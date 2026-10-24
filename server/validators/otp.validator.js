import { z } from 'zod';
import { passwordRule } from './auth.validator.js';

const email = z.string().trim().toLowerCase().email('Valid email daalo');
export const otp = z.string().trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

// Only these two can be requested from the public send-otp route.
// password_reset has its own route, so nobody can mix purposes.
const publicPurpose = z.enum(['email_verify', 'login']);

export const sendOtpSchema = z.object({
  body: z.object({ email, purpose: publicPurpose }),
});

export const verifyOtpSchema = z.object({
  body: z.object({ email, otp, purpose: publicPurpose }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email }),
});

export const resetPasswordSchema = z.object({
  body: z.object({ email, otp, newPassword: passwordRule }),
});