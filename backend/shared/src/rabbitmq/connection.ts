import * as amqp from 'amqplib';
import type { ConfirmChannel, ChannelModel } from 'amqplib';

let connection: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;
let connectionPromise: Promise<ChannelModel> | null = null;
let channelPromise: Promise<ConfirmChannel> | null = null;

async function getRabbitMQConnection(): Promise<ChannelModel> {
  if (connection) return connection;
  if (connectionPromise) return connectionPromise;
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL is required');
  connectionPromise = amqp.connect(url);
  try {
    const opened = await connectionPromise;
    connection = opened;
    opened.on('close', () => {
      console.warn('[RabbitMQ] Connection closed');
      if (connection === opened) connection = null;
      channel = null;
      channelPromise = null;
    });
    opened.on('error', (err) => {
      console.error('[RabbitMQ]', err);
    });
    return opened;
  } finally {
    connectionPromise = null;
  }
}

export async function createRabbitMQConfirmChannel(
  options: { logErrors?: boolean } = {}
): Promise<ConfirmChannel> {
  const activeConnection = await getRabbitMQConnection();
  const opened = await activeConnection.createConfirmChannel();
  opened.on('error', options.logErrors === false
    ? () => undefined
    : (err) => console.error('[RabbitMQ channel]', err));
  return opened;
}

export async function getRabbitMQChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;
  if (channelPromise) return channelPromise;
  channelPromise = (async () => {
    const opened = await createRabbitMQConfirmChannel();
    // Many independent subscribeToEvent() consumers share this single confirm
    // channel and each attaches its own 'close' listener for reconnect logic;
    // that's expected fan-out, not a leak, so raise Node's default cap of 10.
    opened.setMaxListeners(0);
    channel = opened;
    opened.once('close', () => {
      if (channel === opened) channel = null;
      channelPromise = null;
    });
    opened.on('error', (err) => {
      console.error('[RabbitMQ channel]', err);
    });
    return opened;
  })();
  try {
    return await channelPromise;
  } catch (error) {
    channelPromise = null;
    throw error;
  }
}

export async function closeRabbitMQConnection() {
  if (channel) {
    await channel.close();
    channel = null;
  }

  if (connection) {
    await connection.close();
    connection = null;
  }
  connectionPromise = null;
  channelPromise = null;
}

export async function checkRabbitMQReady(): Promise<void> {
  const readyChannel = await getRabbitMQChannel();
  await readyChannel.assertQueue(process.env.RABBITMQ_READINESS_QUEUE || 'lms.readiness', {
    durable: false,
    autoDelete: true,
  });
}
