import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const payloadSchema = z.object({
  organizationId: z.string().min(1),
  studentUserId: z.string().min(1),
  recipientEmail: z.string().email(),
  studentName: z.string().min(1),
  studentId: z.string().nullable().optional(),
  guardianLinkCode: z.string().min(1),
  registerUrl: z.string().url(),
  loginUrl: z.string().url(),
  occurredAt: z.string().datetime(),
}).strict();

export const startGuardianInviteConsumer = () =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.guardian-invite.v1',
    EVENTS.GUARDIAN_INVITE_REQUESTED,
    async raw => {
      const event = payloadSchema.parse(raw);
      await deliverNotification({
        organizationId: event.organizationId,
        userId: event.studentUserId,
        eventType: 'GUARDIAN_INVITE',
        idempotencyKey: `guardian-invite:${event.studentUserId}:${event.recipientEmail}:${event.occurredAt}`,
        channels: ['EMAIL'],
        recipientEmail: event.recipientEmail,
        variables: {
          studentName: event.studentName,
          studentId: event.studentId || '-',
          guardianLinkCode: event.guardianLinkCode,
          registerUrl: event.registerUrl,
          loginUrl: event.loginUrl,
        },
        digestEligible: false,
      });
    },
    { deadLetter: true, inbox: notificationInbox },
  );
