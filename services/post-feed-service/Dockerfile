FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/post-feed-service ./services/post-feed-service
RUN npm ci
RUN npm run build --workspace=services/shared-contracts
RUN npm run build --workspace=services/post-feed-service

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/post-feed-service/dist ./services/post-feed-service/dist
COPY --from=builder /app/services/post-feed-service/package.json ./services/post-feed-service/package.json

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "services/post-feed-service/dist/index.js"]
