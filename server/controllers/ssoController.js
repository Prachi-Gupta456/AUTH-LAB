import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import * as ssoService from '../services/ssoService.js';

// ---- client management ----
export const createClient = asyncHandler(async (req, res) => {
  const { client, clientSecret } = await ssoService.registerClient(req.user.id, req.body);
  res.status(201).json({ success: true, client, clientSecret }); // secret: shown ONCE
});

export const listClients = asyncHandler(async (req, res) => {
  res.json({ success: true, clients: await ssoService.listClients(req.user.id) });
});

export const deleteClient = asyncHandler(async (req, res) => {
  await ssoService.deleteClient(req.user.id, req.params.id);
  res.json({ success: true, message: 'Client deleted' });
});

// ---- authorize ----
// A "redirectable" error is not a failure for OUR API: the frontend must send the user
// back to the client app with ?error=..., so we answer 200 + redirectTo.
const withRedirectErrors = (fn) =>
  asyncHandler(async (req, res) => {
    try {
      res.json({ success: true, ...(await fn(req)) });
    } catch (err) {
      if (err.redirectTo) return res.json({ success: true, redirectTo: err.redirectTo });
      throw err;
    }
  });

export const validateAuthorize = withRedirectErrors((req) =>
  ssoService.getAuthorizeInfo(req.user.id, req.query)
);

export const decision = withRedirectErrors((req) =>
  ssoService.decide(
    { userId: req.user.id, sessionId: req.user.sessionId },
    req.body,
    req.body.approve
  )
);

// ---- token + userinfo ----
export const token = asyncHandler(async (req, res) => {
  const tokens = await ssoService.exchangeCode(req.body);
  // Required by the OAuth spec: tokens must never be cached
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
  res.json(tokens);
});

export const userinfo = asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Bearer token missing', 'invalid_token');
  res.json(await ssoService.getUserInfo(header.split(' ')[1]));
});