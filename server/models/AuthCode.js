import mongoose from 'mongoose';

const authCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  // Everything the code is BOUND to. The token endpoint re-checks all of it.
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scopes: [String],
  nonce: String,
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});

authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete

export default mongoose.model('AuthCode', authCodeSchema);