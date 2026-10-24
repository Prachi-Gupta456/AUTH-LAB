import mongoose from 'mongoose';

const knownDeviceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fingerprint: { type: String, required: true },
    browser: String,
    os: String,
    deviceType: String,
    lastIp: String,
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

knownDeviceSchema.index({ user: 1, fingerprint: 1 }, { unique: true });
// A device unseen for 180 days is "new" again
knownDeviceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model('KnownDevice', knownDeviceSchema);