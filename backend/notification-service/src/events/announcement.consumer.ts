import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const announcementPublishedEventSchema = z.object({
  organizationId: z.string().min(1),
  announcementId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  recipientIds: z.array(z.string().min(1)).max(2000),
}).strict();

export async function deliverAnnouncementPublishedNotifications(raw: unknown) {
  const event = announcementPublishedEventSchema.parse(raw);
  const recipients = [...new Set(event.recipientIds)];

  await Promise.all(recipients.map(userId =>
    deliverNotification({
      organizationId: event.organizationId,
      userId,
      eventType: 'ANNOUNCEMENT_PUBLISHED',
      idempotencyKey: `announcement:published:${event.announcementId}:${userId}`,
      title: 'Шинэ зар мэдээ',
      body: event.title,
      channels: ['IN_APP'],
      digestEligible: event.priority === 'LOW' || event.priority === 'NORMAL',
      metadata: { announcementId: event.announcementId, priority: event.priority },
    })
  ));
}

export const startAnnouncementConsumers = () => subscribeToEvent(
  EVENT_EXCHANGE,
  'notification-service.announcement-published.v1',
  EVENTS.ANNOUNCEMENT_PUBLISHED,
  raw => deliverAnnouncementPublishedNotifications(raw),
  { deadLetter: true, inbox: notificationInbox },
);
