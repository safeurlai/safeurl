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

GNU Affero General Public License v3.0 (AGPL-3.0)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

**Why AGPL?** SafeURL.ai is a SaaS service accessed over the network. AGPL v3 extends copyleft to network use, ensuring that anyone who uses this code to provide a service over a network must share their source code modifications. This protects against competitors forking the code and running it as a proprietary SaaS without contributing back.

See [LICENSE](LICENSE) for full details.
