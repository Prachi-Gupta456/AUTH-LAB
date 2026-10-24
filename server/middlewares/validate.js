import ApiError from '../utils/ApiError.js';

export const validate = (schema) => (req, resp, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const err = new ApiError(400, 'Validation failed');
    err.errors = result.error.issues.map((i) => ({
      field: i.path.slice(1).join('.'),
      message: i.message,
    }));
    return next(err);
  }

  if (result.data.body) req.body = result.data.body;
  req.valid = result.data; // coerced query/params (e.g. "2" -> 2) live here
  next();
};

