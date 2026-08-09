import { Router } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import {
  AppError,
  asyncHandler,
  authMiddleware,
  requireRole,
  tenantMiddleware,
  createPrincipalRateLimiter,
} from '@lms/shared';
import {
  clearNotifications,
  deleteNotification,
  getMyStudentAccessRequests,
  getNotifications,
  getStudentAccessRequests,
  markAllAsRead,
  markAsRead,
  requestStudentAccess,
  reviewStudentAccessRequest,
  queueNotification,
  queueBulkNotifications,
  getUnreadCount,getPreferences,updatePreferences,subscribePush,unsubscribePush,upsertTemplate,updateBranding,providerWebhook,
  getAuditLogs,
} from '../controllers/notification.controller';
import { notificationEventSchema } from '../services/notification.service';
import rateLimit from 'express-rate-limit';

const router = Router();
const idSchema = z.string().uuid();
const notificationQueueLimiter = createPrincipalRateLimiter({ windowMs: 60_000, max: 30 });
const notificationBulkLimiter = createPrincipalRateLimiter({ windowMs: 60 * 60_000, max: 5 });
const providerWebhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Provider webhook rate limit exceeded.' },
});

router.post('/provider-webhooks/:provider',providerWebhookLimiter,(req,_res,next)=>{
 const expected=process.env.PROVIDER_WEBHOOK_SECRET,provided=req.header('x-provider-secret')||'';
 if(!expected)return next(AppError.internal('Provider webhook is not configured'));
 const a=Buffer.from(expected),b=Buffer.from(provided);if(a.length!==b.length||!timingSafeEqual(a,b))return next(AppError.unauthorized('Invalid provider webhook signature'));
 const result=z.object({providerEventId:z.string().min(1).max(200),providerMessageId:z.string().max(300).optional(),type:z.enum(['delivery','bounce','complaint','open','click'])}).passthrough().safeParse(req.body);
 if(!result.success)return next(AppError.badRequest('Invalid provider webhook'));req.body=result.data;next();
},asyncHandler(providerWebhook));

router.use(authMiddleware, tenantMiddleware, createPrincipalRateLimiter());
router.get('/unread-count',asyncHandler(getUnreadCount));
router.get('/preferences',asyncHandler(getPreferences));
router.put('/preferences',(req,_res,next)=>{const result=z.object({digestMode:z.enum(['IMMEDIATE','DAILY','WEEKLY','NONE']).optional(),timezone:z.string().max(100).optional(),emailEnabled:z.boolean().optional(),inAppEnabled:z.boolean().optional(),pushEnabled:z.boolean().optional(),smsEnabled:z.boolean().optional(),quietHoursStart:z.string().regex(/^\d\d:\d\d$/).optional().nullable(),quietHoursEnd:z.string().regex(/^\d\d:\d\d$/).optional().nullable(),events:z.array(z.object({eventType:z.string().min(1).max(100),email:z.boolean().optional(),inApp:z.boolean().optional(),push:z.boolean().optional(),sms:z.boolean().optional()}).strict()).max(100).optional()}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid preferences',result.error.flatten()));req.body=result.data;next();},asyncHandler(updatePreferences));
router.post('/push-subscriptions',(req,_res,next)=>{const result=z.object({endpoint:z.string().url().max(4000),p256dh:z.string().min(1).max(1000),auth:z.string().min(1).max(1000)}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid push subscription'));req.body=result.data;next();},asyncHandler(subscribePush));
router.delete('/push-subscriptions',(req,_res,next)=>{const result=z.object({endpoint:z.string().url().max(4000)}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid endpoint'));req.body=result.data;next();},asyncHandler(unsubscribePush));
router.put('/templates/:eventType',requireRole('SUPER_ADMIN','ORG_ADMIN'),(req,_res,next)=>{const result=z.object({locale:z.string().min(2).max(10),subjectTemplate:z.string().min(1).max(500),htmlTemplate:z.string().min(1).max(100000),textTemplate:z.string().min(1).max(50000)}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid template'));req.body=result.data;next();},asyncHandler(upsertTemplate));
router.put('/branding',requireRole('SUPER_ADMIN','ORG_ADMIN'),(req,_res,next)=>{const result=z.object({organizationName:z.string().min(1).max(200),logoUrl:z.string().url().optional().nullable(),primaryColor:z.string().regex(/^#[0-9A-Fa-f]{6}$/),supportEmail:z.string().email().optional().nullable()}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid branding'));req.body=result.data;next();},asyncHandler(updateBranding));
router.get(
  '/',
  (req, _res, next) => {
    const result = z.object({
      unread: z.enum(['true', 'false']).optional().default('false'),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    }).strict().safeParse(req.query);
    if (!result.success) return next(AppError.badRequest('Invalid query', result.error.flatten()));
    req.query = result.data as any;
    next();
  },
  asyncHandler(getNotifications),
);
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'INSTRUCTOR', 'STAFF', 'PRINCIPAL'),
  notificationQueueLimiter,
  (req, _res, next) => {
    const result = notificationEventSchema.safeParse({ ...req.body, organizationId: req.organizationId });
    if (!result.success) return next(AppError.badRequest('Invalid notification', result.error.flatten()));
    req.body = result.data;
    next();
  },
  asyncHandler(queueNotification),
);
router.post('/bulk',requireRole('SUPER_ADMIN','ORG_ADMIN','STAFF'),notificationBulkLimiter,(req,_res,next)=>{const result=z.object({campaignKey:z.string().min(1).max(100),userIds:z.array(z.string().min(1).max(100)).min(1).max(5000),eventType:z.string().min(1).max(100),title:z.string().min(1).max(200),body:z.string().min(1).max(10000),channels:z.array(z.enum(['IN_APP','EMAIL','PUSH','SMS'])).min(1).max(4),variables:z.record(z.union([z.string(),z.number(),z.boolean(),z.null()])).optional(),digestEligible:z.boolean().optional()}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid bulk notification',result.error.flatten()));req.body=result.data;next();},asyncHandler(queueBulkNotifications));
router.get('/student-access-requests/me',requireRole('USER','PARENT','STUDENT'),asyncHandler(getMyStudentAccessRequests));
router.get('/student-access-requests',requireRole('SUPER_ADMIN','ORG_ADMIN'),(req,_res,next)=>{const result=z.object({status:z.enum(['ALL','PENDING','APPROVED','REJECTED','CANCELLED']).optional(),page:z.coerce.number().int().min(1).optional(),limit:z.coerce.number().int().min(1).max(100).optional()}).strict().safeParse(req.query);if(!result.success)return next(AppError.badRequest('Invalid request query',result.error.flatten()));req.query=result.data as any;next();},asyncHandler(getStudentAccessRequests));
router.post('/student-access-requests',requireRole('USER','PARENT','STUDENT'),(req,_res,next)=>{const result=z.object({organizationId:z.string().trim().min(1).max(100).optional(),note:z.string().trim().max(1000).optional()}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid student access request',result.error.flatten()));req.body=result.data;next();},asyncHandler(requestStudentAccess));
router.patch('/student-access-requests/:id',requireRole('SUPER_ADMIN','ORG_ADMIN'),(req,_res,next)=>{if(!idSchema.safeParse(req.params.id).success)return next(AppError.badRequest('Invalid request id'));const result=z.object({status:z.enum(['APPROVED','REJECTED']),reviewerNote:z.string().trim().max(1000).optional()}).strict().safeParse(req.body);if(!result.success)return next(AppError.badRequest('Invalid review payload',result.error.flatten()));req.body=result.data;next();},asyncHandler(reviewStudentAccessRequest));
router.get('/audit-logs',requireRole('SUPER_ADMIN','ORG_ADMIN'),asyncHandler(getAuditLogs));
router.patch('/read-all', asyncHandler(markAllAsRead));
router.patch('/:id/read', (req, _res, next) => {
  if (!idSchema.safeParse(req.params.id).success) return next(AppError.badRequest('Invalid notification id'));
  next();
}, asyncHandler(markAsRead));
router.delete('/', asyncHandler(clearNotifications));
router.delete('/:id', (req, _res, next) => {
  if (!idSchema.safeParse(req.params.id).success) return next(AppError.badRequest('Invalid notification id'));
  next();
}, asyncHandler(deleteNotification));

export default router;
