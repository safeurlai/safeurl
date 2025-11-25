# SafeURL.ai Setup Guide

This guide helps you complete the manual setup tasks for Phase 1 and prepare for development.

---

## Prerequisites

Before starting, ensure you have:

- ✅ **Bun** installed (latest version, >= 1.0.0)
  ```bash
  curl -fsSL https://bun.sh/install | bash  # macOS/Linux
  ```
- ✅ **Docker Desktop** installed and running
- ✅ **Tilt** installed (optional, for local development)
  ```bash
  # macOS
  brew install tilt-dev/tap/tilt
  
  # Or download from https://docs.tilt.dev/install.html
  ```
- ✅ **Git** configured with SSH keys

---

## Step 1: Install Dependencies

```bash
# From project root
bun install
```

This will install all workspace dependencies for `packages/core` and `packages/db`.

---

## Step 2: Create Environment Variables File

Create a `.env.example` file in the project root (this file is gitignored, but `.env.example` should be committed):

```bash
# Copy this template to .env.example
cat > .env.example << 'EOF'
# SafeURL.ai Environment Variables
# Copy this file to .env and fill in your actual values

# Database (Turso/libSQL)
# For local development, you can use a local file: file:./local.db
# For production, use your Turso database URL
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token

# Redis/Queue
# Local development uses Docker Compose Redis service
REDIS_URL=redis://localhost:6379

# Authentication (Clerk)
# Get these from https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# LLM Provider (Mastra)
# Use your preferred LLM provider API key
OPENAI_API_KEY=sk-...
# Or other provider keys:
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...

# Application
NODE_ENV=development
LOG_LEVEL=info
API_PORT=8080

# Optional: Docker configuration for fetcher containers
DOCKER_HOST=unix:///var/run/docker.sock

# Optional: Monitoring and Observability
# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
EOF
```

Then create your local `.env` file:

```bash
cp .env.example .env
# Edit .env with your actual values
```

---

## Step 3: Set Up Turso Database

### Option A: Local Development (File-based)

For local development, you can use a local SQLite file:

```bash
# In your .env file, set:
DATABASE_URL=file:./local.db
# Leave DATABASE_AUTH_TOKEN empty
```

### Option B: Turso Cloud Database

1. **Install Turso CLI:**
   ```bash
   # macOS/Linux
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # Or using Homebrew
   brew install tursodatabase/tap/turso
   ```

2. **Login to Turso:**
   ```bash
   turso auth login
   ```

3. **Create a database:**
   ```bash
   turso db create safeurl-dev
   ```

4. **Get database URL and token:**
   ```bash
   # Get database URL
   turso db show safeurl-dev --url
   
   # Create auth token
   turso db tokens create safeurl-dev
   ```

5. **Update your `.env` file:**
   ```bash
   DATABASE_URL=libsql://your-database-url.turso.io
   DATABASE_AUTH_TOKEN=your-auth-token
   ```

---

## Step 4: Start Docker Services

Start Redis using Docker Compose:

```bash
# Start Redis service
docker-compose up -d

# Verify it's running
docker-compose ps

# Check Redis connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

---

## Step 5: Verify Setup

Run these commands to verify everything is set up correctly:

```bash
# 1. Check Bun version
bun --version

# 2. Verify TypeScript compilation
bun run typecheck

# 3. Check Docker Compose
docker-compose config

# 4. Verify Redis is accessible
docker-compose exec redis redis-cli ping

# 5. Check workspace packages
ls -la packages/core packages/db
```

---

## Step 6: Database Migrations (When Ready)

Once you have database schemas defined (Phase 3), you can run migrations:

```bash
# Generate migrations from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio (database GUI)
bun run db:studio
```

---

## Troubleshooting

### Docker Compose Issues

If Docker Compose fails:

```bash
# Check Docker Desktop is running
docker ps

# Restart Docker Desktop if needed
# Then try again:
docker-compose up -d
```

### Bun Not Found

If `bun` command is not found:

```bash
# Add Bun to PATH (macOS/Linux)
export PATH="$HOME/.bun/bin:$PATH"

# Or restart your terminal
# Or add to ~/.zshrc / ~/.bashrc:
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
```

### Turso CLI Issues

If Turso CLI installation fails:

```bash
# Check if curl is available
which curl

# Try alternative installation method
# See: https://docs.turso.tech/cli/installation
```

---

## Next Steps

Once setup is complete:

1. ✅ Verify all checks pass
2. ✅ Proceed to **Phase 2: Core Package Implementation**
3. ✅ Continue with **Phase 3: Database Schema & Migrations**

---

## Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Turso Documentation](https://docs.turso.tech)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Tilt Documentation](https://docs.tilt.dev/)

