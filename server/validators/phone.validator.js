import { z } from 'zod';
import {otp}   from './otp.validator.js';

// Accept "+91 98765-43210", strip spaces/dashes/brackets, then enforce E.164.
// E.164 = "+" + country code + number, 8 to 15 digits total. Storing ONE canonical
// format matters: "+919876543210" and "9876543210" must not become two accounts.
const phone = z
  .string()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must include country code, e.g. +919876543210'));

export const phoneSchema = z.object({ body: z.object({ phone }) });
export const phoneOtpSchema = z.object({ body: z.object({ phone, otp }) });