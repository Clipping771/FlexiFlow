/**
 * Bounded In-Memory LRU (Least Recently Used) Cache.
 * Provides sub-millisecond lookup and prevents unbounded memory growth.
 * JavaScript Map maintains insertion order:
 * - On access, key is refreshed to the end (most recent).
 * - On overflow, the first key (least recently used) is evicted.
 */

export interface LruEntry<T> {
  value: T;
  expiresAt: number;
}

export class LruCache<T = unknown> {
  private map = new Map<string, LruEntry<T>>();
  private readonly maxCapacity: number;
  private readonly defaultTtlMs: number;

  constructor(maxCapacity: number = 500, defaultTtlMs: number = 24 * 60 * 60 * 1000) {
    this.maxCapacity = Math.max(1, maxCapacity);
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh position to MRU (tail)
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const duration = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const expiresAt = Date.now() + duration;

    // If already exists, delete first to update position
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxCapacity) {
      // Evict least recently used (first item in Map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, { value, expiresAt });
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  get capacity(): number {
    return this.maxCapacity;
  }

  /**
   * Prune all expired entries from memory.
   */
  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.map.entries()) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        count++;
      }
    }
    return count;
  }
}
