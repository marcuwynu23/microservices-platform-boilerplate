FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/file-upload-service ./services/file-upload-service
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=file-upload-service

FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/file-upload-service/dist ./services/file-upload-service/dist
COPY --from=builder /app/services/file-upload-service/package.json ./services/file-upload-service/package.json

EXPOSE 3002
ENV NODE_ENV=production
CMD ["node", "services/file-upload-service/dist/index.js"]
