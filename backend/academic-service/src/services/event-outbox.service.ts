import { EVENT_EXCHANGE, publishEvent } from '@lms/shared';
import { Prisma } from '@prisma/client-academic';
import { prisma } from '../lib/prisma';
export const enqueueAcademicEvent = (
  tx: Prisma.TransactionClient,
  eventType: string,
  organizationId: string,
  payload: any,
  traceId?: string
) =>
  tx.academicOutboxEvent.create({
    data: { eventType, organizationId, payload: { organizationId, ...payload }, traceId },
  });
export async function flushAcademicOutbox(limit = 100) {
  const rows = await prisma.academicOutboxEvent.findMany({
    where: { publishedAt: null, nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  let published = 0;
  for (const row of rows)
    try {
      await publishEvent(EVENT_EXCHANGE, row.eventType, row.payload, {
        eventId: row.id,
        traceId: row.traceId || undefined,
        organizationId: row.organizationId,
      });
      await prisma.academicOutboxEvent.update({
        where: { id: row.id },
        data: { publishedAt: new Date(), attemptCount: { increment: 1 }, lastError: null },
      });
      published += 1;
    } catch (error: any) {
      const attempts = row.attemptCount + 1;
      await prisma.academicOutboxEvent.update({
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
export const startAcademicOutboxPublisher = () => {
  timer = setInterval(
    () => flushAcademicOutbox().catch((e) => console.error('[Academic outbox]', e)),
    5000
  );
  timer.unref();
  void flushAcademicOutbox();
};
