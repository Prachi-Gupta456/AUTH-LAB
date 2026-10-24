import Session from '../models/Session.js';
import RefreshToken from '../models/RefreshToken.js';
import ApiError from '../utils/ApiError.js';
import { parseDevice } from '../utils/device.js';

const ttlMs = () => Number(process.env.REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000;

// Called once on every successful login
export const createSession = (userId, meta = {}) =>
  Session.create({
    user: userId,
    userAgent: meta.userAgent,
    ip: meta.ip,
    device: parseDevice(meta.userAgent),
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + ttlMs()),
  });

// Called on every refresh rotation: "this device is still alive"
export const touchSession = (sessionId, meta = {}) =>
  Session.updateOne(
    { _id: sessionId },
    {
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + ttlMs()),
      ...(meta.ip && { ip: meta.ip }),
    }
  );

export const listSessions = async (userId, currentSessionId) => {
  const sessions = await Session.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastActiveAt: -1 })
    .lean();

  // Return only what the UI needs (never leak userAgent/internal fields blindly)
  return sessions.map((s) => ({
    id: s._id,
    device: s.device,
    ip: s.ip,
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
    isCurrent: String(s._id) === String(currentSessionId),
  }));
};

// Core helper: revoke every session matching the filter + kill their refresh tokens
const revokeSessions = async (filter) => {
  const sessions = await Session.find({ ...filter, revokedAt: null }).select('_id');
  if (sessions.length === 0) return 0;

  const ids = sessions.map((s) => s._id);
  const now = new Date();

  await Session.updateMany({ _id: { $in: ids } }, { revokedAt: now });
  await RefreshToken.updateMany(
    { session: { $in: ids }, revokedAt: null },
    { revokedAt: now }
  );
  return ids.length;
};

// User revokes ONE of their own sessions.
// `user: userId` in the filter = ownership check. Without it, anyone could
// kill anyone's session by guessing an id (IDOR vulnerability!)
export const revokeOne = async (userId, sessionId) => {
  const count = await revokeSessions({ _id: sessionId, user: userId });
  if (count === 0) throw new ApiError(404, 'Session not found');
};

// "Logout from other devices" (exceptSessionId = current) or everything (null)
export const revokeAll = (userId, exceptSessionId = null) =>
  revokeSessions({
    user: userId,
    ...(exceptSessionId && { _id: { $ne: exceptSessionId } }),
  });

// Internal use: logout + reuse detection (no ownership check, we already trust the caller)
export const revokeById = (sessionId) => revokeSessions({ _id: sessionId });