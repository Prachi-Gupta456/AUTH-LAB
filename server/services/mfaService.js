import crypto from 'node:crypto';
import otplib from 'otplib'; // otplib v12 is CommonJS, so take the named export off the default
import QRCode from 'qrcode';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { comparePassword } from '../utils/hash.js';

const { authenticator } = otplib;

const STEP_SECONDS = 30;
const BACKUP_CODE_COUNT = 10;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

// window: 1 = accept the previous, current and next 30s code (tolerates clock drift)
authenticator.options = { step: STEP_SECONDS, window: 1 };

// ---------- helpers ----------

// Returns the matched time-step number, or null if the code is wrong.
// checkDelta gives -1, 0 or +1 (how many steps the phone clock is off).
const matchStep = (code, secret) => {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
};

// Backup codes are HMAC-hashed with a server secret (same idea as OTP hashing)
const hashBackupCode = (code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET).update(code).digest('hex');

const generateBackupCodes = () => {
  const raw = Array.from({ length: BACKUP_CODE_COUNT }, () => crypto.randomBytes(5).toString('hex'));
  return {
    // shown to the user ONCE, formatted like "a1b2c-3d4e5"
    display: raw.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`),
    // stored in DB: only hashes
    stored: raw.map((c) => ({ hash: hashBackupCode(c), usedAt: null })),
  };
};

// Checks a TOTP code OR a backup code. Returns true/false, never throws on a bad code.
const checkCode = async (user, code) => {
  // ----- 6 digits => TOTP -----
  if (/^\d{6}$/.test(code)) {
    const step = matchStep(code, decrypt(user.mfa.secretEnc));
    if (step === null) return false;

    // Replay protection: a code can only be used if its step is NEWER than the last used one.
    // The check + update is ONE atomic query, so two parallel requests can't both win.
    const { modifiedCount } = await User.updateOne(
      { _id: user._id, 'mfa.lastUsedStep': { $not: { $gte: step } } },
      { $set: { 'mfa.lastUsedStep': step } }
    );
    return modifiedCount === 1;
  }

  // ----- otherwise => backup code -----
  const normalized = code.replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{10}$/.test(normalized)) return false;

  // Find an UNUSED matching code and mark it used, atomically (single use)
  const { modifiedCount } = await User.updateOne(
    { _id: user._id, 'mfa.backupCodes': { $elemMatch: { hash: hashBackupCode(normalized), usedAt: null } } },
    { $set: { 'mfa.backupCodes.$.usedAt': new Date() } }
  );
  return modifiedCount === 1;
};

const registerFailure = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { 'mfa.failedAttempts': 1 } },
    { new: true }
  );
  if (user.mfa.failedAttempts >= MAX_FAILED) {
    await User.updateOne(
      { _id: userId },
      { $set: { 'mfa.lockedUntil': new Date(Date.now() + LOCK_MS), 'mfa.failedAttempts': 0 } }
    );
  }
};

// ---------- the one function every "prove you have the 2nd factor" flow uses ----------

// Used by login-verify, disable and regenerate-backup-codes.
// Handles: lockout, TOTP / backup code check, failure counting.
export const verifyUserFactor = async (userId, code) => {
  const user = await User.findById(userId).select('+mfa.secretEnc');
  if (!user || !user.mfa.enabled) throw new ApiError(400, 'MFA is not enabled', 'MFA_NOT_ENABLED');

  if (user.mfa.lockedUntil && user.mfa.lockedUntil > new Date()) {
    throw new ApiError(429, 'Too many wrong codes. Try again in a few minutes', 'MFA_LOCKED');
  }

  const ok = await checkCode(user, code);
  if (!ok) {
    await registerFailure(user._id);
    throw new ApiError(401, 'Invalid code', 'MFA_CODE_INVALID');
  }

  // success: reset the failure counter and any lock
  await User.updateOne(
    { _id: user._id },
    { $set: { 'mfa.failedAttempts': 0 }, $unset: { 'mfa.lockedUntil': 1 } }
  );
  return user;
};

// ---------- public API used by controllers ----------

export const getStatus = async (userId) => {
  const user = await User.findById(userId).select('+mfa.backupCodes');
  return {
    enabled: user.mfa.enabled,
    backupCodesRemaining: user.mfa.enabled
      ? user.mfa.backupCodes.filter((c) => !c.usedAt).length
      : 0,
  };
};

export const setup = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.mfa.enabled) throw new ApiError(409, 'MFA is already enabled', 'MFA_ALREADY_ENABLED');

  const secret = authenticator.generateSecret(); // random base32 string
  // Stored as "pending": MFA stays OFF until the user proves the app works
  await User.updateOne({ _id: userId }, { $set: { 'mfa.pendingSecretEnc': encrypt(secret) } });

  const otpauthUrl = authenticator.keyuri(user.email, process.env.MFA_ISSUER || 'Auth Lab', secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl); // "data:image/png;base64,..." for <img src>

  // manualKey: for users who can't scan (typing it into the app by hand)
  return { qrDataUrl, manualKey: secret };
};

export const verifySetup = async (userId, code) => {
  const user = await User.findById(userId).select('+mfa.pendingSecretEnc');
  if (!user) throw new ApiError(404, 'User not found');
  if (user.mfa.enabled) throw new ApiError(409, 'MFA is already enabled', 'MFA_ALREADY_ENABLED');
  if (!user.mfa.pendingSecretEnc) {
    throw new ApiError(400, 'Start the setup first', 'MFA_SETUP_REQUIRED');
  }

  if (!/^\d{6}$/.test(code)) throw new ApiError(400, 'Enter the 6-digit code', 'MFA_CODE_INVALID');

  const step = matchStep(code, decrypt(user.mfa.pendingSecretEnc));
  if (step === null) throw new ApiError(400, 'Invalid code', 'MFA_CODE_INVALID');

  const backup = generateBackupCodes();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'mfa.enabled': true,
        'mfa.secretEnc': user.mfa.pendingSecretEnc, // pending becomes active
        'mfa.backupCodes': backup.stored,
        'mfa.lastUsedStep': step, // this code can't be replayed right after setup
        'mfa.failedAttempts': 0,
      },
      $unset: { 'mfa.pendingSecretEnc': 1 },
    }
  );

  return backup.display; // the ONLY time the user ever sees these
};

export const disable = async (userId, { password, code }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found');

  // replace the password check with:
  if (user.passwordHash) {
    if (!(await comparePassword(password ?? '', user.passwordHash))) {
      throw new ApiError(401, 'Incorrect password', 'INVALID_PASSWORD');
    }
  }

  await verifyUserFactor(userId, code); // also needs a valid TOTP/backup code

  await User.updateOne(
    { _id: userId },
    {
      $set: { 'mfa.enabled': false, 'mfa.failedAttempts': 0 },
      $unset: {
        'mfa.secretEnc': 1,
        'mfa.pendingSecretEnc': 1,
        'mfa.backupCodes': 1,
        'mfa.lockedUntil': 1,
        'mfa.lastUsedStep': 1,
      },
    }
  );
};

export const regenerateBackupCodes = async (userId, code) => {
  await verifyUserFactor(userId, code);

  const backup = generateBackupCodes();
  await User.updateOne({ _id: userId }, { $set: { 'mfa.backupCodes': backup.stored } }); // old ones die
  return backup.display;
};