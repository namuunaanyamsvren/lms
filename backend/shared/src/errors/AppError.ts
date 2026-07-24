export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, isOperational = true, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details?: unknown) {
    return new AppError(message, 400, true, details);
  }
  static unauthorized(message = 'Unauthorized', details?: unknown) {
    return new AppError(message, 401, true, details);
  }
  static forbidden(message = 'Forbidden', details?: unknown) {
    return new AppError(message, 403, true, details);
  }
  static notFound(message = 'Not Found', details?: unknown) {
    return new AppError(message, 404, true, details);
  }
  static conflict(message = 'Conflict', details?: unknown) {
    return new AppError(message, 409, true, details);
  }
  static internal(message = 'Internal Server Error', details?: unknown) {
    return new AppError(message, 500, false, details);
  }
}
