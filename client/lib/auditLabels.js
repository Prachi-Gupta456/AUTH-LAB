// tone: ok = normal, warn = needs attention, bad = security-relevant
export const EVENTS = {
  login_success: { label: 'Signed in', tone: 'ok' },
  login_failed: { label: 'Failed sign-in attempt', tone: 'warn' },
  account_locked: { label: 'Account locked', tone: 'bad' },
  account_unlocked: { label: 'Account unlocked', tone: 'ok' },
  new_device_login: { label: 'Sign-in from a new device', tone: 'warn' },
  password_reset: { label: 'Password reset', tone: 'warn' },
  mfa_enabled: { label: '2FA enabled', tone: 'ok' },
  mfa_disabled: { label: '2FA disabled', tone: 'warn' },
  session_revoked: { label: 'Session revoked', tone: 'ok' },
  role_changed: { label: 'Role changed', tone: 'warn' },
  admin_revoked_sessions: { label: 'Sessions revoked by admin', tone: 'warn' },
  permission_denied: { label: 'Permission denied', tone: 'bad' },
};

export const eventLabel = (e) => EVENTS[e]?.label || e; // unknown event: show the raw name

export const TONE_CLASS = {
  ok: 'bg-zinc-800 text-zinc-300',
  warn: 'bg-amber-950 text-amber-300',
  bad: 'bg-red-950 text-red-300',
};

export const toneOf = (e) => TONE_CLASS[EVENTS[e]?.tone] || TONE_CLASS.ok;