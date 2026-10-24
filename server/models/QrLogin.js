import mongoose from 'mongoose';

export const QR_STATUS = Object.freeze({
  PENDING: 'pending',
  SCANNED: 'scanned',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONSUMED: 'consumed',
});

const qrLoginSchema = new mongoose.Schema(
  {
    // Only hashes are stored. The secrets are 32 random bytes, so plain SHA-256 is enough
    // (same reasoning as refresh tokens).
    pollHash: { type: String, required: true },
    scanHash: { type: String, required: true },

    status: { type: String, enum: Object.values(QR_STATUS), default: QR_STATUS.PENDING },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Who is asking for the login? Shown on the phone's confirm screen.
    // (deviceType, NOT "type": Mongoose treats a nested "type" key as a schema keyword!)
    device: { browser: String, os: String, deviceType: String },
    ip: String,

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Mongo auto-deletes the document after expiresAt
qrLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('QrLogin', qrLoginSchema);