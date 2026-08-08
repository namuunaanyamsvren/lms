
import { prisma } from '../lib/prisma';

export const parseRetentionDays = (
  value: string | undefined,
  fallback: number,
  name: string,
) => {
  const days = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
    throw new Error(`${name} must be an integer between 1 and 3650`);
  }
  return days;
};

const cutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

export async function runAuthRetention(now = new Date()) {
  const auditCutoff = cutoff(
    now,
    parseRetentionDays(process.env.AUTH_AUDIT_RETENTION_DAYS, 365, 'AUTH_AUDIT_RETENTION_DAYS'),
  );
  const sessionCutoff = cutoff(
    now,
    parseRetentionDays(process.env.AUTH_SESSION_RETENTION_DAYS, 90, 'AUTH_SESSION_RETENTION_DAYS'),
  );
  const tokenCutoff = cutoff(
    now,
    parseRetentionDays(process.env.AUTH_TOKEN_RETENTION_DAYS, 30, 'AUTH_TOKEN_RETENTION_DAYS'),
  );
  const outboxCutoff = cutoff(
    now,
    parseRetentionDays(process.env.AUTH_OUTBOX_RETENTION_DAYS, 30, 'AUTH_OUTBOX_RETENTION_DAYS'),
  );

  const [audit, sessions, resetTokens, verificationTokens, outbox] =
    await prisma.$transaction([
      prisma.authAuditEvent.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
      prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: sessionCutoff } },
            { revokedAt: { not: null, lt: sessionCutoff } },
          ],
        },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: tokenCutoff } },
            { usedAt: { not: null, lt: tokenCutoff } },
          ],
        },
      }),
      prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: tokenCutoff } },
            { usedAt: { not: null, lt: tokenCutoff } },
          ],
        },
      }),
      prisma.authOutboxEvent.deleteMany({
        where: { publishedAt: { not: null, lt: outboxCutoff } },
      }),
    ]);
  return {
    auditEvents: audit.count,
    sessions: sessions.count,
    resetTokens: resetTokens.count,
    verificationTokens: verificationTokens.count,
    outboxEvents: outbox.count,
  };
}

let timer: NodeJS.Timeout | undefined;

export function startAuthRetentionJob() {
  const intervalMs = Number(process.env.AUTH_RETENTION_INTERVAL_MS || 24 * 60 * 60 * 1000);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 60_000) {
    throw new Error('AUTH_RETENTION_INTERVAL_MS must be an integer of at least 60000');
  }
  timer = setInterval(() => {
    runAuthRetention()
      .then(result => console.log('[Auth retention]', result))
      .catch(() => console.error('[Auth retention] cleanup failed'));
  }, intervalMs);
  timer.unref();
  void runAuthRetention().catch(() => console.error('[Auth retention] initial cleanup failed'));
}
