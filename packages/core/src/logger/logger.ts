import {
  LOG_LEVEL_PRIORITY,
  type LogEntry,
  type LoggerOptions,
  type LogLevel,
} from "./types";

/**
 * Supported color names for terminal output
 */
type ColorName =
  | "gray"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "reset";

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Lightweight logger with debug capabilities
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: "info", debug: true });
 * logger.debug("Debug message");
 * logger.info("Info message");
 * logger.warn("Warning message");
 * logger.error("Error message", { error: new Error("Something went wrong") });
 * ```
 */
export class Logger {
  #level: LogLevel;
  #debugEnabled: boolean;
  #colors: boolean;
  #timestamps: boolean;
  #prefix?: string;
  #context: Record<string, unknown>;
  #formatter?: (entry: LogEntry) => string;
  #output: (message: string, level: LogLevel) => void;

  constructor(options: LoggerOptions = {}) {
    this.#level = options.level ?? "info";
    this.#debugEnabled = options.debug ?? false;
    this.#colors = options.colors ?? true;
    this.#timestamps = options.timestamps ?? true;
    this.#prefix = options.prefix;
    this.#context = options.context ?? {};
    this.#formatter = options.formatter;
    this.#output = options.output ?? this.#defaultOutput.bind(this);
  }

  /**
   * Log a debug message
   * Only shown when debug mode is enabled
   */
  debug(message: string, data?: unknown): void {
    if (!this.shouldLog("debug")) return;
    this.log("debug", message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    if (!this.shouldLog("info")) return;
    this.log("info", message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    if (!this.shouldLog("warn")) return;
    this.log("warn", message, data);
  }

  /**
   * Log an error message
   * Can include an Error object in the data
   */
  error(message: string, data?: unknown): void {
    if (!this.shouldLog("error")) return;
    this.log("error", message, data);
  }

  /**
   * Create a child logger with additional context
   * Useful for scoped logging (e.g., per-request, per-module)
   *
   * @example
   * ```typescript
   * const logger = createLogger();
   * const requestLogger = logger.child({ requestId: "123" });
   * requestLogger.info("Processing request"); // Includes requestId in context
   * ```
   */
  child(context: Record<string, unknown>): Logger {
    const child = new Logger({
      level: this.#level,
      debug: this.#debugEnabled,
      colors: this.#colors,
      timestamps: this.#timestamps,
      prefix: this.#prefix,
      context: { ...this.#context, ...context },
      formatter: this.#formatter,
      output: this.#output,
    });
    return child;
  }

  /**
   * Update logger configuration
   */
  configure(options: Partial<LoggerOptions>): void {
    if (options.level !== undefined) this.#level = options.level;
    if (options.debug !== undefined) this.#debugEnabled = options.debug;
    if (options.colors !== undefined) this.#colors = options.colors;
    if (options.timestamps !== undefined) this.#timestamps = options.timestamps;
    if (options.prefix !== undefined) this.#prefix = options.prefix;
    if (options.context !== undefined) {
      this.#context = { ...this.#context, ...options.context };
    }
    if (options.formatter !== undefined) this.#formatter = options.formatter;
    if (options.output !== undefined) this.#output = options.output;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    // Debug logs require debug mode
    if (level === "debug" && !this.#debugEnabled) {
      return false;
    }

    // Check if level meets minimum threshold
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.#level];
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context:
        Object.keys(this.#context).length > 0 ? this.#context : undefined,
      data,
    };

    // Extract error from data if present
    if (data && typeof data === "object" && data !== null && "error" in data) {
      const dataWithError = data as { error: unknown };
      entry.error =
        dataWithError.error instanceof Error ? dataWithError.error : undefined;
    }

    const formatted = this.#formatter
      ? this.#formatter(entry)
      : this.formatEntry(entry);

    this.#output(formatted, level);
  }

  /**
   * Format a log entry into a string
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.#timestamps) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(this.#colorize(`[${timestamp}]`, "gray"));
    }

    // Prefix
    if (this.#prefix) {
      parts.push(this.#colorize(`[${this.#prefix}]`, "cyan"));
    }

    // Level
    const levelStr = entry.level.toUpperCase().padEnd(5);
    parts.push(this.#colorizeLevel(levelStr, entry.level));

    // Message
    parts.push(entry.message);

    // Context
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = JSON.stringify(entry.context);
      parts.push(this.#colorize(contextStr, "gray"));
    }

    // Data
    if (entry.data) {
      const dataStr = this.formatData(entry.data);
      if (dataStr) {
        parts.push(this.#colorize(dataStr, "gray"));
      }
    }

    // Error stack
    if (entry.error) {
      parts.push(
        "\n" + this.#colorize(entry.error.stack || entry.error.message, "red"),
      );
    }

    return parts.join(" ");
  }

  /**
   * Format data for output
   */
  private formatData(data: unknown): string {
    if (data === null || data === undefined) {
      return "";
    }

    // If data is an object with an error property, exclude it (already handled)
    if (typeof data === "object" && data !== null && "error" in data) {
      const dataRecord = data as Record<string, unknown>;
      const { error, ...rest } = dataRecord;
      if (Object.keys(rest).length === 0) {
        return "";
      }
      return JSON.stringify(rest);
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  /**
   * Colorize text (if colors enabled)
   */
  #colorize(text: string, color: ColorName): string {
    if (!this.#colors) return text;

    const colors: Record<ColorName, string> = {
      gray: "\x1b[90m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      reset: "\x1b[0m",
    };

    return `${colors[color]}${text}${colors.reset}`;
  }

  /**
   * Colorize log level
   */
  #colorizeLevel(text: string, level: LogLevel): string {
    if (!this.#colors) return text;

    const levelColors: Record<LogLevel, ColorName> = {
      debug: "gray",
      info: "blue",
      warn: "yellow",
      error: "red",
    };

    return this.#colorize(text, levelColors[level]);
  }

  /**
   * Default output handler (console)
   */
  #defaultOutput(message: string, level: LogLevel): void {
    switch (level) {
      case "debug":
        console.debug(message);
        break;
      case "info":
        console.info(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "error":
        console.error(message);
        break;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new logger instance
 *
 * @param options - Logger configuration options
 * @returns New Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ level: "info", debug: true });
 * logger.debug("This is a debug message");
 * logger.info("This is an info message");
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

/**
 * Create a logger with debug mode enabled
 * Convenience function for development
 *
 * @param options - Logger configuration options (debug will be overridden to true)
 * @returns New Logger instance with debug enabled
 *
 * @example
 * ```typescript
 * const logger = createDebugLogger();
 * logger.debug("Debug message"); // Will be shown
 * ```
 */
export function createDebugLogger(
  options?: Omit<LoggerOptions, "debug">,
): Logger {
  return new Logger({
    ...options,
    debug: true,
    level: options?.level ?? "debug",
  });
}

/**
 * Create a silent logger (no output)
 * Useful for testing or when logging should be disabled
 *
 * @returns Logger instance that doesn't output anything
 */
export function createSilentLogger(): Logger {
  return new Logger({
    level: "error",
    debug: false,
    output: () => {
      // No-op
    },
  });
}

// ============================================================================
// Global Logger Instance (Optional)
// ============================================================================

/**
 * Default logger instance
 * Can be used as a singleton across the application
 */
let defaultLogger: Logger | null = null;

/**
 * Get or create the default logger instance
 *
 * @param options - Logger configuration (only used on first call)
 * @returns Default logger instance
 *
 * @example
 * ```typescript
 * const logger = getDefaultLogger({ level: "info" });
 * logger.info("Using default logger");
 * ```
 */
export function getDefaultLogger(options?: LoggerOptions): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger(options);
  }
  return defaultLogger;
}

/**
 * Set the default logger instance
 *
 * @param logger - Logger instance to use as default
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * Reset the default logger (useful for testing)
 */
export function resetDefaultLogger(): void {
  defaultLogger = null;
}
