# =========================
# Stage 1: Build
# =========================
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat bash postgresql-client

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npx tsc --project tsconfig.build.json

# Build Next.js
RUN npm run build

# =========================
# Stage 2a: App runtime
# =========================
FROM node:22-alpine AS app-runtime

RUN apk add --no-cache bash postgresql-client

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Default command for web service
CMD ["sh", "-c", "\
    until pg_isready -h \"${DATABASE_HOST:-verification-db}\" -p \"${DATABASE_PORT:-5432}\" >/dev/null 2>&1; do \
    echo 'Waiting for database...'; sleep 1; \
    done; \
    echo 'Database ready'; \
    node dist/dbsetup.js; \
    npm run start:prod \
    "]

# =========================
# Stage 2b: Cron runtime
# =========================
FROM node:22-alpine AS cron-runtime

RUN apk add --no-cache bash postgresql-client

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Default command for cron
CMD ["sh", "-c", "\
    until pg_isready -h \"${DATABASE_HOST:-verification-db}\" -p \"${DATABASE_PORT:-5432}\" >/dev/null 2>&1; do \
    echo 'Waiting for database...'; sleep 1; \
    done; \
    echo 'Database ready'; \
    node dist/dbsetup.js; \
    npm run start:cron \
    "]
