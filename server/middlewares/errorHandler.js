import ApiError from "../utils/ApiError.js"

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  // Mongo duplicate key (race condition case)
  if (err.code === 11000) {
    err = new ApiError(409, 'Email already registered');
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode === 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    code: err.code,
    errors: err.errors, // zod errors yahan aayenge
  });
};

