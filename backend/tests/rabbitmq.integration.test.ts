import { randomUUID } from 'crypto';
import { z } from 'zod';
import { afterAll, describe, expect, it } from 'vitest';
import {
  closeRabbitMQConnection,
  publishEvent,
  registerEventContract,
  subscribeToEvent,
} from '@lms/shared';

const describeRabbitMQ = process.env.RABBITMQ_URL ? describe.sequential : describe.skip;

describeRabbitMQ('RabbitMQ integration', () => {
  afterAll(async () => {
    await closeRabbitMQConnection();
  });

  it('publishes an event to a real broker and delivers it to a live consumer', async () => {
    const runId = randomUUID();
    const eventType = `ci.integration.${runId}`;
    const exchange = 'ci.integration';
    const queue = `ci-integration-${runId}`;

    registerEventContract(
      eventType,
      1,
      z.object({ organizationId: z.string(), message: z.string() })
    );

    let resolveReceived: (payload: { organizationId: string; message: string }) => void;
    const received = new Promise<{ organizationId: string; message: string }>((resolve) => {
      resolveReceived = resolve;
    });

    // Binding must be established before publishing: a topic exchange drops
    // messages that arrive with no queue bound to the routing key yet.
    await subscribeToEvent(exchange, queue, eventType, async (payload) => {
      resolveReceived(payload);
    });

    await publishEvent(exchange, eventType, {
      organizationId: 'ci-org',
      message: 'integration-test',
    });

    await expect(received).resolves.toEqual({
      organizationId: 'ci-org',
      message: 'integration-test',
    });
  }, 20_000);
});
