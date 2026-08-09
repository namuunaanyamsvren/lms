import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

// Reuses an inbound X-Request-Id (propagated by the gateway or an upstream
// caller) so a single request keeps one id across service hops; generates a
// fresh one at the edge otherwise. Always echoed back so callers can log it.
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export { REQUEST_ID_HEADER };
