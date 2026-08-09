import { notificationPrisma } from './notification.service';
import { createServiceHttpClient, serviceAuthorizationHeaders } from '@lms/shared';

export type AuditLogInput = {
  organizationId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
};

export const recordAuditLog = (input: AuditLogInput) => notificationPrisma.auditLog.create({ data: input });

const academicAuditClient = () => {
  const baseUrl = process.env.ACADEMIC_SERVICE_URL;
  if (!baseUrl) return null;
  return createServiceHttpClient({
    baseUrl,
    defaultTimeoutMs: Number(process.env.INTERNAL_AUDIT_TIMEOUT_MS || 2000),
    retries: 1,
    defaultHeaders: {
      'content-type': 'application/json',
      ...serviceAuthorizationHeaders('notification-service'),
    },
  });
};

export async function recordCentralAuditLog(input: AuditLogInput & { ipAddress?: string | null }) {
  const client = academicAuditClient();
  if (!client) return null;
  try {
    await client.json('/internal/audit-logs', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return true;
  } catch (error) {
    console.warn('[Notification] central audit write failed', {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      error: String(error),
    });
    return false;
  }
}
