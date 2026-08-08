import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

/**
 * Ensures every authenticated request is scoped to an organization (tenant).
 * Attaches organizationId to req for downstream use in services/controllers.
 * This is the core mechanism enforcing multi-tenant data isolation.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Tenant identity must only come from the verified access token. Trusting a
  // caller-controlled header here would allow cross-tenant data access.
  const organizationId = req.user?.organizationId;

  if (!organizationId) {
    return next(AppError.unauthorized('Token does not contain an organizationId'));
  }
  if (req.user?.emailVerificationRequired && !req.user.emailVerified) {
    return next(AppError.forbidden('EMAIL_VERIFICATION_REQUIRED'));
  }
  if (req.user?.phoneVerificationRequired && !req.user.phoneVerified) {
    return next(AppError.forbidden('PHONE_VERIFICATION_REQUIRED'));
  }

  req.organizationId = organizationId;
  next();
}
