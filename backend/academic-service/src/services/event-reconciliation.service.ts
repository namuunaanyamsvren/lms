import { flushAcademicOutbox } from './event-outbox.service';

import { prisma } from '../lib/prisma';

export async function reconcileAcademicEvents() {
  const staleBefore = new Date(
    Date.now() - Number(process.env.EVENT_INBOX_STALE_MS || 15 * 60_000)
  );
  const staleInbox = await prisma.eventInbox.count({
    where: { status: 'PROCESSING', receivedAt: { lt: staleBefore } },
  });
  const published = await flushAcademicOutbox(500);
  if (staleInbox || published) {
    console.info(
      JSON.stringify({
        kind: 'event_reconciliation',
        service: 'academic',
        staleInboxDetected: staleInbox,
        outboxPublished: published,
      })
    );
  }
  return { staleInboxDetected: staleInbox, outboxPublished: published };
}

export const startAcademicEventReconciliation = () => {
  const timer = setInterval(
    () =>
      reconcileAcademicEvents().catch((error) => console.error('[Academic reconciliation]', error)),
    Number(process.env.EVENT_RECONCILIATION_INTERVAL_MS || 60_000)
  );
  timer.unref();
};
