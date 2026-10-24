import ApiError from '../utils/ApiError.js';
import { isSmsEnabled } from '../services/smsService.js';

// Same answer for every caller and every number, so it leaks nothing about accounts
const requireSmsEnabled = (req, res, next) => {
  if (!isSmsEnabled()) {
    return next(
      new ApiError(
        503,
        'Phone OTP is currently unavailable. Please use email OTP, password, or another sign-in method.',
        'PHONE_OTP_UNAVAILABLE'
      )
    );
  }
  next();
};

export default requireSmsEnabled;