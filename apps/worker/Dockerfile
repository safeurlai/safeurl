FROM oven/bun:1.3.2-slim AS deps
WORKDIR /app

COPY . .

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0

RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install || true; \
    test -d node_modules && test -d packages/core && test -d packages/db

FROM oven/bun:1.3.2-slim AS runtime
WORKDIR /app

# Note: dockerode connects via Docker socket, no CLI needed
# Docker socket will be mounted at runtime via docker-compose

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/bun.lock ./
COPY --from=deps /app/tsconfig.json* ./
COPY --from=deps /app/packages/core ./packages/core
COPY --from=deps /app/packages/db ./packages/db
COPY --from=deps /app/packages/mastra ./packages/mastra
COPY --from=deps /app/apps/worker ./apps/worker

WORKDIR /app/apps/worker

# Note: Docker socket will be mounted at runtime via docker-compose
# DOCKER_SOCKET_PATH=/var/run/docker.sock

CMD ["bun", "run", "src/index.ts"]

