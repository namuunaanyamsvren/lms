import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';
import { incrementCounter, observeHistogram } from '../observability';

const logger = createLogger('http');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.userId,
      organizationId: req.organizationId,
    };
    logger.info('http_request', meta);
    incrementCounter('http_requests_total', 'HTTP request count.', {
      method: req.method,
      route: req.route?.path || req.path || req.originalUrl,
      status: res.statusCode,
    });
    observeHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds.', {
      method: req.method,
      route: req.route?.path || req.path || req.originalUrl,
      status: res.statusCode,
    }, duration);
  });
  next();
}
