import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { can } from '../config/roles.js';
import { audit, AUDIT } from '../services/auditService.js';

// Use AFTER requireAuth.
const requirePermission = (permission) => async (req, res, next) => {
  try {
    // Fresh role from the DB: the role inside the JWT can be up to 15 min stale
    const user = await User.findById(req.user.id).select('role');
    if (!user) return next(new ApiError(401, 'User no longer exists'));

    if (!can(user.role, permission)) {
      audit(AUDIT.PERMISSION_DENIED, {
        userId: user._id,
        meta: { ip: req.ip, userAgent: req.headers['user-agent'] },
        data: { permission, path: req.originalUrl },
      });
      return next(new ApiError(403, 'You do not have permission to do this', 'FORBIDDEN'));
    }

    req.user.role = user.role; // overwrite the stale JWT value
    next();
  } catch (err) {
    next(err);
  }
};

export default requirePermission;