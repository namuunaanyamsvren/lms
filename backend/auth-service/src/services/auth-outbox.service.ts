import { EVENTS, EVENT_EXCHANGE, publishEvent } from '@lms/shared';
import { Prisma } from '@prisma/client-auth';
import { prisma } from '../lib/prisma';
export const userEventPayload = (user: any) => ({
  userId: user.id,
  organizationId: user.organizationId,
  email: user.email,
  username: user.username,
  phone: user.phone,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isActive: user.isActive,
  studentId: user.studentId,
  employeeId: user.employeeId,
  guardianLinkCode: user.guardianLinkCode,
  occurredAt: new Date().toISOString(),
});
export const userCreatedPayload = userEventPayload;
export const enqueueAuthEvent = (
  tx: Prisma.TransactionClient,
  eventType: string,
  payload: Prisma.InputJsonValue
) => tx.authOutboxEvent.create({ data: { eventType, payload } });
export const enqueueUserCreated = (tx: Prisma.TransactionClient, user: any) =>
  enqueueAuthEvent(tx, EVENTS.USER_CREATED, userEventPayload(user));
export const enqueueUserUpdated = (tx: Prisma.TransactionClient, user: any) =>
  enqueueAuthEvent(tx, EVENTS.USER_UPDATED, userEventPayload(user));
export const enqueueUserDeactivated = (tx: Prisma.TransactionClient, user: any) =>
  enqueueAuthEvent(tx, EVENTS.USER_DEACTIVATED, userEventPayload(user));
export const enqueueUserInvited = (
  tx: Prisma.TransactionClient,
  user: any,
  setPasswordUrl: string,
) =>
  enqueueAuthEvent(tx, EVENTS.USER_INVITED, {
    userId: user.id,
    organizationId: user.organizationId,
    recipientEmail: user.email,
    setPasswordUrl,
    occurredAt: new Date().toISOString(),
  });
export const enqueueGuardianInviteRequested = (
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    studentUserId: string;
    recipientEmail: string;
    studentName: string;
    studentId?: string | null;
    guardianLinkCode: string;
    registerUrl: string;
    loginUrl: string;
  },
) =>
  enqueueAuthEvent(tx, EVENTS.GUARDIAN_INVITE_REQUESTED, {
    ...input,
    occurredAt: new Date().toISOString(),
  });
export const enqueueUserAnonymized = (
  tx: Prisma.TransactionClient,
  input: { userId: string; organizationId: string },
) => enqueueAuthEvent(tx, EVENTS.USER_ANONYMIZED, {
  userId: input.userId,
  organizationId: input.organizationId,
  occurredAt: new Date().toISOString(),
});
export async function flushAuthOutbox(limit = 100) {
  const rows = await prisma.authOutboxEvent.findMany({
    where: { publishedAt: null, nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  let published = 0;
  for (const row of rows)
    try {
      const payload = row.payload as any;
      await publishEvent(EVENT_EXCHANGE, row.eventType, payload, {
        eventId: row.id,
        organizationId: payload.organizationId,
      });
      await prisma.authOutboxEvent.update({
        where: { id: row.id },
        data: { publishedAt: new Date(), attemptCount: { increment: 1 }, lastError: null },
      });
      published += 1;
    } catch (error: any) {
      const attempts = row.attemptCount + 1;
      await prisma.authOutboxEvent.update({
        where: { id: row.id },
        data: {
          attemptCount: attempts,
          nextAttemptAt: new Date(Date.now() + Math.min(1000 * 2 ** attempts, 300000)),
          lastError: String(error.message).slice(0, 1000),
        },
      });
    }
  return published;
}
let timer: NodeJS.Timeout | undefined;
export const startAuthOutboxPublisher = () => {
  timer = setInterval(
    () => flushAuthOutbox().catch((e) => console.error('[Auth outbox]', e)),
    5000
  );
  timer.unref();
  void flushAuthOutbox();
};
