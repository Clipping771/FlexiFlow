import { LocalDictionaryProvider } from './localDictionary';
import { DictionaryProvider } from './types';
import { DictionaryResult } from '../../types';
import { BengaliService } from '../bengali';
import { CacheManager } from '../cache';
import { stripEnclosingPunctuation } from '../cache/normalization';

export class DictionaryService {
  private static localProvider = new LocalDictionaryProvider();
  private static cacheManager = CacheManager.getInstance();

  /**
   * Fast offline dictionary-first lookup:
   * 1. Validate & safely normalize selected word/phrase
   * 2. Check Tier 1 & Tier 2 cache
   * 3. Check local offline English lexicon
   * 4. Check curated bilingual Bengali lexicon
   * 5. Cache and return verified result
   */
  static async lookup(word: string, contextSentence?: string): Promise<DictionaryResult | null> {
    if (!word || typeof word !== 'string') return null;
    const clean = stripEnclosingPunctuation(word);
    if (!clean) return null;

    // 1. Check Cache (Memory LRU -> Persistent)
    try {
      const cached = await this.cacheManager.getDictionary<DictionaryResult>(clean);
      if (cached) {
        return cached;
      }
    } catch {
      // Non-blocking
    }

    // 2. Local offline English lexicon
    const localHit = await this.localProvider.lookup(clean, contextSentence);
    if (localHit) {
      this.cacheManager.setDictionary(clean, localHit);
      return localHit;
    }

    // 3. Curated bilingual engine check
    const bengali = BengaliService.getMeaning(clean, contextSentence);
    if (bengali && bengali.isCurated) {
      const entry = (bengali as any);
      const synthesized: DictionaryResult = {
        word: clean,
        meanings: [
          {
            partOfSpeech: entry.pos || 'word',
            definitions: [
              {
                definition: bengali.nuance || bengali.bengaliExplanation || 'Curated definition in context.',
                example: contextSentence
              }
            ]
          }
        ],
        bengaliMeaning: bengali.bengaliWord,
        bengaliExplanation: bengali.bengaliExplanation,
        source: 'curated_bilingual_lexicon',
        isVerified: true,
        contextSentence
      };
      this.cacheManager.setDictionary(clean, synthesized);
      return synthesized;
    }

    return null;
  }

  /**
   * Synchronous dictionary lookup (< 0.01ms):
   * Checks in-memory cache and local synchronous offline lexicons.
   */
  static lookupSync(word: string, contextSentence?: string): DictionaryResult | null {
    if (!word || typeof word !== 'string') return null;
    const clean = stripEnclosingPunctuation(word);
    if (!clean) return null;

    // 1. Check in-memory LRU cache
    const key = this.cacheManager.getDictionaryKey(clean);
    const cached = (this.cacheManager as any).memoryCache?.get(key) as DictionaryResult | null;
    if (cached) return cached;

    // 2. Check local offline English lexicon synchronously
    const localHit = this.localProvider.lookupSync(clean, contextSentence);
    if (localHit) {
      this.cacheManager.setDictionary(clean, localHit);
      return localHit;
    }

    // 3. Check curated bilingual Bengali lexicon
    const bengali = BengaliService.getMeaning(clean, contextSentence);
    if (bengali && bengali.isCurated) {
      const entry = (bengali as any);
      const synthesized: DictionaryResult = {
        word: clean,
        meanings: [
          {
            partOfSpeech: entry.pos || 'word',
            definitions: [
              {
                definition: bengali.nuance || bengali.bengaliExplanation || 'Curated definition in context.',
                example: contextSentence
              }
            ]
          }
        ],
        bengaliMeaning: bengali.bengaliWord,
        bengaliExplanation: bengali.bengaliExplanation,
        source: 'curated_bilingual_lexicon',
        isVerified: true,
        contextSentence
      };
      this.cacheManager.setDictionary(clean, synthesized);
      return synthesized;
    }

    return null;
  }
}

/**
 * Maps a DictionaryResult into a StageAExplanation for immediate UI rendering.
 */
export function dictionaryResultToStageA(
  dict: DictionaryResult,
  contextSentence?: string
): import('../../types').StageAExplanation {
  const firstMeaning = dict.meanings?.[0];
  const firstDef = firstMeaning?.definitions?.[0];
  const easyEnglish = firstDef?.definition || dict.bengaliExplanation || 'Dictionary definition.';
  const easyBengali = dict.bengaliMeaning || 'বাংলা অর্থ';
  const contextMeaning = dict.bengaliExplanation || firstDef?.definition || 'প্রাসঙ্গিক অর্থ';

  return {
    selectedText: dict.word,
    lemma: dict.word.toLowerCase(),
    partOfSpeech: firstMeaning?.partOfSpeech || 'word',
    easyEnglish,
    easyBengali,
    contextMeaning,
    example: firstDef?.example || contextSentence || `Example with ${dict.word}.`,
    exampleBengali: 'বাক্যটিতে এর ভাবার্থ স্পষ্টভাবে প্রকাশ পেয়েছে।',
    confidence: 'high',
    contextualSenseId: 'sense_dict_1'
  };
}

export * from './types';
export * from './localDictionary';
