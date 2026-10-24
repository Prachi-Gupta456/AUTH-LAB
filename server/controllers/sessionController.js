import asyncHandler from '../utils/asyncHandler.js';
import * as sessionService from '../services/sessionService.js';
import { COOKIE_NAME, clearOptions } from '../config/cookie.js';
import { audit, AUDIT } from "../services/auditService.js"


export const list = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listSessions(req.user.id, req.user.sessionId);
  res.json({ success: true, sessions });
});

export const revokeOne = asyncHandler(async (req, res) => {

  audit(AUDIT.SESSION_REVOKED, {
    userId: req.user.id,
    meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
    data: { target: req.params.id || 'all' },
  });
  
  await sessionService.revokeOne(req.user.id, req.params.id);

  // If the user just killed their OWN current session, clear the cookie too
  if (req.params.id === req.user.sessionId) {
    res.clearCookie(COOKIE_NAME, clearOptions);
  }
  res.json({ success: true, message: 'Session revoked' });
});

export const revokeAll = asyncHandler(async (req, res) => {

  audit(AUDIT.SESSION_REVOKED, {
    userId: req.user.id,
    meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
    data: { target: req.params.id || 'all' },
  });

  const includeCurrent = req.query.includeCurrent === 'true';

  const count = await sessionService.revokeAll(
    req.user.id,
    includeCurrent ? null : req.user.sessionId // keep current unless asked
  );

  if (includeCurrent) res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ success: true, revoked: count });
});
