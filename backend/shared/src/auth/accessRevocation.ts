import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { getRedisClient } from '../redis';
import { getAccessTokenExpiresIn, parseDuration } from './tokenService';

const keyFor = (organizationId: string, userId: string) =>
  `auth:access-revoked:${organizationId}:${userId}`;

export async function revokeUserAccess(
  organizationId: string,
  userId: string,
): Promise<void> {
  const ttlMs = parseDuration(getAccessTokenExpiresIn(), 'ACCESS_TOKEN_EXPIRES_IN') + 60_000;
  await getRedisClient().set(keyFor(organizationId, userId), '1', 'PX', ttlMs);
}

export async function clearUserAccessRevocation(
  organizationId: string,
  userId: string,
): Promise<void> {
  await getRedisClient().del(keyFor(organizationId, userId));
}

export async function accessRevocationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next();
  try {
    const revoked = await getRedisClient().exists(
      keyFor(req.user.organizationId, req.user.userId),
    );
    if (revoked) return next(AppError.unauthorized('Account access has been revoked'));
    return next();
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return next(new AppError('Authorization state is temporarily unavailable', 503));
    }
    return next();
  }
}
