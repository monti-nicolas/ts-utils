/**
 * ts-utils — public API surface
 *
 * This barrel file defines what consumers of the library can import.
 * Only export what is intentionally public. Internal helpers stay private.
 *
 * Tree-shaking note:
 * Because we export named exports (not a default object), bundlers like
 * esbuild and rollup can tree-shake unused modules. A consumer that only
 * imports Logger will not bundle the RateLimiter code.
 */

// Types
export type { Result, Awaited, DeepReadonly, RequireKeys, Unsubscribe } from './types/shared'
export { ok, err } from './types/shared'

// Event
export { TypedEventEmitter } from './event/typed-event-emitter'

// Retry
export { retry, calculateDelay } from './retry/retry'
export type { RetryConfig } from './retry/retry'

// Cache
export { InMemoryCache } from './cache/in-memory-cache'
export type { CacheConfig } from './cache/in-memory-cache'

// Logger
export { Logger } from './logger/logger'
export type { LogLevel, LogEntry, LogTransport, LoggerConfig } from './logger/logger'

// Rate Limiter
export { RateLimiter } from './rate-limiter/rate-limiter'
export type { RateLimiterConfig, ConsumeResult } from './rate-limiter/rate-limiter'
