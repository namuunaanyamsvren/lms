import { flushBillingOutbox } from './event-outbox.service';

import { prisma } from '../lib/prisma';

export async function reconcileBillingEvents() {
  const staleBefore = new Date(
    Date.now() - Number(process.env.EVENT_INBOX_STALE_MS || 15 * 60_000)
  );
  const staleInbox = await prisma.eventInbox.count({
    where: { status: 'PROCESSING', receivedAt: { lt: staleBefore } },
  });
  const published = await flushBillingOutbox(500);
  if (staleInbox || published) {
    console.info(
      JSON.stringify({
        kind: 'event_reconciliation',
        service: 'billing',
        staleInboxDetected: staleInbox,
        outboxPublished: published,
      })
    );
  }
  return { staleInboxDetected: staleInbox, outboxPublished: published };
}

export const startBillingEventReconciliation = () => {
  const timer = setInterval(
    () =>
      reconcileBillingEvents().catch((error) => console.error('[Billing reconciliation]', error)),
    Number(process.env.EVENT_RECONCILIATION_INTERVAL_MS || 60_000)
  );
  timer.unref();
};
