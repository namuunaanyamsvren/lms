import { getRabbitMQChannel } from './connection';
import { createEventEnvelope, EventEnvelope } from './envelope';

/**
 * Publishes a domain event to the shared topic exchange.
 * Business logic for handling the event lives in the consuming service.
 */
export async function publishEvent(
  exchange: string,
  routingKey: string,
  payload: unknown,
  options: {
    version?: number;
    traceId?: string;
    eventId?: string;
    occurredAt?: string;
    organizationId?: string;
  } = {}
): Promise<EventEnvelope> {
  const channel = await getRabbitMQChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  const envelope = createEventEnvelope(routingKey, payload, options);
  channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(envelope)), {
    persistent: true,
    contentType: 'application/json',
    contentEncoding: 'utf-8',
    messageId: envelope.eventId,
    correlationId: envelope.traceId,
    type: envelope.eventType,
    timestamp: Date.parse(envelope.occurredAt),
  });
  await channel.waitForConfirms();
  return envelope;
}
