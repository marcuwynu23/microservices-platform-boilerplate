FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY services/shared-contracts ./services/shared-contracts
COPY services/gateway ./services/gateway
RUN npm ci
RUN npm run build --workspace=services/shared-contracts
RUN npm run build --workspace=services/gateway

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shared-contracts ./services/shared-contracts
COPY --from=builder /app/services/gateway/dist ./services/gateway/dist
COPY --from=builder /app/services/gateway/package.json ./services/gateway/package.json

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "services/gateway/dist/index.js"]
