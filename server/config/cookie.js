export const COOKIE_NAME = 'refreshToken';

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/auth',
  maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000,
};

// clearCookie only needs the path, not maxAge
export const clearOptions = { path: '/auth' };