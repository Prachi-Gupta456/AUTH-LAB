import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    event: { type: String, required: true },
    ip: String,
    userAgent: String,
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // small, NON-secret details only
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ event: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // keep 90 days

export default mongoose.model('AuditLog', auditLogSchema);