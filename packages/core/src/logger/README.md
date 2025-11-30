# Logger/Debugger Library

A lightweight, zero-dependency logger and debugger library for TypeScript/JavaScript applications.

## Features

- 🎯 **Lightweight** - No external dependencies
- 🎨 **Colored output** - Beautiful terminal colors (optional)
- 🔍 **Debug mode** - Toggle debug logs on/off
- 📊 **Structured logging** - Support for context and metadata
- 🏷️ **Scoped logging** - Create child loggers with additional context
- ⚙️ **Configurable** - Customizable log levels, formatters, and output handlers
- 🚀 **Type-safe** - Full TypeScript support

## Quick Start

```typescript
import { createLogger } from "@safeurl/core/logger";

// Create a logger
const logger = createLogger({ level: "info", debug: true });

// Use it
logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message", { error: new Error("Something went wrong") });
```

## Basic Usage

### Creating a Logger

```typescript
import {
  createLogger,
  createDebugLogger,
  createSilentLogger,
} from "@safeurl/core/logger";

// Standard logger
const logger = createLogger({ level: "info" });

// Debug logger (debug mode enabled by default)
const debugLogger = createDebugLogger();

// Silent logger (no output)
const silentLogger = createSilentLogger();
```

### Log Levels

Log levels in order of severity: `debug` < `info` < `warn` < `error`

```typescript
const logger = createLogger({ level: "warn" });

logger.debug("Hidden"); // Won't show (below warn)
logger.info("Hidden"); // Won't show (below warn)
logger.warn("Shown"); // Will show
logger.error("Shown"); // Will show
```

### Debug Mode

Debug logs are only shown when debug mode is enabled:

```typescript
const logger = createLogger({ debug: true, level: "debug" });
logger.debug("This will be shown");

const logger2 = createLogger({ debug: false });
logger2.debug("This will be hidden");
```

### Context and Scoped Logging

Add context to all logs or create scoped loggers:

```typescript
// Add context to all logs
const logger = createLogger({
  context: { service: "api", version: "1.0.0" },
});

logger.info("Starting server");
// Output: [timestamp] INFO  Starting server {"service":"api","version":"1.0.0"}

// Create a child logger with additional context
const requestLogger = logger.child({ requestId: "123" });
requestLogger.info("Processing request");
// Output: [timestamp] INFO  Processing request {"service":"api","version":"1.0.0","requestId":"123"}
```

### Error Logging

Log errors with full stack traces:

```typescript
try {
  throw new Error("Something went wrong");
} catch (error) {
  logger.error("Failed to process request", { error });
  // Will show the error message and stack trace
}
```

### Custom Configuration

```typescript
const logger = createLogger({
  level: "info",
  debug: false,
  colors: true, // Enable colored output
  timestamps: true, // Show timestamps
  prefix: "MyApp", // Custom prefix
  context: { env: "prod" },

  // Custom formatter
  formatter: (entry) => {
    return `${entry.timestamp.toISOString()} [${entry.level}] ${entry.message}`;
  },

  // Custom output handler
  output: (message, level) => {
    // Send to external logging service, file, etc.
    sendToLogService(message, level);
  },
});
```

### Global Logger

Use a singleton logger instance:

```typescript
import { getDefaultLogger, setDefaultLogger } from "@safeurl/core/logger";

// Get or create default logger
const logger = getDefaultLogger({ level: "info" });
logger.info("Using default logger");

// Replace with custom logger
setDefaultLogger(createDebugLogger());
```

## API Reference

### `createLogger(options?: LoggerOptions): Logger`

Creates a new logger instance.

**Options:**

- `level?: LogLevel` - Minimum log level (default: `"info"`)
- `debug?: boolean` - Enable debug mode (default: `false`)
- `colors?: boolean` - Enable colored output (default: `true`)
- `timestamps?: boolean` - Show timestamps (default: `true`)
- `prefix?: string` - Custom prefix for all logs
- `context?: Record<string, unknown>` - Additional context
- `formatter?: (entry: LogEntry) => string` - Custom formatter
- `output?: (message: string, level: LogLevel) => void` - Custom output handler

### `Logger` Methods

- `debug(message: string, data?: unknown): void` - Log debug message
- `info(message: string, data?: unknown): void` - Log info message
- `warn(message: string, data?: unknown): void` - Log warning message
- `error(message: string, data?: unknown): void` - Log error message
- `child(context: Record<string, unknown>): Logger` - Create child logger
- `configure(options: Partial<LoggerOptions>): void` - Update configuration

## Examples

### Per-Request Logging

```typescript
// In your request handler
function handleRequest(req: Request) {
  const logger = getDefaultLogger().child({
    requestId: req.id,
    method: req.method,
    path: req.path,
  });

  logger.info("Request received");
  // ... process request
  logger.info("Request completed");
}
```

### Module-Scoped Logging

```typescript
// In a module
const logger = createLogger({
  prefix: "Database",
  context: { module: "db" },
});

export function connect() {
  logger.info("Connecting to database");
  // ...
}
```

### Production vs Development

```typescript
const isDev = process.env.NODE_ENV === "development";
const logger = createLogger({
  level: isDev ? "debug" : "info",
  debug: isDev,
  colors: isDev, // Disable colors in production if needed
});
```
