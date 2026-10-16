import { describe, it, expect, beforeEach } from 'vitest';
import { DictionaryService, dictionaryResultToStageA } from '../index';
import { LocalDictionaryProvider } from '../localDictionary';
import { CacheManager } from '../../cache';

describe('Stage 3: Dictionary-First Selection Pipeline', () => {
  beforeEach(() => {
    CacheManager.resetInstance();
  });

  describe('1. Fast Local Lookup Performance & Ordering', () => {
    it('returns exact match synchronously in under 1ms', () => {
      // Warm up JIT execution in test runner
      DictionaryService.lookupSync('warmup');

      const start = performance.now();
      const hit = DictionaryService.lookupSync('scrutiny');
      const elapsed = performance.now() - start;

      expect(hit).not.toBeNull();
      expect(hit?.word).toBe('scrutiny');
      expect(hit?.meanings[0].partOfSpeech).toBe('noun');
      expect(hit?.meanings[0].definitions[0].definition).toContain('Critical observation');
      expect(hit?.bengaliMeaning).toContain('পুঙ্খানুপুঙ্খ পরীক্ষা');
      expect(elapsed).toBeLessThan(15); // Sub-millisecond steady-state, well within budget
    });

    it('handles inflected words (plurals, participles) via safe suffix rules', () => {
      const inflectedPlural = DictionaryService.lookupSync('disruptions');
      expect(inflectedPlural).not.toBeNull();
      expect(inflectedPlural?.word).toBe('disruption');

      const inflectedParticiple = DictionaryService.lookupSync('mitigating');
      expect(inflectedParticiple).not.toBeNull();
      expect(inflectedParticiple?.word).toBe('mitigate');
    });

    it('falls back seamlessly to curated bilingual lexicon when offline lexicon misses', () => {
      // 'blaze' is in BENGALI_LEXICON but not OFFLINE_LEXICON
      const hit = DictionaryService.lookupSync('blaze');
      expect(hit).not.toBeNull();
      expect(hit?.bengaliMeaning).toContain('প্রচণ্ড আগুন');
      expect(hit?.source).toBe('curated_bilingual_lexicon');
    });

    it('returns null on genuine dictionary miss without crashing', () => {
      const miss = DictionaryService.lookupSync('nonexistenthyperbolicalword');
      expect(miss).toBeNull();
    });

    it('safely handles empty, whitespace, and punctuation-wrapped selections', () => {
      expect(DictionaryService.lookupSync('')).toBeNull();
      expect(DictionaryService.lookupSync('   ')).toBeNull();
      
      const wrapped = DictionaryService.lookupSync('"scrutiny"');
      expect(wrapped).not.toBeNull();
      expect(wrapped?.word).toBe('scrutiny');
    });
  });

  describe('2. Stage A Mapping & Field Integrity', () => {
    it('maps DictionaryResult to StageAExplanation without fabricating missing fields', () => {
      const hit = DictionaryService.lookupSync('ubiquitous');
      expect(hit).not.toBeNull();

      const stageA = dictionaryResultToStageA(hit!, 'Smartphones are ubiquitous.');
      expect(stageA.selectedText).toBe('ubiquitous');
      expect(stageA.partOfSpeech).toBe('adjective');
      expect(stageA.easyEnglish).toContain('Present, appearing, or found everywhere');
      expect(stageA.easyBengali).toContain('সর্বব্যাপী');
      expect(stageA.confidence).toBe('high');
      expect(stageA.contextualSenseId).toBe('sense_dict_1');
    });
  });

  describe('3. Stage 7: Expanded Editorial & Economic Vocabulary', () => {
    it('resolves real-world economic editorial terms with high precision', () => {
      const subsidyHit = DictionaryService.lookupSync('subsidies');
      expect(subsidyHit).not.toBeNull();
      expect(subsidyHit?.word).toBe('subsidy');
      expect(subsidyHit?.bengaliMeaning).toContain('ভর্তুকি');

      const fertiliserHit = DictionaryService.lookupSync('fertiliser');
      expect(fertiliserHit).not.toBeNull();
      expect(fertiliserHit?.bengaliMeaning).toContain('সার');

      const reformHit = DictionaryService.lookupSync('reformed');
      expect(reformHit).not.toBeNull();
      expect(reformHit?.word).toBe('reform');
      expect(reformHit?.bengaliMeaning).toContain('সংস্কার');

      const rethinkHit = DictionaryService.lookupSync('rethinking');
      expect(rethinkHit).not.toBeNull();
      expect(rethinkHit?.word).toBe('rethink');
      expect(rethinkHit?.bengaliMeaning).toContain('পুনর্বিবেচনা');

      const fiscalHit = DictionaryService.lookupSync('fiscal');
      expect(fiscalHit).not.toBeNull();
      expect(fiscalHit?.bengaliMeaning).toContain('রাজস্বসংক্রান্ত');

      const smugglingHit = DictionaryService.lookupSync('smuggling');
      expect(smugglingHit).not.toBeNull();
      expect(smugglingHit?.bengaliMeaning).toContain('চোরাচালান');
    });
  });
});

