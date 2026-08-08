import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { notificationInbox, notificationPrisma } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  firstName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
}).passthrough();

export const startUserUpdatedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.user-updated.v1',
    EVENTS.USER_UPDATED,
    async raw => {
      const event = payloadSchema.parse(raw);
      await notificationPrisma.notificationRecipient.upsert({
        where: { organizationId_userId: { organizationId: event.organizationId, userId: event.userId } },
        create: {
          organizationId: event.organizationId,
          userId: event.userId,
          email: event.email || undefined,
          phone: event.phone || undefined,
          firstName: event.firstName || undefined,
          role: event.role,
        },
        update: {
          email: event.email || undefined,
          phone: event.phone || undefined,
          firstName: event.firstName || undefined,
          role: event.role,
        },
      });
    },
    { deadLetter: true, inbox: notificationInbox },
  );
