import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { rateLimiter } from './middleware/rate-limiter';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';

const app = express();

app.use(cors());
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'API Gateway' });
});

// Serve OpenAPI Specification
app.get('/openapi.yml', (req, res) => {
  const specPath = path.join(__dirname, 'openapi.yml');
  if (fs.existsSync(specPath)) {
    res.setHeader('Content-Type', 'text/yaml');
    fs.createReadStream(specPath).pipe(res);
  } else {
    // If running in development (ts-node-dev), __dirname is src
    const devSpecPath = path.join(__dirname, '../src/openapi.yml');
    if (fs.existsSync(devSpecPath)) {
      res.setHeader('Content-Type', 'text/yaml');
      fs.createReadStream(devSpecPath).pipe(res);
    } else {
      res.status(404).json({ error: 'Not Found', message: 'OpenAPI specification file not found.' });
    }
  }
});

// Serve Scalar API reference docs
app.get('/docs', (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>Microservices Platform API Reference</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <script
          id="api-reference"
          data-url="/openapi.yml"
          data-theme="purple"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

// Downstream header passing utility
const addAuthHeaders = (proxyReq: any, req: any) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user) {
    proxyReq.setHeader('x-user-id', authReq.user.id);
    proxyReq.setHeader('x-user-role', authReq.user.role);
  }
};

// 1. Post Feed Service Proxy
app.use(
  '/api/posts',
  authMiddleware,
  createProxyMiddleware({
    target: config.services.postFeed,
    changeOrigin: true,
    pathRewrite: {
      '^/api/posts': '/posts', // Forward /api/posts/foo to /posts/foo
    },
    onProxyReq: addAuthHeaders
  })
);

// 2. File Upload Service Proxy
app.use(
  '/api/files',
  authMiddleware,
  createProxyMiddleware({
    target: config.services.fileUpload,
    changeOrigin: true,
    pathRewrite: {
      '^/api/files': '', // Forward /api/files/upload to /upload, /api/files/1 to /files/1
    },
    onProxyReq: addAuthHeaders
  })
);

// 3. Notification Service Proxy
app.use(
  '/api/notifications',
  authMiddleware,
  createProxyMiddleware({
    target: config.services.notification,
    changeOrigin: true,
    pathRewrite: {
      '^/api/notifications': '/notifications', // Forward /api/notifications/foo to /notifications/foo
    },
    onProxyReq: addAuthHeaders
  })
);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Gateway Error]:', err);
  res.status(500).json({ error: 'Gateway Error', message: err.message || 'Something went wrong.' });
});

app.listen(config.port, () => {
  console.log(`[API Gateway] Running on port ${config.port}`);
});
