// ============================================================================
// Logger Types
// ============================================================================

/**
 * Log levels in order of severity
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Minimum log level to output
   * Logs below this level will be ignored
   * @default "info"
   */
  level?: LogLevel;

  /**
   * Enable debug mode (shows debug logs)
   * @default false
   */
  debug?: boolean;

  /**
   * Enable colored output (for terminals that support it)
   * @default true
   */
  colors?: boolean;

  /**
   * Enable timestamps in log output
   * @default true
   */
  timestamps?: boolean;

  /**
   * Custom prefix for all log messages
   * @default undefined
   */
  prefix?: string;

  /**
   * Additional context/tags to include with all logs
   * @default {}
   */
  context?: Record<string, unknown>;

  /**
   * Custom formatter function
   * If provided, this will be used instead of the default formatter
   */
  formatter?: (entry: LogEntry) => string;

  /**
   * Custom output handler
   * If provided, logs will be sent here instead of console
   */
  output?: (message: string, level: LogLevel) => void;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
  data?: unknown;
}

/**
 * Log level priority (higher = more important)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
