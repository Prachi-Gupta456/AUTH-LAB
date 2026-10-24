import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import * as qrService from '../services/qrLoginService.js';
import { COOKIE_NAME, cookieOptions } from '../config/cookie.js';

const getMeta = (req) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const generate = asyncHandler(async (req, res) => {
  const data = await qrService.createQr(getMeta(req));
  res.status(201).json({ success: true, ...data });
});

export const status = asyncHandler(async (req, res) => {
  const pollSecret = req.get('x-qr-secret');
  if (!pollSecret) throw new ApiError(400, 'Missing x-qr-secret header', 'QR_SECRET_MISSING');

  const result = await qrService.getStatus(req.params.id, pollSecret, getMeta(req));

  if (result.status === 'approved') {
    // Same shape as any other login: refresh cookie + access token in JSON
    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    return res.json({ success: true, status: 'approved', user: result.user, accessToken: result.accessToken });
  }
  res.json({ success: true, status: result.status });
});

export const scan = asyncHandler(async (req, res) => {
  const request = await qrService.scan(req.user.id, req.body.id, req.body.secret);
  res.json({ success: true, request });
});

export const approve = asyncHandler(async (req, res) => {
  await qrService.approve(req.user.id, req.body.id, req.body.secret);
  res.json({ success: true, message: 'Login approved' });
});

export const reject = asyncHandler(async (req, res) => {
  await qrService.reject(req.user.id, req.body.id, req.body.secret);
  res.json({ success: true, message: 'Login rejected' });
});