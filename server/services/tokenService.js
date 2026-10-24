import crypto from 'node:crypto';
import RefreshToken from '../models/RefreshToken.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { signAccessToken } from '../utils/jwt.js';
import { sha256 } from '../utils/hash.js';
import * as sessionService from './sessionService.js';

const refreshTtlMs = () => Number(process.env.REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000;

// `sid` ties this access token to a session
export const generateAccessToken = (user, sessionId) =>
  signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: sessionId.toString(),
  });

export const generateRefreshToken = async (userId, sessionId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');

  const doc = await RefreshToken.create({
    user: userId,
    session: sessionId,
    tokenHash: sha256(rawToken), // only the hash goes to DB
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });

  return { rawToken, doc };
};

export const rotateRefreshToken = async (rawToken, meta = {}) => {
  if (!rawToken) throw new ApiError(401, 'Refresh token missing');

  const stored = await RefreshToken.findOne({ tokenHash: sha256(rawToken) });
  if (!stored) throw new ApiError(401, 'Invalid refresh token');

  // 1) Is the session itself alive? (user may have revoked it from another device)
  const session = await Session.findById(stored.session);
  if (!session || session.revokedAt) {
    throw new ApiError(401, 'Session has been revoked', 'SESSION_REVOKED');
  }

  // 2) Reuse detection: an already-rotated token came back => possible theft
  if (stored.revokedAt) {
    await sessionService.revokeById(session._id);
    throw new ApiError(401, 'Token reuse detected. Please login again', 'TOKEN_REUSE');
  }

  if (stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token expired');
  }

  const user = await User.findById(stored.user);
  if (!user) throw new ApiError(401, 'User no longer exists');

  // 3) Rotate: new token in the SAME session, old one revoked
  const { rawToken: newRaw, doc: newDoc } = await generateRefreshToken(user._id, session._id);
  stored.revokedAt = new Date();
  stored.replacedBy = newDoc._id;
  await stored.save();

  // 4) Device is alive: update lastActiveAt, extend expiry
  await sessionService.touchSession(session._id, meta);

  return {
    accessToken: generateAccessToken(user, session._id),
    refreshToken: newRaw,
    user,
  };
};

// Logout = kill the whole session this token belongs to
export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return;
  const stored = await RefreshToken.findOne({ tokenHash: sha256(rawToken) });
  if (stored) await sessionService.revokeById(stored.session);
};