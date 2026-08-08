import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../jwt/jwt';
import { AppError } from '../errors/AppError';

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = header.split(' ')[1];
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
