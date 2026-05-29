import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { pool, initDb } from './db';
import { initRabbitMQ, publishEvent } from './rabbitmq';
import { ROUTING_KEYS } from 'shared-contracts';

const app = express();
const port = parseInt(process.env.PORT || '3003', 10);

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'UP', service: 'Notification Service', database: 'HEALTHY' });
  } catch (error: any) {
    res.status(500).json({ status: 'DOWN', service: 'Notification Service', error: error.message });
  }
});

// Helper to map DB row to DTO
const mapToDTO = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  type: row.type as 'email' | 'push' | 'in-app',
  title: row.title,
  message: row.message,
  status: row.status as 'sent' | 'failed' | 'pending',
  createdAt: row.created_at.toISOString(),
});

// All API Gateway requests to /api/notifications are proxied to /notifications
// So our router prefix will be /notifications

const router = express.Router();

// 1. GET /notifications - Get list of notifications (optionally filter by user via header or query)
router.get('/', async (req, res) => {
  const userIdHeader = req.headers['x-user-id'] as string;
  const userRoleHeader = req.headers['x-user-role'] as string;
  const userIdQuery = req.query.userId as string;

  try {
    let query = 'SELECT * FROM notifications';
    const params: any[] = [];

    // If regular user, restrict them to their own notifications
    if (userIdHeader && userRoleHeader !== 'admin') {
      query += ' WHERE user_id = $1';
      params.push(userIdHeader);
    } else if (userIdQuery) {
      query += ' WHERE user_id = $1';
      params.push(userIdQuery);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const notifications = result.rows.map(mapToDTO);
    res.json(notifications);
  } catch (error: any) {
    console.error('[Notification Service] Error retrieving notifications:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 2. POST /notifications - Send a manual notification
router.post('/', async (req, res) => {
  const { userId, type, title, message } = req.body;

  if (!userId || !type || !title || !message) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userId, type, title, and message are required fields',
    });
  }

  if (!['email', 'push', 'in-app'].includes(type)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: "Type must be one of: 'email', 'push', 'in-app'",
    });
  }

  try {
    const notificationId = uuidv4();
    const result = await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [notificationId, userId, type, title, message, 'sent']
    );

    const notification = mapToDTO(result.rows[0]);

    // Publish event
    await publishEvent(ROUTING_KEYS.NOTIFICATION_CREATED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
    });

    res.status(201).json(notification);
  } catch (error: any) {
    console.error('[Notification Service] Error creating manual notification:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 3. GET /notifications/:id - Retrieve notification by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userIdHeader = req.headers['x-user-id'] as string;
  const userRoleHeader = req.headers['x-user-role'] as string;

  try {
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Notification with ID ${id} not found` });
    }

    const notification = mapToDTO(result.rows[0]);

    // Auth check: Regular users can only retrieve their own notifications
    if (userIdHeader && notification.userId !== userIdHeader && userRoleHeader !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to view this notification' });
    }

    res.json(notification);
  } catch (error: any) {
    console.error('[Notification Service] Error retrieving notification:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

app.use('/notifications', router);

// Startup logic
const startServer = async () => {
  try {
    await initDb();
    await initRabbitMQ();
    app.listen(port, () => {
      console.log(`[Notification Service] Running on port ${port}`);
    });
  } catch (error) {
    console.error('[Notification Service] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
