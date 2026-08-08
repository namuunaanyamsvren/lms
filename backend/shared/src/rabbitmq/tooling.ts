import { createRabbitMQConfirmChannel } from './connection';

async function checkQueueSafely(queue: string) {
  const channel = await createRabbitMQConfirmChannel({ logErrors: false });
  try {
    return await channel.checkQueue(queue);
  } catch {
    return null;
  } finally {
    await channel.close().catch(() => undefined);
  }
}

export async function inspectEventQueues(exchange: string, queues: string[]) {
  const result: Array<{
    queue: string;
    ready: number;
    consumers: number;
    retrying: number;
    poisoned: number;
  }> = [];
  for (const queue of queues) {
    const retryQueues = [
      `${queue}.retry`,
      `${queue}.inbox-wait`,
      ...Array.from(
        { length: Number(process.env.EVENT_MAX_RETRIES || 5) },
        (_, index) => `${queue}.retry.${index + 1}`
      ),
    ];
    const [main, dead, ...retries] = await Promise.all([
      checkQueueSafely(queue),
      checkQueueSafely(`${queue}.dead`),
      ...retryQueues.map(checkQueueSafely),
    ]);
    result.push({
      queue,
      ready: main?.messageCount || 0,
      consumers: main?.consumerCount || 0,
      retrying: retries.reduce((total, retry) => total + (retry?.messageCount || 0), 0),
      poisoned: dead?.messageCount || 0,
    });
  }
  return { exchange, queues: result, checkedAt: new Date().toISOString() };
}
export async function replayDeadLetters(exchange: string, queue: string, limit = 100) {
  const channel = await createRabbitMQConfirmChannel();
  let replayed = 0;
  try {
    for (; replayed < limit; replayed++) {
      const msg = await channel.get(`${queue}.dead`, { noAck: false });
      if (!msg) break;
      const routingKey = String(msg.properties.headers?.['x-original-routing-key'] || '');
      if (!routingKey) {
        channel.nack(msg, false, true);
        throw new Error(`Dead letter in ${queue}.dead has no original routing key`);
      }
      channel.publish(exchange, routingKey, msg.content, {
        persistent: true,
        contentType: 'application/json',
        messageId: msg.properties.messageId,
        correlationId: msg.properties.correlationId,
        headers: { 'x-replayed-from': queue, 'x-replayed-at': new Date().toISOString() },
      });
      await channel.waitForConfirms();
      channel.ack(msg);
    }
    return { queue, replayed };
  } finally {
    await channel.close().catch(() => undefined);
  }
}
