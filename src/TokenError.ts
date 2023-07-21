/**
 * Custom error class for token errors.
 */
class TokenError extends Error {
  constructor(message?: string) {
    super(message);

    // Ensuring Error is properly extended
    Object.setPrototypeOf(this, TokenError.prototype);
    this.name = this.constructor.name;

    // Capturing stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}
