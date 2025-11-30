# SafeURL.ai

AI-powered URL safety screening service. Asynchronous job processing with ephemeral containers, LLM analysis, and privacy-first design (metadata only, no content persistence).

## Monorepo Structure

```
safeurl/
├── apps/
│   ├── api/          # ElysiaJS API service (Bun)
│   ├── worker/       # Job processor (Bun + BullMQ)
│   ├── fetcher/      # Ephemeral container fetcher (Bun + Mastra)
│   ├── dashboard/    # Next.js dashboard (Clerk auth)
│   └── mcp-server/   # MCP server for agent integration
├── packages/
│   ├── core/         # Shared schemas, types, utilities
│   ├── db/           # Drizzle schema & migrations (Turso/libSQL)
│   └── mastra/       # Mastra agents & tools for URL analysis
```

## Tech Stack

- **Runtime**: Bun
- **API**: ElysiaJS
- **Database**: Turso (libSQL) + Drizzle ORM
- **Queue**: Redis + BullMQ
- **Dashboard**: Next.js 16 + tRPC
- **Auth**: Clerk
- **AI**: Mastra framework (600+ LLM models)
- **Error Handling**: neverthrow (Result types)
- **Validation**: Zod schemas

## Quick Start

```bash
# Install dependencies
bun install

# Setup database
bun run db:migrate

# Start all services (via Tilt)
bun run dev
```

Services:

- API: `http://localhost:8080`
- Dashboard: `http://localhost:3000`
- Redis: `localhost:6379`

## Development

```bash
bun run dev              # Start all services
bun run build            # Build all apps
bun run test             # Run tests
bun run db:generate      # Generate migration
bun run db:migrate       # Apply migrations
bun run db:studio        # Open Drizzle Studio
```

## License

Business Source License (BSL 1.1)
