/**
 * Multi-Level Cache Manager.
 * Orchestrates Tier 1 (In-Memory LRU) and Tier 2 (Persistent Cache).
 * Ensures fast lookups, zero UI freezing, and persistence across MV3 restarts.
 */

import { LruCache } from './lru';
import { PersistentCache } from './persistentCache';
import {
  normalizeDictionaryKey,
  normalizeAIContextKey,
  stripEnclosingPunctuation
} from './normalization';
import { CacheCategory } from './types';

export class CacheManager {
  private static instance: CacheManager | null = null;

  // Tier 1: In-Memory LRU Cache (Fastest: < 0.01ms)
  private memoryCache: LruCache<unknown>;

  // Tier 2: Persistent Storage (Survives SW termination: IndexedDB)
  private persistentCache: PersistentCache;

  // In-flight request deduplication map to prevent duplicate network calls
  private inFlightRequests = new Map<string, Promise<unknown>>();

  constructor(memoryCapacity = 500, defaultTtlMs = 24 * 60 * 60 * 1000) {
    this.memoryCache = new LruCache<unknown>(memoryCapacity, defaultTtlMs);
    this.persistentCache = new PersistentCache();
  }

  static getInstance(): CacheManager {
    if (!this.instance) {
      this.instance = new CacheManager();
    }
    return this.instance;
  }

  /**
   * Reset instance (primarily for test isolation)
   */
  static resetInstance(): void {
    if (this.instance) {
      this.instance.clear();
    }
    this.instance = null;
  }

  // ==========================================
  // Dictionary Cache API (Category: 'dictionary')
  // ==========================================

  getDictionaryKey(word: string, langPair = 'en-bn', dictVersion = 'v1'): string {
    return normalizeDictionaryKey(word, langPair, dictVersion);
  }

  async getDictionary<T>(word: string, langPair = 'en-bn', dictVersion = 'v1'): Promise<T | null> {
    const key = this.getDictionaryKey(word, langPair, dictVersion);
    if (!key) return null;

    // 1. Check Tier 1 Memory Cache
    const memHit = this.memoryCache.get(key) as T | null;
    if (memHit !== null) {
      return memHit;
    }

    // 2. Check Tier 2 Persistent Cache
    try {
      const persistHit = await this.persistentCache.get<T>(key);
      if (persistHit !== null) {
        // Backfill Tier 1 memory cache for future rapid hits
        this.memoryCache.set(key, persistHit);
        return persistHit;
      }
    } catch {
      // Non-blocking: persistent cache failure must not stop pipeline
    }

    return null;
  }

  setDictionary<T>(
    word: string,
    data: T,
    langPair = 'en-bn',
    dictVersion = 'v1',
    ttlMs?: number
  ): void {
    const key = this.getDictionaryKey(word, langPair, dictVersion);
    if (!key) return;

    // Synchronous Tier 1 write
    this.memoryCache.set(key, data, ttlMs);

    // Asynchronous non-blocking Tier 2 write
    this.persistentCache
      .set<T>(key, 'dictionary', data, ttlMs, dictVersion)
      .catch((err) => {
        console.warn('[LexiFlow Cache] Non-blocking persistent write failed:', err);
      });
  }

  // ==========================================
  // Contextual AI Cache API (Category: 'ai_contextual')
  // ==========================================

  getAIKey(
    text: string,
    contextSentence?: string,
    langPair = 'en-bn',
    analysisType = 'stageA',
    promptVersion = 'v2_master'
  ): string {
    return normalizeAIContextKey(text, contextSentence, langPair, analysisType, promptVersion);
  }

  async getAIExplanation<T>(
    text: string,
    contextSentence?: string,
    langPair = 'en-bn',
    analysisType = 'stageA',
    promptVersion = 'v2_master'
  ): Promise<T | null> {
    const key = this.getAIKey(text, contextSentence, langPair, analysisType, promptVersion);
    if (!key) return null;

    // 1. Tier 1 Memory Cache Hit
    const memHit = this.memoryCache.get(key) as T | null;
    if (memHit !== null) {
      return memHit;
    }

    // 2. Tier 2 Persistent Cache Hit
    try {
      const persistHit = await this.persistentCache.get<T>(key);
      if (persistHit !== null) {
        this.memoryCache.set(key, persistHit);
        return persistHit;
      }
    } catch {
      // Non-blocking
    }

    return null;
  }

  setAIExplanation<T>(
    text: string,
    contextSentence: string | undefined,
    data: T,
    langPair = 'en-bn',
    analysisType = 'stageA',
    promptVersion = 'v2_master',
    ttlMs?: number
  ): void {
    const key = this.getAIKey(text, contextSentence, langPair, analysisType, promptVersion);
    if (!key) return;

    // Synchronous Tier 1 write
    this.memoryCache.set(key, data, ttlMs);

    // Asynchronous Tier 2 write
    this.persistentCache
      .set<T>(key, 'ai_contextual', data, ttlMs, promptVersion)
      .catch((err) => {
        console.warn('[LexiFlow Cache] Non-blocking persistent write failed:', err);
      });
  }

  // ==========================================
  // Deduplication & Invalidation
  // ==========================================

  /**
   * Execute an operation with in-flight deduplication.
   * If a matching request is currently pending, reuses the existing Promise.
   */
  async executeDeduplicated<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  async invalidateCategory(category: CacheCategory): Promise<void> {
    await this.persistentCache.invalidateCategory(category);
    this.memoryCache.clear();
  }

  clear(): void {
    this.memoryCache.clear();
    this.persistentCache.clear().catch(() => {});
    this.inFlightRequests.clear();
  }

  get memorySize(): number {
    return this.memoryCache.size;
  }
}
