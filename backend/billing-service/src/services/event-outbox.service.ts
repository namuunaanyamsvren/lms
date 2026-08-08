import { EVENT_EXCHANGE, publishEvent } from '@lms/shared';
import { Prisma } from '@prisma/client-billing';

import { prisma } from '../lib/prisma';

export const enqueueBillingEvent = (
  tx: Prisma.TransactionClient,
  eventType: string,
  organizationId: string,
  payload: Prisma.InputJsonObject,
  traceId?: string
) =>
  tx.billingOutboxEvent.create({
    data: { eventType, organizationId, payload: { organizationId, ...payload }, traceId },
  });

export async function flushBillingOutbox(limit = 100) {
  const rows = await prisma.billingOutboxEvent.findMany({
    where: { publishedAt: null, nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });
  let published = 0;
  for (const row of rows) {
    try {
      await publishEvent(EVENT_EXCHANGE, row.eventType, row.payload, {
        eventId: row.id,
        traceId: row.traceId || undefined,
        organizationId: row.organizationId,
      });
      await prisma.billingOutboxEvent.update({
        where: { id: row.id },
        data: { publishedAt: new Date(), attemptCount: { increment: 1 }, lastError: null },
      });
      published += 1;
    } catch (error: any) {
      const attempts = row.attemptCount + 1;
      await prisma.billingOutboxEvent.update({
        where: { id: row.id },
        data: {
          attemptCount: attempts,
          nextAttemptAt: new Date(Date.now() + Math.min(1_000 * 2 ** attempts, 300_000)),
          lastError: String(error.message).slice(0, 1_000),
        },
      });
    }
  }
  return published;
}

let timer: NodeJS.Timeout | undefined;
export const startBillingOutboxPublisher = () => {
  timer = setInterval(
    () => flushBillingOutbox().catch((error) => console.error('[Billing outbox]', error)),
    Number(process.env.BILLING_OUTBOX_INTERVAL_MS || 5_000)
  );
  timer.unref();
  void flushBillingOutbox();
};
