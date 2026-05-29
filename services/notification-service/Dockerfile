FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/notification-service ./services/notification-service
RUN npm ci
RUN npm run build --workspace=services/shared-contracts
RUN npm run build --workspace=services/notification-service

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=builder /app/services/notification-service/package.json ./services/notification-service/package.json

EXPOSE 3003
ENV NODE_ENV=production
CMD ["node", "services/notification-service/dist/index.js"]
