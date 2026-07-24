import { getRabbitMQChannel } from './connection';

export type EventHandler = (payload: any) => Promise<void> | void;

/**
 * Subscribes to a routing key on the shared topic exchange via a durable queue.
 */
export async function subscribeToEvent(
  exchange: string,
  queue: string,
  routingKey: string,
  handler: EventHandler
): Promise<void> {
  const channel = await getRabbitMQChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  const assertedQueue = await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(assertedQueue.queue, exchange, routingKey);

  await channel.consume(assertedQueue.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(payload);
      channel.ack(msg);
    } catch (error) {
      console.error(`[rabbitmq] failed to process message on queue "${queue}"`, error);
      channel.nack(msg, false, false);
    }
  });
}
