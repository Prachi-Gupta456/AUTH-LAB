import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import ApiError from '../utils/ApiError.js';
import * as sessionService from './sessionService.js';
import { audit, AUDIT } from './auditService.js';
import { ROLES } from '../config/roles.js';

// Search text becomes a regex: escape it, or "(a+)+$" style input could hang the DB (ReDoS)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Moderators can manage normal users, but never admins
const assertCanManage = (actor, target) => {
  if (target.role === ROLES.ADMIN && actor.role !== ROLES.ADMIN) {
    throw new ApiError(403, 'Only an admin can manage an admin', 'FORBIDDEN');
  }
};

const getTarget = async (id) => {
  const target = await User.findById(id).select('role');
  if (!target) throw new ApiError(404, 'User not found');
  return target;
};

export const listUsers = async ({ page, limit, q }) => {
  const filter = q
    ? { $or: [{ email: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] }
    : {};

  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // Explicit allow-list: an admin API still must not leak hashes or MFA secrets
  const users = rows.map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    isEmailVerified: u.isEmailVerified,
    mfaEnabled: Boolean(u.mfa?.enabled),
    providers: (u.providers || []).map((p) => p.provider),
    locked: Boolean(u.lockedUntil && u.lockedUntil > new Date()),
    createdAt: u.createdAt,
  }));

  return { users, total, page, pages: Math.ceil(total / limit) };
};

export const unlockUser = async (actor, targetId, meta) => {
  assertCanManage(actor, await getTarget(targetId));
  await User.updateOne({ _id: targetId }, { $set: { loginAttempts: 0 }, $unset: { lockedUntil: 1 } });
  audit(AUDIT.ACCOUNT_UNLOCKED, { userId: targetId, meta, data: { by: actor.id } });
};

export const revokeUserSessions = async (actor, targetId, meta) => {
  assertCanManage(actor, await getTarget(targetId));
  const count = await sessionService.revokeAll(targetId);
  audit(AUDIT.ADMIN_REVOKED_SESSIONS, { userId: targetId, meta, data: { by: actor.id, count } });
  return count;
};

export const setRole = async (actor, targetId, role, meta) => {
  // Admins can't touch their own role. With "only admins change roles" this GUARANTEES
  // at least one admin always exists (nobody can demote the last one).
  if (String(actor.id) === String(targetId)) {
    throw new ApiError(400, 'You cannot change your own role', 'SELF_ROLE_CHANGE');
  }

  // new:false returns the document as it was BEFORE the update (so we know the old role)
  const before = await User.findOneAndUpdate({ _id: targetId }, { role }, { new: false }).select('role');
  if (!before) throw new ApiError(404, 'User not found');

  audit(AUDIT.ROLE_CHANGED, { userId: targetId, meta, data: { by: actor.id, from: before.role, to: role } });
};

export const listAudit = async ({ page, limit, userId, event }) => {
  const filter = {};
  if (userId) filter.user = userId;
  if (event) filter.event = event;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'email name')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
};