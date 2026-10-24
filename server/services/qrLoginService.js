import crypto from 'node:crypto';
import QRCode from 'qrcode';
import QrLogin, { QR_STATUS } from '../models/QrLogin.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { sha256 } from '../utils/hash.js';
import { parseDevice } from '../utils/device.js';
import { issueSession } from './authService.js';

const TTL_MS = 2 * 60 * 1000;
const newSecret = () => crypto.randomBytes(32).toString('base64url');

// One generic error for every bad-QR case: wrong secret, expired, already used...
const invalidQr = () => new ApiError(400, 'QR code is invalid, expired or already used', 'QR_INVALID');

// ---------- DESKTOP: create the QR ----------

export const createQr = async (meta) => {
  const pollSecret = newSecret(); // stays with the desktop, NEVER goes into the QR
  const scanSecret = newSecret(); // goes into the QR

  const doc = await QrLogin.create({
    pollHash: sha256(pollSecret),
    scanHash: sha256(scanSecret),
    device: parseDevice(meta.userAgent),
    ip: meta.ip,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  // The prefix lets the phone's scanner reject random QR codes (a wifi QR, a URL...)
  const qrPayload = `qrlogin:v1:${doc._id}:${scanSecret}`;
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 2, width: 256 });

  return { id: doc._id, pollSecret, qrPayload, qrDataUrl, expiresAt: doc.expiresAt };
};

// ---------- PHONE: scan -> approve / reject ----------

// pending -> scanned. The filter IS the state machine: it only matches a fresh, unexpired,
// pending QR with the right scan secret. First scanner wins (atomic).
export const scan = async (userId, id, secret) => {
  const doc = await QrLogin.findOneAndUpdate(
    { _id: id, scanHash: sha256(secret), status: QR_STATUS.PENDING, expiresAt: { $gt: new Date() } },
    { status: QR_STATUS.SCANNED, scannedBy: userId },
    { new: true }
  );
  if (!doc) throw invalidQr();

  // Everything the phone needs to show the "is this you?" confirm screen
  return { id: doc._id, device: doc.device, ip: doc.ip, requestedAt: doc.createdAt, expiresAt: doc.expiresAt };
};

// scanned -> approved | rejected. `scannedBy: userId` = only the user who scanned can decide.
const decide = async (userId, id, secret, nextStatus) => {
  const doc = await QrLogin.findOneAndUpdate(
    {
      _id: id,
      scanHash: sha256(secret),
      status: QR_STATUS.SCANNED,
      scannedBy: userId,
      expiresAt: { $gt: new Date() },
    },
    { status: nextStatus },
    { new: true }
  );
  if (!doc) throw invalidQr();
};

export const approve = (userId, id, secret) => decide(userId, id, secret, QR_STATUS.APPROVED);
export const reject = (userId, id, secret) => decide(userId, id, secret, QR_STATUS.REJECTED);

// ---------- DESKTOP: poll ----------

export const getStatus = async (id, pollSecret, meta) => {
  const pollHash = sha256(pollSecret);

  const doc = await QrLogin.findOne({ _id: id, pollHash });
  // Wrong id and wrong secret look identical: nothing to learn here
  if (!doc) throw new ApiError(404, 'QR session not found', 'QR_NOT_FOUND');

  if (doc.expiresAt <= new Date()) return { status: 'expired' };

  if (doc.status !== QR_STATUS.APPROVED) return { status: doc.status };

  // Approved: claim it. approved -> consumed is atomic, so tokens are issued exactly ONCE,
  // even if two polls arrive at the same moment.
  const claimed = await QrLogin.findOneAndUpdate(
    { _id: id, pollHash, status: QR_STATUS.APPROVED },
    { status: QR_STATUS.CONSUMED },
    { new: true }
  );
  if (!claimed) return { status: QR_STATUS.CONSUMED }; // another poll won the race

  const user = await User.findById(claimed.scannedBy);
  if (!user) throw new ApiError(401, 'User no longer exists');

  // The session belongs to the DESKTOP that polled (its UA/IP), not to the phone
  const { accessToken, refreshToken } = await issueSession(user, meta);
  return { status: 'approved', user, accessToken, refreshToken };
};