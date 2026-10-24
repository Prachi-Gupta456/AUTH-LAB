import mongoose from 'mongoose';

export const OTP_PURPOSES = Object.freeze({
  EMAIL_VERIFY: 'email_verify',
  LOGIN: 'login',
  PASSWORD_RESET: 'password_reset',
  PHONE_VERIFY: 'phone_verify',
  PHONE_LOGIN: 'phone_login',
});

const otpSchema = new mongoose.Schema(
  {
    // email OR phone number. The OTP engine doesn't care which one it is.
    identifier: { type: String, required: true, trim: true },
    purpose: { type: String, enum: Object.values(OTP_PURPOSES), required: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.index({ identifier: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);