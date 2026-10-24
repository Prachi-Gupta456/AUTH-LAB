import { z } from 'zod';

// Either a 6-digit TOTP code or a backup code like "a1b2c-3d4e5".
// The service decides which one it is; zod only checks the basic shape.
const code = z.string().trim().min(6, 'Enter your code').max(20, 'Code is too long');

export const codeSchema = z.object({ body: z.object({ code }) });

export const mfaLoginSchema = z.object({
  body: z.object({ mfaToken: z.string().min(10, 'mfaToken is required'), code }),
});

export const disableSchema = z.object({
  body: z.object({ password: z.string().min(1, 'Password is required'), code }),
});