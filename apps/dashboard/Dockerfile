FROM oven/bun:1.3.2-slim AS deps
WORKDIR /app

COPY . .

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0

RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile || bun install || true; \
    test -d node_modules && test -d packages/core && test -d packages/db

FROM oven/bun:1.3.2-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/bun.lock ./
COPY --from=deps /app/tsconfig.json* ./
COPY --from=deps /app/packages/core ./packages/core
COPY --from=deps /app/packages/db ./packages/db
COPY --from=deps /app/apps/dashboard ./apps/dashboard

WORKDIR /app/apps/dashboard

# Build Next.js app
RUN bun run build

FROM oven/bun:1.3.2-slim AS runtime
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/bun.lock ./
COPY --from=deps /app/tsconfig.json* ./
COPY --from=deps /app/packages/core ./packages/core
COPY --from=deps /app/packages/db ./packages/db
COPY --from=builder /app/apps/dashboard ./apps/dashboard

WORKDIR /app/apps/dashboard
EXPOSE 3000

CMD ["bun", "run", "start"]

