FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/post-feed-service ./services/post-feed-service
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=post-feed-service

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/post-feed-service/dist ./services/post-feed-service/dist
COPY --from=builder /app/services/post-feed-service/package.json ./services/post-feed-service/package.json

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "services/post-feed-service/dist/index.js"]
