import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const consentPublishedEventSchema = z.object({
  organizationId: z.string().min(1),
  consentFormId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  dueAt: z.string().min(1).nullable(),
  recipientIds: z.array(z.string().min(1)).max(1000),
}).strict();

export async function deliverConsentFormPublishedNotifications(raw: unknown) {
  const event = consentPublishedEventSchema.parse(raw);
  const recipients = [...new Set(event.recipientIds)];
  const body = event.dueAt
    ? `Шинэ зөвшөөрлийн маягт: "${event.title}". Хариу өгөх эцсийн хугацаа: ${event.dueAt.slice(0, 10)}`
    : `Шинэ зөвшөөрлийн маягт: "${event.title}". Хариу өгнө үү.`;

  await Promise.all(recipients.map(userId =>
    deliverNotification({
      organizationId: event.organizationId,
      userId,
      eventType: 'CONSENT_FORM_PUBLISHED',
      idempotencyKey: `consent:published:${event.consentFormId}:${userId}`,
      title: 'Зөвшөөрлийн маягт',
      body,
      channels: ['IN_APP'],
      digestEligible: false,
      // Absolute: /consent-forms is a single top-level route shared by every
      // role that can receive this notification (no role-prefix needed).
      metadata: { consentFormId: event.consentFormId, actionUrl: '/consent-forms' },
    })
  ));
}

export const startConsentConsumers = () => subscribeToEvent(
  EVENT_EXCHANGE,
  'notification-service.consent-form-published.v1',
  EVENTS.CONSENT_FORM_PUBLISHED,
  raw => deliverConsentFormPublishedNotifications(raw),
  { deadLetter: true, inbox: notificationInbox },
);
