import { StageAExplanation, StageBDetailedVocabulary } from '../../types';
import { CacheManager } from '../cache';
import { hashString as hashStringUtil } from '../cache/normalization';

export const PROMPT_VERSION = 'v2_master';

/**
 * FNV-1a non-cryptographic hash for fast, stable sentence fingerprinting.
 */
export const hashString = hashStringUtil;

/**
 * TwoStageCacheService bridges Stage A & Stage B caching to the
 * high-performance multi-level CacheManager (LRU + Persistent Cache).
 */
export class TwoStageCacheService {
  private static cacheManager = CacheManager.getInstance();

  // Cache TTL: 24 hours
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;

  static getStageAKey(lemmaOrText: string, contextSentence?: string, targetLang?: string): string {
    const cleanLemma = (lemmaOrText || '').trim().toLowerCase();
    const sentenceHash = hashString(contextSentence || '');
    const langSuffix = targetLang && targetLang !== 'bn' ? `::${targetLang}` : '';
    return `stageA:${cleanLemma}::${sentenceHash}${langSuffix}::${PROMPT_VERSION}`;
  }

  static getStageBKey(lemma: string, partOfSpeech?: string, targetLang?: string): string {
    const cleanLemma = (lemma || '').trim().toLowerCase();
    const cleanPos = (partOfSpeech || 'word').trim().toLowerCase();
    const langSuffix = targetLang && targetLang !== 'bn' ? `::${targetLang}` : '';
    return `stageB:${cleanLemma}::${cleanPos}${langSuffix}::${PROMPT_VERSION}`;
  }

  static getStageA(key: string): StageAExplanation | null {
    // Synchronous memory LRU hit
    return (this.cacheManager as any).memoryCache?.get(key) || null;
  }

  static async getStageAAsync(key: string): Promise<StageAExplanation | null> {
    const mem = this.getStageA(key);
    if (mem) return mem;
    try {
      const persist = await (this.cacheManager as any).persistentCache?.get(key);
      if (persist) {
        (this.cacheManager as any).memoryCache?.set(key, persist);
        return persist;
      }
    } catch {
      // non-blocking
    }
    return null;
  }

  static setStageA(key: string, data: StageAExplanation): void {
    (this.cacheManager as any).memoryCache?.set(key, data, this.TTL_MS);
    (this.cacheManager as any).persistentCache?.set(key, 'ai_contextual', data, this.TTL_MS, PROMPT_VERSION).catch(() => {});
  }

  static getStageB(key: string): StageBDetailedVocabulary | null {
    return (this.cacheManager as any).memoryCache?.get(key) || null;
  }

  static async getStageBAsync(key: string): Promise<StageBDetailedVocabulary | null> {
    const mem = this.getStageB(key);
    if (mem) return mem;
    try {
      const persist = await (this.cacheManager as any).persistentCache?.get(key);
      if (persist) {
        (this.cacheManager as any).memoryCache?.set(key, persist);
        return persist;
      }
    } catch {
      // non-blocking
    }
    return null;
  }

  static setStageB(key: string, data: StageBDetailedVocabulary): void {
    (this.cacheManager as any).memoryCache?.set(key, data, this.TTL_MS);
    (this.cacheManager as any).persistentCache?.set(key, 'ai_contextual', data, this.TTL_MS, PROMPT_VERSION).catch(() => {});
  }

  static clear(): void {
    this.cacheManager.clear();
  }

  /**
   * Deduplicate concurrent Stage A executions for the same cache key
   */
  static async executeDeduplicatedStageA(
    key: string,
    fetcher: () => Promise<StageAExplanation>
  ): Promise<StageAExplanation> {
    const cached = await this.getStageAAsync(key);
    if (cached) return cached;

    return this.cacheManager.executeDeduplicated(key, async () => {
      const result = await fetcher();
      this.setStageA(key, result);
      return result;
    });
  }

  /**
   * Deduplicate concurrent Stage B executions for the same cache key
   */
  static async executeDeduplicatedStageB(
    key: string,
    fetcher: () => Promise<StageBDetailedVocabulary>
  ): Promise<StageBDetailedVocabulary> {
    const cached = await this.getStageBAsync(key);
    if (cached) return cached;

    return this.cacheManager.executeDeduplicated(key, async () => {
      const result = await fetcher();
      this.setStageB(key, result);
      return result;
    });
  }
}
