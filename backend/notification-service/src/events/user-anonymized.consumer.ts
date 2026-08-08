import { createPrismaInbox, EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { notificationPrisma } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
}).passthrough();

export const startUserAnonymizedConsumer = () => {
  const inbox = createPrismaInbox(notificationPrisma.eventInbox);
  return subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.user-anonymized',
    EVENTS.USER_ANONYMIZED,
    async raw => {
      const event = payloadSchema.parse(raw);
      const where = {
        organizationId: event.organizationId,
        userId: event.userId,
      };
      await notificationPrisma.$transaction(async tx => {
        await tx.notification.deleteMany({ where });
        await tx.pushSubscription.deleteMany({ where });
        await tx.notificationPreference.deleteMany({ where });
        await tx.notificationRecipient.deleteMany({ where });
      });
    },
    { deadLetter: true, inbox },
  );
};
