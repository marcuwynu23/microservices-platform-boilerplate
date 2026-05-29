FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/file-upload-service ./services/file-upload-service
RUN npm ci
RUN npm run build --workspace=services/shared-contracts
RUN npm run build --workspace=services/file-upload-service

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/file-upload-service/dist ./services/file-upload-service/dist
COPY --from=builder /app/services/file-upload-service/package.json ./services/file-upload-service/package.json

EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "services/file-upload-service/dist/index.js"]
