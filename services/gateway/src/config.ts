import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  services: {
    postFeed: process.env.POST_FEED_SERVICE_URL || 'http://localhost:3001',
    fileUpload: process.env.FILE_UPLOAD_SERVICE_URL || 'http://localhost:3002',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  },
  apiKey: process.env.API_KEY || 'default-secret-key',
};
