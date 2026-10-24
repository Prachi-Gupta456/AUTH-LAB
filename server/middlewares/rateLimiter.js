import rateLimit from "express-rate-limit"

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Try after 15 min..' },
})

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Try again in 15 minutes' },
});

// SMS costs real money, so this is stricter than the email OTP limiter
export const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many SMS requests. Try again in 15 minutes' },
});

// IP-level net for every MFA code-entry route (per-user lockout lives in mfaService)
export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes' },
});

// Creating QRs: each one writes to the DB
export const qrGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many QR requests. Try again later' },
});

// Polling is frequent by design (every ~2s = 30/min), so this one is per-minute and roomy
export const qrPollLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Polling too fast' },
});

// Token endpoint is hit by apps' servers, so it's per-minute and roomy, but still capped
export const ssoTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many token requests' },
});


export default authLimiter;