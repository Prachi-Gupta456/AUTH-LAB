import mongoose from 'mongoose';

const ssoClientSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    redirectUris: { type: [String], required: true },
    // confidential = has a secret (server-side apps). public = no secret (SPAs/mobile), PKCE only.
    confidential: { type: Boolean, default: true },
    secretHash: { type: String, select: false },
  },
  { timestamps: true }
);

export default mongoose.model('SsoClient', ssoClientSchema);