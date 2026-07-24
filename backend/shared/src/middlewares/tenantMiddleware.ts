import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

/**
 * Ensures every authenticated request is scoped to an organization (tenant).
 * Attaches organizationId to req for downstream use in services/controllers.
 * This is the core mechanism enforcing multi-tenant data isolation.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const organizationId = req.user?.organizationId || (req.headers['x-organization-id'] as string);

  if (!organizationId) {
    return next(AppError.badRequest('organizationId is required for this request'));
  }

  req.organizationId = organizationId;
  next();
}
