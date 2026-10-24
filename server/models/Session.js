import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userAgent: String,
    ip: String,
    device: {
      browser: String,
      os: String,
      deviceType: String, // desktop | mobile | tablet
    },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }, // sliding: extended on every refresh
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// "give me all active sessions of this user" will be the most common query
sessionSchema.index({ user: 1, revokedAt: 1 });

// Mongo auto-deletes the document once expiresAt passes
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Session', sessionSchema);