import ApiError from '../utils/ApiError.js';

// Cookie-based routes (/auth/refresh, /auth/logout) must come from OUR frontend.
// Browsers always attach Origin on cross-site POSTs, so evil.com can't fake this.
// No Origin header = not a browser (curl/Postman), which isn't a CSRF risk.
const requireSameOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== process.env.CLIENT_URL) {
    return next(new ApiError(403, 'Cross-origin request blocked', 'CSRF_BLOCKED'));
  }
  next();
};

export default requireSameOrigin;