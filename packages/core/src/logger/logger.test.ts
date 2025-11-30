import { test, expect, beforeEach, afterEach } from "bun:test";
import {
  createLogger,
  createDebugLogger,
  createSilentLogger,
  getDefaultLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from "./logger";
import type { LogLevel } from "./types";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Capture console output for testing
 */
class OutputCapture {
  private messages: Array<{ message: string; level: LogLevel }> = [];
  private originalMethods: {
    debug: typeof console.debug;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  constructor() {
    this.originalMethods = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  start() {
    this.messages = [];
    console.debug = (...args: unknown[]) => {
      this.messages.push({ message: args.join(" "), level: "debug" });
    };
    console.info = (...args: unknown[]) => {
      this.messages.push({ message: args.join(" "), level: "info" });
    };
    console.warn = (...args: unknown[]) => {
      this.messages.push({ message: args.join(" "), level: "warn" });
    };
    console.error = (...args: unknown[]) => {
      this.messages.push({ message: args.join(" "), level: "error" });
    };
  }

  stop() {
    console.debug = this.originalMethods.debug;
    console.info = this.originalMethods.info;
    console.warn = this.originalMethods.warn;
    console.error = this.originalMethods.error;
  }

  getMessages(): Array<{ message: string; level: LogLevel }> {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
  }
}

// ============================================================================
// Basic Logging Tests
// ============================================================================

test("should log debug messages when debug mode is enabled", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "debug", debug: true });
  logger.debug("Debug message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].level).toBe("debug");
  expect(messages[0].message).toContain("Debug message");
});

test("should not log debug messages when debug mode is disabled", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "debug", debug: false });
  logger.debug("Debug message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(0);
});

test("should log info messages", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  logger.info("Info message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].level).toBe("info");
  expect(messages[0].message).toContain("Info message");
});

test("should log warn messages", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "warn" });
  logger.warn("Warning message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].level).toBe("warn");
  expect(messages[0].message).toContain("Warning message");
});

test("should log error messages", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "error" });
  logger.error("Error message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].level).toBe("error");
  expect(messages[0].message).toContain("Error message");
});

test("should log error with Error object", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "error" });
  const error = new Error("Test error");
  logger.error("Error occurred", { error });

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("Error occurred");
  expect(messages[0].message).toContain("Test error");
});

// ============================================================================
// Log Level Filtering Tests
// ============================================================================

test("should filter logs below minimum level", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "warn", debug: true });
  logger.debug("Debug message");
  logger.info("Info message");
  logger.warn("Warning message");
  logger.error("Error message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(2);
  expect(messages[0].level).toBe("warn");
  expect(messages[1].level).toBe("error");
});

test("should show all logs when level is debug and debug mode is enabled", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "debug", debug: true });
  logger.debug("Debug message");
  logger.info("Info message");
  logger.warn("Warning message");
  logger.error("Error message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(4);
});

test("should respect info level", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", debug: false });
  logger.debug("Debug message");
  logger.info("Info message");
  logger.warn("Warning message");
  logger.error("Error message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(3);
  expect(messages[0].level).toBe("info");
  expect(messages[1].level).toBe("warn");
  expect(messages[2].level).toBe("error");
});

// ============================================================================
// Context and Scoped Logging Tests
// ============================================================================

test("should include context in log messages", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({
    level: "info",
    context: { service: "api", version: "1.0.0" },
  });
  logger.info("Starting server");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("service");
  expect(messages[0].message).toContain("api");
  expect(messages[0].message).toContain("version");
  expect(messages[0].message).toContain("1.0.0");
});

test("should create child logger with additional context", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({
    level: "info",
    context: { service: "api" },
  });
  const requestLogger = logger.child({ requestId: "123" });
  requestLogger.info("Processing request");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("service");
  expect(messages[0].message).toContain("api");
  expect(messages[0].message).toContain("requestId");
  expect(messages[0].message).toContain("123");
});

test("should merge context when creating child logger", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({
    level: "info",
    context: { service: "api", version: "1.0.0" },
  });
  const childLogger = logger.child({ requestId: "123", version: "2.0.0" });
  childLogger.info("Request");

  capture.stop();
  const messages = capture.getMessages();
  const message = messages[0].message;
  expect(message).toContain("service");
  expect(message).toContain("api");
  expect(message).toContain("requestId");
  expect(message).toContain("123");
  // Child context should override parent context
  expect(message).toContain("2.0.0");
});

// ============================================================================
// Configuration Tests
// ============================================================================

test("should update configuration", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "error" });
  logger.info("This should not appear");
  logger.configure({ level: "info" });
  logger.info("This should appear");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("This should appear");
});

test("should update debug mode", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "debug", debug: false });
  logger.debug("Should not appear");
  logger.configure({ debug: true });
  logger.debug("Should appear");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("Should appear");
});

test("should update context", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", context: { a: "1" } });
  logger.info("Message 1");
  logger.configure({ context: { b: "2" } });
  logger.info("Message 2");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("a");
  expect(messages[0].message).toContain("1");
  expect(messages[1].message).toContain("b");
  expect(messages[1].message).toContain("2");
  // Context should be merged
  expect(messages[1].message).toContain("a");
});

// ============================================================================
// Timestamps and Prefix Tests
// ============================================================================

test("should include timestamps when enabled", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", timestamps: true });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  // Should contain ISO timestamp format
  expect(messages[0].message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test("should not include timestamps when disabled", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", timestamps: false });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  // Should not contain ISO timestamp format
  expect(messages[0].message).not.toMatch(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
  );
});

test("should include prefix when provided", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", prefix: "MyApp" });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("[MyApp]");
});

// ============================================================================
// Custom Formatter Tests
// ============================================================================

test("should use custom formatter", () => {
  const capture = new OutputCapture();
  capture.start();

  const customFormatter = (entry: { level: LogLevel; message: string }) => {
    return `[${entry.level.toUpperCase()}] ${entry.message}`;
  };

  const logger = createLogger({
    level: "info",
    formatter: customFormatter,
    timestamps: false,
    colors: false,
  });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toBe("[INFO] Test message");
});

// ============================================================================
// Custom Output Handler Tests
// ============================================================================

test("should use custom output handler", () => {
  const customOutput: Array<{ message: string; level: LogLevel }> = [];

  const logger = createLogger({
    level: "info",
    output: (message, level) => {
      customOutput.push({ message, level });
    },
  });

  logger.info("Test message");
  logger.warn("Warning message");

  expect(customOutput.length).toBe(2);
  expect(customOutput[0].level).toBe("info");
  expect(customOutput[0].message).toContain("Test message");
  expect(customOutput[1].level).toBe("warn");
  expect(customOutput[1].message).toContain("Warning message");
});

// ============================================================================
// Data Logging Tests
// ============================================================================

test("should include data in log messages", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  logger.info("Processing", { userId: "123", action: "create" });

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("userId");
  expect(messages[0].message).toContain("123");
  expect(messages[0].message).toContain("action");
  expect(messages[0].message).toContain("create");
});

test("should handle complex data objects", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  logger.info("Complex data", {
    nested: { value: "test" },
    array: [1, 2, 3],
    number: 42,
  });

  capture.stop();
  const messages = capture.getMessages();
  expect(messages[0].message).toContain("nested");
  expect(messages[0].message).toContain("array");
});

// ============================================================================
// Factory Function Tests
// ============================================================================

test("createDebugLogger should enable debug mode", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createDebugLogger({ level: "debug" });
  logger.debug("Debug message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].level).toBe("debug");
});

test("createSilentLogger should not output anything", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createSilentLogger();
  logger.debug("Debug");
  logger.info("Info");
  logger.warn("Warn");
  logger.error("Error");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(0);
});

// ============================================================================
// Default Logger Tests
// ============================================================================

beforeEach(() => {
  resetDefaultLogger();
});

afterEach(() => {
  resetDefaultLogger();
});

test("getDefaultLogger should create singleton instance", () => {
  const logger1 = getDefaultLogger({ level: "info" });
  const logger2 = getDefaultLogger({ level: "debug" });

  expect(logger1).toBe(logger2);
});

test("setDefaultLogger should replace default logger", () => {
  const customLogger = createLogger({ level: "warn" });
  setDefaultLogger(customLogger);

  const defaultLogger = getDefaultLogger();
  expect(defaultLogger).toBe(customLogger);
});

test("resetDefaultLogger should clear default logger", () => {
  const logger1 = getDefaultLogger({ level: "info" });
  resetDefaultLogger();
  const logger2 = getDefaultLogger({ level: "debug" });

  expect(logger1).not.toBe(logger2);
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

test("should handle null data", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  logger.info("Message", null);

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("Message");
});

test("should handle undefined data", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  logger.info("Message", undefined);

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("Message");
});

test("should handle circular references in data", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info" });
  const circular: Record<string, unknown> = { a: "test" };
  circular.self = circular;

  logger.info("Circular data", circular);

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  // Should not throw, but may show "[object Object]" or similar when stringified
  expect(messages[0].message).toContain("Circular data");
});

test("should handle empty context", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", context: {} });
  logger.info("Message");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  // Empty context should not appear in output
  expect(messages[0].message).not.toContain("{}");
});

test("should handle error without stack trace", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "error" });
  // Create a real Error object but without stack trace
  const error = new Error("Custom error");
  error.stack = undefined;
  logger.error("Error occurred", { error });

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  expect(messages[0].message).toContain("Error occurred");
  expect(messages[0].message).toContain("Custom error");
});

// ============================================================================
// Color Tests (Basic - colors are hard to test without visual inspection)
// ============================================================================

test("should disable colors when colors option is false", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", colors: false });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  // Without colors, there should be no ANSI escape codes
  expect(messages[0].message).not.toContain("\x1b[");
});

test("should enable colors when colors option is true", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({ level: "info", colors: true });
  logger.info("Test message");

  capture.stop();
  const messages = capture.getMessages();
  // With colors, there should be ANSI escape codes
  expect(messages[0].message).toContain("\x1b[");
});

// ============================================================================
// Integration Tests
// ============================================================================

test("should work with all features combined", () => {
  const capture = new OutputCapture();
  capture.start();

  const logger = createLogger({
    level: "info",
    debug: true,
    colors: true,
    timestamps: true,
    prefix: "TestApp",
    context: { env: "test", version: "1.0.0" },
  });

  const childLogger = logger.child({ requestId: "req-123" });
  childLogger.info("Processing request", { userId: "user-456" });

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(1);
  const message = messages[0].message;

  // Check all features are present
  expect(message).toContain("[TestApp]");
  expect(message).toContain("env");
  expect(message).toContain("test");
  expect(message).toContain("requestId");
  expect(message).toContain("req-123");
  expect(message).toContain("userId");
  expect(message).toContain("user-456");
  expect(message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Timestamp
  expect(message).toContain("\x1b["); // Colors
});

test("should maintain separate state for child loggers", () => {
  const capture = new OutputCapture();
  capture.start();

  const parentLogger = createLogger({
    level: "info",
    context: { service: "api" },
  });

  const child1 = parentLogger.child({ requestId: "1" });
  const child2 = parentLogger.child({ requestId: "2" });

  child1.info("Request 1");
  child2.info("Request 2");

  capture.stop();
  const messages = capture.getMessages();
  expect(messages.length).toBe(2);
  expect(messages[0].message).toContain("1");
  expect(messages[1].message).toContain("2");
  // Both should have service context
  expect(messages[0].message).toContain("service");
  expect(messages[1].message).toContain("service");
});
