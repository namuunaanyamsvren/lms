import { EVENT_EXCHANGE, EVENTS, subscribeToEvent } from '@lms/shared';
import { z } from 'zod';
import { deliverNotification, notificationInbox } from '../services/notification.service';

const statusCopy: Record<string, string> = {
  APPROVED: 'зөвшөөрөгдлөө',
  REJECTED: 'татгалзагдлаа',
  CANCELLED: 'цуцлагдлаа',
  IN_REVIEW: 'хянагдаж байна',
  UNDER_REVIEW: 'хянагдаж байна',
  REVIEWED: 'хянагдсан',
};
const statusLabel = (status: string) => statusCopy[status] || 'шинэчлэгдлээ';

const documentRequestCreatedSchema = z.object({
  organizationId: z.string().min(1),
  requestId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  documentType: z.string().min(1).max(100),
  studentId: z.string().min(1),
  studentName: z.string().min(1).max(200),
  recipientIds: z.array(z.string().min(1)).max(500),
}).strict();

const requestStatusUpdatedSchema = z.object({
  organizationId: z.string().min(1),
  requestId: z.string().min(1).max(200),
  status: z.string().min(1).max(50),
  rejectionReason: z.string().max(1000).nullable(),
  studentId: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).max(10),
}).strict();

const scholarshipRequestCreatedSchema = z.object({
  organizationId: z.string().min(1),
  requestId: z.string().min(1).max(200),
  program: z.string().min(1).max(200),
  studentId: z.string().min(1),
  studentName: z.string().min(1).max(200),
  recipientIds: z.array(z.string().min(1)).max(500),
}).strict();

async function deliverToMany(
  recipients: string[],
  build: (userId: string) => Parameters<typeof deliverNotification>[0],
) {
  await Promise.all([...new Set(recipients)].map(userId => deliverNotification(build(userId))));
}

export async function deliverDocumentRequestCreatedNotifications(raw: unknown) {
  const event = documentRequestCreatedSchema.parse(raw);
  await deliverToMany(event.recipientIds, userId => ({
    organizationId: event.organizationId,
    userId,
    eventType: 'DOCUMENT_REQUEST_CREATED',
    idempotencyKey: `document-request:created:${event.requestId}:${userId}`,
    title: 'Шинэ баримт бичгийн хүсэлт',
    body: `${event.studentName}: "${event.title}" (${event.documentType}) хүсэлт ирлээ.`,
    channels: ['IN_APP'],
    digestEligible: true,
    // Role-relative (no leading slash) — recipients span student/teacher/parent/
    // staff/admin, and each has this page under a different role-prefixed base
    // path; the frontend resolves it against the viewing user's own role.
    metadata: { requestId: event.requestId, actionUrl: 'document-requests' },
  }));
}

export async function deliverDocumentRequestStatusUpdatedNotifications(raw: unknown) {
  const event = requestStatusUpdatedSchema.parse(raw);
  await deliverToMany(event.recipientIds, userId => ({
    organizationId: event.organizationId,
    userId,
    eventType: 'DOCUMENT_REQUEST_STATUS_UPDATED',
    idempotencyKey: `document-request:status:${event.requestId}:${event.status}:${userId}`,
    title: 'Баримт бичгийн хүсэлтийн шинэчлэл',
    body: `Таны хүсэлт ${statusLabel(event.status)}.${event.rejectionReason ? ` Шалтгаан: ${event.rejectionReason}` : ''}`,
    channels: ['IN_APP'],
    digestEligible: false,
    metadata: { requestId: event.requestId, status: event.status, actionUrl: 'document-requests' },
  }));
}

export async function deliverScholarshipRequestCreatedNotifications(raw: unknown) {
  const event = scholarshipRequestCreatedSchema.parse(raw);
  await deliverToMany(event.recipientIds, userId => ({
    organizationId: event.organizationId,
    userId,
    eventType: 'SCHOLARSHIP_REQUEST_CREATED',
    idempotencyKey: `scholarship-request:created:${event.requestId}:${userId}`,
    title: 'Шинэ тэтгэлгийн хүсэлт',
    body: `${event.studentName}: "${event.program}" хөтөлбөрт тэтгэлэг хүссэн байна.`,
    channels: ['IN_APP'],
    digestEligible: true,
    metadata: { requestId: event.requestId, actionUrl: 'scholarships' },
  }));
}

export async function deliverScholarshipRequestStatusUpdatedNotifications(raw: unknown) {
  const event = requestStatusUpdatedSchema.parse(raw);
  await deliverToMany(event.recipientIds, userId => ({
    organizationId: event.organizationId,
    userId,
    eventType: 'SCHOLARSHIP_REQUEST_STATUS_UPDATED',
    idempotencyKey: `scholarship-request:status:${event.requestId}:${event.status}:${userId}`,
    title: 'Тэтгэлгийн хүсэлтийн шинэчлэл',
    body: `Таны тэтгэлгийн хүсэлт ${statusLabel(event.status)}.${event.rejectionReason ? ` Шалтгаан: ${event.rejectionReason}` : ''}`,
    channels: ['IN_APP'],
    digestEligible: false,
    metadata: { requestId: event.requestId, status: event.status, actionUrl: 'scholarships' },
  }));
}

export const startStaffWorkflowConsumers = () => Promise.all([
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.document-request-created.v1',
    EVENTS.DOCUMENT_REQUEST_CREATED,
    raw => deliverDocumentRequestCreatedNotifications(raw),
    { deadLetter: true, inbox: notificationInbox },
  ),
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.document-request-status-updated.v1',
    EVENTS.DOCUMENT_REQUEST_STATUS_UPDATED,
    raw => deliverDocumentRequestStatusUpdatedNotifications(raw),
    { deadLetter: true, inbox: notificationInbox },
  ),
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.scholarship-request-created.v1',
    EVENTS.SCHOLARSHIP_REQUEST_CREATED,
    raw => deliverScholarshipRequestCreatedNotifications(raw),
    { deadLetter: true, inbox: notificationInbox },
  ),
  subscribeToEvent(
    EVENT_EXCHANGE,
    'notification-service.scholarship-request-status-updated.v1',
    EVENTS.SCHOLARSHIP_REQUEST_STATUS_UPDATED,
    raw => deliverScholarshipRequestStatusUpdatedNotifications(raw),
    { deadLetter: true, inbox: notificationInbox },
  ),
]);
