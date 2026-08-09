import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const attendanceEventSchema = z.object({
  organizationId: z.string().min(1),
  attendanceId: z.string().min(1).max(200),
  studentId: z.string().min(1).max(200),
  cohortId: z.string().min(1).max(200),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  date: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).max(1000),
  thresholdCrossed: z.boolean(),
  absenceCount: z.number().int().nonnegative(),
  threshold: z.number().int().positive().default(3),
  instructorId: z.string().min(1).nullable(),
  managerIds: z.array(z.string().min(1)).max(1000).default([]),
  changeId: z.string().min(1),
}).strict();

const statusCopy: Record<'ABSENT' | 'LATE', string> = {
  ABSENT: 'Таны хүүхэд өнөөдөр хичээлд ирээгүй байна',
  LATE: 'Таны хүүхэд өнөөдөр хичээлд хоцорсон байна',
};

type Action = 'recorded' | 'updated';

export async function deliverAttendanceNotifications(action: Action, raw: unknown) {
  const event = attendanceEventSchema.parse(raw);
  if (event.status !== 'ABSENT' && event.status !== 'LATE') return;

  const recipients = [...new Set(event.recipientIds)];
  const body = statusCopy[event.status];
  await Promise.all(recipients.map(userId =>
    deliverNotification({
      organizationId: event.organizationId,
      userId,
      eventType: `ATTENDANCE_${event.status}`,
      idempotencyKey: `attendance:${action}:${event.attendanceId}:${event.changeId}:${userId}`,
      title: event.status === 'ABSENT' ? 'Тасалсан бүртгэл' : 'Хоцорсон бүртгэл',
      body,
      channels: ['IN_APP'],
      digestEligible: false,
      // Role-relative: only guardians (PARENT) receive this notification, and
      // every PARENT-role recipient has an /attendance page under their own
      // dashboard prefix — resolveNotificationActionUrl (frontend) prefixes it.
      metadata: { attendanceId: event.attendanceId, cohortId: event.cohortId, date: event.date, actionUrl: 'attendance' },
    })
  ));

  if (event.thresholdCrossed) {
    const alertRecipients = [...new Set([...recipients, ...event.managerIds, ...(event.instructorId ? [event.instructorId] : [])])];
    const alertBody = `Сурагч энэ хугацаанд ${event.absenceCount} удаа тасалсан байна (босго: ${event.threshold}).`;
    await Promise.all(alertRecipients.map(userId =>
      deliverNotification({
        organizationId: event.organizationId,
        userId,
        eventType: 'ATTENDANCE_THRESHOLD_ALERT',
        idempotencyKey: `attendance:threshold:${event.studentId}:${event.absenceCount}:${userId}`,
        title: 'Тасалсан тоо босгыг давлаа',
        body: alertBody,
        channels: ['IN_APP'],
        digestEligible: false,
        metadata: { studentId: event.studentId, cohortId: event.cohortId, absenceCount: event.absenceCount, threshold: event.threshold },
      })
    ));
  }
}

const startOne = (action: Action, eventType: typeof EVENTS.ATTENDANCE_RECORDED | typeof EVENTS.ATTENDANCE_UPDATED) =>
  subscribeToEvent(
    EVENT_EXCHANGE,
    `notification-service.attendance-${action}.v1`,
    eventType,
    raw => deliverAttendanceNotifications(action, raw),
    { deadLetter: true, inbox: notificationInbox },
  );

export const startAttendanceConsumers = () => Promise.all([
  startOne('recorded', EVENTS.ATTENDANCE_RECORDED),
  startOne('updated', EVENTS.ATTENDANCE_UPDATED),
]);
