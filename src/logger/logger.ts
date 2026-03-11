/**
 * Logger
 *
 * A structured, levelled logger designed for use in SDKs and libraries.
 *
 * Key design goals:
 * 1. Silent by default — libraries should never log unless the consumer opts in.
 *    An SDK that logs to the console uninvited is annoying and can leak data.
 * 2. Structured output — logs include a timestamp, level, and optional context.
 *    This makes logs machine-parseable (e.g. by Datadog, CloudWatch).
 * 3. Pluggable transport — the default writes to console, but callers can
 *    inject any transport (e.g. send logs to a remote endpoint).
 * 4. Child loggers — a child logger inherits parent config but adds its own
 *    context. This is useful for tracing logs through a request lifecycle.
 *
 * Usage:
 *   const logger = new Logger({ level: 'debug', prefix: 'sdk' })
 *   logger.info('Initialised', { version: '1.0.0' })
 *   // => [2024-01-01T00:00:00.000Z] [sdk] INFO Initialised {"version":"1.0.0"}
 *
 *   const childLogger = logger.child('network')
 *   childLogger.warn('Slow response', { durationMs: 3200 })
 *   // => [2024-01-01T00:00:00.000Z] [sdk:network] WARN Slow response {"durationMs":3200}
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/** Numeric priority — higher = more severe. Used for level filtering. */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4, // silent means nothing passes through
}

/** A structured log entry — what gets passed to the transport function. */
export interface LogEntry {
  timestamp: string
  level: Exclude<LogLevel, 'silent'>
  prefix: string
  message: string
  context?: Record<string, unknown>
}

/** A transport is any function that receives and handles a log entry. */
export type LogTransport = (entry: LogEntry) => void

export interface LoggerConfig {
  /**
   * Minimum level to emit. Messages below this level are dropped.
   * Default: 'silent' — libraries should not log unless explicitly configured.
   */
  level?: LogLevel

  /** String prefix to identify the source of logs (e.g. 'my-sdk'). */
  prefix?: string

  /**
   * Custom transport function. Defaults to a console-based transport.
   * Swap this in tests to capture logs without polluting test output.
   */
  transport?: LogTransport
}

/** Default transport: formats the log entry and writes to console. */
const consoleTransport: LogTransport = (entry) => {
  const context = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  const line = `[${entry.timestamp}] [${entry.prefix}] ${entry.level.toUpperCase()} ${entry.message}${context}`

  switch (entry.level) {
    case 'debug': console.debug(line); break
    case 'info':  console.info(line);  break
    case 'warn':  console.warn(line);  break
    case 'error': console.error(line); break
  }
}

export class Logger {
  private readonly level: LogLevel
  private readonly prefix: string
  private readonly transport: LogTransport

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? 'silent'
    this.prefix = config.prefix ?? 'app'
    this.transport = config.transport ?? consoleTransport
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  /**
   * Create a child logger that inherits level and transport, but appends
   * to the prefix. Ideal for tagging logs by subsystem (network, cache, etc.)
   */
  child(childPrefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: `${this.prefix}:${childPrefix}`,
      transport: this.transport,
    })
  }

  private log(
    level: Exclude<LogLevel, 'silent'>,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      prefix: this.prefix,
      message,
      ...(context !== undefined && { context }),
    }

    this.transport(entry)
  }
}
