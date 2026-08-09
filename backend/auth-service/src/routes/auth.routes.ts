import { Router } from 'express';
import { z } from 'zod';
import {
  AppError,
  asyncHandler,
  authMiddleware,
  csrfProtection,
  createPrincipalRateLimiter,
  issueCsrfToken,
  requireRole,
  tenantMiddleware,
} from '@lms/shared';
import {
  register,
  login,
  refresh,
  switchOrganization,
  logout,
  forgotPassword,
  resetPassword,
  sendVerification,
  sendPhoneVerification,
  verifyPhone,
  verifyAccount,
  getMe,
  changePassword,
} from '../controllers/auth.controller';
import {
  getActiveSessions,
  logoutAll,
  revokeSession,
} from '../controllers/session.controller';
import { getOrganizationAuthAuditEvents } from '../controllers/audit.controller';
import {
  beginGoogleOAuth,
  exchangeGoogleLoginCode,
  handleGoogleOAuthCallback,
} from '../controllers/google-oauth.controller';
import rateLimit from 'express-rate-limit';
import { anonymizeMyAccount, exportMyData } from '../controllers/privacy.controller';

const router = Router();
const publicMutationLimiter = (max: number) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});
const registrationLimiter = publicMutationLimiter(10);
const loginLimiter = publicMutationLimiter(30);
const recoveryLimiter = publicMutationLimiter(10);
const oauthLimiter = publicMutationLimiter(30);
const principalLimiter = createPrincipalRateLimiter();

router.get('/csrf-token', issueCsrfToken);
router.use(csrfProtection);
router.get('/google', oauthLimiter, asyncHandler(beginGoogleOAuth));
router.get('/google/callback', oauthLimiter, asyncHandler(handleGoogleOAuthCallback));
router.post('/google/exchange', oauthLimiter, asyncHandler(exchangeGoogleLoginCode));
router.post('/register', registrationLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/switch-organization', authMiddleware, principalLimiter, asyncHandler(switchOrganization));
router.post('/logout', logout);
router.post('/forgot-password', recoveryLimiter, forgotPassword);
router.post('/reset-password', recoveryLimiter, resetPassword);
router.post('/change-password', authMiddleware, principalLimiter, asyncHandler(changePassword));
router.post('/send-verification', authMiddleware, principalLimiter, sendVerification);
router.post('/send-phone-verification', authMiddleware, principalLimiter, sendPhoneVerification);
router.post('/verify-phone', authMiddleware, principalLimiter, verifyPhone);
router.post('/verify', verifyAccount);
router.get('/me', authMiddleware, principalLimiter, getMe);
router.get(
  '/privacy/export',
  authMiddleware,
  tenantMiddleware,
  principalLimiter,
  asyncHandler(exportMyData),
);
router.delete(
  '/privacy/account',
  authMiddleware,
  tenantMiddleware,
  principalLimiter,
  (req, _res, next) => {
    const result = z.object({ confirmation: z.literal('DELETE') }).strict().safeParse(req.body);
    if (!result.success) return next(AppError.badRequest('Type DELETE to confirm account deletion'));
    req.body = result.data;
    next();
  },
  asyncHandler(anonymizeMyAccount),
);
router.post('/logout-all', authMiddleware, principalLimiter, asyncHandler(logoutAll));
router.get('/sessions', authMiddleware, principalLimiter, asyncHandler(getActiveSessions));
router.get(
  '/audit-events',
  authMiddleware,
  tenantMiddleware,
  principalLimiter,
  requireRole('SUPER_ADMIN', 'ORG_ADMIN'),
  asyncHandler(getOrganizationAuthAuditEvents),
);
router.delete(
  '/sessions/:id',
  authMiddleware,
  principalLimiter,
  (req, _res, next) => {
    const result = z.string().uuid().safeParse(req.params.id);
    if (!result.success) return next(AppError.badRequest('Invalid session id'));
    next();
  },
  asyncHandler(revokeSession),
);

export default router;
