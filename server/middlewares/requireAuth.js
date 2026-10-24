import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import Session from '../models/Session.js';

const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Access token missing'));
  }

  let payload;
  try {
    payload = verifyAccessToken(header.split(' ')[1]);
    
    // Every real access token carries a session id. No sid = not a login token.
    if (!payload.sid) return next(new ApiError(401, 'Invalid token'));

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new ApiError(401, 'Invalid token'));
  }

  // Is the session still alive? Makes "remote logout" instant.
  // Wrapped in try/catch because this is async and Express 4 won't catch it for us.
  try {
    const alive = await Session.exists({ _id: payload.sid, revokedAt: null });
    if (!alive) return next(new ApiError(401, 'Session revoked', 'SESSION_REVOKED'));
  } catch (err) {
    return next(err);
  }

  req.user = { id: payload.sub, role: payload.role, sessionId: payload.sid };
  next();
};

export default requireAuth;