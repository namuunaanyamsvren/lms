export const EVENT_EXCHANGE = 'lms.events';

export const EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  ORGANIZATION_CREATED: 'organization.created',
  ENROLLMENT_CREATED: 'enrollment.created',
  ASSIGNMENT_SUBMITTED: 'assignment.submitted',
  GRADE_PUBLISHED: 'grade.published',
  CERTIFICATE_ISSUED: 'certificate.issued',
  INVOICE_CREATED: 'invoice.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  NOTIFICATION_SEND: 'notification.send',
} as const;
