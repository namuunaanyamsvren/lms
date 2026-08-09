import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../redis';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

// Opt-in: only activates when the caller sends an Idempotency-Key header
// (Stripe-style convention), so it never changes behavior for existing
// clients that don't send one. Replays the first response verbatim for the
// same key/scope/org within the TTL instead of re-running the handler.
export function idempotencyMiddleware(scope: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header(IDEMPOTENCY_HEADER);
    if (!key) return next();
    const redisKey = `idempotency:${scope}:${req.organizationId || 'global'}:${key}`;

    try {
      const client = getRedisClient();
      const cached = await client.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { status: number; body: unknown };
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(parsed.status).json(parsed.body);
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          client.set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', ttlSeconds).catch(() => undefined);
        }
        return originalJson(body);
      }) as typeof res.json;
      return next();
    } catch {
      // Redis unavailable — degrade to non-idempotent rather than blocking the request.
      return next();
    }
  };
}

export { IDEMPOTENCY_HEADER };
