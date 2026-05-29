import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { EXCHANGES, ROUTING_KEYS } from 'shared-contracts';
import { pool } from './db';
import dotenv from 'dotenv';

dotenv.config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'notification_service_queue';

let channel: any = null;
let connection: any = null;

export const initRabbitMQ = async (retries = 5, delay = 5000): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[RabbitMQ] Connecting to RabbitMQ at ${RABBITMQ_URL} (Attempt ${i + 1}/${retries})...`);
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      
      // Assert exchange
      await channel.assertExchange(EXCHANGES.PLATFORM_EVENTS, 'topic', { durable: true });
      
      // Assert queue
      await channel.assertQueue(QUEUE_NAME, { durable: true });
      
      // Bind queue for events we consume
      await channel.bindQueue(QUEUE_NAME, EXCHANGES.PLATFORM_EVENTS, ROUTING_KEYS.POST_CREATED);
      await channel.bindQueue(QUEUE_NAME, EXCHANGES.PLATFORM_EVENTS, ROUTING_KEYS.FILE_UPLOADED);
      
      console.log(`[RabbitMQ] Queue "${QUEUE_NAME}" asserted and bound to exchange.`);
      
      // Start consuming
      startConsuming();
      
      console.log('[RabbitMQ] Successfully connected, bound and started consuming.');
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

const startConsuming = () => {
  if (!channel) return;
  
  channel.consume(QUEUE_NAME, async (msg: any) => {
    if (!msg) return;
    
    const routingKey = msg.fields.routingKey;
    const contentStr = msg.content.toString();
    
    try {
      console.log(`[Notification Worker] Received message with routing key "${routingKey}"`);
      const payload = JSON.parse(contentStr);
      
      if (routingKey === ROUTING_KEYS.POST_CREATED) {
        // Handle Post Created
        const { postId, title, authorId } = payload;
        
        // 1. Notify the author
        await createNotification(
          authorId,
          'in-app',
          'Post Published Successfully!',
          `Your post "${title}" has been published successfully.`
        );
        
        // 2. Notify a mock follower/user
        await createNotification(
          'user-follower-456',
          'push',
          'New Post Alert',
          `A new post "${title}" was published by user ${authorId}.`
        );
        
      } else if (routingKey === ROUTING_KEYS.FILE_UPLOADED) {
        // Handle File Uploaded
        const { fileId, filename, url } = payload;
        
        // Notify mock admin / system user about the file upload
        await createNotification(
          'system-admin',
          'email',
          'New File Uploaded',
          `File "${filename}" was successfully uploaded. Access URL: ${url}`
        );
      }
      
      // Acknowledge receipt
      channel.ack(msg);
      console.log(`[Notification Worker] Acknowledged message: ${msg.fields.deliveryTag}`);
    } catch (error) {
      console.error('[Notification Worker] Error processing message:', error);
      // Reject message, requeue if it was a temporary/network error, but here we discard it (requeue = false) to prevent loops
      channel.nack(msg, false, false);
    }
  });
};

const createNotification = async (userId: string, type: string, title: string, message: string) => {
  try {
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), userId, type, title, message, 'sent']
    );
    console.log(`[Notification Service] Created notification [${type}] for ${userId}: ${title}`);
  } catch (error) {
    console.error('[Notification Service] Failed to write notification to DB:', error);
  }
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
    return published;
  } catch (error) {
    console.error('[RabbitMQ] Error publishing event:', error);
    return false;
  }
};
