# Multi-stage build for the Next.js app. Same base image in every stage to
# avoid musl/glibc mismatches with the better-sqlite3 native addon.
FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
# build tools so better-sqlite3 can compile if no prebuilt binary matches this platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/db/migrations ./src/db/migrations
# safety net: explicitly ship the native addon in case standalone's file
# tracer missed it
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

EXPOSE 3000
CMD ["node", "server.js"]
