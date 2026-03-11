/**
 * RateLimiter — Token Bucket Algorithm
 *
 * Rate limiting is fundamental to bot detection and SDK design:
 * - SDKs must limit how frequently they send telemetry to avoid overwhelming servers
 * - Bot detection systems look for unusual request rates as a signal
 * - APIs must protect themselves from abusive clients
 *
 * Why token bucket?
 * Token bucket allows controlled bursting. A sliding window (alternative) is
 * stricter but penalises bursty-but-legitimate traffic. Token bucket says:
 * "you can burst up to N requests immediately, but sustained rate is capped."
 *
 * How it works:
 * - A bucket holds tokens (up to `capacity`)
 * - Tokens refill at a steady `refillRate` per second
 * - Each `consume()` call removes one token
 * - If no token is available, the call is rejected (or optionally waited for)
 *
 * Usage:
 *   // Allow up to 10 requests, refilling 2 tokens per second
 *   const limiter = new RateLimiter({ capacity: 10, refillRatePerSec: 2 })
 *
 *   if (limiter.tryConsume()) {
 *     sendTelemetry()
 *   } else {
 *     // Drop or queue the request
 *   }
 */

export interface RateLimiterConfig {
  /** Maximum number of tokens the bucket can hold (burst capacity). */
  capacity: number

  /** Tokens added per second. Determines steady-state throughput. */
  refillRatePerSec: number

  /**
   * Tokens to start with. Defaults to `capacity` (full bucket).
   * Set to 0 to start "cold" — useful for testing rate-limit behaviour.
   */
  initialTokens?: number
}

export interface ConsumeResult {
  /** Whether the token was successfully consumed. */
  allowed: boolean

  /** Remaining tokens after this call. */
  remaining: number

  /**
   * If not allowed, estimated milliseconds until a token is available.
   * Useful for setting a Retry-After style delay.
   */
  retryAfterMs: number | null
}

export class RateLimiter {
  private tokens: number
  private lastRefillTime: number
  private readonly capacity: number
  private readonly refillRatePerSec: number

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity
    this.refillRatePerSec = config.refillRatePerSec
    this.tokens = config.initialTokens ?? config.capacity
    this.lastRefillTime = Date.now()
  }

  /**
   * Attempt to consume one token.
   * Returns a ConsumeResult describing whether the request was allowed.
   *
   * This is non-blocking — it never waits. For a waiting version, use `consume()`.
   */
  tryConsume(tokens = 1): ConsumeResult {
    this.refill()

    if (this.tokens >= tokens) {
      this.tokens -= tokens
      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        retryAfterMs: null,
      }
    }

    // Calculate how long until enough tokens are available
    const needed = tokens - this.tokens
    const retryAfterMs = Math.ceil((needed / this.refillRatePerSec) * 1000)

    return {
      allowed: false,
      remaining: Math.floor(this.tokens),
      retryAfterMs,
    }
  }

  /**
   * Consume a token, waiting if necessary until one becomes available.
   * Resolves with the time waited in milliseconds.
   *
   * Use sparingly — in hot paths, prefer `tryConsume()` and drop/queue yourself.
   */
  async consume(tokens = 1): Promise<number> {
    const result = this.tryConsume(tokens)
    if (result.allowed) return 0

    const waitMs = result.retryAfterMs!
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
    return waitMs
  }

  /** Current token count (fractional — tokens accumulate continuously). */
  get availableTokens(): number {
    this.refill()
    return this.tokens
  }

  /** Reset the bucket to its initial full state. */
  reset(): void {
    this.tokens = this.capacity
    this.lastRefillTime = Date.now()
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   * Called lazily on every `tryConsume` — no background timer needed.
   */
  private refill(): void {
    const now = Date.now()
    const elapsedSec = (now - this.lastRefillTime) / 1000

    if (elapsedSec <= 0) return

    const newTokens = elapsedSec * this.refillRatePerSec
    this.tokens = Math.min(this.capacity, this.tokens + newTokens)
    this.lastRefillTime = now
  }
}
