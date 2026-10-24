export const ROLES = Object.freeze({ USER: 'user', MODERATOR: 'moderator', ADMIN: 'admin' });

const moderator = ['users:read', 'users:unlock', 'users:revoke_sessions'];

// Explicit lists, no wildcard "*": a typo can never silently grant everything
const ROLE_PERMISSIONS = {
  user: [],
  moderator,
  admin: [...moderator, 'users:set_role', 'audit:read'],
};

export const can = (role, permission) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false;