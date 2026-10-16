import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TwoStageCacheService, PROMPT_VERSION, hashString } from '../cache';
import { StageAExplanation, StageBDetailedVocabulary } from '../../../types';

describe('Two-Stage Cache Isolation & Request Lifecycle', () => {
  beforeEach(() => {
    TwoStageCacheService.clear();
  });

  const mockStageA: StageAExplanation = {
    selectedText: 'reluctant',
    lemma: 'reluctant',
    partOfSpeech: 'adjective',
    easyEnglish: 'Not wanting to do something.',
    easyBengali: 'কোনো কাজ করতে মন না চাওয়া।',
    contextMeaning: 'In this sentence, the minister hesitated before signing.',
    example: 'He was reluctant to leave.',
    exampleBengali: 'সে যেতে অনাগ্রহী ছিল।',
    confidence: 'high',
    contextualSenseId: 'sense_1'
  };

  const mockStageB: StageBDetailedVocabulary = {
    lemma: 'reluctant',
    partOfSpeech: 'adjective',
    contextualSenseId: 'sense_1',
    senses: [
      {
        id: 'sense_1',
        partOfSpeech: 'adjective',
        easyEnglish: 'Unwilling and hesitant.',
        easyBengali: 'অনিচ্ছুক বা দ্বিধাগ্রস্ত',
        isContextual: true,
        examples: [{ english: 'He was reluctant to commit.', bengali: 'সে প্রতিশ্রুতি দিতে অনিচ্ছুক ছিল।' }],
        synonyms: [{ word: 'hesitant', easyEnglish: 'slow to act', easyBengali: 'দ্বিধাগ্রস্ত' }],
        antonyms: [{ word: 'eager', easyEnglish: 'wanting very much to do it', easyBengali: 'উৎসাহী' }]
      }
    ],
    collocations: [{ english: 'reluctant agreement', bengali: 'অনিচ্ছুক সম্মতি' }],
    idiomsAndPhrases: []
  };

  it('generates distinct cache keys for Stage A and Stage B', () => {
    const keyA = TwoStageCacheService.getStageAKey('reluctant', 'He was reluctant to agree.');
    const keyB = TwoStageCacheService.getStageBKey('reluctant', 'adjective');

    expect(keyA).toContain('stageA:reluctant::');
    expect(keyB).toBe(`stageB:reluctant::adjective::${PROMPT_VERSION}`);
    expect(keyA).not.toEqual(keyB);
  });

  it('invalidates Stage A cache when context sentence changes', () => {
    const keyA1 = TwoStageCacheService.getStageAKey('reluctant', 'Sentence 1 with reluctant.');
    const keyA2 = TwoStageCacheService.getStageAKey('reluctant', 'Sentence 2 with reluctant.');

    expect(keyA1).not.toEqual(keyA2);

    TwoStageCacheService.setStageA(keyA1, mockStageA);
    expect(TwoStageCacheService.getStageA(keyA1)).toEqual(mockStageA);
    expect(TwoStageCacheService.getStageA(keyA2)).toBeNull();
  });

  it('reuses Stage B cache across different sentences for the same lemma and POS', () => {
    const keyB = TwoStageCacheService.getStageBKey('reluctant', 'adjective');
    TwoStageCacheService.setStageB(keyB, mockStageB);

    // Any sentence checking the general vocabulary of 'reluctant' gets the cached Stage B
    const cached = TwoStageCacheService.getStageB(keyB);
    expect(cached).toEqual(mockStageB);
  });

  it('deduplicates simultaneous concurrent requests for the same cache key', async () => {
    const keyA = TwoStageCacheService.getStageAKey('bank', 'He sat on the river bank.');
    let callCount = 0;

    const slowFetcher = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return mockStageA;
    };

    // Dispatch 3 concurrent requests simultaneously
    const [res1, res2, res3] = await Promise.all([
      TwoStageCacheService.executeDeduplicatedStageA(keyA, slowFetcher),
      TwoStageCacheService.executeDeduplicatedStageA(keyA, slowFetcher),
      TwoStageCacheService.executeDeduplicatedStageA(keyA, slowFetcher)
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(mockStageA);
    expect(res2).toEqual(mockStageA);
    expect(res3).toEqual(mockStageA);
  });

  it('hashes sentences deterministically and ignores superficial whitespace', () => {
    const h1 = hashString('  The quick   brown fox. ');
    const h2 = hashString('The quick brown fox.');
    expect(h1).toEqual(h2);
  });
});
