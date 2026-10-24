import bcrypt from "bcrypt"
import crypto from "crypto"

export const hashPassword = (plain) => bcrypt.hash(plain,12)
export const comparePassword = (plain,hash) => bcrypt.compare(plain,hash)
export const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex')

// Constant-time string comparison (length check first: timingSafeEqual throws on unequal lengths)
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Short, one-way fingerprint for logging identifiers we must not store in plain text
export const shortHash = (str) => sha256(String(str).toLowerCase()).slice(0, 16);