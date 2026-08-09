import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  recipientEmail: z.string().email(),
  setPasswordUrl: z.string().url(),
  occurredAt: z.string().datetime(),
}).strict();

export const startUserInvitedConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.user-invited.v1',
    EVENTS.USER_INVITED,
    async raw => {
      try {
        const event = payloadSchema.parse(raw);
        await deliverNotification({organizationId:event.organizationId,userId:event.userId,eventType:'USER_INVITED',idempotencyKey:`user-invited:${event.userId}:${event.occurredAt}`,channels:['EMAIL'],recipientEmail:event.recipientEmail,variables:{actionUrl:event.setPasswordUrl},digestEligible:false});
      } catch {
        // Do not allow validation/provider error objects to expose the URL,
        // whose query string contains the one-time password-set credential.
        throw new Error('User invite email delivery failed');
      }
    },
    { deadLetter: true, inbox: notificationInbox },
  );
