import type { Result } from '../types/shared'
import { ok, err } from '../types/shared'

/**
 * Configuration for retry behaviour.
 *
 * Why so many options?
 * Real-world retry needs vary. An SDK sending telemetry has different
 * requirements to a UI component fetching data. Making this config-driven
 * means callers tune the behaviour without forking the code.
 */
export interface RetryConfig {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxAttempts?: number

  /**
   * Base delay in milliseconds before the first retry. Default: 200ms
   * Subsequent retries multiply this by the backoff factor.
   */
  baseDelayMs?: number

  /**
   * Multiplier applied to the delay after each failure. Default: 2
   * With baseDelayMs=200 and factor=2: 200ms → 400ms → 800ms → ...
   * This is "exponential backoff" — backing off exponentially reduces
   * thundering herd problems when many clients retry simultaneously.
   */
  backoffFactor?: number

  /**
   * Maximum delay cap in milliseconds. Default: 30_000 (30 seconds)
   * Without this, exponential growth would eventually produce absurd delays.
   */
  maxDelayMs?: number

  /**
   * Add random jitter to delays. Default: true
   * Jitter prevents all retrying clients from hitting a server at exactly
   * the same moment after a shared failure. Highly recommended in SDKs.
   */
  jitter?: boolean

  /**
   * Optional predicate to decide whether a given error is retryable.
   * If not provided, all errors are retried.
   *
   * Example: only retry on network errors, not on 4xx HTTP errors
   *   shouldRetry: (e) => e instanceof NetworkError
   */
  shouldRetry?: (error: unknown) => boolean

  /**
   * Called after each failed attempt. Useful for logging or telemetry.
   */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

const DEFAULT_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 200,
  backoffFactor: 2,
  maxDelayMs: 30_000,
  jitter: true,
} satisfies Required<Omit<RetryConfig, 'shouldRetry' | 'onRetry'>>
// `satisfies` (TS 4.9+) checks the object matches the type without widening it.
// This means DEFAULT_CONFIG retains its literal types for inference.

/**
 * Calculate the delay before the next retry attempt.
 * Exported for testability — you can unit test the delay logic in isolation.
 */
export function calculateDelay(
  attempt: number, // 0-indexed: 0 = first retry
  baseDelayMs: number,
  backoffFactor: number,
  maxDelayMs: number,
  jitter: boolean
): number {
  // Exponential: base * factor^attempt
  const exponential = baseDelayMs * Math.pow(backoffFactor, attempt)
  const capped = Math.min(exponential, maxDelayMs)

  // Full jitter: random value between 0 and the capped delay.
  // "Full jitter" is generally preferred over "equal jitter" for distributed systems.
  // See: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
  return jitter ? Math.random() * capped : capped
}

/**
 * Executes an async function and retries on failure with exponential backoff.
 *
 * Returns a Result<T> — the caller must handle both success and failure cases.
 * This avoids silent exception swallowing, which is a common SDK footgun.
 *
 * Usage:
 *   const result = await retry(() => fetch('/api/data'), { maxAttempts: 5 })
 *   if (result.ok) {
 *     process(result.value)
 *   } else {
 *     reportError(result.error)
 *   }
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<Result<T>> {
  const {
    maxAttempts,
    baseDelayMs,
    backoffFactor,
    maxDelayMs,
    jitter,
    shouldRetry,
    onRetry,
  } = { ...DEFAULT_CONFIG, ...config }

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const value = await fn()
      return ok(value)
    } catch (error) {
      lastError = error

      const isLastAttempt = attempt === maxAttempts - 1
      if (isLastAttempt) break

      // Check if this error type should be retried
      if (shouldRetry && !shouldRetry(error)) break

      const delayMs = calculateDelay(attempt, baseDelayMs, backoffFactor, maxDelayMs, jitter)
      onRetry?.(attempt + 1, error, delayMs)

      await sleep(delayMs)
    }
  }

  // Normalise the caught value into an Error instance
  const finalError =
    lastError instanceof Error ? lastError : new Error(String(lastError))

  return err(finalError)
}

/** Promisified setTimeout — used internally for delays. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
