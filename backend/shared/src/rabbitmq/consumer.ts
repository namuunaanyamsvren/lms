import { getRabbitMQChannel } from './connection';
import { createEventEnvelope, EventEnvelope, validateEventEnvelope } from './envelope';
export type EventHandler = (payload: any, envelope?: EventEnvelope) => Promise<void> | void;
export enum InboxClaimResult {
  CLAIMED = 'CLAIMED',
  PROCESSED = 'PROCESSED',
  BUSY = 'BUSY',
}
export type ConsumerInbox = {
  claim: (envelope: EventEnvelope, consumer: string) => Promise<InboxClaimResult | boolean>;
  complete?: (eventId: string, consumer: string) => Promise<void>;
  fail?: (eventId: string, consumer: string, error: string) => Promise<void>;
};
type ConsumerOptions = {
  deadLetter?: boolean;
  maxRetries?: number;
  retryBaseMs?: number;
  inbox?: ConsumerInbox;
};
const safeEventLabel = (value: string | undefined) =>
  value ? value.replace(/[^A-Z0-9_.:-]/gi, '_').slice(0, 120) : undefined;

export async function subscribeToEvent(
  exchange: string,
  queue: string,
  routingKey: string,
  handler: EventHandler,
  options: ConsumerOptions = {}
): Promise<void> {
  let reconnectTimer: NodeJS.Timeout | undefined;
  const reconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = undefined;
        subscribeToEvent(exchange, queue, routingKey, handler, options).catch((error) => {
          console.error(`[RabbitMQ] ${queue} resubscribe failed`, error);
        });
      },
      Number(process.env.EVENT_CONSUMER_RECONNECT_MS || 5_000)
    );
    reconnectTimer.unref();
  };
  let channel;
  try {
    channel = await getRabbitMQChannel();
  } catch (error) {
    reconnect();
    throw error;
  }
  channel.once('close', reconnect);
  try {
    await channel.assertExchange(exchange, 'topic', { durable: true });
    const deadExchange = `${exchange}.dead`,
      retryExchange = `${exchange}.retry`;
    const maxRetries = options.maxRetries ?? Number(process.env.EVENT_MAX_RETRIES || 5);
    if (options.deadLetter) {
      await channel.assertExchange(deadExchange, 'topic', { durable: true });
      await channel.assertExchange(retryExchange, 'topic', { durable: true });
      const dead = await channel.assertQueue(`${queue}.dead`, { durable: true });
      await channel.bindQueue(dead.queue, deadExchange, queue);
      const inboxWait = await channel.assertQueue(`${queue}.inbox-wait`, {
        durable: true,
        arguments: {
          'x-message-ttl': Number(process.env.EVENT_INBOX_BUSY_RETRY_MS || 5_000),
          'x-dead-letter-exchange': exchange,
          'x-dead-letter-routing-key': routingKey,
        },
      });
      await channel.bindQueue(inboxWait.queue, retryExchange, `${queue}.inbox-wait`);
      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        const delay = Math.min(
          (options.retryBaseMs ?? Number(process.env.EVENT_RETRY_BASE_MS || 1_000)) *
            2 ** (attempt - 1),
          Number(process.env.EVENT_RETRY_MAX_MS || 300_000)
        );
        const retry = await channel.assertQueue(`${queue}.retry.${attempt}`, {
          durable: true,
          arguments: {
            'x-message-ttl': delay,
            'x-dead-letter-exchange': exchange,
            'x-dead-letter-routing-key': routingKey,
          },
        });
        await channel.bindQueue(retry.queue, retryExchange, `${queue}.retry.${attempt}`);
      }
    }
    const main = await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(main.queue, exchange, routingKey);
    await channel.prefetch(Number(process.env.EVENT_CONSUMER_PREFETCH || 20));
    await channel.consume(main.queue, async (msg) => {
      if (!msg) return;
      let envelope: EventEnvelope | undefined;
      try {
        const raw = JSON.parse(msg.content.toString());
        envelope = raw?.eventId
          ? validateEventEnvelope(raw)
          : createEventEnvelope(routingKey, raw, {
              eventId: msg.properties.messageId,
              traceId: msg.properties.correlationId,
            });
        if (envelope.eventType !== routingKey) {
          throw new Error(
            `Envelope eventType ${envelope.eventType} does not match routing key ${routingKey}`
          );
        }
        if (options.inbox) {
          const claim = await options.inbox.claim(envelope, queue);
          if (claim === false || claim === InboxClaimResult.PROCESSED) {
            channel.ack(msg);
            return;
          }
          if (claim === InboxClaimResult.BUSY) {
            if (options.deadLetter) {
              channel.publish(retryExchange, `${queue}.inbox-wait`, msg.content, {
                persistent: true,
                contentType: 'application/json',
                messageId: envelope.eventId,
                correlationId: envelope.traceId,
                headers: {
                  ...msg.properties.headers,
                  'x-inbox-wait-count':
                    Number(msg.properties.headers?.['x-inbox-wait-count'] || 0) + 1,
                  'x-original-queue': queue,
                  'x-original-routing-key': routingKey,
                },
              });
              await channel.waitForConfirms();
              channel.ack(msg);
            } else {
              channel.nack(msg, false, true);
            }
            return;
          }
        }
        await handler(envelope.payload, envelope);
        await options.inbox?.complete?.(envelope.eventId, queue);
        channel.ack(msg);
      } catch (error: any) {
        const message = String(error?.message || error).slice(0, 2000);
        if (envelope) await options.inbox?.fail?.(envelope.eventId, queue, message);
        const retries = Number(msg.properties.headers?.['x-retry-count'] || 0);
        const poison =
          !envelope ||
          message.startsWith('Unsupported event contract') ||
          error?.name === 'ZodError';
        console.error(
          JSON.stringify({
            level: 'error',
            kind: poison ? 'poison_event' : 'event_handler_failure',
            queue,
            routingKey: safeEventLabel(routingKey),
            eventId: envelope?.eventId,
            retries,
            error: message,
          })
        );
        if (options.deadLetter && !poison && retries < maxRetries) {
          channel.publish(retryExchange, `${queue}.retry.${retries + 1}`, msg.content, {
            persistent: true,
            contentType: 'application/json',
            messageId: envelope?.eventId,
            correlationId: envelope?.traceId,
            headers: {
              ...msg.properties.headers,
              'x-retry-count': retries + 1,
              'x-original-queue': queue,
              'x-original-routing-key': routingKey,
            },
          });
          await channel.waitForConfirms();
          channel.ack(msg);
        } else if (options.deadLetter) {
          channel.publish(deadExchange, queue, msg.content, {
            persistent: true,
            contentType: 'application/json',
            messageId: envelope?.eventId,
            correlationId: envelope?.traceId,
            headers: {
              ...msg.properties.headers,
              'x-retry-count': retries,
              'x-original-queue': queue,
              'x-original-routing-key': routingKey,
              'x-poison': poison,
              'x-error': message,
            },
          });
          await channel.waitForConfirms();
          channel.ack(msg);
        } else channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    reconnect();
    throw error;
  }
}
