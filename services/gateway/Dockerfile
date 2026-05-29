FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/gateway ./services/gateway
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=gateway

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/gateway/dist ./services/gateway/dist
COPY --from=builder /app/services/gateway/package.json ./services/gateway/package.json

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "services/gateway/dist/index.js"]
