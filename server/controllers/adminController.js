import asyncHandler from '../utils/asyncHandler.js';
import * as adminService from '../services/adminService.js';

const metaOf = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

export const listUsers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await adminService.listUsers(req.valid.query)) });
});

export const unlock = asyncHandler(async (req, res) => {
  await adminService.unlockUser(req.user, req.params.id, metaOf(req));
  res.json({ success: true, message: 'Account unlocked' });
});

export const revokeSessions = asyncHandler(async (req, res) => {
  const revoked = await adminService.revokeUserSessions(req.user, req.params.id, metaOf(req));
  res.json({ success: true, revoked });
});

export const setRole = asyncHandler(async (req, res) => {
  await adminService.setRole(req.user, req.params.id, req.body.role, metaOf(req));
  res.json({ success: true, message: 'Role updated' });
});

export const auditLog = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await adminService.listAudit(req.valid.query)) });
});