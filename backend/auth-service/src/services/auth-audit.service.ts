import {
  AuthAuditEventType,
  Prisma,
} from '@prisma/client-auth';

export type AuthAuditSeverity = 'critical' | 'best-effort';

const BEST_EFFORT_EVENTS = new Set<AuthAuditEventType>([
  AuthAuditEventType.LOGIN_FAILURE,
  AuthAuditEventType.ACCOUNT_LOCKED,
  AuthAuditEventType.PASSWORD_RESET_REQUESTED,
]);

const SAFE_METADATA_KEYS = new Set([
  'deviceName',
  'reasonCode',
  'sessionId',
]);

const FORBIDDEN_KEY_PATTERN =
  /password|token|otp|secret|cookie|authorization|credential|hash/i;

export interface AuthAuditWriter {
  authAuditEvent: {
    create(args: Prisma.AuthAuditEventCreateArgs): Promise<unknown>;
  };
}

export interface AuthAuditInput {
  eventType: AuthAuditEventType;
  userId?: string | null;
  organizationId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  reasonCode?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

const safeString = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.normalize('NFKC').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

export const sanitizeAuthAuditMetadata = (
  metadata: Record<string, unknown> = {},
): Record<string, string> => {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEY_PATTERN.test(key) || !SAFE_METADATA_KEYS.has(key)) continue;
    const sanitized = safeString(value, key === 'deviceName' ? 200 : 100);
    if (sanitized) safe[key] = sanitized;
  }
  return safe;
};

export const getAuthAuditSeverity = (
  eventType: AuthAuditEventType,
): AuthAuditSeverity =>
  BEST_EFFORT_EVENTS.has(eventType) ? 'best-effort' : 'critical';

const safeAuditEventLabel = (eventType: AuthAuditEventType): string =>
  eventType.replace(/[^A-Z0-9_]/g, '_').slice(0, 80);

export const recordAuthAudit = async (
  writer: AuthAuditWriter,
  input: AuthAuditInput,
): Promise<boolean> => {
  const metadata = sanitizeAuthAuditMetadata({
    ...input.metadata,
    ...(input.deviceName ? { deviceName: input.deviceName } : {}),
    ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  });
  try {
    await writer.authAuditEvent.create({
      data: {
        userId: input.userId || null,
        organizationId: input.organizationId || null,
        eventType: input.eventType,
        ipAddress: safeString(input.ipAddress, 64),
        userAgent: safeString(input.userAgent, 1000),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw error;
    }
    if (getAuthAuditSeverity(input.eventType) === 'critical') {
      // Do not attach the database error as a cause: downstream error
      // serialization must not expose query or connection details.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Critical authentication audit write failed for ${safeAuditEventLabel(input.eventType)}`);
    }
    // Never log the original database error or input: either could contain
    // sensitive query context. Best-effort events must not alter auth results.
    console.error(`[AuthAudit] best-effort write failed for ${safeAuditEventLabel(input.eventType)}`);
    return false;
  }
};
