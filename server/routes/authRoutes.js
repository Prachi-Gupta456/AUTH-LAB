import express from "express"
import { validate } from "../middlewares/validate.js"
import { loginSchema, registerSchema } from "../validators/auth.validator.js"
import * as authController from "../controllers/authController.js"
import requireAuth from "../middlewares/requireAuth.js"
import authLimiter from "../middlewares/rateLimiter.js"
import { otpLimiter } from '../middlewares/rateLimiter.js';
import { smsLimiter } from '../middlewares/rateLimiter.js';
import { phoneSchema, phoneOtpSchema } from '../validators/phone.validator.js';

import {
    sendOtpSchema,
    verifyOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from '../validators/otp.validator.js';

import requireSameOrigin from '../middlewares/requireSameOrigin.js';
import requireSmsEnabled from '../middlewares/requireSmsEnabled.js';
import { isSmsEnabled } from '../services/smsService.js';

const router = express.Router()


router.post('/phone/link/send-otp', requireSmsEnabled, requireAuth, smsLimiter, validate(phoneSchema), authController.sendPhoneLinkOtp);
router.post('/phone/link/verify-otp', requireSmsEnabled, requireAuth, otpLimiter, validate(phoneOtpSchema), authController.verifyPhoneLinkOtp);
router.post('/phone/login/send-otp', requireSmsEnabled, smsLimiter, validate(phoneSchema), authController.sendPhoneLoginOtp);
router.post('/phone/login/verify-otp', requireSmsEnabled, otpLimiter, validate(phoneOtpSchema), authController.verifyPhoneLoginOtp);

// Public: tells the frontend which optional features exist
router.get('/config', (req, res) => {
  res.json({ success: true, phoneOtp: isSmsEnabled() });
});

router.post('/email/send-otp', otpLimiter, validate(sendOtpSchema), authController.sendEmailOtp);
router.post('/email/verify-otp', otpLimiter, validate(verifyOtpSchema), authController.verifyEmailOtp);
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', otpLimiter, validate(resetPasswordSchema), authController.resetPassword);


router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/register', authLimiter, validate(registerSchema), authController.register);


router.post('/refresh', requireSameOrigin, authController.refresh);
router.post('/logout', requireSameOrigin, authController.logout);

// Link a phone (logged in)
router.post('/phone/link/send-otp', requireAuth, smsLimiter, validate(phoneSchema), authController.sendPhoneLinkOtp);
router.post('/phone/link/verify-otp', requireAuth, otpLimiter, validate(phoneOtpSchema), authController.verifyPhoneLinkOtp);

// Login with phone (public)
router.post('/phone/login/send-otp', smsLimiter, validate(phoneSchema), authController.sendPhoneLoginOtp);
router.post('/phone/login/verify-otp', otpLimiter, validate(phoneOtpSchema), authController.verifyPhoneLoginOtp);

router.get('/me', requireAuth, authController.me);
router.get('/activity', requireAuth, authController.activity);

export default router;