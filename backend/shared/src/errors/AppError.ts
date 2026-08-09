const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code: string;

  constructor(message: string, statusCode = 500, isOperational = true, details?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.code = code || DEFAULT_CODE_BY_STATUS[statusCode] || 'ERROR';
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details?: unknown, code = 'BAD_REQUEST') {
    return new AppError(message, 400, true, details, code);
  }
  static unauthorized(message = 'Unauthorized', details?: unknown, code = 'UNAUTHORIZED') {
    return new AppError(message, 401, true, details, code);
  }
  static forbidden(message = 'Forbidden', details?: unknown, code = 'FORBIDDEN') {
    return new AppError(message, 403, true, details, code);
  }
  static notFound(message = 'Not Found', details?: unknown, code = 'NOT_FOUND') {
    return new AppError(message, 404, true, details, code);
  }
  static conflict(message = 'Conflict', details?: unknown, code = 'CONFLICT') {
    return new AppError(message, 409, true, details, code);
  }
  static internal(message = 'Internal Server Error', details?: unknown, code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, false, details, code);
  }
}
