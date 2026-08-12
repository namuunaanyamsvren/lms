import { Router } from 'express';
import { asyncHandler, authMiddleware, createPrincipalRateLimiter, idempotencyMiddleware, requireRole, tenantMiddleware } from '@lms/shared';
import {
  createQPayInvoice,
  createStripeCheckout,
  failInvoice,
  getBillingOverview,
  issueInvoice,
  listInvoices,
  listOutstandingInvoices,
  listPayments,
  payInvoice,
  refundInvoice,
  sendOutstandingReminders,
  updateSubscription,
} from '../controllers/billing.controller';

const router = Router();
router.use(authMiddleware, tenantMiddleware, createPrincipalRateLimiter());
router.get('/', asyncHandler(getBillingOverview));
router.get('/invoices', requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'STUDENT'), asyncHandler(listInvoices));
router.get('/outstanding', requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'STUDENT'), asyncHandler(listOutstandingInvoices));
router.get('/history', requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'STUDENT'), asyncHandler(listPayments));
router.post('/checkout', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), asyncHandler(createStripeCheckout));
router.put('/subscription', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), asyncHandler(updateSubscription));
router.post('/invoices', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), idempotencyMiddleware('invoice-issue'), asyncHandler(issueInvoice));
router.post('/invoices/:id/pay', requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'STUDENT'), idempotencyMiddleware('invoice-pay'), asyncHandler(payInvoice));
router.post('/invoices/:id/qpay', requireRole('SUPER_ADMIN', 'ORG_ADMIN', 'STUDENT'), idempotencyMiddleware('invoice-qpay'), asyncHandler(createQPayInvoice));
router.post('/invoices/:id/fail', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), idempotencyMiddleware('invoice-fail'), asyncHandler(failInvoice));
router.post('/invoices/:id/refund', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), idempotencyMiddleware('invoice-refund'), asyncHandler(refundInvoice));
router.post('/reminders/outstanding', requireRole('SUPER_ADMIN', 'ORG_ADMIN'), idempotencyMiddleware('invoice-reminders'), asyncHandler(sendOutstandingReminders));

export default router;
