import { describe, it, expect, vi } from 'vitest';
import { CacheManager } from '../../services/cache';

describe('Stage 4: Selection Races, Cancellation, and Request Deduplication', () => {

  describe('1. Monotonic Request Identity & Obsolete Response Suppression', () => {
    it('discards stale response when a newer request has started', async () => {
      let currentRequestId = 0;
      let activeUIState: string | null = null;

      // Simulate Request 1 (slow network)
      const requestId1 = ++currentRequestId;
      const slowRequest1 = async () => {
        await new Promise((r) => setTimeout(r, 60));
        // Verify identity before updating UI
        if (requestId1 === currentRequestId) {
          activeUIState = 'result_from_request_1';
        }
      };

      // Simulate Request 2 (fast network, e.g. user selected another word)
      const requestId2 = ++currentRequestId;
      const fastRequest2 = async () => {
        await new Promise((r) => setTimeout(r, 10));
        if (requestId2 === currentRequestId) {
          activeUIState = 'result_from_request_2';
        }
      };

      // Trigger both
      const p1 = slowRequest1();
      const p2 = fastRequest2();

      await Promise.all([p1, p2]);

      // Result MUST be from Request 2; Request 1 was discarded!
      expect(activeUIState).toBe('result_from_request_2');
    });

    it('cancels pending operations via AbortController on rapid consecutive selection', async () => {
      let activeAbortController: AbortController | null = null;
      const abortedResults: string[] = [];

      const startLookup = (word: string): Promise<string> => {
        activeAbortController?.abort();
        activeAbortController = new AbortController();
        const signal = activeAbortController.signal;

        return new Promise((resolve) => {
          setTimeout(() => {
            if (signal.aborted) {
              abortedResults.push(word);
              resolve(`aborted_${word}`);
            } else {
              resolve(`completed_${word}`);
            }
          }, 30);
        });
      };

      // User rapidly selects word A then immediately word B then word C
      const pA = startLookup('wordA');
      const pB = startLookup('wordB');
      const pC = startLookup('wordC');

      const [resA, resB, resC] = await Promise.all([pA, pB, pC]);

      expect(resA).toBe('aborted_wordA');
      expect(resB).toBe('aborted_wordB');
      expect(resC).toBe('completed_wordC');
      expect(abortedResults).toContain('wordA');
      expect(abortedResults).toContain('wordB');
    });
  });

  describe('2. In-Flight Request Deduplication', () => {
    it('reuses pending Promise for compatible identical lookups and cleans up map on settlement', async () => {
      const inFlight = new Map<string, Promise<string>>();
      let executionCount = 0;

      const deduplicatedFetch = (key: string): Promise<string> => {
        const existing = inFlight.get(key);
        if (existing) return existing;

        const promise = (async () => {
          try {
            executionCount++;
            await new Promise((r) => setTimeout(r, 20));
            return `result_for_${key}`;
          } finally {
            inFlight.delete(key);
          }
        })();

        inFlight.set(key, promise);
        return promise;
      };

      // 4 concurrent consumers request the exact same lookup
      const [r1, r2, r3, r4] = await Promise.all([
        deduplicatedFetch('scrutiny'),
        deduplicatedFetch('scrutiny'),
        deduplicatedFetch('scrutiny'),
        deduplicatedFetch('scrutiny')
      ]);

      expect(executionCount).toBe(1);
      expect(r1).toBe('result_for_scrutiny');
      expect(r2).toBe('result_for_scrutiny');
      expect(r3).toBe('result_for_scrutiny');
      expect(r4).toBe('result_for_scrutiny');

      // Ensure in-flight map is completely cleaned up
      expect(inFlight.size).toBe(0);
    });

    it('cleans up in-flight map even when fetcher throws an error', async () => {
      const inFlight = new Map<string, Promise<string>>();
      let executionCount = 0;

      const failingFetch = (key: string): Promise<string> => {
        const existing = inFlight.get(key);
        if (existing) return existing;

        const promise = (async () => {
          try {
            executionCount++;
            await new Promise((r) => setTimeout(r, 10));
            throw new Error('Network timeout');
          } finally {
            inFlight.delete(key);
          }
        })();

        inFlight.set(key, promise);
        return promise;
      };

      await expect(Promise.all([failingFetch('fail_key'), failingFetch('fail_key')])).rejects.toThrow('Network timeout');
      expect(executionCount).toBe(1);
      expect(inFlight.size).toBe(0);
    });
  });
});
