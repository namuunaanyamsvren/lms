import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { enqueueUserAnonymized, enqueueUserCreated } from '../services/auth-outbox.service';
import { enforcePasswordPolicy } from '../services/password-policy.service';

import { prisma } from '../lib/prisma';

export const provisionOrganizationAdmin = async (req: Request, res: Response) => {
  const normalizedPassword = await enforcePasswordPolicy(req.body.password, {
    userInfo: req.body,
  });
  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const user = await prisma.$transaction(async tx => {
    const created = await tx.userAccount.create({ data: {
      organizationId: req.params.organizationId,
      email: req.body.email,
      username: req.body.username,
      phone: req.body.phone,
      passwordHash,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      role: 'ORG_ADMIN',
      isActive: req.body.isActive === false ? false : true,
    }});
    await enqueueUserCreated(tx, created);
    return created;
  });
  return res.status(201).json({ success: true, data: user });
};

export const activateOrganizationAdmins = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const result = await prisma.userAccount.updateMany({
    where: {
      organizationId,
      role: 'ORG_ADMIN',
      deletedAt: null,
    },
    data: { isActive: true },
  });
  return res.json({ success: true, data: { activated: result.count } });
};

export const revokeOrganizationSessions = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
    ? req.body.reason.trim().slice(0, 500)
    : 'ORGANIZATION_STATUS_REVOKE';
  const now = new Date();
  const userIds = (await prisma.userAccount.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true },
  })).map(user => user.id);
  if (userIds.length === 0) {
    return res.json({ success: true, data: { sessionsRevoked: 0, refreshTokensRevoked: 0 } });
  }
  const [sessions, refreshTokens] = await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId: { in: userIds }, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    }),
    prisma.refreshToken.updateMany({
      where: { organizationId, revoked: false },
      data: { revoked: true, revokedAt: now },
    }),
  ]);
  return res.json({
    success: true,
    data: {
      sessionsRevoked: sessions.count,
      refreshTokensRevoked: refreshTokens.count,
    },
  });
};

export const removeOrganizationAccounts = async (req: Request, res: Response) => {
  const organizationId = req.params.organizationId;
  const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 10);
  await prisma.$transaction(async tx => {
    const accounts = await tx.userAccount.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });
    const userIds = accounts.map(account => account.id);
    await tx.oAuthAccount.deleteMany({ where: { organizationId } });
    await tx.passwordResetToken.deleteMany({ where: { organizationId } });
    await tx.verificationToken.deleteMany({ where: { organizationId } });
    await tx.session.deleteMany({ where: { userId: { in: userIds } } });
    await tx.authAuditEvent.updateMany({
      where: { organizationId },
      data: { userId: null, ipAddress: null, userAgent: null, metadata: {} },
    });
    const deletedAt = new Date();
    for (const account of accounts) {
      await tx.userAccount.update({
        where: { id: account.id },
        data: {
          email: `deleted+${account.id}@invalid.local`,
          username: null,
          phone: null,
          firstName: null,
          lastName: null,
          passwordHash,
          isActive: false,
          isEmailVerified: false,
          isPhoneVerified: false,
          deletedAt,
        },
      });
      await enqueueUserAnonymized(tx, { userId: account.id, organizationId });
    }
  });
  return res.status(204).send();
};
