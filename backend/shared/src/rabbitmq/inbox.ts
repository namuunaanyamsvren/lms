import { ConsumerInbox, InboxClaimResult } from './consumer';
export function createPrismaInbox(delegate: any): ConsumerInbox {
  return {
    async claim(envelope, consumer) {
      try {
        await delegate.create({
          data: { eventId: envelope.eventId, consumer, eventType: envelope.eventType },
        });
        return InboxClaimResult.CLAIMED;
      } catch (error: any) {
        if (error?.code !== 'P2002') throw error;
        const key = { eventId_consumer: { eventId: envelope.eventId, consumer } };
        const existing = await delegate.findUnique({ where: key });
        if (!existing) {
          return InboxClaimResult.BUSY;
        }
        if (existing.status === 'PROCESSED') {
          return InboxClaimResult.PROCESSED;
        }
        const staleBefore = new Date(
          Date.now() - Number(process.env.EVENT_INBOX_STALE_MS || 15 * 60_000)
        );
        const reclaimed = await delegate.updateMany({
          where: {
            eventId: envelope.eventId,
            consumer,
            status: 'PROCESSING',
            receivedAt: { lt: staleBefore },
          },
          data: { receivedAt: new Date(), processedAt: null, error: null },
        });
        return reclaimed.count === 1 ? InboxClaimResult.CLAIMED : InboxClaimResult.BUSY;
      }
    },
    async complete(eventId, consumer) {
      await delegate.update({
        where: { eventId_consumer: { eventId, consumer } },
        data: { status: 'PROCESSED', processedAt: new Date(), error: null },
      });
    },
    async fail(eventId, consumer, _error) {
      await delegate.deleteMany({ where: { eventId, consumer } });
    },
  };
}
