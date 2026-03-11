# ts-utils

A zero-dependency TypeScript utility library for building robust SDKs and client-side applications.

![CI](https://github.com/monti-nicolas/ts-utils/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Why this exists

When building a web SDK that runs on millions of devices, every dependency is a liability — a larger bundle, a potential breaking change, a security surface. This library provides the foundational primitives needed for production-grade SDKs, written in strict TypeScript with zero runtime dependencies.

It includes:

- **TypedEventEmitter** — a compile-time type-safe event system
- **retry** — exponential backoff with jitter, configurable per call-site
- **InMemoryCache** — TTL-aware cache with LRU eviction
- **Logger** — structured, levelled logger with pluggable transport
- **RateLimiter** — token bucket algorithm with burst support

---

## Installation

```bash
npm install @your-username/ts-utils
```

---

## Usage

### TypedEventEmitter

A type-safe event emitter where the event map is defined upfront. TypeScript enforces correct event names and payload types at compile time.

```typescript
import { TypedEventEmitter } from '@your-username/ts-utils'

type SDKEvents = {
  'session:start': { sessionId: string; timestamp: number }
  'session:end':   { sessionId: string; durationMs: number }
  'error':         Error
}

const emitter = new TypedEventEmitter<SDKEvents>()

// Returns an unsubscribe function — no need to hold a reference to the listener
const unsub = emitter.on('session:start', ({ sessionId }) => {
  console.log(`Session started: ${sessionId}`)
})

emitter.emit('session:start', { sessionId: 'abc', timestamp: Date.now() })

// Clean up when done
unsub()
```

---

### retry

Executes an async function and retries on failure with configurable exponential backoff and jitter. Returns a `Result<T>` — the caller must handle both success and failure at the type level.

```typescript
import { retry } from '@your-username/ts-utils'

const result = await retry(
  () => fetch('https://api.example.com/data').then(r => r.json()),
  {
    maxAttempts: 4,
    baseDelayMs: 300,
    backoffFactor: 2,       // 300ms → 600ms → 1200ms
    jitter: true,           // Randomises delays to avoid thundering herd
    shouldRetry: (error) => !(error instanceof AuthError), // Don't retry auth failures
    onRetry: (attempt, error, delayMs) => {
      logger.warn('Retrying request', { attempt, delayMs })
    },
  }
)

if (result.ok) {
  process(result.value)
} else {
  reportError(result.error)
}
```

---

### InMemoryCache

A TTL-aware cache with optional LRU-style max size eviction. Expiry is lazy — entries are checked on read, with no background timers.

```typescript
import { InMemoryCache } from '@your-username/ts-utils'

const cache = new InMemoryCache<string, UserProfile>({
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  maxSize: 500,                  // Evict oldest when full
})

cache.set('user:42', profile)

const cached = cache.get('user:42') // UserProfile | undefined
if (cached) {
  return cached
}

// Override TTL per entry
cache.set('session:token', token, 60_000) // 1 minute regardless of default
```

---

### Logger

A structured logger designed for SDK use. Silent by default — only logs when explicitly configured. Supports child loggers and pluggable transports.

```typescript
import { Logger } from '@your-username/ts-utils'

const logger = new Logger({
  level: 'info',   // 'debug' | 'info' | 'warn' | 'error' | 'silent'
  prefix: 'my-sdk',
})

logger.info('SDK initialised', { version: '1.0.0', env: 'production' })
// => [2024-01-01T00:00:00.000Z] [my-sdk] INFO SDK initialised {"version":"1.0.0","env":"production"}

// Subsystem loggers inherit level and transport
const networkLogger = logger.child('network')
networkLogger.warn('Slow response', { durationMs: 3200, url: '/api/collect' })
// => [2024-01-01T00:00:00.000Z] [my-sdk:network] WARN Slow response {"durationMs":3200}

// In tests, inject a custom transport to capture logs without console noise
const captured: LogEntry[] = []
const testLogger = new Logger({ level: 'debug', transport: (e) => captured.push(e) })
```

---

### RateLimiter

Token bucket rate limiter with burst support. Non-blocking by default — returns a result immediately rather than queueing. Useful for throttling SDK telemetry or outbound requests.

```typescript
import { RateLimiter } from '@your-username/ts-utils'

// Allow bursts of up to 10 requests, refilling at 2 per second
const limiter = new RateLimiter({ capacity: 10, refillRatePerSec: 2 })

function sendTelemetry(payload: unknown) {
  const { allowed, remaining, retryAfterMs } = limiter.tryConsume()

  if (!allowed) {
    console.warn(`Rate limited. Retry in ${retryAfterMs}ms. Dropping telemetry.`)
    return
  }

  // proceed with sending
}
```

---

## Result type

All fallible operations return a `Result<T, E>` discriminated union instead of throwing. This keeps error handling explicit and visible in the type system.

```typescript
import { ok, err, Result } from '@your-username/ts-utils'

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return err(new Error('Division by zero'))
  return ok(a / b)
}

const result = divide(10, 0)

if (result.ok) {
  console.log(result.value) // TypeScript knows this is number
} else {
  console.error(result.error.message) // TypeScript knows this is Error
}
```

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint

# Build
npm run build

# Check bundle size
npm run size
```

---

## Design principles

**Zero dependencies** — No transitive risk. The entire library is your code, nothing else.

**Strict TypeScript** — All strictness flags enabled, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. If it compiles, it's correct.

**Library-first** — No side effects on import. No global state. Everything is instantiated explicitly.

**Testable by design** — Pluggable transports, injectable clocks, exported pure functions like `calculateDelay`. Nothing is untestable.

**Result over exceptions** — Functions that can fail return `Result<T>`. No hidden throws in library code.

---

## License

MIT
