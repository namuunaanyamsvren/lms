import {
  AuthAuditEventType,
  Prisma,
  PrismaClient,
} from '@prisma/client-auth';
import { hashRefreshToken, maskIp } from '@lms/shared';
import { SessionRequestContext } from './session.service';
import { recordAuthAudit } from './auth-audit.service';

const USER_LOGOUT_REASON = 'User logout';
const LOGOUT_ALL_REASON = 'User logout all';
const USER_REVOKED_REASON = 'User revoked session';
const SERIALIZABLE_RETRY_LIMIT = 3;

const withSerializableRetry = async <T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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

export const logoutByRefreshToken = async (
  prisma: PrismaClient,
  rawRefreshToken: string,
  context: SessionRequestContext,
) => {
  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawRefreshToken) },
  });
  if (!token) return;

  await withSerializableRetry(prisma, async tx => {
    const now = new Date();
    const revoked = await tx.session.updateMany({
      where: {
        id: token.sessionId,
        userId: token.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokeReason: USER_LOGOUT_REASON,
      },
    });
    if (revoked.count === 0) return;

    await tx.refreshToken.updateMany({
      where: {
        sessionId: token.sessionId,
        revokedAt: null,
      },
      data: {
        revoked: true,
        revokedAt: now,
      },
    });
    await recordAuthAudit(tx, {
      eventType: AuthAuditEventType.LOGOUT,
      userId: token.userId,
      organizationId: token.organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      sessionId: token.sessionId,
      reasonCode: 'USER_LOGOUT',
    });
  });
};

export const logoutAllSessions = async (
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  context: SessionRequestContext,
) => {
  const now = new Date();
  await withSerializableRetry(prisma, async tx => {
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokeReason: LOGOUT_ALL_REASON,
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revoked: true,
        revokedAt: now,
      },
    });
    await recordAuthAudit(tx, {
      eventType: AuthAuditEventType.LOGOUT_ALL,
      userId,
      organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      reasonCode: 'USER_LOGOUT_ALL',
    });
  });
};

export const listActiveSessions = async (
  prisma: PrismaClient,
  userId: string,
  currentSessionId: string,
) => {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceName: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });

  return sessions.map(session => ({
    id: session.id,
    deviceName: session.deviceName,
    userAgent: session.userAgent,
    ipAddress: maskIp(session.ipAddress || undefined) || null,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: session.id === currentSessionId,
    ...(session.revokedAt ? { revokedAt: session.revokedAt } : {}),
  }));
};

export const revokeOwnedSession = async (
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  sessionId: string,
  context: SessionRequestContext,
) => {
  const ownedSession = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, revokedAt: true },
  });
  if (!ownedSession) return { found: false, revoked: false };
  if (ownedSession.revokedAt) return { found: true, revoked: false };

  return withSerializableRetry(prisma, async tx => {
    const now = new Date();
    const revoked = await tx.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: {
        revokedAt: now,
        revokeReason: USER_REVOKED_REASON,
      },
    });
    if (revoked.count === 0) return { found: true, revoked: false };

    await tx.refreshToken.updateMany({
      where: { sessionId, userId, revokedAt: null },
      data: {
        revoked: true,
        revokedAt: now,
      },
    });
    await recordAuthAudit(tx, {
      eventType: AuthAuditEventType.SESSION_REVOKED,
      userId,
      organizationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      deviceName: context.deviceName,
      sessionId,
      reasonCode: 'USER_REVOKED_SESSION',
    });
    return { found: true, revoked: true };
  });
};
