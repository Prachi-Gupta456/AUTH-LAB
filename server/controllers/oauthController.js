import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import * as oauthService from '../services/oauthService.js';
import * as authService from '../services/authService.js';
import { COOKIE_NAME, cookieOptions } from '../config/cookie.js';

const STATE_COOKIE = 'oauth_state';
const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // the callback is a top-level GET from Google, so Lax cookies ARE sent
  path: '/auth/oauth',
  maxAge: 10 * 60 * 1000,
};

const getMeta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

// Browser navigation, so errors become redirects to the login page, not JSON
const fail = (res, code) =>
  res.redirect(`${process.env.CLIENT_URL}/login?oauth_error=${encodeURIComponent(code)}`);

// GET /auth/oauth/:provider
export const start = asyncHandler(async (req, res) => {
  let request;
  try {
    request = oauthService.buildAuthRequest(req.params.provider);
  } catch (err) {
    return fail(res, err.code || 'OAUTH_FAILED');
  }
  res.cookie(STATE_COOKIE, `${request.state}.${request.verifier}`, stateCookieOptions);
  res.redirect(request.url);
});

// GET /auth/oauth/:provider/callback
export const callback = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { code, state, error } = req.query;

  // The state cookie is single-use: read it, then delete it right away
  const stored = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: '/auth/oauth' });

  if (error) return fail(res, error); // e.g. user clicked "Cancel" => access_denied

  const [savedState, verifier] = (stored || '').split('.');
  if (!code || !state || !savedState || state !== savedState) {
    return fail(res, 'OAUTH_STATE_INVALID');
  }

  try {
    const profile = await oauthService.fetchProfile(provider, String(code), verifier);
    const user = await oauthService.findOrCreateUser(provider, profile);

    // The SAME gate as password / OTP login: MFA users still get the 2nd step
    const result = await authService.startSession(user, getMeta(req));

    if (result.mfaRequired) {
      // Fragment (#), not query (?): fragments never reach servers, logs or Referer headers
      return res.redirect(
        `${process.env.CLIENT_URL}/oauth/callback#mfaToken=${encodeURIComponent(result.mfaToken)}`
      );
    }

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.redirect(`${process.env.CLIENT_URL}/oauth/callback`);
  } catch (err) {
    if (!(err instanceof ApiError)) console.error('OAuth error:', err);
    fail(res, err.code || 'OAUTH_FAILED');
  }
});