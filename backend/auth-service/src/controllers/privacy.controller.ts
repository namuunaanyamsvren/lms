import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { AuthAuditEventType, Prisma } from '@prisma/client-auth';
import {
  AppError,
  clearRefreshCookie,
  maskIp,
  serviceAuthorizationHeaders,
  revokeUserAccess,
  clearUserAccessRevocation,
} from '@lms/shared';
import { enqueueUserAnonymized } from '../services/auth-outbox.service';
import { sanitizeAuthAuditMetadata } from '../services/auth-audit.service';

import { prisma } from '../lib/prisma';
const SERIALIZABLE_RETRY_LIMIT = 5;
const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const withSerializableRetry = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!retryable || attempt === SERIALIZABLE_RETRY_LIMIT) throw error;
      await sleep(25 * attempt);
    }
  }
  throw new Error('Serializable transaction retry limit reached');
};

const getAcademicExport = async (organizationId: string, userId: string) => {
  const baseUrl = process.env.ACADEMIC_SERVICE_URL;
  if (!baseUrl) throw AppError.internal('ACADEMIC_SERVICE_URL is not configured');
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/internal/privacy/export/${encodeURIComponent(organizationId)}/${encodeURIComponent(userId)}`,
      {
        headers: serviceAuthorizationHeaders('auth-service'),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`academic export status ${response.status}`);
    return await response.json();
  } catch {
    throw new AppError('A complete data export is temporarily unavailable', 503);
  }
};

export const exportMyData = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const organizationId = req.user!.organizationId;
  const [account, oauthAccounts, sessions, auditEvents, academic] = await Promise.all([
    prisma.userAccount.findFirst({
      where: { id: userId, organizationId },
      select: {
        id: true,
        organizationId: true,
        username: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.oAuthAccount.findMany({
      where: { userId, organizationId },
      select: { provider: true, email: true, createdAt: true, updatedAt: true },
    }),
    prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        revokeReason: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.authAuditEvent.findMany({
      where: { userId, organizationId },
      select: {
        id: true,
        eventType: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    getAcademicExport(organizationId, userId),
  ]);
  if (!account) throw AppError.notFound('Account not found');

  const exportedAt = new Date();
  const payload = {
    schemaVersion: '1.0',
    exportedAt,
    scope: 'authenticated-user',
    identity: account,
    connectedAccounts: oauthAccounts,
    sessions: sessions.map(session => ({
      ...session,
      ipAddress: maskIp(session.ipAddress || undefined) || null,
    })),
    authenticationAudit: auditEvents.map(event => ({
      ...event,
      ipAddress: maskIp(event.ipAddress || undefined) || null,
      metadata:
        event.metadata &&
        typeof event.metadata === 'object' &&
        !Array.isArray(event.metadata)
          ? sanitizeAuthAuditMetadata(event.metadata as Record<string, unknown>)
          : {},
    })),
    academic,
  };
  const date = exportedAt.toISOString().slice(0, 10);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="lms-data-export-${date}.json"`);
  res.type('application/json');
  return res.send(JSON.stringify(payload, null, 2));
};

export const anonymizeMyAccount = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const organizationId = req.user!.organizationId;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10);
  const now = new Date();

  await revokeUserAccess(organizationId, userId);
  let updated: { id: string; organizationId: string };
  try {
    updated = await withSerializableRetry(async tx => {
      const account = await tx.userAccount.findFirst({
        where: { id: userId, organizationId, isActive: true },
        select: { id: true, organizationId: true },
      });
      if (!account) throw AppError.notFound('Active account not found');

      await tx.oAuthAccount.deleteMany({ where: { userId, organizationId } });
      await tx.passwordResetToken.deleteMany({ where: { userId, organizationId } });
      await tx.verificationToken.deleteMany({ where: { userId, organizationId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.authAuditEvent.updateMany({
        where: { userId, organizationId },
        data: {
          userId: null,
          ipAddress: null,
          userAgent: null,
          metadata: {},
        },
      });
      const anonymized = await tx.userAccount.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@invalid.local`,
          username: null,
          phone: null,
          firstName: null,
          lastName: null,
          passwordHash,
          isActive: false,
          isEmailVerified: false,
          isPhoneVerified: false,
          deletedAt: now,
        },
        select: { id: true, organizationId: true },
      });
      await tx.authAuditEvent.create({
        data: {
          eventType: AuthAuditEventType.ACCOUNT_ANONYMIZED,
          organizationId,
          metadata: { reasonCode: 'USER_REQUESTED_ACCOUNT_DELETION' },
        },
      });
      await enqueueUserAnonymized(tx, { userId, organizationId });
      return anonymized;
    });
  } catch (error) {
    await clearUserAccessRevocation(organizationId, userId).catch(() => undefined);
    throw error;
  }

  clearRefreshCookie(res);
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  return res.json({
    success: true,
    data: {
      accountId: updated.id,
      anonymizedAt: now,
      retainedRecords:
        'Academic records may be retained without direct identity according to the organization retention policy.',
    },
  });
};
