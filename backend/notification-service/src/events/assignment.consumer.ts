import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const resubmitRequestedEventSchema = z.object({
  organizationId: z.string().min(1),
  studentId: z.string().min(1),
  assignmentId: z.string().min(1),
  assignmentTitle: z.string().min(1).max(200),
  submissionId: z.string().min(1),
  courseId: z.string().min(1).optional(),
  reason: z.string().max(2000).nullable().optional(),
}).strict();

export async function deliverAssignmentResubmitRequestedNotification(raw: unknown) {
  const event = resubmitRequestedEventSchema.parse(raw);
  await deliverNotification({
    organizationId: event.organizationId,
    userId: event.studentId,
    eventType: 'ASSIGNMENT_RESUBMIT_REQUESTED',
    idempotencyKey: `assignment-resubmit:${event.submissionId}`,
    title: 'Даалгавраа дахин илгээх шаардлагатай',
    body: `${event.assignmentTitle}: ${event.reason || 'Багш дахин илгээхийг хүссэн байна.'}`,
    channels: ['IN_APP'],
    metadata: {
      assignmentId: event.assignmentId,
      submissionId: event.submissionId,
      courseId: event.courseId,
      actionUrl: `/student/assignments?assignmentId=${event.assignmentId}`,
    },
  });
}

export const startAssignmentResubmitConsumer = () => subscribeToEvent(
  EVENT_EXCHANGE,
  'notification-service.assignment-resubmit-requested.v1',
  EVENTS.ASSIGNMENT_RESUBMIT_REQUESTED,
  raw => deliverAssignmentResubmitRequestedNotification(raw),
  { deadLetter: true, inbox: notificationInbox },
);

// GRADE_PUBLISHED is also emitted for course-level manual grades and CSV bulk
// imports that aren't tied to an assignment submission — the assignment-only
// fields stay optional so those payloads don't fail validation here.
const gradePublishedEventSchema = z.object({
  organizationId: z.string().min(1),
  studentId: z.string().min(1),
  gradeId: z.string().min(1),
  submissionId: z.string().min(1).optional(),
  assignmentId: z.string().min(1).optional(),
  assignmentTitle: z.string().min(1).max(200).optional(),
  score: z.number(),
  maxPoints: z.number().optional(),
}).strict();

export async function deliverGradePublishedNotification(raw: unknown) {
  const event = gradePublishedEventSchema.parse(raw);
  const isAssignmentGrade = Boolean(event.assignmentId && event.assignmentTitle);
  await deliverNotification({
    organizationId: event.organizationId,
    userId: event.studentId,
    eventType: 'GRADE_PUBLISHED',
    idempotencyKey: `grade-published:${event.gradeId}`,
    title: isAssignmentGrade ? 'Даалгавар дүгнэгдлээ' : 'Дүн нийтлэгдлээ',
    body: isAssignmentGrade
      ? `${event.assignmentTitle}: ${event.score}${event.maxPoints ? `/${event.maxPoints}` : ''} оноо`
      : `Таны дүн шинэчлэгдлээ: ${event.score} оноо`,
    channels: ['IN_APP'],
    metadata: {
      assignmentId: event.assignmentId,
      submissionId: event.submissionId,
      gradeId: event.gradeId,
      ...(event.assignmentId ? { actionUrl: `/student/assignments?assignmentId=${event.assignmentId}` } : {}),
    },
  });
}

export const startGradePublishedConsumer = () => subscribeToEvent(
  EVENT_EXCHANGE,
  'notification-service.grade-published.v1',
  EVENTS.GRADE_PUBLISHED,
  raw => deliverGradePublishedNotification(raw),
  { deadLetter: true, inbox: notificationInbox },
);
