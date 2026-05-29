import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const apiKeyHeader = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];

  // 1. Check API Key
  if (apiKeyHeader === config.apiKey) {
    req.user = { id: 'system-admin', role: 'admin' };
    return next();
  }

  // 2. Check Bearer Token (Mock JWT check for this boilerplate)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === 'valid-mock-token' || token.length > 10) {
      req.user = { id: 'user-123', role: 'user' };
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Provide a valid API Key in X-API-KEY header or a Bearer token in Authorization header.'
  });
};
