FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/notification-service ./services/notification-service
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=notification-service

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=builder /app/services/notification-service/package.json ./services/notification-service/package.json

EXPOSE 3003
ENV NODE_ENV=production
CMD ["node", "services/notification-service/dist/index.js"]
