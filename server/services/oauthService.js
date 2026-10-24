import crypto from 'node:crypto';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword } from '../utils/hash.js';
import { providers, callbackUrl } from '../config/oauth.js';
import * as sessionService from './sessionService.js';

const b64url = (buf) => buf.toString('base64url');

export const getProvider = (name) => {
  // hasOwn: so "constructor" or "__proto__" can't be used as a provider name
  if (!Object.hasOwn(providers, name) || !providers[name].clientId) {
    throw new ApiError(404, 'Unknown or unconfigured OAuth provider', 'OAUTH_PROVIDER_UNKNOWN');
  }
  return providers[name];
};

// ---------- step 1: build the URL we redirect the browser to ----------

export const buildAuthRequest = (name) => {
  const p = getProvider(name);
  const state = b64url(crypto.randomBytes(24)); // CSRF protection
  const verifier = b64url(crypto.randomBytes(32)); // PKCE secret, never leaves our server/cookie

  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: callbackUrl(name),
    response_type: 'code',
    scope: p.scope,
    state,
  });

  if (p.pkce) {
    params.set('code_challenge', b64url(crypto.createHash('sha256').update(verifier).digest()));
    params.set('code_challenge_method', 'S256');
  }
  if (name === 'google') params.set('prompt', 'select_account'); // always show the account chooser

  return { url: `${p.authUrl}?${params}`, state, verifier };
};

// ---------- step 5: trade the one-time code for an access token ----------

const exchangeCode = async (name, code, verifier) => {
  const p = getProvider(name);
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code,
    redirect_uri: callbackUrl(name),
    grant_type: 'authorization_code',
  });
  if (p.pkce) body.set('code_verifier', verifier);

  const res = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));

  // GitHub returns 200 even on failure, with an "error" field, so check the token itself
  if (!res.ok || !data.access_token) {
    throw new ApiError(400, 'Could not complete sign-in with the provider', 'OAUTH_EXCHANGE_FAILED');
  }
  return data.access_token;
};

// ---------- step 6: profile, normalized to ONE shape ----------
// { providerId, email, emailVerified, name }

const getJson = async (url, token) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'auth-lab', // GitHub's API rejects requests without a User-Agent
    },
  });
  if (!res.ok) throw new ApiError(400, 'Could not read your profile', 'OAUTH_PROFILE_FAILED');
  return res.json();
};

const profileFetchers = {
  google: async (token) => {
    const u = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
    return {
      providerId: String(u.sub),
      email: u.email?.toLowerCase(),
      emailVerified: u.email_verified === true,
      name: u.name,
    };
  },

  github: async (token) => {
    const u = await getJson('https://api.github.com/user', token);
    // /user can show a PUBLIC email that is not verified, so read the emails list instead
    const emails = await getJson('https://api.github.com/user/emails', token);
    const primary = emails.find((e) => e.primary && e.verified);
    return {
      providerId: String(u.id), // numeric in GitHub's API, we store strings
      email: primary?.email.toLowerCase(),
      emailVerified: Boolean(primary),
      name: u.name || u.login,
    };
  },
};

export const fetchProfile = async (name, code, verifier) => {
  const token = await exchangeCode(name, code, verifier);
  return profileFetchers[name](token);
};

// ---------- step 7: find / link / create the user ----------

export const findOrCreateUser = async (provider, profile) => {
  // 1) Returning user: matched by the provider's stable id (never by email)
  const linked = await User.findOne({
    providers: { $elemMatch: { provider, providerId: profile.providerId } },
  });
  if (linked) return linked;

  // 2) First time with this provider: we need a VERIFIED email to link or create anything
  if (!profile.email || !profile.emailVerified) {
    throw new ApiError(400, 'Your provider account has no verified email', 'OAUTH_EMAIL_UNVERIFIED');
  }

  const link = { provider, providerId: profile.providerId, email: profile.email };

  try {
    // 3) Same email already registered here: link this provider to that account
    const existing = await User.findOne({ email: profile.email });
    if (existing) {
      existing.providers.push(link);

      if (!existing.isEmailVerified) {
        // Pre-hijacking defense: someone may have registered this email BEFORE the real
        // owner and knows the password. Kill that password and every session they hold.
        existing.passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
        existing.isEmailVerified = true;
        await existing.save();
        await sessionService.revokeAll(existing._id);
      } else {
        await existing.save();
      }
      return existing;
    }

    // 4) Brand new user, no password
    return await User.create({
      name: profile.name || profile.email.split('@')[0],
      email: profile.email,
      isEmailVerified: true, // the provider already verified it
      providers: [link],
    });
  } catch (err) {
    // Parallel callbacks raced on a unique index. The global handler would say "Email already
    // registered", which is misleading here, so we map it ourselves.
    if (err.code === 11000) {
      throw new ApiError(409, 'Account conflict. Please try again', 'OAUTH_CONFLICT');
    }
    throw err;
  }
};