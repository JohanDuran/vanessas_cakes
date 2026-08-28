# Multi-stage build for the Next.js app.
FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined into the compiled bundle at build time by
# Next.js — a runtime env_file value can never override them — so these must
# be the real values, passed in as build args (see docker-compose.yml).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
# Build-time-only placeholder: every page is force-dynamic (no DB reads
# during static generation), but src/db/index.ts still throws if this is
# unset when its module loads during page-data collection. Unlike the
# NEXT_PUBLIC_* vars above, this one is NOT inlined, so the real
# DATABASE_URL supplied at container runtime via env_file still applies.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SUPABASE_SERVICE_ROLE_KEY="build-placeholder"
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/db/migrations ./src/db/migrations

EXPOSE 3000
CMD ["node", "server.js"]
