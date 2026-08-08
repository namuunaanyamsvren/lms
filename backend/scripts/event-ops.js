#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

if (!process.env.RABBITMQ_URL) {
  const user = encodeURIComponent(process.env.RABBITMQ_USER || '');
  const password = encodeURIComponent(process.env.RABBITMQ_PASSWORD || '');
  const port = process.env.RABBITMQ_HOST_PORT || '5673';
  if (!user || !password) {
    throw new Error('RABBITMQ_URL or RABBITMQ_USER/RABBITMQ_PASSWORD is required');
  }
  process.env.RABBITMQ_URL = `amqp://${user}:${password}@127.0.0.1:${port}`;
}

const {
  closeRabbitMQConnection,
  EVENT_EXCHANGE,
  inspectEventQueues,
  replayDeadLetters,
} = require('@lms/shared');

async function main() {
  const [command, queue, limitArg] = process.argv.slice(2);
  if (command === 'inspect') {
    const queues = process.argv.slice(3);
    if (!queues.length) throw new Error('Usage: npm run events:ops -- inspect <queue> [queue...]');
    console.log(JSON.stringify(await inspectEventQueues(EVENT_EXCHANGE, queues), null, 2));
    return;
  }
  if (command === 'replay') {
    if (!queue) throw new Error('Usage: npm run events:ops -- replay <queue> [limit]');
    const limit = Number(limitArg || 100);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000)
      throw new Error('limit must be 1..10000');
    console.log(JSON.stringify(await replayDeadLetters(EVENT_EXCHANGE, queue, limit), null, 2));
    return;
  }
  throw new Error('Commands: inspect, replay');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => closeRabbitMQConnection());
