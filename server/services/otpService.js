import crypto from 'node:crypto';
import Otp from '../models/Otp.js';
import ApiError from '../utils/ApiError.js';

const ttlMs = () => Number(process.env.OTP_TTL_MINUTES || 10) * 60 * 1000;
const cooldownMs = () => Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60) * 1000;
const maxAttempts = () => Number(process.env.OTP_MAX_ATTEMPTS || 5);

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

// identifier = email or phone. Binding identifier+purpose into the HMAC means
// an OTP for one target/purpose can never be replayed for another.
const hashOtp = (otp, identifier, purpose) =>
  crypto
    .createHmac('sha256', process.env.OTP_SECRET)
    .update(`${identifier}:${purpose}:${otp}`)
    .digest('hex');

export const issueOtp = async (identifier, purpose) => {
  const existing = await Otp.findOne({ identifier, purpose }).select('sentAt');
  if (existing && Date.now() - existing.sentAt.getTime() < cooldownMs()) {
    return null; // inside the resend cooldown
  }

  const otp = generateOtp();

  try {
    await Otp.findOneAndUpdate(
      { identifier, purpose },
      {
        otpHash: hashOtp(otp, identifier, purpose),
        attempts: 0,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs()),
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code === 11000) return null; // parallel request already won the race
    throw err;
  }

  return otp;
};

export const verifyOtp = async (identifier, purpose, otp) => {
  // Increment attempts BEFORE comparing so parallel guesses can't bypass the limit
  const doc = await Otp.findOneAndUpdate(
    { identifier, purpose, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  if (!doc) throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID');

  if (doc.attempts > maxAttempts()) {
    await Otp.deleteOne({ _id: doc._id });
    throw new ApiError(429, 'Too many wrong attempts. Please request a new OTP', 'OTP_ATTEMPTS_EXCEEDED');
  }

  const expected = Buffer.from(doc.otpHash, 'hex');
  const actual = Buffer.from(hashOtp(otp, identifier, purpose), 'hex');

  if (!crypto.timingSafeEqual(expected, actual)) {
    throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID');
  }

  const { deletedCount } = await Otp.deleteOne({ _id: doc._id });
  if (deletedCount === 0) throw new ApiError(400, 'Invalid or expired OTP', 'OTP_INVALID');
};