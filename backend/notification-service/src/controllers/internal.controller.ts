import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '@lms/shared';
import { notificationPrisma } from '../services/notification.service';

const paramsSchema = z.object({
  organizationId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
});
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const getInternalUserNotificationSummary = async (req: Request, res: Response) => {
  const params = paramsSchema.safeParse(req.params);
  const query = querySchema.safeParse(req.query);
  if (!params.success || !query.success) {
    throw AppError.badRequest('Invalid notification projection request');
  }
  const where = {
    organizationId: params.data.organizationId,
    userId: params.data.userId,
    deliveries: { some: { channel: 'IN_APP' as const, status: 'DELIVERED' as const } },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
  const [unreadCount, items] = await Promise.all([
    notificationPrisma.notification.count({ where: { ...where, isRead: false } }),
    notificationPrisma.notification.findMany({
      where,
      select: { id: true, title: true, body: true, type: true, isRead: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: query.data.limit,
    }),
  ]);
  return res.json({ success: true, data: { unreadCount, items } });
};

export const eraseOrganizationNotifications = async (req: Request, res: Response) => {
  const organizationId = z.string().min(1).max(200).parse(req.params.organizationId);
  await notificationPrisma.$transaction(async tx => {
    await tx.notification.deleteMany({ where: { organizationId } });
    await tx.pushSubscription.deleteMany({ where: { organizationId } });
    await tx.notificationPreference.deleteMany({ where: { organizationId } });
    await tx.notificationRecipient.deleteMany({ where: { organizationId } });
    await tx.notificationTemplate.deleteMany({ where: { organizationId } });
    await tx.notificationBranding.deleteMany({ where: { organizationId } });
    await tx.deadLetter.deleteMany({ where: { organizationId } });
  });
  return res.status(204).send();
};
