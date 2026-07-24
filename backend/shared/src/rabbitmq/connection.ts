import * as amqp from "amqplib";
import type { Channel, ChannelModel } from "amqplib";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getRabbitMQChannel(): Promise<Channel> {
  if (channel) return channel;

  const url =
    process.env.RABBITMQ_URL ??
    "amqp://guest:guest@rabbitmq:5672";

  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  connection.on("close", () => {
    console.warn("[RabbitMQ] Connection closed");
    connection = null;
    channel = null;
  });

  connection.on("error", (err) => {
    console.error("[RabbitMQ]", err);
  });

  return channel;
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
}
