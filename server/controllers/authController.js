import asyncHandler from '../utils/asyncHandler.js';
import * as authService from '../services/authService.js';
import { COOKIE_NAME, cookieOptions, clearOptions } from '../config/cookie.js';
import AuditLog from '../models/AuditLog.js';

// Same message for every case: never reveal whether the email exists
const GENERIC_OTP_MESSAGE = 'If an account exists for this email, an OTP has been sent.';


// One place to turn a login result into an HTTP response
export const sendLoginResult = (res, result) => {
  if (result.mfaRequired) {
    // No cookie, no access token. Just tell the client to ask for the 2nd factor.
    return res.json({ success: true, mfaRequired: true, mfaToken: result.mfaToken });
  }
  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.json({ success: true, user: result.user, accessToken: result.accessToken });
};

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, getMeta(req));
  sendLoginResult(res, result);
});

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ success: true, user });
});


export const verifyEmailOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmailOtp(req.body, getMeta(req));

  // purpose=login returns tokens (or an mfaToken), purpose=email_verify doesn't
  if (result.refreshToken || result.mfaRequired) return sendLoginResult(res, result);
  res.json({ success: true, message: 'Email verified', user: result.user });
});

export const verifyPhoneLoginOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyPhoneLoginOtp(req.body, getMeta(req));
  sendLoginResult(res, result);
});


export const sendEmailOtp = asyncHandler(async (req, res) => {
  await authService.requestEmailOtp(req.body.email, req.body.purpose);
  res.json({ success: true, message: GENERIC_OTP_MESSAGE });
});



export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.json({ success: true, message: GENERIC_OTP_MESSAGE });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  res.clearCookie(COOKIE_NAME, clearOptions); // this browser is logged out too
  res.json({ success: true, message: 'Password updated. Please login again.' });
});


const getMeta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });


export const refresh = asyncHandler(async (req, res) => {
  try {
    const { accessToken, refreshToken, user } = await authService.refresh(
      req.cookies[COOKIE_NAME],
      getMeta(req)
    );
    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);
    res.json({ success: true, user, accessToken });
  } catch (err) {
    res.clearCookie(COOKIE_NAME, clearOptions); // dead cookie, remove it
    throw err;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ success: true, message: 'Logged out' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ success: true, user });
});

const GENERIC_SMS_MESSAGE = 'If this number is registered, an SMS has been sent.';

export const sendPhoneLinkOtp = asyncHandler(async (req, res) => {
  await authService.requestPhoneLinkOtp(req.user.id, req.body.phone);
  res.json({ success: true, message: 'An SMS has been sent to this number.' });
});

export const verifyPhoneLinkOtp = asyncHandler(async (req, res) => {
  const user = await authService.verifyPhoneLinkOtp(req.user.id, req.body);
  res.json({ success: true, message: 'Phone number linked', user });
});

export const sendPhoneLoginOtp = asyncHandler(async (req, res) => {
  await authService.requestPhoneLoginOtp(req.body.phone);
  res.json({ success: true, message: GENERIC_SMS_MESSAGE });
});



export const activity = asyncHandler(async (req, res) => {
  const items = await AuditLog.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('event ip userAgent createdAt -_id')
    .lean();
  res.json({ success: true, items });
});