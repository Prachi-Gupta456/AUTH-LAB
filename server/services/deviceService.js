import KnownDevice from '../models/KnownDevice.js';
import { sha256 } from '../utils/hash.js';
import { parseDevice } from '../utils/device.js';

// Returns { isNew, device }. "New" means: first time we see this browser+OS for this user,
// AND the user had at least one known device before (a brand-new account isn't suspicious).
export const checkAndRecordDevice = async (user, meta) => {
  const device = parseDevice(meta.userAgent);
  const fingerprint = sha256(`${user._id}|${device.browser}|${device.os}|${device.deviceType}`);

  const hadAny = await KnownDevice.exists({ user: user._id });

  try {
    const res = await KnownDevice.updateOne(
      { user: user._id, fingerprint },
      {
        $set: { lastSeenAt: new Date(), lastIp: meta.ip },
        $setOnInsert: { firstSeenAt: new Date(), ...device },
      },
      { upsert: true }
    );
    return { isNew: res.upsertedCount === 1 && Boolean(hadAny), device };
  } catch (err) {
    if (err.code === 11000) return { isNew: false, device }; // parallel login already inserted it
    throw err;
  }
};