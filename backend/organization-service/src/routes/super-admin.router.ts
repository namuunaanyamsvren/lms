import { Router } from 'express';
import {
  asyncHandler,
  authMiddleware,
  createPrincipalRateLimiter,
  requireRole,
  AppError,
} from '@lms/shared';
import { z } from 'zod';
import {
  getOverview,
  getOrganizations,
  getOrganizationById,
  updateOrganizationStatus,
  getSubscriptions,
  getUsers,
  getPlans,
  createPlan,
  updatePlan,
  getSystemHealth,
  getSecurityEvents,
  getAuditLogs,
  getNotificationDeliveries,
  getSupportTickets,
} from '../controllers/super-admin.controller';

const router = Router();

router.use(authMiddleware, createPrincipalRateLimiter(), requireRole('SUPER_ADMIN'));

const validateBody = (schema: z.ZodTypeAny) => (req: any, _res: any, next: any) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(AppError.badRequest('Invalid request body', result.error.flatten()));
  req.body = result.data;
  next();
};

const statusBody = z.object({
  status: z.enum(['PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED']),
  reason: z.string().trim().min(3).max(500),
}).strict();

const planBody = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default('MNT'),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'four_year']).default('monthly'),
  maxUsers: z.coerce.number().int().min(1).max(1_000_000).default(100),
  maxCourses: z.coerce.number().int().min(0).max(1_000_000).default(50),
  featuresJson: z.union([z.record(z.any()), z.string().max(10000)]).optional().nullable(),
  reason: z.string().trim().max(500).optional(),
}).strict();

const planPatchBody = planBody.partial().extend({
  isActive: z.boolean().optional(),
}).strict();

router.get('/overview', asyncHandler(getOverview));
router.get('/organizations', asyncHandler(getOrganizations));
router.get('/organizations/:id', asyncHandler(getOrganizationById));
router.patch('/organizations/:id/status', validateBody(statusBody), asyncHandler(updateOrganizationStatus));
router.get('/subscriptions', asyncHandler(getSubscriptions));
router.get('/users', asyncHandler(getUsers));
router.get('/plans', asyncHandler(getPlans));
router.post('/plans', validateBody(planBody), asyncHandler(createPlan));
router.patch('/plans/:id', validateBody(planPatchBody), asyncHandler(updatePlan));
router.get('/system-health', asyncHandler(getSystemHealth));
router.get('/security-events', asyncHandler(getSecurityEvents));
router.get('/audit-logs', asyncHandler(getAuditLogs));
router.get('/notification-deliveries', asyncHandler(getNotificationDeliveries));
router.get('/support-tickets', asyncHandler(getSupportTickets));

export default router;
