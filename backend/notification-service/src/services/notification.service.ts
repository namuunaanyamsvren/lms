import { DeliveryStatus, DigestMode, NotificationType } from '@prisma/client-notification';
import { createPrismaInbox, getRedisClient } from '@lms/shared';
import { z } from 'zod';
import { renderTemplate } from './template.service';
import { sendChannel } from './channel-provider.service';
import { prisma } from '../lib/prisma';
const channel = z.nativeEnum(NotificationType);
export const notificationEventSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(100),
    userId: z.string().trim().min(1).max(100),
    eventType: z.string().trim().min(1).max(100).default('GENERAL'),
    idempotencyKey: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    type: channel.optional(),
    channels: z.array(channel).min(1).max(4).optional(),
    recipientEmail: z.string().email().optional(),
    recipientPhone: z.string().max(30).optional(),
    variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    metadata: z.record(z.unknown()).optional(),
    digestEligible: z.boolean().default(true),
    expiresAt: z.coerce.date().optional(),
  })
  .strict()
  .refine((x) => x.title || x.eventType !== 'GENERAL', {
    message: 'title is required for GENERAL events',
  })
  .refine((x) => x.body || x.eventType !== 'GENERAL', {
    message: 'body is required for GENERAL events',
  });
export type NotificationEvent = z.infer<typeof notificationEventSchema>;
const securityEvents = new Set(['PASSWORD_RESET', 'EMAIL_VERIFICATION', 'USER_INVITED']);
const inferTargetType = (actionUrl?: unknown) => {
  if (typeof actionUrl !== 'string') return undefined;
  if (actionUrl.includes('student-access-requests')) return 'studentAccessRequest';
  if (actionUrl.includes('assignments')) return 'assignment';
  if (actionUrl.includes('attendance')) return 'attendance';
  if (actionUrl.includes('reports')) return 'report';
  if (actionUrl.includes('document-requests')) return 'documentRequest';
  if (actionUrl.includes('scholarships')) return 'scholarshipRequest';
  if (actionUrl.includes('consent-forms')) return 'consentForm';
  if (actionUrl.includes('schedules')) return 'schedule';
  return undefined;
};
function normalizeMetadata(event: NotificationEvent) {
  const metadata = { ...event.variables, ...event.metadata };
  const targetType = metadata.targetType || inferTargetType(metadata.actionUrl);
  const targetId =
    metadata.targetId ||
    metadata.requestId ||
    metadata.assignmentId ||
    metadata.attendanceId ||
    metadata.reportJobId ||
    metadata.consentFormId ||
    metadata.cohortId;
  return {
    ...metadata,
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
  };
}
const cacheKey = (org: string, user: string) => `notifications:unread:${org}:${user}`;
const digestEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
const invalidateUnread = async (org: string, user: string) => {
  try {
    await getRedisClient().del(cacheKey(org, user));
  } catch (error) {
    console.warn('[Notification] unread cache invalidation failed', error);
  }
};
const nextDigest = (mode: DigestMode) => {
  const now = new Date();
  if (mode === 'DAILY') {
    now.setUTCDate(now.getUTCDate() + 1);
    now.setUTCHours(8, 0, 0, 0);
  } else {
    now.setUTCDate(now.getUTCDate() + 7);
    now.setUTCHours(8, 0, 0, 0);
  }
  return now;
};
async function resolveChannels(
  event: NotificationEvent
): Promise<{ channels: NotificationType[]; digestMode: DigestMode }> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      organizationId_userId: { organizationId: event.organizationId, userId: event.userId },
    },
    include: { eventPreferences: { where: { eventType: event.eventType } } },
  });
  const base = event.channels || [event.type || NotificationType.IN_APP];
  if (securityEvents.has(event.eventType))
    return { channels: base, digestMode: DigestMode.IMMEDIATE };
  if (pref?.digestMode === DigestMode.NONE) return { channels: [], digestMode: pref.digestMode };
  const override = pref?.eventPreferences[0];
  const enabled: Record<string, boolean> = {
    EMAIL: override?.email ?? pref?.emailEnabled ?? true,
    IN_APP: override?.inApp ?? pref?.inAppEnabled ?? true,
    PUSH: override?.push ?? pref?.pushEnabled ?? false,
    SMS: override?.sms ?? pref?.smsEnabled ?? false,
  };
  return {
    channels: base.filter((c) => enabled[c]),
    digestMode: pref?.digestMode || DigestMode.IMMEDIATE,
  };
}
async function claimDelivery(id: string) {
  const result = await prisma.notificationDelivery.updateMany({
    where: {
      id,
      status: { in: [DeliveryStatus.PENDING, DeliveryStatus.RETRYING] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    data: { status: DeliveryStatus.PROCESSING, lastAttemptAt: new Date() },
  });
  return result.count === 1;
}
export async function processDelivery(id: string) {
  const claimed = await claimDelivery(id);
  if (!claimed) return prisma.notificationDelivery.findUnique({ where: { id } });
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id },
    include: { notification: true },
  });
  if (!delivery || ['DELIVERED', 'DEAD_LETTER', 'SKIPPED'].includes(delivery.status))
    return delivery;
  const recipient = await prisma.notificationRecipient.findUnique({
    where: {
      organizationId_userId: {
        organizationId: delivery.organizationId,
        userId: delivery.notification.userId,
      },
    },
  });
  const variables = {
    title: delivery.notification.title,
    body: delivery.notification.body,
    ...JSON.parse(delivery.notification.metadataJson || '{}'),
  };
  const rendered = await renderTemplate(
    delivery.organizationId,
    delivery.notification.eventType,
    recipient?.locale || 'mn',
    variables
  );
  const address =
    delivery.recipient ||
    (delivery.channel === 'EMAIL'
      ? recipient?.email
      : delivery.channel === 'SMS'
        ? recipient?.phone
        : delivery.notification.userId);
  try {
    if (!address && delivery.channel !== 'PUSH')
      throw new Error(`No recipient for ${delivery.channel}`);
    const subscriptions =
      delivery.channel === 'PUSH'
        ? await prisma.pushSubscription.findMany({
            where: {
              organizationId: delivery.organizationId,
              userId: delivery.notification.userId,
            },
          })
        : [];
    if (delivery.channel === 'PUSH' && !subscriptions.length)
      throw new Error('No Web Push subscription');
    const result = await sendChannel(delivery.channel, {
      recipient: address || '',
      ...rendered,
      pushSubscriptions: subscriptions,
    });
    const updated = await prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        provider: result.provider,
        providerMessageId: result.messageId,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        deliveredAt: new Date(),
        lastError: null,
      },
    });
    if (delivery.channel === 'IN_APP')
      await invalidateUnread(delivery.organizationId, delivery.notification.userId);
    return updated;
  } catch (error: any) {
    const attempts = delivery.attemptCount + 1,
      max = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
    if (attempts >= max) {
      await prisma.$transaction([
        prisma.notificationDelivery.update({
          where: { id },
          data: {
            status: 'DEAD_LETTER',
            attemptCount: attempts,
            lastAttemptAt: new Date(),
            lastError: String(error.message).slice(0, 2000),
          },
        }),
        prisma.deadLetter.create({
          data: {
            organizationId: delivery.organizationId,
            eventType: delivery.notification.eventType,
            idempotencyKey: delivery.notification.idempotencyKey,
            payloadJson: JSON.stringify({ deliveryId: id }),
            error: String(error.message).slice(0, 2000),
            attempts,
          },
        }),
      ]);
    } else {
      const base = Number(process.env.NOTIFICATION_RETRY_BASE_MS || 30000),
        delay = Math.min(
          base * 2 ** (attempts - 1),
          Number(process.env.NOTIFICATION_RETRY_MAX_MS || 3600000)
        );
      await prisma.notificationDelivery.update({
        where: { id },
        data: {
          status: 'RETRYING',
          attemptCount: attempts,
          lastAttemptAt: new Date(),
          nextAttemptAt: new Date(Date.now() + delay),
          lastError: String(error.message).slice(0, 2000),
        },
      });
    }
    return null;
  }
}
export async function deliverNotification(input: unknown) {
  const event = notificationEventSchema.parse(input);
  const existing = await prisma.notification.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId: event.organizationId,
        idempotencyKey: event.idempotencyKey,
      },
    },
    include: { deliveries: true },
  });
  if (existing) return existing;
  const route = await resolveChannels(event);
  const delayed =
    event.digestEligible &&
    (route.digestMode === DigestMode.DAILY || route.digestMode === DigestMode.WEEKLY);
  const notification = await prisma.notification.create({
    data: {
      organizationId: event.organizationId,
      userId: event.userId,
      title: event.title || event.eventType,
      body: event.body || '',
      eventType: event.eventType,
      idempotencyKey: event.idempotencyKey,
      metadataJson: JSON.stringify(normalizeMetadata(event)),
      expiresAt: event.expiresAt,
      type: event.type || route.channels[0] || NotificationType.IN_APP,
      deliveries: {
        create: route.channels.map((c) => ({
          organizationId: event.organizationId,
          channel: c,
          recipient:
            c === NotificationType.EMAIL
              ? event.recipientEmail
              : c === NotificationType.SMS
                ? event.recipientPhone
                : undefined,
          status: DeliveryStatus.PENDING,
          nextAttemptAt:
            delayed && c !== NotificationType.IN_APP
              ? nextDigest(route.digestMode as 'DAILY' | 'WEEKLY')
              : new Date(),
        })),
      },
    },
    include: { deliveries: true },
  });
  await invalidateUnread(event.organizationId, event.userId);
  await Promise.all(
    notification.deliveries
      .filter((d) => !d.nextAttemptAt || d.nextAttemptAt <= new Date())
      .map((d) => processDelivery(d.id))
  );
  return notification;
}
export async function unreadCount(organizationId: string, userId: string) {
  try {
    const redis = getRedisClient(),
      key = cacheKey(organizationId, userId),
      cached = await redis.get(key);
    if (cached !== null) return Number(cached);
    const count = await prisma.notification.count({
      where: {
        organizationId,
        userId,
        isRead: false,
        deliveries: { some: { channel: 'IN_APP', status: 'DELIVERED' } },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    await redis.set(key, String(count), 'EX', 60);
    return count;
  } catch {
    return prisma.notification.count({
      where: {
        organizationId,
        userId,
        isRead: false,
        deliveries: { some: { channel: 'IN_APP', status: 'DELIVERED' } },
      },
    });
  }
}
export async function processDueDeliveries(limit = 100) {
  const staleBefore = new Date(
    Date.now() - Number(process.env.NOTIFICATION_PROCESSING_STALE_MS || 15 * 60_000)
  );
  await prisma.notificationDelivery.updateMany({
    where: { status: DeliveryStatus.PROCESSING, lastAttemptAt: { lt: staleBefore } },
    data: {
      status: DeliveryStatus.RETRYING,
      nextAttemptAt: new Date(),
      lastError: 'Recovered stale processing claim',
    },
  });
  const rows = await prisma.notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    include: { notification: true },
  });
  const immediate: typeof rows = [],
    groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const pref = await prisma.notificationPreference.findUnique({
      where: {
        organizationId_userId: {
          organizationId: row.organizationId,
          userId: row.notification.userId,
        },
      },
    });
    if (
      row.channel !== 'IN_APP' &&
      pref &&
      [DigestMode.DAILY, DigestMode.WEEKLY].includes(pref.digestMode as any)
    ) {
      if (!(await claimDelivery(row.id))) continue;
      const key = `${row.organizationId}:${row.notification.userId}:${row.channel}`;
      groups.set(key, [...(groups.get(key) || []), row]);
    } else immediate.push(row);
  }
  await Promise.all(immediate.map((x) => processDelivery(x.id)));
  for (const batch of groups.values()) {
    const first = batch[0],
      recipient = await prisma.notificationRecipient.findUnique({
        where: {
          organizationId_userId: {
            organizationId: first.organizationId,
            userId: first.notification.userId,
          },
        },
      });
    const address =
      first.recipient ||
      (first.channel === 'EMAIL'
        ? recipient?.email
        : first.channel === 'SMS'
          ? recipient?.phone
          : first.notification.userId);
    try {
      const subscriptions =
        first.channel === 'PUSH'
          ? await prisma.pushSubscription.findMany({
              where: { organizationId: first.organizationId, userId: first.notification.userId },
            })
          : [];
      const items = batch
        .map((x) => `• ${x.notification.title}: ${x.notification.body}`)
        .join('\n');
      const html = `<h1>Мэдэгдлийн хураангуй</h1><ul>${batch.map((x) => `<li><b>${digestEscape(x.notification.title)}</b>: ${digestEscape(x.notification.body)}</li>`).join('')}</ul>`;
      const result = await sendChannel(first.channel, {
        recipient: address || '',
        subject: 'Мэдэгдлийн хураангуй',
        text: items,
        html,
        pushSubscriptions: subscriptions,
      });
      await prisma.notificationDelivery.updateMany({
        where: { id: { in: batch.map((x) => x.id) } },
        data: {
          status: 'DELIVERED',
          provider: result.provider,
          providerMessageId: result.messageId,
          deliveredAt: new Date(),
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
    } catch (error: any) {
      const base = Number(process.env.NOTIFICATION_RETRY_BASE_MS || 30000),
        max = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      for (const row of batch) {
        const attempts = row.attemptCount + 1;
        if (attempts >= max)
          await prisma.$transaction([
            prisma.notificationDelivery.update({
              where: { id: row.id },
              data: {
                status: 'DEAD_LETTER',
                attemptCount: attempts,
                lastAttemptAt: new Date(),
                lastError: String(error.message).slice(0, 2000),
              },
            }),
            prisma.deadLetter.create({
              data: {
                organizationId: row.organizationId,
                eventType: row.notification.eventType,
                idempotencyKey: row.notification.idempotencyKey,
                payloadJson: JSON.stringify({ deliveryId: row.id, digest: true }),
                error: String(error.message).slice(0, 2000),
                attempts,
              },
            }),
          ]);
        else
          await prisma.notificationDelivery.update({
            where: { id: row.id },
            data: {
              status: 'RETRYING',
              attemptCount: attempts,
              lastAttemptAt: new Date(),
              nextAttemptAt: new Date(Date.now() + Math.min(base * 2 ** row.attemptCount, 3600000)),
              lastError: String(error.message).slice(0, 2000),
            },
          });
      }
    }
  }
  return rows.length;
}
export async function cleanupRetention() {
  const days = Number(process.env.NOTIFICATION_RETENTION_DAYS || 90),
    before = new Date(Date.now() - days * 86400000);
  return prisma.notification.deleteMany({ where: { createdAt: { lt: before } } });
}
export const notificationInbox = createPrismaInbox(prisma.eventInbox);
export { prisma as notificationPrisma, invalidateUnread };
