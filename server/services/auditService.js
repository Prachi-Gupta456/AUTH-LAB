import AuditLog from '../models/AuditLog.js';

export const AUDIT = Object.freeze({
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_UNLOCKED: 'account_unlocked',
  NEW_DEVICE: 'new_device_login',
  PASSWORD_RESET: 'password_reset',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  SESSION_REVOKED: 'session_revoked',
  ROLE_CHANGED: 'role_changed',
  ADMIN_REVOKED_SESSIONS: 'admin_revoked_sessions',
  PERMISSION_DENIED: 'permission_denied',
});

// Fire-and-forget and NEVER throws: a broken log must not break a login.
// Rule: never put passwords, OTPs or tokens in `data`.
export const audit = (event, { userId = null, meta = {}, data = {} } = {}) =>
  AuditLog.create({
    user: userId,
    event,
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300),
    data,
  }).catch((err) => console.error('Audit log failed:', err.message));