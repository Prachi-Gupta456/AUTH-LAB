// Mirror of the backend config/roles.js. Used ONLY to decide what to SHOW.
// The backend is the real authority: never rely on this for security.
const moderator = ['users:read', 'users:unlock', 'users:revoke_sessions'];

const PERMISSIONS = {
  user: [],
  moderator,
  admin: [...moderator, 'users:set_role', 'audit:read'],
};

export const can = (role, permission) => PERMISSIONS[role]?.includes(permission) ?? false;