# SafeURL.ai Implementation Plan

This document provides an overview of the implementation plan. Detailed phase documents are available in the [`phases/`](./phases/) directory.

---

## Quick Links

- **[Phase Overview](./phases/00-overview.md)** - Overview and dependencies
- **[Phase 1: Foundation & Monorepo Setup](./phases/01-foundation.md)**
- **[Phase 2: Core Package Implementation](./phases/02-core-package.md)**
- **[Phase 3: Database Schema & Migrations](./phases/03-database.md)**
- **[Phase 4: Mastra Integration](./phases/04-mastra.md)**
- **[Phase 5: API Service](./phases/05-api-service.md)**
- **[Phase 6: Worker Service](./phases/06-worker-service.md)**
- **[Phase 7: Fetcher Container](./phases/07-fetcher.md)**
- **[Phase 8: Dashboard](./phases/08-dashboard.md)**
- **[Phase 9: MCP Server](./phases/09-mcp-server.md)**
- **[Phase 10: Infrastructure & DevOps](./phases/10-infrastructure.md)**
- **[Phase 11: Testing & Quality Assurance](./phases/11-testing.md)**
- **[Phase 12: Documentation & Polish](./phases/12-documentation.md)**
- **[Phase 13: Deployment & Launch](./phases/13-deployment.md)**

---

## Implementation Strategy

### Phase Dependencies

```
Phase 1 (Foundation)
    ↓
Phase 2 (Core Package) ──┐
    ↓                     │
Phase 3 (Database) ───────┤
    ↓                     │
Phase 4 (Mastra)          │
    ↓                     │
Phase 5 (API) ────────────┼──→ Phase 6 (Worker)
    ↓                     │         ↓
Phase 8 (Dashboard)       │    Phase 7 (Fetcher)
    ↓                     │         ↓
Phase 9 (MCP Server)      │    Phase 11 (Testing)
    ↓                     │         ↓
Phase 10 (Infrastructure) │    Phase 12 (Documentation)
    ↓                     │         ↓
Phase 13 (Deployment) ←───┘    Phase 13 (Deployment)
```

### Parallel Work Opportunities

- Phase 2 (Core Package) and Phase 3 (Database) can be worked on in parallel
- Phase 4 (Mastra) can start after Phase 2
- Phase 8 (Dashboard) and Phase 9 (MCP Server) can be worked on in parallel after Phase 5
- Phase 11 (Testing) should be done incrementally alongside development

---

## Dependencies & Prerequisites

### External Services

- [ ] Clerk account setup (OAuth2/OIDC provider)
- [ ] Turso account setup (libSQL database)
- [ ] Redis/Upstash account setup (job queue)
- [ ] LLM provider API keys (OpenAI, Anthropic, etc.)
- [ ] Container registry (Docker Hub, GHCR, etc.)
- [ ] Monitoring service (optional: Datadog, Sentry, etc.)

### Development Tools

- [ ] Bun installed (latest version, >= 1.0.0)
- [ ] Docker Desktop installed and running
- [ ] Tilt installed (for local development)
- [ ] Git configured with SSH keys
- [ ] IDE/Editor configured (VS Code recommended)
- [ ] Node.js (optional, for compatibility testing)

### Framework & Libraries

- [ ] **ElysiaJS** - Fast, type-safe web framework for Bun
  - Installation: `bun add elysia`
  - Documentation: [https://elysiajs.com/quick-start.html](https://elysiajs.com/quick-start.html)
  - Plugins:
    - `@elysiajs/bearer` - Bearer token authentication
    - `@elysiajs/cors` - CORS configuration
    - `@elysiajs/jwt` - JWT validation
    - `@elysiajs/openapi` - OpenAPI/Swagger documentation
    - `@elysiajs/opentelemetry` - OpenTelemetry observability
  - Development: `bun dev` for hot reloading
  - Patterns:
    - [OpenAPI](https://elysiajs.com/patterns/openapi.html) - API documentation
    - [OpenTelemetry](https://elysiajs.com/patterns/opentelemetry.html) - Observability
    - [Best Practices](https://elysiajs.com/essential/best-practice.html) - Code organization
- [ ] **Drizzle ORM** - Type-safe database access
- [ ] **BullMQ** - Redis-based job queue
- [ ] **neverthrow** - Functional error handling
- [ ] **Zod** - Runtime validation (integrated with ElysiaJS)
- [ ] **Mastra** - Agentic LLM framework
- [ ] **Clerk SDK** - Authentication

---

## Success Criteria

### Functional Requirements

- ✅ Users can scan URLs via API (POST /v1/scans)
- ✅ Scan results are accurate and reliable (high confidence scores)
- ✅ Credits system works correctly (atomic deduction, balance tracking)
- ✅ Audit logs are created for all scans (immutable, metadata-only)
- ✅ No content is persisted (only metadata)
- ✅ Webhook notifications work for scan completion events
- ✅ API key authentication works for programmatic access
- ✅ Rate limiting prevents abuse
- ✅ Health checks and monitoring endpoints functional
- ✅ OpenAPI documentation is automatically generated and accessible
- ✅ OpenTelemetry tracing is configured for observability

### Non-Functional Requirements

- ✅ API responds in < 200ms p95 (non-scan endpoints)
- ✅ Scan creation endpoint responds in < 500ms p95
- ✅ Worker processes jobs within SLA (< 30s p95)
- ✅ Fetcher containers start in < 2s p95
- ✅ System handles 100+ concurrent scans per worker
- ✅ Error handling is type-safe and explicit (neverthrow)
- ✅ All API endpoints have proper validation (Zod schemas)
- ✅ Database queries are optimized (indexes, connection pooling)
- ✅ Horizontal scaling works for API service

### Security Requirements

- ✅ SSRF protection prevents internal network access
- ✅ JWT validation works correctly for all protected endpoints
- ✅ API keys are securely stored and validated
- ✅ Rate limiting prevents abuse
- ✅ Container isolation prevents data leakage
- ✅ No secrets in logs or error messages
- ✅ HTTPS/TLS enforced in production

### Compliance Requirements

- ✅ Audit logs are immutable (append-only)
- ✅ No unsafe/illegal content is stored
- ✅ Privacy policy is enforced (GDPR compliance)
- ✅ Data retention policies implemented
- ✅ Right to deletion implemented
- ✅ Data portability supported

### Developer Experience Requirements

- ✅ API documentation is comprehensive (OpenAPI/Swagger)
- ✅ Local development setup works with one command
- ✅ Error messages are clear and actionable
- ✅ TypeScript types are accurate and helpful
- ✅ Testing infrastructure is in place
- ✅ CI/CD pipeline works correctly

---

## Technical Decisions & Rationale

### Why ElysiaJS?

- **Performance**: Built specifically for Bun, leveraging native performance
- **Type Safety**: Excellent TypeScript inference and compile-time type checking
- **Developer Experience**:
  - Clean, intuitive API design
  - Hot reloading with `bun dev` (auto-reloads on file changes)
  - Great error messages and IDE support
  - Native Zod integration for validation
- **Plugin Ecosystem**: Rich plugin ecosystem for common functionality:
  - `@elysiajs/bearer` - Bearer token authentication
  - `@elysiajs/cors` - CORS configuration
  - `@elysiajs/jwt` - JWT validation
  - `@elysiajs/openapi` - Automatic OpenAPI/Swagger documentation
  - `@elysiajs/opentelemetry` - Distributed tracing and observability
- **Observability**: Built-in OpenTelemetry support for production monitoring
- **API Documentation**: Automatic OpenAPI generation from route definitions
- **Compatibility**: Works seamlessly with Bun's native APIs
- **Future-Proof**: Active development, modern design patterns
- **Documentation**: Comprehensive docs:
  - [Quick Start](https://elysiajs.com/quick-start.html)
  - [OpenAPI Patterns](https://elysiajs.com/patterns/openapi.html)
  - [OpenTelemetry Patterns](https://elysiajs.com/patterns/opentelemetry.html)
  - [Best Practices](https://elysiajs.com/essential/best-practice.html)

**Quick Start:**

```bash
bun create elysia app  # Scaffold new ElysiaJS app
cd app
bun dev                # Start dev server with hot reload
# Access Swagger UI at http://localhost:3000/openapi
```

**Key Features for SafeURL:**

- **OpenAPI Integration**: Automatic API documentation generation from Zod schemas
- **OpenTelemetry**: Distributed tracing for request/response monitoring
- **Best Practices**: Feature-based folder structure, separation of concerns
- **Type Safety**: End-to-end type inference from routes to responses

### Why neverthrow?

- **Explicit Error Handling**: Errors are first-class citizens in the type system
- **Type Safety**: TypeScript exhaustively checks error handling paths
- **Composability**: Chain operations without losing error context
- **No Hidden Failures**: Exceptions don't escape unexpectedly
- **Better Testing**: Easy to test both success and error paths

### Why Zod?

- **Runtime Validation**: Type-safe validation at runtime, not just compile-time
- **Type Inference**: Generate TypeScript types from schemas
- **Cross-Service Contracts**: Shared schemas ensure consistency
- **Error Messages**: Detailed validation error messages
- **Ecosystem**: Widely adopted, excellent tooling

### Why Mastra?

- **Provider Abstraction**: Support 600+ LLM models across providers
- **Agent Framework**: Built-in agent orchestration and tool calling
- **Structured Output**: Native support for Zod schema validation
- **Streaming**: Built-in streaming support for real-time responses
- **Observability**: Built-in logging and monitoring hooks

## Notes

- This plan is iterative and should be updated as implementation progresses
- Each phase can be worked on in parallel where dependencies allow
- Focus on MVP first (core scanning functionality) before advanced features
- Security and compliance are non-negotiable requirements
- All code should follow the functional programming patterns (neverthrow, Zod)
- Type safety is paramount throughout the codebase
- **API Framework**: Use ElysiaJS for all API endpoints (not Bun's native HTTP server)
- See individual phase documents for detailed task breakdowns
- Performance testing should be done incrementally, not just at the end
- Security reviews should happen at each phase, not just before launch
