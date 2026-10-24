import crypto from 'node:crypto';

// 32 bytes (256 bits) key, stored as 64 hex chars in .env
const getKey = () => Buffer.from(process.env.MFA_ENC_KEY, 'hex');

// AES-256-GCM = encryption + tamper detection (auth tag) in one
// Output format: iv.tag.ciphertext (all base64)
export const encrypt = (plain) => {
  const iv = crypto.randomBytes(12); // fresh random IV for EVERY encryption
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
};

export const decrypt = (payload) => {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag); // if the data was modified, final() throws
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
};