import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const payloadSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  recipientEmail: z.string().email(),
  verificationUrl: z.string().url(),
  occurredAt: z.string().datetime(),
}).strict();

export const startEmailVerificationConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.email-verification.v2',
    EVENTS.EMAIL_VERIFICATION_REQUESTED,
    async raw => {
      try {
        const event = payloadSchema.parse(raw);
        await deliverNotification({organizationId:event.organizationId,userId:event.userId,eventType:'EMAIL_VERIFICATION',idempotencyKey:`email-verification:${event.userId}:${event.occurredAt}`,channels:['EMAIL'],recipientEmail:event.recipientEmail,variables:{actionUrl:event.verificationUrl},digestEligible:false});
      } catch {
        throw new Error('Verification email delivery failed');
      }
    },
    { deadLetter: true, inbox: notificationInbox },
  );
