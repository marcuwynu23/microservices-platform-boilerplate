import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { pool, initDb } from './db';
import { initRabbitMQ, publishEvent } from './rabbitmq';
import { ROUTING_KEYS } from 'shared-contracts';

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', async (req, res) => {
  try {
    // Check DB health
    await pool.query('SELECT 1');
    res.json({ status: 'UP', service: 'Post Feed Service', database: 'HEALTHY' });
  } catch (error: any) {
    res.status(500).json({ status: 'DOWN', service: 'Post Feed Service', error: error.message });
  }
});

// Helper to map DB row to DTO
const mapToDTO = (row: any) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  authorId: row.author_id,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// 1. POST /posts - Create a new post
app.post('/posts', async (req, res) => {
  const { title, content } = req.body;
  const authorId = (req.headers['x-user-id'] as string) || req.body.authorId || 'anonymous';

  if (!title || !content) {
    return res.status(400).json({ error: 'Validation Error', message: 'Title and content are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO posts (title, content, author_id) VALUES ($1, $2, $3) RETURNING *',
      [title, content, authorId]
    );
    
    const post = mapToDTO(result.rows[0]);

    // Publish event
    await publishEvent(ROUTING_KEYS.POST_CREATED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      postId: post.id,
      title: post.title,
      content: post.content,
      authorId: post.authorId,
    });

    res.status(201).json(post);
  } catch (error: any) {
    console.error('[Post Service] Error creating post:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 2. GET /posts - Get all posts
app.get('/posts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    const posts = result.rows.map(mapToDTO);
    res.json(posts);
  } catch (error: any) {
    console.error('[Post Service] Error retrieving posts:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 3. GET /posts/:id - Get a post by ID
app.get('/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Post with ID ${id} not found` });
    }
    res.json(mapToDTO(result.rows[0]));
  } catch (error: any) {
    console.error('[Post Service] Error retrieving post:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 4. PUT /posts/:id - Update a post
app.put('/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;

  try {
    // Check if post exists and retrieve creator
    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Post with ID ${id} not found` });
    }

    const existingPost = postCheck.rows[0];
    
    // Auth check: Admin or creator
    if (userId && existingPost.author_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to update this post' });
    }

    const updatedTitle = title !== undefined ? title : existingPost.title;
    const updatedContent = content !== undefined ? content : existingPost.content;

    const result = await pool.query(
      'UPDATE posts SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [updatedTitle, updatedContent, id]
    );

    const post = mapToDTO(result.rows[0]);

    // Publish event
    await publishEvent(ROUTING_KEYS.POST_UPDATED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      postId: post.id,
      title: title !== undefined ? post.title : undefined,
      content: content !== undefined ? post.content : undefined,
    });

    res.json(post);
  } catch (error: any) {
    console.error('[Post Service] Error updating post:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 5. DELETE /posts/:id - Delete a post
app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;

  try {
    // Check if post exists
    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Post with ID ${id} not found` });
    }

    const existingPost = postCheck.rows[0];

    // Auth check: Admin or creator
    if (userId && existingPost.author_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to delete this post' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    // Publish event
    await publishEvent(ROUTING_KEYS.POST_DELETED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      postId: id,
    });

    res.json({ message: 'Post successfully deleted', id });
  } catch (error: any) {
    console.error('[Post Service] Error deleting post:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// Startup logic
const startServer = async () => {
  try {
    await initDb();
    await initRabbitMQ();
    app.listen(port, () => {
      console.log(`[Post Feed Service] Running on port ${port}`);
    });
  } catch (error) {
    console.error('[Post Feed Service] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
