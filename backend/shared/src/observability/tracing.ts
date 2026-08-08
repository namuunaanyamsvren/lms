import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const TRACEPARENT_HEADER = 'traceparent';
const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;
const TRACEPARENT_RE = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([a-f0-9]{2})$/;

function hex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

export function tracingMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers[TRACEPARENT_HEADER];
    const match = typeof incoming === 'string' ? TRACEPARENT_RE.exec(incoming) : null;
    const traceId = match?.[1] || hex(TRACE_ID_BYTES);
    const sampled = match?.[3] || (process.env.OTEL_SAMPLE_ALL === 'true' ? '01' : '00');
    const spanId = hex(SPAN_ID_BYTES);
    const traceparent = `00-${traceId}-${spanId}-${sampled}`;

    req.headers[TRACEPARENT_HEADER] = traceparent;
    res.setHeader('traceparent', traceparent);
    res.setHeader('X-Trace-Id', traceId);
    res.setHeader('X-Service-Name', serviceName);
    next();
  };
}
