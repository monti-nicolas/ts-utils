/**
 * InMemoryCache
 *
 * A generic, TTL-aware in-memory cache with optional max size eviction.
 *
 * Why build this instead of using a Map directly?
 * A raw Map has no concept of expiry. In an SDK, stale cached values
 * (e.g. a device fingerprint, an auth token) can cause subtle bugs.
 * This cache makes expiry a first-class concern.
 *
 * Design decisions:
 * - Lazy expiry: items are checked for expiry on `get`, not on a timer.
 *   This avoids background timers that complicate testing and teardown.
 * - LRU-style eviction: when maxSize is reached, the least-recently-used
 *   entry is evicted. We approximate LRU using insertion order in a Map
 *   (Maps preserve insertion order in modern JS engines).
 * - Generic: CacheEntry<V> means you get type-safe gets with no casting.
 */

interface CacheEntry<V> {
  value: V
  expiresAt: number | null // null = never expires
}

export interface CacheConfig {
  /** Default TTL for entries in milliseconds. Omit for no expiry. */
  defaultTtlMs?: number

  /** Maximum number of entries. Oldest entry is evicted when limit is reached. */
  maxSize?: number
}

export class InMemoryCache<K = string, V = unknown> {
  private store = new Map<K, CacheEntry<V>>()
  private readonly defaultTtlMs: number | undefined
  private readonly maxSize: number | undefined

  constructor(config: CacheConfig = {}) {
    this.defaultTtlMs = config.defaultTtlMs
    this.maxSize = config.maxSize
  }

  /**
   * Store a value. TTL overrides the instance default for this entry only.
   */
  set(key: K, value: V, ttlMs?: number): void {
    // Evict before inserting if we're at capacity
    if (this.maxSize !== undefined && this.store.size >= this.maxSize) {
      this.evictOldest()
    }

    const resolvedTtl = ttlMs ?? this.defaultTtlMs
    const expiresAt = resolvedTtl !== undefined ? Date.now() + resolvedTtl : null

    // Deleting before setting moves the key to the "newest" position in the Map.
    // This is how we maintain LRU order without a doubly-linked list.
    this.store.delete(key)
    this.store.set(key, { value, expiresAt })
  }

  /**
   * Retrieve a value. Returns undefined if the key doesn't exist or has expired.
   * Expired entries are lazily deleted on access.
   */
  get(key: K): V | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined

    if (this.isExpired(entry)) {
      this.store.delete(key)
      return undefined
    }

    // Move to end (most recently used) for LRU ordering
    this.store.delete(key)
    this.store.set(key, entry)

    return entry.value
  }

  /** Returns true if the key exists and has not expired. */
  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  /** Remove a specific entry. */
  delete(key: K): boolean {
    return this.store.delete(key)
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear()
  }

  /** Number of entries currently stored (includes potentially expired ones). */
  get size(): number {
    return this.store.size
  }

  /**
   * Remove all expired entries. Call this periodically if memory is a concern
   * and the cache may accumulate many expired keys without being read.
   */
  prune(): number {
    let pruned = 0
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(key)
        pruned++
      }
    }
    return pruned
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt
  }

  /** Evict the oldest (first inserted) entry from the store. */
  private evictOldest(): void {
    const firstKey = this.store.keys().next().value
    if (firstKey !== undefined) {
      this.store.delete(firstKey)
    }
  }
}
