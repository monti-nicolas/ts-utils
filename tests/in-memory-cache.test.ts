import { InMemoryCache } from '../src/cache/in-memory-cache'

describe('InMemoryCache', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('basic get/set', () => {
    it('stores and retrieves a value', () => {
      const cache = new InMemoryCache<string, number>()
      cache.set('score', 42)
      expect(cache.get('score')).toBe(42)
    })

    it('returns undefined for unknown keys', () => {
      const cache = new InMemoryCache()
      expect(cache.get('missing')).toBeUndefined()
    })

    it('overwrites an existing value', () => {
      const cache = new InMemoryCache<string, string>()
      cache.set('name', 'alice')
      cache.set('name', 'bob')
      expect(cache.get('name')).toBe('bob')
    })
  })

  describe('TTL expiry', () => {
    it('returns a value before TTL expires', () => {
      const cache = new InMemoryCache<string, string>({ defaultTtlMs: 1000 })
      cache.set('key', 'value')

      jest.advanceTimersByTime(999)
      expect(cache.get('key')).toBe('value')
    })

    it('returns undefined after TTL expires', () => {
      const cache = new InMemoryCache<string, string>({ defaultTtlMs: 1000 })
      cache.set('key', 'value')

      jest.advanceTimersByTime(1001)
      expect(cache.get('key')).toBeUndefined()
    })

    it('per-entry TTL overrides the default', () => {
      const cache = new InMemoryCache<string, string>({ defaultTtlMs: 5000 })
      cache.set('short', 'value', 500)

      jest.advanceTimersByTime(600)
      expect(cache.get('short')).toBeUndefined()
    })

    it('stores entries with no expiry when no TTL is set', () => {
      const cache = new InMemoryCache<string, string>()
      cache.set('key', 'forever')

      jest.advanceTimersByTime(999_999)
      expect(cache.get('key')).toBe('forever')
    })
  })

  describe('has / delete / clear', () => {
    it('has() returns true for existing non-expired entries', () => {
      const cache = new InMemoryCache<string, number>()
      cache.set('x', 1)
      expect(cache.has('x')).toBe(true)
    })

    it('has() returns false for expired entries', () => {
      const cache = new InMemoryCache<string, number>({ defaultTtlMs: 100 })
      cache.set('x', 1)
      jest.advanceTimersByTime(200)
      expect(cache.has('x')).toBe(false)
    })

    it('delete() removes an entry', () => {
      const cache = new InMemoryCache<string, number>()
      cache.set('x', 1)
      cache.delete('x')
      expect(cache.get('x')).toBeUndefined()
    })

    it('clear() empties the cache', () => {
      const cache = new InMemoryCache<string, number>()
      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()
      expect(cache.size).toBe(0)
    })
  })

  describe('maxSize eviction', () => {
    it('evicts the oldest entry when maxSize is reached', () => {
      const cache = new InMemoryCache<string, number>({ maxSize: 3 })
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      // This should evict 'a' (oldest)
      cache.set('d', 4)

      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })

    it('does not grow beyond maxSize', () => {
      const cache = new InMemoryCache<string, number>({ maxSize: 2 })
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4)

      expect(cache.size).toBe(2)
    })
  })

  describe('prune', () => {
    it('removes all expired entries and returns the count', () => {
      const cache = new InMemoryCache<string, number>({ defaultTtlMs: 500 })
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3, 999_999) // Long TTL — should not be pruned

      jest.advanceTimersByTime(600)
      const pruned = cache.prune()

      expect(pruned).toBe(2)
      expect(cache.size).toBe(1)
      expect(cache.get('c')).toBe(3)
    })
  })
})
