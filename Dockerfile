# ============================================
# Stage 1: Build (full dependencies)
# - Installs full deps
# - Generates Prisma client
# - Builds TypeScript + Next.js
# ============================================
FROM node:22-alpine AS builder

# System dependencies required for node-gyp, Prisma, etc.
RUN apk add --no-cache python3 make g++ libc6-compat bash

# Work from the application directory
WORKDIR /app

# Install full dependency tree (prod + dev)
COPY package*.json ./
RUN npm ci

# Copy the full source tree (post-install)
COPY . .

# Prisma client generation
RUN npx prisma generate

# Run the project build (TS + Next.js)
RUN npm run build


# ============================================
# Stage 2: Runtime (production-only)
# - Installs only production deps
# - Receives compiled build output
# - Shared base for app + cron
# ============================================
FROM node:22-alpine AS runtime

# Minimal runtime system utilities
RUN apk add --no-cache bash postgresql-client

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the compiled output + prisma client + any emitted files
COPY --from=builder /app ./

# Shared environment defaults
ENV DATABASE_HOST=localhost \
    DATABASE_PORT=5432 \
    DATABASE_URL=""


# ============================================
# Stage 3a: Web Application Service
# - Starts the normal HTTP server
# ============================================
FROM runtime AS app

ENV START_CRON=false

WORKDIR /app
EXPOSE 3000

CMD ["sh", "-c", "\
    until pg_isready -h \"$DATABASE_HOST\" -p \"$DATABASE_PORT\" >/dev/null 2>&1; do \
      echo 'Waiting for database...'; sleep 1; \
    done; \
    echo 'Database ready'; \
    node dist/dbsetup.js; \
    npm run start:prod \
"]


# ============================================
# Stage 3b: Cron Worker Service
# - Starts the background scheduled job runner
# ============================================
FROM runtime AS cron

ENV START_CRON=true

WORKDIR /app

CMD ["sh", "-c", "\
    until pg_isready -h \"$DATABASE_HOST\" -p \"$DATABASE_PORT\" >/dev/null 2>&1; do \
      echo 'Waiting for database...'; sleep 1; \
    done; \
    echo 'Database ready'; \
    node dist/dbsetup.js; \
    npm run start:cron \
"]
