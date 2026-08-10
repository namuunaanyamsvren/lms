import { randomUUID } from 'crypto';
import { z } from 'zod';

export const eventEnvelopeSchema = z
  .object({
    eventId: z.string().uuid(),
    eventType: z.string().min(1).max(200),
    version: z.number().int().positive(),
    occurredAt: z.string().datetime(),
    traceId: z.string().min(1).max(200),
    organizationId: z.string().min(1).max(200),
    payload: z.unknown(),
  })
  .strict();
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
const commonOrganization = z.object({ organizationId: z.string().min(1) }).passthrough();
const contracts = new Map<string, Map<number, z.ZodTypeAny>>();
export const registerEventContract = (eventType: string, version: number, schema: z.ZodTypeAny) => {
  const versions = contracts.get(eventType) || new Map();
  versions.set(version, schema);
  contracts.set(eventType, versions);
};
export const supportedEventVersions = (eventType: string) => [
  ...(contracts.get(eventType)?.keys() || []),
];
export function validateEventEnvelope(input: unknown) {
  const envelope = eventEnvelopeSchema.parse(input),
    schema = contracts.get(envelope.eventType)?.get(envelope.version);
  if (!schema)
    throw new Error(`Unsupported event contract ${envelope.eventType}@${envelope.version}`);
  schema.parse(envelope.payload);
  const payloadOrganizationId = (envelope.payload as { organizationId?: unknown })?.organizationId;
  if (
    typeof payloadOrganizationId === 'string' &&
    payloadOrganizationId !== envelope.organizationId
  ) {
    throw new Error('Envelope organizationId does not match payload.organizationId');
  }
  return envelope;
}
export function createEventEnvelope(
  eventType: string,
  payload: any,
  options: {
    version?: number;
    traceId?: string;
    eventId?: string;
    occurredAt?: string;
    organizationId?: string;
  } = {}
): EventEnvelope {
  const version = options.version || 1,
    schema = contracts.get(eventType)?.get(version);
  if (!schema) throw new Error(`Unsupported event contract ${eventType}@${version}`);
  schema.parse(payload);
  const organizationId = options.organizationId || payload?.organizationId;
  if (!organizationId) throw new Error('organizationId is required in event payload');
  if (payload?.organizationId && payload.organizationId !== organizationId) {
    throw new Error('Envelope organizationId does not match payload.organizationId');
  }
  return {
    eventId: options.eventId || randomUUID(),
    eventType,
    version,
    occurredAt: options.occurredAt || new Date().toISOString(),
    traceId: options.traceId || payload?.traceId || randomUUID(),
    organizationId,
    payload,
  };
}
const withId = (field: string) => commonOrganization.extend({ [field]: z.string().min(1) });
const eventContracts: Record<string, z.ZodTypeAny> = {
  'user.created': withId('userId').extend({ email: z.string().email(), role: z.string().min(1) }),
  'guardian.invite.requested': withId('studentUserId').extend({
    recipientEmail: z.string().email(),
    studentName: z.string().min(1),
    studentId: z.string().nullable().optional(),
    guardianLinkCode: z.string().min(1),
    registerUrl: z.string().url(),
    loginUrl: z.string().url(),
  }),
  'user.updated': withId('userId').extend({ email: z.string().email(), role: z.string().min(1) }),
  'user.deactivated': withId('userId').extend({ isActive: z.literal(false) }),
  'organization.created': withId('organizationId'),
  'enrollment.created': withId('enrollmentId'),
  'enrollment.deleted': withId('enrollmentId'),
  'assignment.submitted': withId('submissionId'),
  'assignment.created': withId('assignmentId'),
  'grade.published': withId('gradeId'),
  'grade.revised': withId('gradeId'),
  'attendance.recorded': withId('attendanceId'),
  'attendance.updated': withId('attendanceId'),
  'consent.form.published': withId('consentFormId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'announcement.published': withId('announcementId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'document-request.created': withId('requestId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'document-request.status-updated': withId('requestId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'scholarship-request.created': withId('requestId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'scholarship-request.status-updated': withId('requestId').extend({
    recipientIds: z.array(z.string().min(1)),
  }),
  'report.ready': withId('reportJobId').extend({
    reportType: z.string().min(1),
    recipientIds: z.array(z.string().min(1)),
  }),
  'certificate.issued': withId('certificateId'),
  'invoice.created': withId('invoiceId'),
  'payment.succeeded': withId('invoiceId'),
  'payment.failed': withId('invoiceId'),
  'notification.send': withId('userId').extend({ idempotencyKey: z.string().min(1) }),
  'auth.email-verification.requested': withId('userId').extend({
    recipientEmail: z.string().email(),
  }),
  'auth.password-reset.requested': withId('userId').extend({
    recipientEmail: z.string().email(),
  }),
  'course.created': withId('courseId'),
  'course.updated': withId('courseId'),
  'course.archived': withId('courseId'),
  'course.deleted': withId('courseId'),
  'schedule.created': withId('scheduleId'),
  'schedule.updated': withId('scheduleId'),
  'schedule.deleted': withId('scheduleId'),
  'billing.subscription.changed': withId('subscriptionId'),
  'billing.invoice.issued': withId('invoiceId'),
  'billing.invoice.paid': withId('invoiceId'),
  'billing.payment.refunded': withId('invoiceId'),
};
Object.entries(eventContracts).forEach(([type, schema]) => registerEventContract(type, 1, schema));
