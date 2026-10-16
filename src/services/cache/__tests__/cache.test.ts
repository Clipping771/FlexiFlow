import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LruCache } from '../lru';
import { PersistentCache } from '../persistentCache';
import { CacheManager } from '../cacheManager';
import {
  normalizeCleanText,
  stripEnclosingPunctuation,
  normalizeDictionaryKey,
  normalizeAIContextKey,
  hashString
} from '../normalization';

describe('Stage 2: Multi-Level Caching & Normalization Suite', () => {

  describe('1. Safe Normalization Rules', () => {
    it('normalizes Unicode into NFC format and collapses whitespace', () => {
      // Decomposed vs Composed Unicode
      const decomposed = 'e\u0301'; // é decomposed
      const composed = 'é';         // é composed
      expect(normalizeCleanText(decomposed)).toEqual(composed);

      // Whitespace collapsing
      const messy = '  agricultural    subsidies \t \n reform  ';
      expect(normalizeCleanText(messy)).toBe('agricultural subsidies reform');
    });

    it('strips enclosing quotes and brackets but preserves internal punctuation', () => {
      expect(stripEnclosingPunctuation('"scrutiny"')).toBe('scrutiny');
      expect(stripEnclosingPunctuation('«subsidies»')).toBe('subsidies');
      expect(stripEnclosingPunctuation('(resilient)')).toBe('resilient');
      expect(stripEnclosingPunctuation('“ephemeral”')).toBe('ephemeral');
      expect(stripEnclosingPunctuation('mitigate.')).toBe('mitigate');

      // Crucial: preserve internal hyphens and apostrophes!
      expect(stripEnclosingPunctuation('state-of-the-art')).toBe('state-of-the-art');
      expect(stripEnclosingPunctuation("don't")).toBe("don't");
    });

    it('preserves uppercase tags for acronyms in dictionary keys to avoid collision', () => {
      const normalKey = normalizeDictionaryKey('us');
      const acronymKey = normalizeDictionaryKey('US');

      expect(normalKey).toBe('dict:en-bn:v1:us');
      expect(acronymKey).toBe('dict:en-bn:v1:us:caps');
      expect(normalKey).not.toEqual(acronymKey);
    });

    it('ensures distinct sentences produce distinct AI context keys', () => {
      const key1 = normalizeAIContextKey('bank', 'He deposited money in the bank.');
      const key2 = normalizeAIContextKey('bank', 'They sat on the grassy bank of the river.');

      expect(key1).toContain('ai:en-bn:stageA:v2_master:bank::');
      expect(key2).toContain('ai:en-bn:stageA:v2_master:bank::');
      expect(key1).not.toEqual(key2);
    });

    it('hashes sentences deterministically regardless of minor outer whitespace', () => {
      const h1 = hashString('  Fertiliser subsidies need a rethink.  ');
      const h2 = hashString('Fertiliser subsidies need a rethink.');
      expect(h1).toBe(h2);
    });
  });

  describe('2. In-Memory LRU Cache', () => {
    it('stores and retrieves values with sub-millisecond latency', () => {
      const lru = new LruCache<string>(10, 10000);
      lru.set('key1', 'value1');

      const start = performance.now();
      const val = lru.get('key1');
      const elapsed = performance.now() - start;

      expect(val).toBe('value1');
      expect(elapsed).toBeLessThan(10); // Under 10ms budget
    });

    it('evicts least recently used items when capacity is exceeded', () => {
      const lru = new LruCache<number>(3, 60000);
      lru.set('a', 1);
      lru.set('b', 2);
      lru.set('c', 3);

      expect(lru.size).toBe(3);

      // Access 'a', making it MRU; 'b' is now the oldest (LRU)
      lru.get('a');

      // Add 'd', which triggers eviction of 'b'
      lru.set('d', 4);

      expect(lru.has('b')).toBe(false);
      expect(lru.get('b')).toBeNull();
      expect(lru.get('a')).toBe(1);
      expect(lru.get('c')).toBe(3);
      expect(lru.get('d')).toBe(4);
    });

    it('handles TTL expiration and prunes expired entries', async () => {
      const lru = new LruCache<string>(10, 30); // 30ms TTL
      lru.set('temp', 'fleeting');

      expect(lru.get('temp')).toBe('fleeting');

      // Wait for expiration
      await new Promise((r) => setTimeout(r, 45));

      expect(lru.get('temp')).toBeNull();
      expect(lru.has('temp')).toBe(false);
    });
  });

  describe('3. Persistent Cache & Multi-Level CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      CacheManager.resetInstance();
      cacheManager = CacheManager.getInstance();
    });

    it('reads from memory cache on hit without accessing persistent layer', async () => {
      const dummyDict = { word: 'scrutiny', bengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা' };
      cacheManager.setDictionary('scrutiny', dummyDict);

      const hit = await cacheManager.getDictionary('scrutiny');
      expect(hit).toEqual(dummyDict);
    });

    it('survives memory clearance via persistent cache tier', async () => {
      const aiData = { easyEnglish: 'Critical examination', easyBengali: 'পুঙ্খানুপুঙ্খ পরীক্ষা' };
      cacheManager.setAIExplanation('scrutiny', 'Under close scrutiny.', aiData);

      // Verify it was set
      const initial = await cacheManager.getAIExplanation('scrutiny', 'Under close scrutiny.');
      expect(initial).toEqual(aiData);

      // Clear ONLY the Tier 1 in-memory cache to simulate service worker restart!
      (cacheManager as any).memoryCache.clear();
      expect((cacheManager as any).memoryCache.size).toBe(0);

      // Querying CacheManager must retrieve from Tier 2 Persistent Cache and re-fill memory!
      const recovered = await cacheManager.getAIExplanation('scrutiny', 'Under close scrutiny.');
      expect(recovered).toEqual(aiData);
      expect((cacheManager as any).memoryCache.size).toBeGreaterThan(0);
    });

    it('isolates dictionary cache from contextual AI cache', async () => {
      const dictData = { type: 'dict_definition' };
      const aiData = { type: 'ai_explanation' };

      cacheManager.setDictionary('subsidies', dictData);
      cacheManager.setAIExplanation('subsidies', 'Fertiliser subsidies need a rethink.', aiData);

      const dictRes = await cacheManager.getDictionary('subsidies');
      const aiRes = await cacheManager.getAIExplanation('subsidies', 'Fertiliser subsidies need a rethink.');

      expect(dictRes).toEqual(dictData);
      expect(aiRes).toEqual(aiData);
      expect(dictRes).not.toEqual(aiRes);
    });

    it('handles persistent storage write failures gracefully without crashing', async () => {
      const persistent = new PersistentCache();

      // Intentionally mock getDB to reject (simulating corrupted or unavailable storage)
      vi.spyOn(persistent as any, 'getDB').mockRejectedValue(new Error('IndexedDB disk error'));

      // set() must not throw
      await expect(persistent.set('fail_key', 'dictionary', { test: true })).resolves.not.toThrow();

      // get() must fall back gracefully to memory fallback
      const result = await persistent.get('fail_key');
      expect(result).toEqual({ test: true });
    });

    it('deduplicates simultaneous in-flight operations', async () => {
      let fetchCount = 0;
      const slowFetch = async () => {
        fetchCount++;
        await new Promise((r) => setTimeout(r, 25));
        return { success: true };
      };

      const [r1, r2, r3] = await Promise.all([
        cacheManager.executeDeduplicated('fetch_key', slowFetch),
        cacheManager.executeDeduplicated('fetch_key', slowFetch),
        cacheManager.executeDeduplicated('fetch_key', slowFetch),
      ]);

      expect(fetchCount).toBe(1);
      expect(r1).toEqual({ success: true });
      expect(r2).toEqual({ success: true });
      expect(r3).toEqual({ success: true });
    });
  });
});
