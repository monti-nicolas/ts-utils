import { RateLimiter } from '../src/rate-limiter/rate-limiter'

describe('RateLimiter', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  describe('tryConsume', () => {
    it('allows requests when tokens are available', () => {
      const limiter = new RateLimiter({ capacity: 5, refillRatePerSec: 1 })
      const result = limiter.tryConsume()

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.retryAfterMs).toBeNull()
    })

    it('denies requests when bucket is empty', () => {
      const limiter = new RateLimiter({ capacity: 2, refillRatePerSec: 1, initialTokens: 0 })
      const result = limiter.tryConsume()

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('exhausts the bucket after capacity requests', () => {
      const limiter = new RateLimiter({ capacity: 3, refillRatePerSec: 1 })

      expect(limiter.tryConsume().allowed).toBe(true)
      expect(limiter.tryConsume().allowed).toBe(true)
      expect(limiter.tryConsume().allowed).toBe(true)
      expect(limiter.tryConsume().allowed).toBe(false)
    })

    it('refills tokens over time', () => {
      const limiter = new RateLimiter({ capacity: 5, refillRatePerSec: 2, initialTokens: 0 })

      // Advance 1 second — should have refilled 2 tokens
      jest.advanceTimersByTime(1000)
      expect(limiter.tryConsume().allowed).toBe(true)
      expect(limiter.tryConsume().allowed).toBe(true)
      expect(limiter.tryConsume().allowed).toBe(false)
    })

    it('does not exceed capacity when refilling', () => {
      const limiter = new RateLimiter({ capacity: 3, refillRatePerSec: 10 })

      // Already full. Advancing time shouldn't push beyond capacity.
      jest.advanceTimersByTime(10_000)
      expect(limiter.availableTokens).toBe(3)
    })

    it('provides a retryAfterMs estimate when denied', () => {
      const limiter = new RateLimiter({ capacity: 1, refillRatePerSec: 2, initialTokens: 0 })
      const result = limiter.tryConsume()

      expect(result.allowed).toBe(false)
      // At 2 tokens/sec, 1 token takes 500ms
      expect(result.retryAfterMs).toBe(500)
    })
  })

  describe('reset', () => {
    it('restores the bucket to full capacity', () => {
      const limiter = new RateLimiter({ capacity: 3, refillRatePerSec: 1 })
      limiter.tryConsume()
      limiter.tryConsume()
      expect(limiter.availableTokens).toBe(1)

      limiter.reset()
      expect(limiter.availableTokens).toBe(3)
    })
  })

  describe('initialTokens', () => {
    it('starts with zero tokens when initialTokens is 0', () => {
      const limiter = new RateLimiter({ capacity: 10, refillRatePerSec: 1, initialTokens: 0 })
      expect(limiter.tryConsume().allowed).toBe(false)
    })
  })

  describe('consume (async)', () => {
    it('resolves immediately when tokens are available', async () => {
      const limiter = new RateLimiter({ capacity: 5, refillRatePerSec: 1 })
      const waited = await limiter.consume()
      expect(waited).toBe(0)
    })

    it('waits and resolves when a token becomes available', async () => {
      const limiter = new RateLimiter({ capacity: 1, refillRatePerSec: 2, initialTokens: 0 })
      const promise = limiter.consume()
      await jest.runAllTimersAsync()
      const waited = await promise
      expect(waited).toBeGreaterThan(0)
    })
  })

})
