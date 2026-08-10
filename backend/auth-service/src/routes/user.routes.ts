import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler, authMiddleware, createPrincipalRateLimiter, requireRole, tenantMiddleware } from '@lms/shared';
import {
  createUser,
  deactivateUser,
  exportUsers,
  getUserById,
  getMyMemberships,
  getUserCsvTemplate,
  getUsers,
  importUsers,
  sendGuardianInviteEmail,
  updateMe,
  updateUser,
} from '../controllers/user.controller';

const router = Router();
const readRoles = requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'PRINCIPAL', 'STAFF');
const writeRoles = requireRole('SUPER_ADMIN', 'ORG_ADMIN');

router.use(authMiddleware, tenantMiddleware, createPrincipalRateLimiter());
router.get('/', readRoles, asyncHandler(getUsers));
router.post('/', writeRoles, asyncHandler(createUser));
router.get('/export', readRoles, asyncHandler(exportUsers));
router.get('/import/template', writeRoles, asyncHandler(getUserCsvTemplate));
router.post('/import', writeRoles, asyncHandler(importUsers));
router.patch('/me', asyncHandler(updateMe));
router.get('/me/memberships', asyncHandler(getMyMemberships));
router.post('/:id/guardian-invite-email', writeRoles, validateUserId, asyncHandler(sendGuardianInviteEmail));
router.patch('/:id', writeRoles, validateUserId, asyncHandler(updateUser));
router.delete('/:id', writeRoles, validateUserId, asyncHandler(deactivateUser));
router.get('/:id', readRoles, validateUserId, asyncHandler(getUserById));

function validateUserId(req: Request, _res: Response, next: NextFunction) {
  const result = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/).safeParse(req.params.id);
  if (!result.success) return next(AppError.badRequest('Invalid user id'));
  next();
}

export default router;
