import { getRabbitMQChannel } from './connection';

/**
 * Publishes a domain event to the shared topic exchange.
 * Business logic for handling the event lives in the consuming service.
 */
export async function publishEvent(exchange: string, routingKey: string, payload: unknown): Promise<void> {
  const channel = await getRabbitMQChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
}
