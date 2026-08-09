import crypto from 'crypto';
import {
  AuthAuditEventType,
  Prisma,
  Role,
} from '@prisma/client-auth';
import {
  createAccessToken,
  createSecureRefreshToken,
  getRefreshTokenExpiresInMs,
  hashRefreshToken,
  parseSafeDeviceName,
  resolveClientIp,
} from '@lms/shared';
import { Request } from 'express';
import { AuthAuditWriter, recordAuthAudit } from './auth-audit.service';

export interface SessionUser {
  id: string;
  organizationId: string;
  role: Role;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
}

export interface SessionRequestContext {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

export const getSessionRequestContext = (req: Request): SessionRequestContext => ({
  ipAddress: resolveClientIp(req),
  userAgent: req.get('user-agent')?.slice(0, 1000),
  deviceName: parseSafeDeviceName(req),
});

export const createAuthenticatedSession = async (
  tx: Prisma.TransactionClient,
  user: SessionUser,
  context: SessionRequestContext,
  auditEvent?: AuthAuditEventType,
  emailVerificationRequired = false,
  phoneVerificationRequired = false,
) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getRefreshTokenExpiresInMs());
  const tokenFamilyId = crypto.randomUUID();
  const rawRefreshToken = createSecureRefreshToken();

  const session = await tx.session.create({
    data: {
      userId: user.id,
      tokenFamilyId,
      expiresAt,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
    },
  });

  await tx.refreshToken.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      sessionId: session.id,
      familyId: tokenFamilyId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      expiresAt,
    },
  });

  if (auditEvent) {
    await recordAuthAudit(tx, {
      eventType: auditEvent,
      userId: user.id,
      organizationId: user.organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      sessionId: session.id,
    });
  }

  const accessToken = createAccessToken({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    sessionId: session.id,
    emailVerified: user.isEmailVerified === true,
    emailVerificationRequired,
    phoneVerified: user.isPhoneVerified === true,
    phoneVerificationRequired,
  });

  return { accessToken, rawRefreshToken, session };
};

export const recordLoginFailure = async (
  writer: AuthAuditWriter,
  organizationId: string,
  context: SessionRequestContext,
  userId?: string,
) => {
  await recordAuthAudit(writer, {
    eventType: AuthAuditEventType.LOGIN_FAILURE,
    userId,
    organizationId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    deviceName: context.deviceName,
    reasonCode: 'INVALID_CREDENTIALS',
  });
};
