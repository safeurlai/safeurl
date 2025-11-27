FROM oven/bun:1.3.3-slim AS deps
WORKDIR /app

COPY . .

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

WORKDIR /app

# Install Playwright browsers (Chromium only for screenshot analysis)
# Playwright is in packages/mastra/devDependencies, installed via bun install
# Execute playwright CLI script directly using bun
# The --with-deps flag installs both browser binaries and system dependencies
RUN echo "Installing Playwright Chromium browser..." && \
    cd /app && \
    (bun node_modules/.bin/playwright install chromium --with-deps 2>/dev/null || \
     bun packages/mastra/node_modules/.bin/playwright install chromium --with-deps 2>/dev/null || \
     bun node_modules/playwright/cli.js install chromium --with-deps 2>/dev/null || \
     { echo "Error: Could not find or execute playwright. Trying alternative..." && \
       cd packages/mastra && \
       bun node_modules/.bin/playwright install chromium --with-deps; }) && \
    echo "Playwright Chromium installed successfully"

WORKDIR /app/apps/fetcher

# Fetcher runs as ephemeral container - no persistent storage needed
# Container will be removed after execution with --rm flag
#
# Required environment variables (must be passed at runtime):
# - JOB_ID: Job ID for tracking
# - SCAN_URL: URL to scan
# - OPENROUTER_API_KEY: OpenRouter API key (required for Mastra agent analysis)
#   Get your API key from: https://openrouter.ai/keys
#
# Optional environment variables:
# - FETCH_TIMEOUT_MS: Fetch timeout in milliseconds (default: 30000)
# - MAX_REDIRECT_DEPTH: Maximum redirect depth (default: 5)
# - DEBUG_AGENT: Enable debug logging (set to "true" to enable)

CMD ["bun", "run", "src/index.ts"]

