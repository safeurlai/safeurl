# Database Setup Guide

This project uses **Turso (libSQL)** as the database, accessed via the `@safeurl/db` workspace package. All services (API, Worker, Dashboard) connect to the same Turso database, ensuring data consistency.

## Current Setup: Turso (libSQL)

The database is accessed directly via the workspace package - **no Docker service needed**:

- **Database**: Turso cloud (libSQL/SQLite compatible)
- **Access**: Via `@safeurl/db` workspace package
- **Connection**: Configured via `DATABASE_URL` environment variable
- **All services** connect to the same Turso database instance

### Benefits

✅ **Data Consistency**: All services see the same data  
✅ **No Docker Overhead**: Database accessed directly via workspace package  
✅ **Cloud-Based**: Turso provides managed SQLite with replication  
✅ **Easy Development**: Same connection string works locally and in Docker  
✅ **Type-Safe**: Drizzle ORM with TypeScript types  

### Configuration

Set these environment variables (in `.env` file or Docker Compose):

```bash
# Turso connection URL (libSQL format)
DATABASE_URL=libsql://your-database.turso.io

# Optional: Turso auth token (if required)
DATABASE_AUTH_TOKEN=your-auth-token

# Alternative: Use TURSO_ prefixed variables
TURSO_CONNECTION_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

## Running with Docker Compose

```bash
# Start all services (database accessed via Turso, no Docker service needed)
docker-compose up -d

# Services automatically connect to Turso using DATABASE_URL from .env
```

## Database Migrations

Run migrations from any service or locally (they all use the same database):

```bash
# From API container
docker-compose exec api bun run db:migrate

# Or from worker container
docker-compose exec worker bun run db:migrate

# Or locally (uses DATABASE_URL from .env)
bun run db:migrate
```

## Local Development (Outside Docker)

When running services locally (not in Docker), they use the same Turso connection:

- **Turso Cloud**: `DATABASE_URL=libsql://your-database.turso.io` (recommended)
- **Local SQLite**: `DATABASE_URL=file:./local.db` (for testing without Turso)

## Testing

Integration tests automatically:
1. Run database migrations before tests
2. Use the same database configuration as services
3. Clean up after tests (optional)

```bash
# Run tests (uses local database)
cd apps/api
bun test
```

## Troubleshooting

### Connection Issues

If services can't connect to Turso:
- Verify `DATABASE_URL` is set correctly in `.env` file
- Check that `DATABASE_AUTH_TOKEN` is set if required by your Turso instance
- Ensure network connectivity (Turso requires internet access)
- Verify Turso database is active and accessible

### Migration Issues

If migrations fail:
- Verify `DATABASE_URL` points to correct Turso instance
- Check that you have write permissions on the Turso database
- Run migrations locally first: `bun run db:migrate`
- Check Turso dashboard for connection status

### Workspace Package Usage

⚠️ **Important**: Always use the `@safeurl/db` workspace package for database access:
- ✅ `import { db } from "@safeurl/db"`
- ❌ Don't create database clients directly in services
- The workspace package handles all Turso/libSQL connections

