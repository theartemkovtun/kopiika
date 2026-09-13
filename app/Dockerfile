# syntax=docker/dockerfile:1

# ---- dependencies ---------------------------------------------------------
# bun.lock is this repo's lockfile, so bun does the install. Its own layer:
# editing source does not re-resolve the dependency graph.
FROM oven/bun:1.3-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ---- build ----------------------------------------------------------------
# Node runs `next build`, not bun: same musl base as the deps stage, so the
# native binaries (next-swc, lightningcss) that bun resolved still load.
FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Every NEXT_PUBLIC_ value is inlined into the bundle at build time, so the
# build has to be handed something. It is handed a sentinel, and the entrypoint
# swaps in the real value at container start — one image, configured per
# deployment instead of rebuilt per environment.
ENV NEXT_PUBLIC_API_URL=__NEXT_PUBLIC_API_URL__ \
    NEXT_PUBLIC_USER_POOL_ID=__NEXT_PUBLIC_USER_POOL_ID__ \
    NEXT_PUBLIC_USER_POOL_CLIENT_ID=__NEXT_PUBLIC_USER_POOL_CLIENT_ID__ \
    NEXT_PUBLIC_USER_POOL_DOMAIN=__NEXT_PUBLIC_USER_POOL_DOMAIN__ \
    NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_IN=__NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_IN__ \
    NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_OUT=__NEXT_PUBLIC_COGNITO_OAUTH_REDIRECT_SIGN_OUT__

RUN npm run build

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
