import amqp from 'amqplib';
import { EXCHANGES } from 'shared-contracts';
import dotenv from 'dotenv';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

let channel: any = null;
let connection: any = null;

export const initRabbitMQ = async (retries = 5, delay = 5000): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[RabbitMQ] Connecting to RabbitMQ at ${RABBITMQ_URL} (Attempt ${i + 1}/${retries})...`);
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      
      // Assert the exchange as durable topic exchange
      await channel.assertExchange(EXCHANGES.PLATFORM_EVENTS, 'topic', { durable: true });
      
      console.log('[RabbitMQ] Successfully connected and exchange asserted.');
      return;
    } catch (error) {
      console.error(`[RabbitMQ] Connection attempt ${i + 1} failed.`, error);
      if (i < retries - 1) {
        console.log(`[RabbitMQ] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Could not connect to RabbitMQ after maximum retries');
};

export const publishEvent = async (routingKey: string, payload: any): Promise<boolean> => {
  if (!channel) {
    console.error('[RabbitMQ] Channel not initialized. Event not published.');
    return false;
  }
  
  try {
    const data = Buffer.from(JSON.stringify(payload));
    const published = channel.publish(EXCHANGES.PLATFORM_EVENTS, routingKey, data, {
      persistent: true,
      contentType: 'application/json',
    });
    
    if (published) {
      console.log(`[RabbitMQ] Published event to routing key "${routingKey}":`, payload);
    } else {
      console.warn(`[RabbitMQ] Event buffered by amqplib for "${routingKey}"`);
    }
    return published;
  } catch (error) {
    console.error('[RabbitMQ] Error publishing event:', error);
    return false;
  }
};
