import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  recipientEmail: z.string().email(),
  resetUrl: z.string().url(),
  occurredAt: z.string().datetime(),
}).strict();

export const startPasswordResetConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.password-reset.v2',
    EVENTS.PASSWORD_RESET_REQUESTED,
    async raw => {
      try {
        const event = payloadSchema.parse(raw);
        await deliverNotification({organizationId:event.organizationId,userId:event.userId,eventType:'PASSWORD_RESET',idempotencyKey:`password-reset:${event.userId}:${event.occurredAt}`,channels:['EMAIL'],recipientEmail:event.recipientEmail,variables:{actionUrl:event.resetUrl},digestEligible:false});
      } catch {
        // Do not allow validation/provider error objects to expose the URL,
        // whose query string contains the one-time reset credential.
        throw new Error('Password reset email delivery failed');
      }
    },
    { deadLetter: true, inbox: notificationInbox },
  );
