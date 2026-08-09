import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../jwt/jwt';
import { AppError } from '../errors/AppError';

const bearerTokenFromHeader = (header: unknown): string | null => {
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header.trim());
  return match?.[1] || null;
};

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerTokenFromHeader(req.headers.authorization);
    if (!token) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const payload = verifyAccessToken(token);

    req.user = {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      sessionId: payload.sessionId,
      emailVerified: payload.emailVerified,
      emailVerificationRequired: payload.emailVerificationRequired,
      phoneVerified: payload.phoneVerified,
      phoneVerificationRequired: payload.phoneVerificationRequired,
    };

    next();
  } catch (error) {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }
    next();
  };
}
