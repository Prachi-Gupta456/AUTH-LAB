import asyncHandler from '../utils/asyncHandler.js';
import * as mfaService from '../services/mfaService.js';
import * as authService from '../services/authService.js';
import { sendLoginResult } from './authController.js';
// controllers/mfaController.js
import { audit, AUDIT } from '../services/auditService.js';

const getMeta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const status = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await mfaService.getStatus(req.user.id)) });
});

export const setup = asyncHandler(async (req, res) => {
  const data = await mfaService.setup(req.user.id);
  res.json({ success: true, ...data }); // { qrDataUrl, manualKey }
});

export const verifySetup = asyncHandler(async (req, res) => {
  const backupCodes = await mfaService.verifySetup(req.user.id, req.body.code);
  audit(AUDIT.MFA_ENABLED, { userId: req.user.id, meta: getMeta(req) });

  res.json({ success: true, message: 'MFA enabled', backupCodes });
});

export const loginVerify = asyncHandler(async (req, res) => {
  const result = await authService.completeMfaLogin(req.body, getMeta(req));
  sendLoginResult(res, result); // same cookie + JSON as a normal login
});

export const disable = asyncHandler(async (req, res) => {
  await mfaService.disable(req.user.id, req.body);
  audit(AUDIT.MFA_DISABLED, { userId: req.user.id, meta: getMeta(req) });
  res.json({ success: true, message: 'MFA disabled' });
});

export const regenerateBackupCodes = asyncHandler(async (req, res) => {
  const backupCodes = await mfaService.regenerateBackupCodes(req.user.id, req.body.code);
  res.json({ success: true, backupCodes });
});