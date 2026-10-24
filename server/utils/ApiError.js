class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // jaise 'TOKEN_EXPIRED'
  }
}

export default ApiError;