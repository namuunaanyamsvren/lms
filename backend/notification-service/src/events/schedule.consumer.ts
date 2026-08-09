import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

export const scheduleEventSchema = z.object({
  organizationId: z.string().min(1),
  scheduleId: z.string().min(1).max(200),
  courseId: z.string().min(1).max(200),
  termId: z.string().min(1).max(200).nullable(),
  title: z.string().min(1).max(200),
  dayOfWeek: z.enum([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  room: z.string().nullable(),
  timezone: z.literal('Asia/Ulaanbaatar'),
  recipientIds: z.array(z.string().min(1)).max(100_000),
  changeId: z.string().datetime(),
}).strict();

const dayLabels: Record<z.infer<typeof scheduleEventSchema>['dayOfWeek'], string> = {
  MONDAY: 'Даваа',
  TUESDAY: 'Мягмар',
  WEDNESDAY: 'Лхагва',
  THURSDAY: 'Пүрэв',
  FRIDAY: 'Баасан',
  SATURDAY: 'Бямба',
  SUNDAY: 'Ням',
};

type ScheduleAction = 'created' | 'updated' | 'deleted';
const copy: Record<ScheduleAction, { title: string; eventType: string }> = {
  created: { title: 'Шинэ хуваарь нэмэгдлээ', eventType: 'SCHEDULE_CREATED' },
  updated: { title: 'Хичээлийн хуваарь шинэчлэгдлээ', eventType: 'SCHEDULE_UPDATED' },
  deleted: { title: 'Хичээлийн хуваарь цуцлагдлаа', eventType: 'SCHEDULE_DELETED' },
};

export async function deliverScheduleNotifications(action: ScheduleAction, raw: unknown) {
  const event = scheduleEventSchema.parse(raw);
  const recipients = [...new Set(event.recipientIds)];
  const body = `${event.title}: ${dayLabels[event.dayOfWeek]} ${event.startTime}–${event.endTime}${event.room ? `, ${event.room}` : ''}`;
  for (let offset = 0; offset < recipients.length; offset += 100) {
    await Promise.all(recipients.slice(offset, offset + 100).map(userId =>
      deliverNotification({
        organizationId: event.organizationId,
        userId,
        eventType: copy[action].eventType,
        idempotencyKey: `schedule:${action}:${event.scheduleId}:${event.changeId}:${userId}`,
        title: copy[action].title,
        body,
        channels: ['IN_APP'],
        digestEligible: false,
        // Role-relative: recipients are always enrolled students + their
        // guardians (recipientIdsForCourse, schedule.service.ts) — both roles
        // have a /schedules page under their own dashboard prefix.
        metadata: {
          scheduleId: event.scheduleId,
          courseId: event.courseId,
          timezone: event.timezone,
          changeId: event.changeId,
          actionUrl: 'schedules',
        },
      })
    ));
  }
}

const startOne = (
  action: ScheduleAction,
  eventType: typeof EVENTS.SCHEDULE_CREATED | typeof EVENTS.SCHEDULE_UPDATED | typeof EVENTS.SCHEDULE_DELETED,
) => subscribeToEvent(
  EVENT_EXCHANGE,
  `notification-service.schedule-${action}.v1`,
  eventType,
  raw => deliverScheduleNotifications(action, raw),
  { deadLetter: true, inbox: notificationInbox },
);

export const startScheduleConsumers = () => Promise.all([
  startOne('created', EVENTS.SCHEDULE_CREATED),
  startOne('updated', EVENTS.SCHEDULE_UPDATED),
  startOne('deleted', EVENTS.SCHEDULE_DELETED),
]);
