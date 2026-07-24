import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '@lms/shared';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  sendVerification,
  verifyAccount,
  getMe,
} from '../controllers/auth.controller';

const router = Router();

// Brute-force protection: a handful of attempts per IP per window, then back off.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.',
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Хэт олон удаа оролдлоо. 15 минутын дараа дахин оролдоно уу.',
  },
});

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/send-verification', authMiddleware, sendVerification);
router.post('/verify', verifyAccount);
router.get('/me', authMiddleware, getMe);

export default router;
