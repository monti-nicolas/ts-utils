import { retry, calculateDelay } from '../src/retry/retry'

// Replace real timers with Jest's fake timers so tests don't actually wait
jest.useFakeTimers()

describe('calculateDelay', () => {
  it('returns base delay on first retry (attempt 0)', () => {
    const delay = calculateDelay(0, 200, 2, 30_000, false)
    expect(delay).toBe(200)
  })

  it('applies exponential backoff', () => {
    expect(calculateDelay(1, 200, 2, 30_000, false)).toBe(400)
    expect(calculateDelay(2, 200, 2, 30_000, false)).toBe(800)
    expect(calculateDelay(3, 200, 2, 30_000, false)).toBe(1600)
  })

  it('caps at maxDelayMs', () => {
    const delay = calculateDelay(10, 200, 2, 1000, false)
    expect(delay).toBe(1000)
  })

  it('returns a value between 0 and cap when jitter is enabled', () => {
    for (let i = 0; i < 20; i++) {
      const delay = calculateDelay(2, 200, 2, 30_000, true)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(800)
    }
  })
})

describe('retry', () => {
  beforeEach(() => {
    jest.clearAllTimers()
  })

  it('returns ok on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success')

    const promise = retry(fn, { maxAttempts: 3 })
    // Advance timers to resolve all pending setTimeout calls
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on a later attempt', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('eventually ok')

    const promise = retry(fn, { maxAttempts: 3, jitter: false })
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('eventually ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('returns err after exhausting all attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'))

    const promise = retry(fn, { maxAttempts: 3, jitter: false })
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBe('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stops retrying when shouldRetry returns false', async () => {
    class PermanentError extends Error {}

    const fn = jest.fn().mockRejectedValue(new PermanentError('do not retry'))

    const promise = retry(fn, {
      maxAttempts: 5,
      jitter: false,
      shouldRetry: (e) => !(e instanceof PermanentError),
    })
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.ok).toBe(false)
    // Should have attempted once and stopped — no retries
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('calls onRetry with the correct attempt number', async () => {
    const onRetry = jest.fn()
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok')

    const promise = retry(fn, { maxAttempts: 3, jitter: false, onRetry })
    await jest.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
  })

  it('wraps non-Error rejections in an Error instance', async () => {
    const fn = jest.fn().mockRejectedValue('string error')

    const promise = retry(fn, { maxAttempts: 1 })
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('string error')
    }
  })
})
