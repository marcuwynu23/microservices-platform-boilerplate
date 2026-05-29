import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool, initDb } from './db';
import { initRabbitMQ, publishEvent } from './rabbitmq';
import { ROUTING_KEYS } from 'shared-contracts';

const app = express();
const port = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Setup Multer for disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'UP', service: 'File Upload Service', database: 'HEALTHY' });
  } catch (error: any) {
    res.status(500).json({ status: 'DOWN', service: 'File Upload Service', error: error.message });
  }
});

// Helper to map DB row to DTO
const mapToDTO = (row: any) => ({
  id: row.id,
  filename: row.filename,
  url: row.url,
  mimetype: row.mimetype,
  size: parseInt(row.size, 10),
  uploadedAt: row.uploaded_at.toISOString(),
});

// 1. POST /upload - Upload a file
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Validation Error', message: 'No file was uploaded' });
  }

  try {
    const fileId = uuidv4();
    const filename = req.file.filename;
    
    // In production/docker setup, standardise external URL format
    const publicHost = process.env.PUBLIC_URL || `http://localhost:${port}`;
    const fileUrl = `${publicHost}/uploads/${filename}`;
    
    const result = await pool.query(
      'INSERT INTO files (id, filename, url, mimetype, size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [fileId, req.file.originalname, fileUrl, req.file.mimetype, req.file.size]
    );

    const fileDTO = mapToDTO(result.rows[0]);

    // Publish event
    await publishEvent(ROUTING_KEYS.FILE_UPLOADED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      fileId: fileDTO.id,
      filename: fileDTO.filename,
      url: fileDTO.url,
      mimetype: fileDTO.mimetype,
      size: fileDTO.size,
    });

    res.status(201).json(fileDTO);
  } catch (error: any) {
    console.error('[File Service] Upload error:', error);
    // Cleanup file from disk if upload db insert fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 2. GET /files/:id - Get file metadata
app.get('/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `File with ID ${id} not found` });
    }
    res.json(mapToDTO(result.rows[0]));
  } catch (error: any) {
    console.error('[File Service] Error retrieving file metadata:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// 3. DELETE /files/:id - Delete a file
app.delete('/files/:id', async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'] as string;

  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `File with ID ${id} not found` });
    }

    const file = result.rows[0];

    // Delete from disk
    const filenameOnDisk = path.basename(file.url);
    const filePath = path.join(UPLOADS_DIR, filenameOnDisk);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[File Service] Deleted file from disk: ${filePath}`);
    } else {
      console.warn(`[File Service] File not found on disk: ${filePath}`);
    }

    // Delete from database
    await pool.query('DELETE FROM files WHERE id = $1', [id]);

    // Publish event
    await publishEvent(ROUTING_KEYS.FILE_DELETED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      fileId: id,
    });

    res.json({ message: 'File successfully deleted', id });
  } catch (error: any) {
    console.error('[File Service] Error deleting file:', error);
    res.status(500).json({ error: 'Database Error', message: error.message });
  }
});

// Startup logic
const startServer = async () => {
  try {
    await initDb();
    await initRabbitMQ();
    app.listen(port, () => {
      console.log(`[File Upload Service] Running on port ${port}`);
    });
  } catch (error) {
    console.error('[File Upload Service] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
