import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // passwordHash: required REMOVED (OAuth-only users have no password)
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },

    // password-login lockout state
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    isEmailVerified: { type: Boolean, default: false },

    phone: { type: String, unique: true, sparse: true, trim: true },

    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, select: false },        // encrypted TOTP secret (active)
      pendingSecretEnc: { type: String, select: false }, // secret during setup, not active yet
      backupCodes: {
        type: [{ _id: false, hash: String, usedAt: { type: Date, default: null } }],
        select: false,
      },
      lastUsedStep: { type: Number, default: 0 },        // replay protection (explained below)
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date },
    },

    // Linked login providers
    providers: {
      type: [
        {
          _id: false,
          provider: { type: String, enum: ['google', 'github'], required: true },
          providerId: { type: String, required: true }, // provider's own stable user id
          email: String,
          linkedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.loginAttempts;
        delete ret.lockedUntil;
        delete ret.__v;
        ret.mfa = { enabled: Boolean(ret.mfa?.enabled) }; // hide everything except "enabled"
        ret.providers = (ret.providers || []).map((p) => p.provider); // ['google'] is enough for the UI
        return ret;
      },
    },
  }
);

// One provider account can belong to only ONE user
userSchema.index(
  { 'providers.provider': 1, 'providers.providerId': 1 },
  { unique: true, sparse: true }
);

const User = mongoose.model('User', userSchema);

export default User;