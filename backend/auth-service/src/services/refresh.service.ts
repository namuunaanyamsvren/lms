import {
  AuthAuditEventType,
  Prisma,
  PrismaClient,
} from '@prisma/client-auth';
import {
  createAccessToken,
  createSecureRefreshToken,
  hashRefreshToken,
} from '@lms/shared';
import { SessionRequestContext } from './session.service';
import { recordAuthAudit } from './auth-audit.service';

const INVALID_REFRESH_MESSAGE = 'Хүчингүй эсвэл хугацаа дууссан refresh token.';
const REUSE_REVOKE_REASON = 'Refresh token reuse detected';
const SERIALIZABLE_RETRY_LIMIT = 3;

class RefreshClaimConflict extends Error {}

export type RefreshRotationResult =
  | {
      status: 'success';
      accessToken: string;
      rawRefreshToken: string;
      expiresAt: Date;
    }
  | { status: 'invalid'; message: string }
  | { status: 'reuse'; message: string };

const isPrismaWriteConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

const revokeTokenFamily = async (
  prisma: PrismaClient,
  familyId: string,
  userId: string,
  organizationId: string,
  context: SessionRequestContext,
) => {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      const now = new Date();
      await prisma.$transaction(async tx => {
        await tx.session.updateMany({
          where: {
            tokenFamilyId: familyId,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokeReason: REUSE_REVOKE_REASON,
          },
        });
        await tx.refreshToken.updateMany({
          where: {
            familyId,
            revokedAt: null,
          },
          data: {
            revoked: true,
            revokedAt: now,
          },
        });
        await recordAuthAudit(tx, {
          eventType: AuthAuditEventType.TOKEN_REUSE_DETECTED,
          userId,
          organizationId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          deviceName: context.deviceName,
          reasonCode: 'ROTATED_TOKEN_REUSED',
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
      return;
    } catch (error) {
      if (!isPrismaWriteConflict(error) || attempt === SERIALIZABLE_RETRY_LIMIT) {
        throw error;
      }
    }
  }
};

const detectReuseAndRevoke = async (
  prisma: PrismaClient,
  tokenHash: string,
  context: SessionRequestContext,
): Promise<RefreshRotationResult> => {
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (
    token &&
    (token.usedAt || token.revoked || token.revokedAt || token.replacedById)
  ) {
    await revokeTokenFamily(
      prisma,
      token.familyId,
      token.userId,
      token.organizationId,
      context,
    );
    return { status: 'reuse', message: INVALID_REFRESH_MESSAGE };
  }
  return { status: 'invalid', message: INVALID_REFRESH_MESSAGE };
};

export const rotateRefreshToken = async (
  prisma: PrismaClient,
  rawRefreshToken: string,
  context: SessionRequestContext,
  resolveVerificationPolicy?: (organizationId: string) => Promise<{
    requireEmailVerification: boolean;
    requirePhoneVerification: boolean;
  }>,
): Promise<RefreshRotationResult> => {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const initial = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true, session: true },
  });

  if (!initial) {
    return { status: 'invalid', message: INVALID_REFRESH_MESSAGE };
  }
  if (initial.usedAt || initial.revoked || initial.revokedAt || initial.replacedById) {
    return detectReuseAndRevoke(prisma, tokenHash, context);
  }

  const now = new Date();
  if (
    initial.expiresAt <= now ||
    initial.session.expiresAt <= now ||
    initial.session.revokedAt ||
    !initial.user.isActive
  ) {
    return { status: 'invalid', message: INVALID_REFRESH_MESSAGE };
  }
  const verificationPolicy = resolveVerificationPolicy
    ? await resolveVerificationPolicy(initial.organizationId)
    : { requireEmailVerification: false, requirePhoneVerification: false };

  const newRawRefreshToken = createSecureRefreshToken();
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      const accessToken = await prisma.$transaction(async tx => {
      const claimed = await tx.refreshToken.updateMany({
        where: {
          id: initial.id,
          usedAt: null,
          revoked: false,
          revokedAt: null,
          replacedById: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
          revoked: true,
          revokedAt: now,
        },
      });
      if (claimed.count !== 1) throw new RefreshClaimConflict();

      const activeSession = await tx.session.findFirst({
        where: {
          id: initial.sessionId,
          userId: initial.userId,
          tokenFamilyId: initial.familyId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (!activeSession) throw new RefreshClaimConflict();

      const activeUser = await tx.userAccount.findFirst({
        where: { id: initial.userId, isActive: true, deletedAt: null },
        select: {
          id: true,
          organizationId: true,
          role: true,
          isEmailVerified: true,
          isPhoneVerified: true,
        },
      });
      if (!activeUser) throw new RefreshClaimConflict();

      const activeMembership = await tx.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: initial.organizationId,
            userId: initial.userId,
          },
        },
        select: {
          organizationId: true,
          role: true,
          status: true,
        },
      });
      const tokenOrganizationId =
        activeMembership?.status === 'ACTIVE'
          ? activeMembership.organizationId
          : activeUser.organizationId;
      const tokenRole =
        activeMembership?.status === 'ACTIVE'
          ? activeMembership.role
          : activeUser.role;

      const replacement = await tx.refreshToken.create({
        data: {
          organizationId: initial.organizationId,
          userId: initial.userId,
          sessionId: initial.sessionId,
          familyId: initial.familyId,
          tokenHash: hashRefreshToken(newRawRefreshToken),
          expiresAt: initial.expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: initial.id },
        data: { replacedById: replacement.id },
      });
      await tx.session.update({
        where: { id: initial.sessionId },
        data: {
          lastUsedAt: now,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          deviceName: context.deviceName,
        },
      });
      await recordAuthAudit(tx, {
        eventType: AuthAuditEventType.TOKEN_REFRESH,
        userId: initial.userId,
        organizationId: initial.organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        deviceName: context.deviceName,
        sessionId: initial.sessionId,
        reasonCode: 'TOKEN_ROTATED',
      });

      return createAccessToken({
        userId: activeUser.id,
        organizationId: tokenOrganizationId,
        role: tokenRole,
        sessionId: initial.sessionId,
        emailVerified: activeUser.isEmailVerified,
        emailVerificationRequired: verificationPolicy.requireEmailVerification,
        phoneVerified: activeUser.isPhoneVerified,
        phoneVerificationRequired: verificationPolicy.requirePhoneVerification,
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    });

      return {
        status: 'success',
        accessToken,
        rawRefreshToken: newRawRefreshToken,
        expiresAt: initial.expiresAt,
      };
    } catch (error) {
      if (isPrismaWriteConflict(error) && attempt < SERIALIZABLE_RETRY_LIMIT) {
        continue;
      }
      if (error instanceof RefreshClaimConflict || isPrismaWriteConflict(error)) {
        await revokeTokenFamily(
          prisma,
          initial.familyId,
          initial.userId,
          initial.organizationId,
          context,
        );
        return { status: 'reuse', message: INVALID_REFRESH_MESSAGE };
      }
      throw error;
    }
  }
  return { status: 'invalid', message: INVALID_REFRESH_MESSAGE };
};
