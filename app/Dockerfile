# syntax=docker/dockerfile:1

# ---- dependencies ---------------------------------------------------------
# The image installs from package-lock.json, as CI does; bun.lock is only for
# local development. Its own layer: editing source does not re-resolve the
# dependency graph.
FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---- build ----------------------------------------------------------------
# Same musl base as the deps stage, so the native binaries (next-swc,
# lightningcss) that npm resolved still load.
FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# The NEXT_PUBLIC_ values come from .env.production, which `next build` loads
# on its own: sentinels, which the entrypoint swaps for the real values at
# container start — one image, configured per deployment rather than rebuilt
# per environment. .dockerignore keeps every other .env file out of the
# context, so nothing of yours outranks it here.
RUN npm run build

# next build copies .env* into the standalone output, where the server would
# read it at runtime. A real environment variable outranks a dotenv file in
# @next/env, so it would change nothing — but an image carrying a file of
# __SENTINEL__ values is a trap for whoever opens it next.
RUN rm -f .next/standalone/.env.production

# There is no public/ in the repo today; the runtime stage copies it either way,
# so adding one later needs no change here.
RUN mkdir -p /app/public

# ---- runtime --------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# `output: "standalone"` leaves the server and its pruned node_modules in
# .next/standalone; static assets and public/ are the two pieces it expects to
# find beside it. Owned by `node` because the entrypoint rewrites the sentinels
# in place, as that user.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

# Documentation only; the platform's injected PORT is what the server binds to.
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
