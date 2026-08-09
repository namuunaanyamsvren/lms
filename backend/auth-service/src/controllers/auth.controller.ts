import { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { AuthAuditEventType, Prisma, Role, VerificationType } from '@prisma/client-auth';
import {
  AppError,
  clearRefreshCookie,
  getRefreshTokenCookie,
  setRefreshCookie,
} from '@lms/shared';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sendVerificationSchema,
  verifyTokenSchema,
  verifyPhoneSchema,
} from '../validators/auth.validator';
import { enqueueUserCreated } from '../services/auth-outbox.service';
import { publishLoginSecurityNotification } from '../events/security.events';
import { publishPasswordResetSecurityNotification } from '../events/security.events';
import { publishVerificationEmail } from '../events/verification.events';
import { publishPasswordResetEmail } from '../events/password-reset.events';
import {
  createAuthenticatedSession,
  getSessionRequestContext,
  recordLoginFailure,
} from '../services/session.service';
import { rotateRefreshToken } from '../services/refresh.service';
import { logoutByRefreshToken } from '../services/session-management.service';
import {
  enforcePasswordPolicy,
  normalizePassword,
} from '../services/password-policy.service';
import {
  genericLoginError,
  loginProtection,
  normalizeLoginIdentifier,
} from '../services/login-protection.service';
import { getOrganizationAuthPolicy } from '../services/organization-policy.service';
import {
  getVerificationTokenDisposition,
  hashVerificationToken,
  isEmailVerificationRequired,
  isVerificationResendThrottled,
} from '../services/verification-policy.service';
import {
  createPhoneOtp,
  getPhoneOtpDisposition,
  getPhoneOtpPolicy,
  hashPhoneOtp,
  isPhoneVerificationRequired,
  normalizePhoneNumber,
  phoneOtpMatches,
  phoneOtpRateLimiter,
} from '../services/phone-verification.service';
import {
  getSmsProvider,
  SmsDeliveryError,
} from '../services/sms-provider.service';
import {
  createPasswordResetToken,
  getPasswordResetExpiresInMs,
  hashPasswordResetToken,
  passwordResetRateLimiter,
} from '../services/password-reset.service';
import { recordAuthAudit } from '../services/auth-audit.service';

import { prisma } from '../lib/prisma';
const dummyPasswordHash = bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
const SERIALIZABLE_RETRY_LIMIT = 3;
const switchOrganizationSchema = z.object({
  organizationId: z.string().min(1).max(200),
}).strict();

const withSerializableRetry = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!retryable || attempt === SERIALIZABLE_RETRY_LIMIT) throw error;
    }
  }
  throw new Error('Serializable transaction retry limit reached');
};

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const getVerificationResendCooldownMs = () => {
  const seconds = Number(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS || 60);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw AppError.internal('Verification resend policy is invalid');
  }
  return seconds * 1000;
};

const isProd = () => process.env.NODE_ENV === 'production';
const generateRawToken = () => crypto.randomBytes(32).toString('hex');

const normalizeRole = (role: string): Role => {
  switch (role.toLowerCase()) {
    case 'user':
      return Role.USER;

    case 'teacher':
    case 'instructor':
      return Role.INSTRUCTOR;

    case 'admin':
    case 'org_admin':
      return Role.ORG_ADMIN;

    case 'super_admin':
      return Role.SUPER_ADMIN;

    case 'parent':
      return Role.PARENT;

    case 'staff':
      return Role.STAFF;

    case 'principal':
      return Role.PRINCIPAL;

    case 'student':
      return Role.STUDENT;

    default:
      throw AppError.badRequest(`Тодорхойгүй эрх (role): ${role}`);
  }
};

const issueVerificationToken = async (
  user: { id: string; organizationId: string; email: string },
  type: VerificationType
) => {
  const now = new Date();
  const latest = await prisma.verificationToken.findFirst({
    where: { userId: user.id, type },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (isVerificationResendThrottled(
    latest?.createdAt || null,
    now,
    getVerificationResendCooldownMs(),
  )) {
    return { rawToken: null, issued: false };
  }

  const rawToken = generateRawToken();
  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { userId: user.id, type, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.verificationToken.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        type,
        tokenHash: hashVerificationToken(rawToken),
        expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
      },
    }),
  ]);
  if (type === VerificationType.EMAIL) {
    publishVerificationEmail(user, rawToken)
      .catch(error => console.error('[Auth] verification email publish failed', error));
  }
  return { rawToken, issued: true };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { organizationId, email, username, phone, password, firstName, lastName, role, invitationCode } =
      registerSchema.parse(req.body);
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;

    const policy = await getOrganizationAuthPolicy(organizationId);
    if (!policy.active) throw AppError.forbidden('Organization is not active');
    if (!policy.allowRegister) throw AppError.forbidden('Self-registration is disabled for this organization');
    if(policy.invitationCodeHash&&createHash('sha256').update(invitationCode||'').digest('hex')!==policy.invitationCodeHash)throw AppError.forbidden('A valid invitation code is required');
    const emailDomain=email.toLowerCase().split('@')[1];if(policy.allowedEmailDomains.length&&!policy.allowedEmailDomains.includes(emailDomain))throw AppError.forbidden('Email domain is not allowed for this organization');
    const userCount = await prisma.userAccount.count({
      where: { organizationId, deletedAt: null },
    });
    if (userCount >= policy.maxUsers) throw AppError.conflict('Organization user limit has been reached');
    const normalizedPassword = await enforcePasswordPolicy(password, {
      minLength:policy.passwordPolicy?.minimumLength,
      userInfo: { email, username, phone: normalizedPhone, firstName, lastName },
    });

    const existingUser = await prisma.userAccount.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { email },
          ...(username ? [{ username }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Энэ хэрэглэгч (имэйл, username эсвэл утас) бүртгэлтэй байна.',
      });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);

    const context = getSessionRequestContext(req);
    const { user, accessToken, rawRefreshToken } = await prisma.$transaction(async tx => {
      const createdUser = await tx.userAccount.create({
        data: {
          organizationId,
          email,
          username: username || null,
          phone: normalizedPhone || null,
          firstName: firstName || null,
          lastName: lastName || null,
          passwordHash,
          role: normalizeRole(role),
        },
      });
      const issued = await createAuthenticatedSession(
        tx,
        createdUser,
        context,
        undefined,
        policy.requireEmailVerification,
        policy.requirePhoneVerification,
      );
      await enqueueUserCreated(tx, createdUser);
      return {
        user: createdUser,
        accessToken: issued.accessToken,
        rawRefreshToken: issued.rawRefreshToken,
      };
    });
    const emailVerification = await issueVerificationToken(user, VerificationType.EMAIL);
    setRefreshCookie(res, rawRefreshToken);

    return res.status(201).json({
      success: true,
      message: 'Бүртгэл амжилттай.',
      data: {
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
        ...(isProd() ? {} : { emailVerificationToken: emailVerification.rawToken }),
        verificationPolicy: {
          requireEmailVerification: policy.requireEmailVerification,
          requirePhoneVerification: policy.requirePhoneVerification,
        },
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error('[Register Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { organizationId, identifier, email, username, phone, password } =
      loginSchema.parse(req.body);

    const targetKey = identifier || email || username || phone;

    if (!targetKey) {
      return res.status(400).json({
        success: false,
        message: 'Имэйл, хэрэглэгчийн нэр эсвэл утасны дугаар оруулна уу.',
      });
    }

    const context = getSessionRequestContext(req);
    const attemptKeys = loginProtection.keys(
      organizationId,
      targetKey,
      context.ipAddress,
    );
    const protectionDecision = await loginProtection.check(attemptKeys);
    if (!protectionDecision.allowed) {
      return res.status(429).json({
        success: false,
        message: genericLoginError,
      });
    }
    const normalizedTargetKey = normalizeLoginIdentifier(targetKey);

    // Find user by organizationId AND (email OR username OR phone)
    const user = await prisma.userAccount.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { email: targetKey },
          ...(normalizedTargetKey !== targetKey ? [{ email: normalizedTargetKey }] : []),
          { username: targetKey },
          { phone: targetKey },
        ],
      },
    });

    const isMatch = await bcrypt.compare(
      normalizePassword(password),
      user?.passwordHash || await dummyPasswordHash,
    );
    if (!user || !user.isActive || !isMatch) {
      const failure = await loginProtection.recordFailure(attemptKeys);
      await recordLoginFailure(prisma, organizationId, context, user?.id);
      if (failure.newlyLocked) {
        await recordAuthAudit(prisma, {
          eventType: AuthAuditEventType.ACCOUNT_LOCKED,
          userId: user?.id,
          organizationId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          deviceName: context.deviceName,
          reasonCode: 'FAILED_LOGIN_THRESHOLD',
        });
      }
      if (user && (failure.accountAttempts === 3 || failure.newlyLocked)) {
        publishLoginSecurityNotification(
          user,
          failure.newlyLocked ? 'ACCOUNT_LOCKED' : 'SUSPICIOUS_ATTEMPTS',
        ).catch(error => console.error('[Auth] security notification publish failed', error));
      }
      return res.status(401).json({
        success: false,
        message: genericLoginError,
      });
    }

    await loginProtection.reset(attemptKeys);
    const policy = await getOrganizationAuthPolicy(user.organizationId);
    const { accessToken, rawRefreshToken } = await prisma.$transaction(tx =>
      createAuthenticatedSession(
        tx,
        user,
        context,
        AuthAuditEventType.LOGIN_SUCCESS,
        policy.requireEmailVerification,
        policy.requirePhoneVerification,
      ),
    );
    setRefreshCookie(res, rawRefreshToken);

    return res.status(200).json({
      success: true,
      message: 'Амжилттай нэвтэрлээ.',
      data: {
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
        },
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: genericLoginError,
      });
    }

    console.error('[Login Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const rawRefreshToken = getRefreshTokenCookie(req);
    if (!rawRefreshToken) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан refresh token.',
      });
    }

    const context = getSessionRequestContext(req);
    const result = await rotateRefreshToken(
      prisma,
      rawRefreshToken,
      context,
      async organizationId => {
        const policy = await getOrganizationAuthPolicy(organizationId);
        return {
          requireEmailVerification: policy.requireEmailVerification,
          requirePhoneVerification: policy.requirePhoneVerification,
        };
      },
    );
    if (result.status !== 'success') {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: result.message,
      });
    }
    setRefreshCookie(
      res,
      result.rawRefreshToken,
      result.expiresAt.getTime() - Date.now(),
    );

    return res.status(200).json({
      success: true,
      data: { token: result.accessToken },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[Refresh Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const switchOrganization = async (req: Request, res: Response) => {
  const { organizationId } = switchOrganizationSchema.parse(req.body);
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: req.user!.userId,
      },
    },
    select: {
      organizationId: true,
      role: true,
      status: true,
    },
  });
  if (!membership || membership.status !== 'ACTIVE') {
    throw AppError.forbidden('Энэ байгууллага руу шилжих идэвхтэй membership олдсонгүй.');
  }

  const user = await prisma.userAccount.findFirst({
    where: {
      id: req.user!.userId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      username: true,
      phone: true,
      firstName: true,
      lastName: true,
      organizationId: true,
      role: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });
  if (!user) throw AppError.unauthorized('Хэрэглэгч олдсонгүй эсвэл идэвхгүй.');

  const policy = await getOrganizationAuthPolicy(organizationId);
  if (!policy.active) throw AppError.forbidden('Organization is not active');

  const now = new Date();
  const context = getSessionRequestContext(req);
  const { accessToken, rawRefreshToken } = await prisma.$transaction(async tx => {
    await tx.refreshToken.updateMany({
      where: {
        sessionId: req.user!.sessionId,
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revoked: true,
        revokedAt: now,
      },
    });
    await tx.session.updateMany({
      where: {
        id: req.user!.sessionId,
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokeReason: 'ORGANIZATION_SWITCH',
      },
    });
    return createAuthenticatedSession(
      tx,
      {
        id: user.id,
        organizationId,
        role: membership.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
      context,
      AuthAuditEventType.TOKEN_REFRESH,
      policy.requireEmailVerification,
      policy.requirePhoneVerification,
    );
  });

  setRefreshCookie(res, rawRefreshToken);
  return res.status(200).json({
    success: true,
    message: 'Байгууллагын context амжилттай солигдлоо.',
    data: {
      token: accessToken,
      user: {
        ...user,
        organizationId,
        role: membership.role,
        emailVerificationRequired: isEmailVerificationRequired(
          policy.requireEmailVerification,
          user,
        ),
        phoneVerificationRequired: isPhoneVerificationRequired(
          policy.requirePhoneVerification,
          user,
        ),
        verificationRequired:
          isEmailVerificationRequired(policy.requireEmailVerification, user) ||
          isPhoneVerificationRequired(policy.requirePhoneVerification, user),
        verificationPolicy: {
          requireEmailVerification: policy.requireEmailVerification,
          requirePhoneVerification: policy.requirePhoneVerification,
        },
      },
    },
  });
};

export const logout = async (req: Request, res: Response) => {
  try {
    const rawRefreshToken = getRefreshTokenCookie(req);
    const context = getSessionRequestContext(req);
    if (rawRefreshToken) {
      await logoutByRefreshToken(prisma, rawRefreshToken, context);
    }
    clearRefreshCookie(res);

    return res.status(200).json({ success: true, message: 'Амжилттай гарлаа.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[Logout Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const genericResponse = {
    success: true,
    message: 'Хэрэв энэ имэйл бүртгэлтэй бол нууц үг сэргээх зааврыг илгээлээ.',
  };
  try {
    const { organizationId, email } = forgotPasswordSchema.parse(req.body);
    const context = getSessionRequestContext(req);
    const allowed = await passwordResetRateLimiter.consume(
      `${organizationId}\0${email}`,
      context.ipAddress,
    );
    if (!allowed) return res.status(200).json(genericResponse);

    const user = await prisma.userAccount.findFirst({ where: { organizationId, email } });

    if (!user) {
      await recordAuthAudit(prisma, {
        eventType: AuthAuditEventType.PASSWORD_RESET_REQUESTED,
        organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceName: context.deviceName,
        reasonCode: 'ACCOUNT_NOT_RESOLVED',
      });
      return res.status(200).json(genericResponse);
    }

    const rawToken = createPasswordResetToken();
    const now = new Date();
    await withSerializableRetry(async tx => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          tokenHash: hashPasswordResetToken(rawToken),
          expiresAt: new Date(now.getTime() + getPasswordResetExpiresInMs()),
        },
      });
    });
    await recordAuthAudit(prisma, {
      eventType: AuthAuditEventType.PASSWORD_RESET_REQUESTED,
      userId: user.id,
      organizationId: user.organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      reasonCode: 'EMAIL_REQUESTED',
    });
    publishPasswordResetEmail(user, rawToken).catch(() => {
      console.error('[Auth] password reset email publish failed');
    });

    return res.status(200).json(genericResponse);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[ForgotPassword Error] unexpected failure');
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashPasswordResetToken(token) },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date() ||
      !resetToken.user.isActive
    ) {
      return res.status(400).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан токен.',
      });
    }

    const normalizedPassword = await enforcePasswordPolicy(newPassword, {
      userInfo: resetToken.user,
    });
    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    const now = new Date();

    const context = getSessionRequestContext(req);
    await withSerializableRetry(async tx => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw AppError.badRequest('Хүчингүй эсвэл хугацаа дууссан токен.');
      }
      await tx.userAccount.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          ...(resetToken.user.status === 'INVITED' ? { status: 'ACTIVE' } : {}),
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId, revoked: false },
        data: { revoked: true, revokedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
      });
      await recordAuthAudit(tx, {
        eventType: AuthAuditEventType.PASSWORD_RESET_COMPLETED,
        userId: resetToken.userId,
        organizationId: resetToken.organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceName: context.deviceName,
        reasonCode: 'RESET_TOKEN_CONSUMED',
      });
    });

    clearRefreshCookie(res);
    publishPasswordResetSecurityNotification(resetToken.user).catch(() => {
      console.error('[Auth] password reset security notification publish failed');
    });
    return res.status(200).json({ success: true, message: 'Нууц үг амжилттай шинэчлэгдлээ.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error('[ResetPassword Error] unexpected failure');
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.userAccount.findUnique({
    where: { id: req.user!.userId },
  });
  if (!user || !await bcrypt.compare(normalizePassword(currentPassword), user.passwordHash)) {
    throw AppError.badRequest('Одоогийн нууц үг буруу байна.');
  }

  const normalizedPassword = await enforcePasswordPolicy(newPassword, {
    userInfo: user,
  });
  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const now = new Date();
  const context = getSessionRequestContext(req);
  await prisma.$transaction(async tx => {
    await tx.userAccount.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true, revokedAt: now },
    });
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, revokeReason: 'PASSWORD_CHANGED' },
    });
    await recordAuthAudit(tx, {
      eventType: AuthAuditEventType.PASSWORD_CHANGED,
      userId: user.id,
      organizationId: user.organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      sessionId: req.user!.sessionId,
      reasonCode: 'USER_INITIATED',
    });
  });
  clearRefreshCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Нууц үг амжилттай шинэчлэгдлээ. Дахин нэвтэрнэ үү.',
  });
};

export const sendVerification = async (req: Request, res: Response) => {
  try {
    const { type } = sendVerificationSchema.parse(req.body);
    if (type === 'PHONE') return sendPhoneVerification(req, res);

    const user = await prisma.userAccount.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй.' });
    }

    if (type === 'EMAIL' && user.isEmailVerified) {
      return res.status(200).json({ success: true, message: 'Имэйл аль хэдийн баталгаажсан.' });
    }
    const verification = await issueVerificationToken(
      user,
      VerificationType.EMAIL,
    );

    return res.status(200).json({
      success: true,
      message: 'Хэрэв боломжтой бол баталгаажуулах зааврыг илгээлээ.',
      ...(isProd() || !verification.rawToken
        ? {}
        : { data: { verificationToken: verification.rawToken } }),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    console.error('[SendVerification Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export const verifyAccount = async (req: Request, res: Response) => {
  try {
    const { token } = verifyTokenSchema.parse(req.body);

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashVerificationToken(token) },
      include: { user: true },
    });

    const alreadyVerified = verificationToken
      ? verificationToken.type === VerificationType.EMAIL
        ? verificationToken.user.isEmailVerified
        : verificationToken.user.isPhoneVerified
      : false;
    const disposition = getVerificationTokenDisposition(
      verificationToken
        ? {
            usedAt: verificationToken.usedAt,
            expiresAt: verificationToken.expiresAt,
            alreadyVerified,
          }
        : null,
      new Date(),
    );
    if (disposition === 'INVALID') {
      return res.status(400).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан токен.',
      });
    }
    if (disposition === 'IDEMPOTENT') {
      return res.status(200).json({
        success: true,
        message: 'Баталгаажуулалт аль хэдийн хийгдсэн.',
      });
    }
    if (!verificationToken) {
      throw AppError.badRequest('Хүчингүй эсвэл хугацаа дууссан токен.');
    }

    await prisma.$transaction(async tx => {
      const claimed = await tx.verificationToken.updateMany({
        where: {
          id: verificationToken.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw AppError.badRequest('Хүчингүй эсвэл хугацаа дууссан токен.');
      }
      await tx.userAccount.update({
        where: { id: verificationToken.userId },
        data:
          verificationToken.type === VerificationType.EMAIL
            ? { isEmailVerified: true }
            : { isPhoneVerified: true },
      });
      await recordAuthAudit(tx, {
        eventType: verificationToken.type === VerificationType.EMAIL
          ? AuthAuditEventType.EMAIL_VERIFIED
          : AuthAuditEventType.PHONE_VERIFIED,
        userId: verificationToken.userId,
        organizationId: verificationToken.organizationId,
        reasonCode: 'ONE_TIME_TOKEN_VERIFIED',
      });
    });

    return res.status(200).json({ success: true, message: 'Амжилттай баталгаажлаа.' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Мэдээлэл буруу байна.',
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    console.error('[VerifyAccount Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};

export async function sendPhoneVerification(req: Request, res: Response) {
  try {
    const user = await prisma.userAccount.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw AppError.unauthorized('Хэрэглэгч олдсонгүй.');
    if (user.isPhoneVerified) {
      return res.status(200).json({
        success: true,
        message: 'Утасны дугаар аль хэдийн баталгаажсан.',
      });
    }
    if (!user.phone) throw AppError.badRequest('Утасны дугаар бүртгэгдээгүй байна.');

    const phone = normalizePhoneNumber(user.phone);
    const now = new Date();
    const policy = getPhoneOtpPolicy();
    const latest = await prisma.verificationToken.findFirst({
      where: { userId: user.id, type: VerificationType.PHONE },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (isVerificationResendThrottled(
      latest?.createdAt || null,
      now,
      policy.resendCooldownMs,
    )) {
      throw new AppError('Дахин код авахын өмнө түр хүлээнэ үү.', 429);
    }

    const context = getSessionRequestContext(req);
    await phoneOtpRateLimiter.consume(phone, context.ipAddress);
    const otp = createPhoneOtp(policy.length);
    const token = await prisma.$transaction(async tx => {
      await tx.verificationToken.updateMany({
        where: { userId: user.id, type: VerificationType.PHONE, usedAt: null },
        data: { usedAt: now },
      });
      return tx.verificationToken.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          type: VerificationType.PHONE,
          tokenHash: hashPhoneOtp(user.id, otp, now.toISOString()),
          attemptCount: 0,
          maxAttempts: policy.maxAttempts,
          expiresAt: new Date(now.getTime() + policy.expiresInMs),
          createdAt: now,
        },
      });
    });

    try {
      await getSmsProvider().sendVerificationSms({
        to: phone,
        code: otp,
        expiresInMinutes: Math.ceil(policy.expiresInMs / 60_000),
      });
    } catch (error) {
      await prisma.verificationToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (error instanceof SmsDeliveryError) {
        throw new AppError('SMS илгээх үйлчилгээ түр боломжгүй байна.', 503);
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: 'Хэрэв боломжтой бол баталгаажуулах кодыг SMS-ээр илгээлээ.',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[SendPhoneVerification Error]', error);
    return res.status(500).json({ success: false, message: 'Дотоод серверийн алдаа.' });
  }
}

export const verifyPhone = async (req: Request, res: Response) => {
  try {
    const { otp } = verifyPhoneSchema.parse(req.body);
    const user = await prisma.userAccount.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw AppError.unauthorized('Хэрэглэгч олдсонгүй.');
    if (user.isPhoneVerified) {
      return res.status(200).json({
        success: true,
        message: 'Утасны дугаар аль хэдийн баталгаажсан.',
      });
    }

    const now = new Date();
    const token = await prisma.verificationToken.findFirst({
      where: { userId: user.id, type: VerificationType.PHONE },
      orderBy: { createdAt: 'desc' },
    });
    const disposition = getPhoneOtpDisposition(token, now);
    if (disposition === 'EXPIRED' && token) {
      await prisma.verificationToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: now },
      });
    }
    if (disposition !== 'VALID' || !token) {
      const status = disposition === 'ATTEMPT_LIMIT' ? 429 : 400;
      return res.status(status).json({
        success: false,
        message: 'Код хүчингүй, хугацаа дууссан эсвэл оролдлогын хязгаарт хүрсэн.',
      });
    }

    if (!phoneOtpMatches(user.id, otp, token.tokenHash, token.createdAt.toISOString())) {
      await prisma.$transaction(async tx => {
        const claimed = await tx.verificationToken.updateMany({
          where: {
            id: token.id,
            usedAt: null,
            expiresAt: { gt: now },
            attemptCount: { lt: token.maxAttempts },
          },
          data: { attemptCount: { increment: 1 } },
        });
        if (claimed.count === 1 && token.attemptCount + 1 >= token.maxAttempts) {
          await tx.verificationToken.updateMany({
            where: { id: token.id, usedAt: null },
            data: { usedAt: now },
          });
        }
      });
      return res.status(400).json({
        success: false,
        message: 'Код хүчингүй, хугацаа дууссан эсвэл оролдлогын хязгаарт хүрсэн.',
      });
    }

    const context = getSessionRequestContext(req);
    await prisma.$transaction(async tx => {
      const claimed = await tx.verificationToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now },
          attemptCount: { lt: token.maxAttempts },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw AppError.badRequest('Код хүчингүй, хугацаа дууссан эсвэл ашиглагдсан.');
      }
      await tx.userAccount.update({
        where: { id: user.id },
        data: { isPhoneVerified: true },
      });
      await recordAuthAudit(tx, {
        eventType: AuthAuditEventType.PHONE_VERIFIED,
        userId: user.id,
        organizationId: user.organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceName: context.deviceName,
        sessionId: req.user!.sessionId,
        reasonCode: 'OTP_VERIFIED',
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Утасны дугаар амжилттай баталгаажлаа.',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: error.errors[0]?.message || 'Кодын формат буруу байна.',
      });
    }
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('[VerifyPhone Error]', error);
    return res.status(500).json({ success: false, message: 'Дотоод серверийн алдаа.' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        id: req.user!.sessionId,
        userId: req.user!.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Хүчингүй эсвэл хугацаа дууссан session.',
      });
    }

    const user = await prisma.userAccount.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        status: true,
        studentId: true,
        employeeId: true,
        profileImageKey: true,
        language: true,
        timezone: true,
        notificationPreferences: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Хэрэглэгч олдсонгүй эсвэл идэвхгүй.',
      });
    }

    const policy = await getOrganizationAuthPolicy(req.user!.organizationId);
    return res.status(200).json({
      success: true,
      data: {
        ...user,
        organizationId: req.user!.organizationId,
        role: req.user!.role as Role,
        emailVerificationRequired: isEmailVerificationRequired(
          policy.requireEmailVerification,
          user,
        ),
        phoneVerificationRequired: isPhoneVerificationRequired(
          policy.requirePhoneVerification,
          user,
        ),
        verificationRequired:
          isEmailVerificationRequired(policy.requireEmailVerification, user) ||
          isPhoneVerificationRequired(policy.requirePhoneVerification, user),
        verificationPolicy: {
          requireEmailVerification: policy.requireEmailVerification,
          requirePhoneVerification: policy.requirePhoneVerification,
        },
      },
    });
  } catch (error) {
    console.error('[GetMe Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Дотоод серверийн алдаа.',
    });
  }
};
