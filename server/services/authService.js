import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import * as tokenService from './tokenService.js';
import * as sessionService from './sessionService.js';
import { OTP_PURPOSES } from '../models/Otp.js';
import * as otpService from './otpService.js';
import * as mailService from './mailService.js';
import * as smsService from './smsService.js';

import { signMfaToken, verifyMfaToken } from '../utils/jwt.js';
import * as mfaService from './mfaService.js';

import { audit, AUDIT } from './auditService.js';
import { checkAndRecordDevice } from './deviceService.js';
import { sendSecurityAlert } from './mailService.js';
import { shortHash } from '../utils/hash.js';


const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

// A fake hash so bcrypt runs even when the user doesn't exist (timing attack defense)
// Generate yours with: bcrypt.hashSync('dummy', 12)
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Ukq6LgWXLw6rVvK9o8cE1YlqY0f5sK';


// Creates the session + tokens. Only call this once the user is FULLY authenticated.
export const issueSession = async (user, meta) => {
  const session = await sessionService.createSession(user._id, meta);
  const accessToken = tokenService.generateAccessToken(user, session._id);
  const { rawToken: refreshToken } = await tokenService.generateRefreshToken(user._id, session._id);
  
   // Side effects: must never delay or fail the login
  afterLogin(user, meta).catch((err) => console.error('afterLogin failed:', err.message));

  return { user, accessToken, refreshToken };
};

const afterLogin = async (user, meta) => {
  audit(AUDIT.LOGIN_SUCCESS, { userId: user._id, meta });

  const { isNew, device } = await checkAndRecordDevice(user, meta);
  if (!isNew) return;

  audit(AUDIT.NEW_DEVICE, { userId: user._id, meta, data: device });
  await sendSecurityAlert({
    to: user.email,
    subject: 'New sign-in to your account',
    lines: [
      `We noticed a sign-in from a new device: ${device.browser} on ${device.os}.`,
      `IP address: ${meta.ip}`,
      `Time: ${new Date().toUTCString()}`,
      'If this was you, no action is needed.',
      'If not, reset your password and log out of all devices from your dashboard immediately.',
    ],
  });
};


// Every first-factor login (password / email OTP / phone OTP) ends here.
// If the user has MFA on, we DON'T issue tokens yet, only a short-lived mfaToken.
export const startSession = async (user, meta) => {
  if (user.mfa?.enabled) {
    return { mfaRequired: true, mfaToken: signMfaToken(user._id) };
  }
  return issueSession(user, meta);
};


export const register = async ({ name, email, password }) => {
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already registered');

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash });

  // fire-and-forget: registration must not fail just because Gmail is slow/down
  sendOtpEmail(email, OTP_PURPOSES.EMAIL_VERIFY).catch((err) =>
    console.error('Verify email failed:', err.message)
  );
  return user;
};


const registerLoginFailure = async (user, meta) => {
  // Atomic increment: parallel guesses can't dodge the counter
  const updated = await User.findByIdAndUpdate(user._id, { $inc: { loginAttempts: 1 } }, { new: true });
  if (updated.loginAttempts < MAX_FAILED_LOGINS) return;

  // Conditional update: only ONE of several parallel requests gets modifiedCount 1,
  // so the owner receives one email, not five
  const { modifiedCount } = await User.updateOne(
    { _id: user._id, loginAttempts: { $gte: MAX_FAILED_LOGINS } },
    { $set: { lockedUntil: new Date(Date.now() + LOCK_MS), loginAttempts: 0 } }
  );
  if (modifiedCount !== 1) return;

  audit(AUDIT.ACCOUNT_LOCKED, { userId: user._id, meta });
  sendSecurityAlert({
    to: user.email,
    subject: 'Your account was temporarily locked',
    lines: [
      'There were too many failed password attempts on your account.',
      'Password login is paused for 15 minutes. You can still sign in with an email or phone OTP.',
      `Last attempt from IP: ${meta.ip}`,
    ],
  }).catch((err) => console.error('Lock mail failed:', err.message));
};


export const login = async ({ email, password }, meta) => {
  const user = await User.findOne({ email }).select('+passwordHash');

  // bcrypt ALWAYS runs (dummy hash if no user): equal timing, no enumeration
  const isValid = await comparePassword(password, user?.passwordHash || DUMMY_HASH);
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());

  if (!user || !user.passwordHash || !isValid || locked) {
    audit(AUDIT.LOGIN_FAILED, {
      userId: user?._id,
      meta,
      // hash of the typed email, never the raw text (people paste passwords into email fields)
      data: { identifier: shortHash(email), reason: locked ? 'locked' : 'bad_credentials' },
    });
    // Count the failure only for real, unlocked, password-having accounts
    if (user && user.passwordHash && !locked) await registerLoginFailure(user, meta);

    // Same message for: unknown email, wrong password AND locked account
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.loginAttempts > 0 || user.lockedUntil) {
    await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 0 }, $unset: { lockedUntil: 1 } });
  }

  return startSession(user, meta);
};

export const refresh = (rawToken, meta) => tokenService.rotateRefreshToken(rawToken, meta);
export const logout = (rawToken) => tokenService.revokeRefreshToken(rawToken);

export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return user;
};

// ---------- Phone OTP ----------

const sendSmsOtp = async (phone, purpose) => {
  const otp = await otpService.issueOtp(phone, purpose);
  if (!otp) return; // cooldown or race: nothing to send
  await smsService.sendOtpSms({ to: phone, otp });
};

// --- Link a phone to the logged-in account ---

export const requestPhoneLinkOtp = async (userId, phone) => {
  // The caller is authenticated, so telling them "taken" leaks little and gives
  // much better UX than silently never sending an SMS.
  const taken = await User.exists({ phone, _id: { $ne: userId } });
  if (taken) throw new ApiError(409, 'This phone number is linked to another account', 'PHONE_IN_USE');

  // Fire-and-forget, same reasoning as email OTP
  sendSmsOtp(phone, OTP_PURPOSES.PHONE_VERIFY).catch((err) =>
    console.error('SMS failed:', err.message)
  );
};

export const verifyPhoneLinkOtp = async (userId, { phone, otp }) => {
  await otpService.verifyOtp(phone, OTP_PURPOSES.PHONE_VERIFY, otp);

  try {
    const user = await User.findByIdAndUpdate(userId, { phone }, { new: true });
    if (!user) throw new ApiError(404, 'User not found');
    return user;
  } catch (err) {
    // Someone else verified the same number between our check and now (race).
    // Catch it here: the global errorHandler maps 11000 to "Email already registered".
    if (err.code === 11000) {
      throw new ApiError(409, 'This phone number is linked to another account', 'PHONE_IN_USE');
    }
    throw err;
  }
};

// --- Login with phone ---

export const requestPhoneLoginOtp = async (phone) => {
  const user = await User.exists({ phone });
  if (!user) return; // unknown number: do nothing, controller returns the same message

  sendSmsOtp(phone, OTP_PURPOSES.PHONE_LOGIN).catch((err) =>
    console.error('SMS failed:', err.message)
  );
};


// Issue an OTP and email it. Never throws to the caller's response path (see below).
const sendOtpEmail = async (email, purpose) => {
  const otp = await otpService.issueOtp(email, purpose);
  if (!otp) return; // cooldown or race: nothing to send

  // Dev helper: remove before production! OTPs must never be logged in prod.
  if (process.env.NODE_ENV !== 'production') console.log(`[DEV] ${purpose} OTP for ${email}: ${otp}`);

  await mailService.sendOtpMail({ to: email, otp, purpose });
};

// Used by send-otp and forgot-password
export const requestEmailOtp = async (email, purpose) => {
  const user = await User.findOne({ email }).select('isEmailVerified');
  if (!user) return; // unknown email: do nothing, controller still returns the same success message
  if (purpose === OTP_PURPOSES.EMAIL_VERIFY && user.isEmailVerified) return;

  // NOT awaited on purpose: SMTP takes ~1-2s. If we waited, "registered" emails would
  // respond slower than "unknown" ones, and attackers could measure that difference.
  sendOtpEmail(email, purpose).catch((err) => console.error('OTP email failed:', err.message));
};

export const forgotPassword = (email) => requestEmailOtp(email, OTP_PURPOSES.PASSWORD_RESET);

export const verifyEmailOtp = async ({ email, otp, purpose }, meta) => {
  await otpService.verifyOtp(email, purpose, otp);

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID'); // account deleted meanwhile

  // Opening the inbox and reading the OTP proves the user owns this email
  if (!user.isEmailVerified) {
    user.isEmailVerified = true;
    await user.save();
  }

  if (purpose === OTP_PURPOSES.EMAIL_VERIFY) return { user };

  // purpose === LOGIN: same as password login from here (new session + tokens)
    if (purpose === OTP_PURPOSES.EMAIL_VERIFY) return { user };
  return startSession(user, meta); // purpose === LOGIN
};

export const resetPassword = async ({ email, otp, newPassword }, meta) => {
  await otpService.verifyOtp(email, OTP_PURPOSES.PASSWORD_RESET, otp);

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID');

  user.passwordHash = await hashPassword(newPassword);
  user.isEmailVerified = true;
  user.loginAttempts = 0;
  user.lockedUntil = undefined; // the owner proved inbox access, so the lock is lifted
  await user.save();

  await sessionService.revokeAll(user._id);

  audit(AUDIT.PASSWORD_RESET, { userId: user._id, meta });
  sendSecurityAlert({
    to: user.email,
    subject: 'Your password was changed',
    lines: ['Your password was just reset and all devices were logged out.', 'If this was not you, contact support immediately.'],
  }).catch((err) => console.error('Password mail failed:', err.message));
};


export const verifyPhoneLoginOtp = async ({ phone, otp }, meta) => {
  await otpService.verifyOtp(phone, OTP_PURPOSES.PHONE_LOGIN, otp);

  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID');

  return startSession(user, meta);
};

// Step 2 of login for MFA users
export const completeMfaLogin = async ({ mfaToken, code }, meta) => {
  let payload;
  try {
    payload = verifyMfaToken(mfaToken);
  } catch {
    throw new ApiError(401, 'MFA session expired. Please login again', 'MFA_TOKEN_INVALID');
  }

  const user = await mfaService.verifyUserFactor(payload.sub, code);
  return issueSession(user, meta);
};