import mongoose from 'mongoose';

// "User X already allowed app Y to see these scopes", so the 2nd login is silent (the SSO feel)
const ssoConsentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true },
    scopes: [String],
  },
  { timestamps: true }
);

ssoConsentSchema.index({ user: 1, clientId: 1 }, { unique: true });

export default mongoose.model('SsoConsent', ssoConsentSchema);