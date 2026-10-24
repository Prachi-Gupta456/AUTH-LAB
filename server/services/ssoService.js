import crypto from 'node:crypto';
import SsoClient from '../models/SsoClient.js';
import AuthCode from '../models/AuthCode.js';
import SsoConsent from '../models/SsoConsent.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { sha256, safeEqual } from '../utils/hash.js';
import { signSsoToken, verifySsoToken } from '../utils/jwt.js';

const ALLOWED_SCOPES = ['openid', 'profile', 'email'];
const CODE_TTL_MS = 60 * 1000;
const ACCESS_TTL_SECONDS = 15 * 60;
const MAX_CLIENTS_PER_USER = 10;

// ======================= CLIENT MANAGEMENT =======================

export const registerClient = async (userId, { name, redirectUris, confidential }) => {
  if ((await SsoClient.countDocuments({ owner: userId })) >= MAX_CLIENTS_PER_USER) {
    throw new ApiError(400, `You can register at most ${MAX_CLIENTS_PER_USER} clients`, 'SSO_CLIENT_LIMIT');
  }

  const clientId = `cl_${crypto.randomBytes(12).toString('hex')}`;
  // 32 random bytes = unguessable, so plain SHA-256 is enough (same logic as refresh tokens)
  const clientSecret = confidential ? `cs_${crypto.randomBytes(32).toString('base64url')}` : null;

  const client = await SsoClient.create({
    clientId,
    name,
    owner: userId,
    redirectUris,
    confidential,
    secretHash: clientSecret ? sha256(clientSecret) : undefined,
  });

  // clientSecret is returned HERE and never again (only its hash is stored)
  return { client, clientSecret };
};

export const listClients = (userId) => SsoClient.find({ owner: userId }).sort({ createdAt: -1 });

export const deleteClient = async (userId, id) => {
  const client = await SsoClient.findOneAndDelete({ _id: id, owner: userId }); // ownership in the filter (IDOR!)
  if (!client) throw new ApiError(404, 'Client not found');
  await Promise.all([
    AuthCode.deleteMany({ clientId: client.clientId }),
    SsoConsent.deleteMany({ clientId: client.clientId }),
  ]);
};

// ======================= AUTHORIZE =======================

const redirectWith = (redirectUri, params) => {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
};

// An error that should be sent BACK TO THE CLIENT APP as ?error=... (only used once
// client_id and redirect_uri are proven valid)
const redirectError = (redirectUri, state, error, description) =>
  Object.assign(new ApiError(400, description, error), {
    redirectTo: redirectWith(redirectUri, { error, error_description: description, state }),
  });

// Validates the whole authorize request. The order matters:
//   1) client_id + redirect_uri  -> failures are FATAL (shown on our own page, NEVER redirected)
//   2) everything else           -> failures are redirected to the client with ?error=
const parseAuthRequest = async (q) => {
  if (!q.client_id || !q.redirect_uri) {
    throw new ApiError(400, 'client_id and redirect_uri are required', 'SSO_INVALID_REQUEST');
  }

  const client = await SsoClient.findOne({ clientId: q.client_id });
  if (!client) throw new ApiError(400, 'Unknown client', 'SSO_UNKNOWN_CLIENT');

  // EXACT string match. No startsWith, no wildcards, no "same domain" logic.
  if (!client.redirectUris.includes(q.redirect_uri)) {
    throw new ApiError(400, 'redirect_uri is not registered for this client', 'SSO_REDIRECT_URI_MISMATCH');
  }

  const fail = (error, desc) => redirectError(q.redirect_uri, q.state, error, desc);

  if (q.response_type !== 'code') throw fail('unsupported_response_type', 'Only response_type=code is supported');
  if (!q.state) throw fail('invalid_request', 'state is required');
  if (q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.code_challenge || '')) {
    throw fail('invalid_request', 'PKCE is required: send code_challenge (S256)');
  }

  const scopes = [...new Set((q.scope || 'openid').split(' ').filter(Boolean))];
  if (!scopes.includes('openid') || scopes.some((s) => !ALLOWED_SCOPES.includes(s))) {
    throw fail('invalid_scope', 'Scope must include openid and only contain: openid profile email');
  }

  return { client, scopes };
};

// Used by the frontend consent page
export const getAuthorizeInfo = async (userId, q) => {
  const { client, scopes } = await parseAuthRequest(q);

  const consent = await SsoConsent.findOne({ user: userId, clientId: client.clientId });
  const consented = Boolean(consent && scopes.every((s) => consent.scopes.includes(s)));

  return {
    client: { name: client.name, clientId: client.clientId, redirectHost: new URL(q.redirect_uri).host },
    scopes,
    consented,
  };
};

// Allow / Deny. We re-validate EVERYTHING here: the frontend is never trusted.
export const decide = async ({ userId, sessionId }, q, approve) => {
  const { client, scopes } = await parseAuthRequest(q);

  if (!approve) {
    return { redirectTo: redirectWith(q.redirect_uri, { error: 'access_denied', state: q.state }) };
  }

  await SsoConsent.updateOne(
    { user: userId, clientId: client.clientId },
    { $addToSet: { scopes: { $each: scopes } } },
    { upsert: true }
  );

  const rawCode = crypto.randomBytes(32).toString('base64url');
  await AuthCode.create({
    codeHash: sha256(rawCode),
    clientId: client.clientId,
    user: userId,
    session: sessionId, // lets us kill SSO access when this Auth Lab session is revoked
    redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge,
    scopes,
    nonce: q.nonce,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return { redirectTo: redirectWith(q.redirect_uri, { code: rawCode, state: q.state }) };
};

// ======================= TOKEN ENDPOINT =======================

const invalidGrant = (msg = 'Authorization code is invalid, expired or already used') =>
  new ApiError(400, msg, 'invalid_grant');

export const exchangeCode = async (b) => {
  if (b.grant_type !== 'authorization_code') {
    throw new ApiError(400, 'Only grant_type=authorization_code is supported', 'unsupported_grant_type');
  }

  // 1) Authenticate the client app
  const client = await SsoClient.findOne({ clientId: b.client_id }).select('+secretHash');
  if (!client) throw new ApiError(401, 'Client authentication failed', 'invalid_client');
  if (client.confidential) {
    if (!b.client_secret || !safeEqual(sha256(b.client_secret), client.secretHash)) {
      throw new ApiError(401, 'Client authentication failed', 'invalid_client');
    }
  }

  // 2) Consume the code ATOMICALLY: unused + unexpired + issued to THIS client -> mark used.
  //    Two parallel requests with the same code: only one gets a document back.
  const doc = await AuthCode.findOneAndUpdate(
    { codeHash: sha256(b.code), clientId: client.clientId, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { new: true }
  );
  if (!doc) throw invalidGrant();

  // 3) The code is bound to the redirect_uri it was issued for
  if (b.redirect_uri !== doc.redirectUri) throw invalidGrant('redirect_uri does not match');

  // 4) PKCE: hash(verifier) must equal the challenge stored at authorize time
  const computed = crypto.createHash('sha256').update(b.code_verifier).digest('base64url');
  if (!safeEqual(computed, doc.codeChallenge)) throw invalidGrant('PKCE verification failed');

  const user = await User.findById(doc.user);
  if (!user) throw invalidGrant();

  // 5) Tokens
  const scope = doc.scopes.join(' ');
  const access_token = signSsoToken(
    'sso_access',
    { sub: String(user._id), sid: String(doc.session), scope },
    ACCESS_TTL_SECONDS,
    client.clientId
  );

  const idClaims = { sub: String(user._id), nonce: doc.nonce };
  if (doc.scopes.includes('profile')) idClaims.name = user.name;
  if (doc.scopes.includes('email')) {
    idClaims.email = user.email;
    idClaims.email_verified = user.isEmailVerified;
  }
  const id_token = signSsoToken('id_token', idClaims, 10 * 60, client.clientId);

  return { access_token, token_type: 'Bearer', expires_in: ACCESS_TTL_SECONDS, id_token, scope };
};

// ======================= USERINFO =======================

export const getUserInfo = async (accessToken) => {
  const bad = () => new ApiError(401, 'Invalid or expired token', 'invalid_token');

  let payload;
  try {
    payload = verifySsoToken(accessToken, 'sso_access');
  } catch {
    throw bad();
  }

  // The user's Auth Lab session must still be alive (revoke at Auth Lab = access gone everywhere),
  // and the client app must still exist (delete client = its tokens die).
  if (!payload.sid) throw bad();
  const [sessionAlive, clientAlive] = await Promise.all([
    Session.exists({ _id: payload.sid, revokedAt: null }),
    SsoClient.exists({ clientId: payload.aud }),
  ]);
  if (!sessionAlive || !clientAlive) throw bad();

  const user = await User.findById(payload.sub);
  if (!user) throw bad();

  const scopes = payload.scope.split(' ');
  const claims = { sub: String(user._id) };
  if (scopes.includes('profile')) claims.name = user.name;
  if (scopes.includes('email')) {
    claims.email = user.email;
    claims.email_verified = user.isEmailVerified;
  }
  return claims; // only what the user consented to
};