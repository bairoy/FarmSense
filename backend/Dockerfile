# Node 24 with native TypeScript support
FROM node:24-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S farmsense -u 1001 -G nodejs
USER farmsense

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "src/server.ts"]
