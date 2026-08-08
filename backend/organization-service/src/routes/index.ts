import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  AppError,
  asyncHandler,
  authMiddleware,
  idempotencyMiddleware,
  requireRole,
  tenantMiddleware,
} from '@lms/shared';
import {
  deleteCurrentOrganization,
  getCurrentOrganization,
  onboard,
  updateCurrentOrganization,
  updateSettings,
  resolveTenant, platformDashboard, platformList, platformLifecycle, publicList,
  requestDomainVerification, verifyDomain,
} from '../controllers/organization.controller';

const router = Router();
const validateBody = (schema: z.ZodTypeAny) => (req: any, _res: any, next: any) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(AppError.badRequest('Invalid request', result.error.flatten()));
  req.body = result.data;
  next();
};
const brandingSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  domain: z.string().trim().toLowerCase().regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/).max(253).optional(),
  logoUrl: z.string().url().max(2000).optional(),
  faviconUrl: z.string().url().max(2000).optional(),
}).strict();
const settingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  allowRegister: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  requirePhoneVerification: z.boolean().optional(),
  maxUsers: z.number().int().min(1).max(100000).optional(),
  emailFromName:z.string().trim().min(1).max(100).optional().nullable(),
  academicYear:z.string().trim().max(50).optional().nullable(), semester:z.string().trim().max(50).optional().nullable(),
  timezone:z.string().trim().min(1).max(100).optional(),locale:z.string().trim().min(2).max(20).optional(),
  gradingScale:z.record(z.number().min(0).max(100)).optional(),
  attendanceRule:z.object({
    absenceThreshold:z.number().int().min(1).max(365).optional(),
    lateAfterMinutes:z.number().int().min(0).max(180).optional(),
  }).strict().optional(),
  passwordPolicy:z.object({minimumLength:z.number().int().min(12).max(64)}).strict().optional(),
  invitationCode:z.string().min(8).max(100).optional().nullable(),allowedEmailDomains:z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).max(100).optional(),
}).strict();
const onboardingSchema = brandingSchema.extend({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  allowRegister: z.boolean().optional(),
  maxUsers: z.number().int().min(1).max(100000).optional(),
  admin: z.object({
    email: z.string().email(),
    username: z.string().trim().min(3).max(50).optional(),
    phone: z.string().trim().min(6).max(30).optional(),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  }).strict(),
}).strict();
const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};
const onboardingLimiter = rateLimit({
  windowMs: positiveInteger(process.env.ONBOARDING_RATE_LIMIT_WINDOW_MINUTES, 60) * 60 * 1000,
  max: positiveInteger(
    process.env.ONBOARDING_RATE_LIMIT_MAX,
    process.env.NODE_ENV === 'production' ? 5 : 50,
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: process.env.NODE_ENV !== 'production',
  message: {
    success: false,
    code: 'ONBOARDING_RATE_LIMITED',
    message: 'Байгууллага үүсгэх хүсэлт хэт олон байна. Түр хүлээгээд дахин оролдоно уу.',
  },
});

router.post('/onboard', onboardingLimiter, idempotencyMiddleware('organization-onboard'), validateBody(onboardingSchema), asyncHandler(onboard));
router.get('/resolve', asyncHandler(resolveTenant));
router.get('/public', asyncHandler(publicList));
router.get('/platform/dashboard', authMiddleware, requireRole('SUPER_ADMIN'), asyncHandler(platformDashboard));
router.get('/platform', authMiddleware, requireRole('SUPER_ADMIN'), asyncHandler(platformList));
router.patch('/platform/:id/status', authMiddleware, requireRole('SUPER_ADMIN'), validateBody(z.object({status:z.enum(['ACTIVE','SUSPENDED','ARCHIVED'])}).strict()), asyncHandler(platformLifecycle));
router.use(authMiddleware, tenantMiddleware);
router.get('/current', asyncHandler(getCurrentOrganization));
router.put('/current', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validateBody(brandingSchema.partial()), asyncHandler(updateCurrentOrganization));
router.put('/current/settings', requireRole('ORG_ADMIN', 'SUPER_ADMIN'), validateBody(settingsSchema), asyncHandler(updateSettings));
router.post('/current/domain-verification', requireRole('ORG_ADMIN','SUPER_ADMIN'), validateBody(z.object({domain:z.string().trim().min(4).max(253)}).strict()), asyncHandler(requestDomainVerification));
router.post('/current/domain-verification/verify', requireRole('ORG_ADMIN','SUPER_ADMIN'), asyncHandler(verifyDomain));
router.delete('/current', requireRole('SUPER_ADMIN'), asyncHandler(deleteCurrentOrganization));

export default router;
