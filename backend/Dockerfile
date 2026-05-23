# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy Prisma schema first (needed for postinstall)
COPY prisma ./prisma
COPY package*.json ./

# Install dependencies (this triggers postinstall -> prisma generate)
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

COPY package*.json ./

# Copy Prisma schema before npm ci (for postinstall)
COPY prisma ./prisma

# Install production dependencies (this triggers postinstall -> prisma generate)
RUN npm ci --omit=dev

# Copy compiled application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
