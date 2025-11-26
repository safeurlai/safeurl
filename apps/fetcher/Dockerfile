FROM oven/bun:1.3.3-slim AS deps
WORKDIR /app

COPY . .

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0

RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install || true; \
    test -d node_modules && test -d packages/core && test -d packages/mastra

FROM oven/bun:1.3.3-slim AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/bun.lock ./
COPY --from=deps /app/tsconfig.json* ./
COPY --from=deps /app/packages/core ./packages/core
COPY --from=deps /app/packages/mastra ./packages/mastra
COPY --from=deps /app/apps/fetcher ./apps/fetcher

WORKDIR /app/apps/fetcher

# Fetcher runs as ephemeral container - no persistent storage needed
# Container will be removed after execution with --rm flag

CMD ["bun", "run", "src/index.ts"]

