import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { createLogger } from '../logger';
import { captureException } from '../observability';

const logger = createLogger('error-handler');

// Flat envelope: `message`/`code` stay top-level for backward compatibility
// with every existing frontend call site that reads `response.data.message`;
// `details`/`requestId` are additive.
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(err.message, { code: err.code, requestId, stack: err.stack });
      captureException(err, {
        requestId,
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        userId: req.user?.userId,
        organizationId: req.organizationId || req.user?.organizationId,
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
      ...(requestId ? { requestId } : {}),
    });
  }

  logger.error('Unhandled error', { requestId, stack: err?.stack || String(err) });
  captureException(err, {
    requestId,
    path: req.path,
    method: req.method,
    statusCode: 500,
    userId: req.user?.userId,
    organizationId: req.organizationId || req.user?.organizationId,
  });
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(requestId ? { requestId } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}
