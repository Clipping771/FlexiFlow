import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyntaxEngine } from '../syntaxEngine';
import { MockAIProvider } from '../../ai/mockProvider';
import { AIService } from '../../ai';
import { SettingsService } from '../../storage/settings';
import { CacheManager } from '../../cache';

describe('Dynamic Explanation Language Support — Grammar Breakdown', () => {
  const testSentence = 'Researchers demand urgent funding to transform Australian ovarian cancer survival.';
  const bengaliCharRegex = /[\u0980-\u09FF]/;

  beforeEach(async () => {
    CacheManager.getInstance().clear();
  });

  describe('1. SyntaxEngine Multi-Language Analysis', () => {
    it('generates natural Bengali explanations when "bn" is selected', () => {
      const result = SyntaxEngine.analyze(testSentence, 'bn');

      // 1. Sentence structure overview
      expect(result.structureOverview.type).toBe('simple');
      expect(result.structureOverview.explanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(result.structureOverview.explanationBengali!)).toBe(true);

      // 2. Clause constituents
      expect(result.clauses.length).toBeGreaterThan(0);
      const main = result.clauses[0];
      expect(main.subject).toBe('Researchers');
      expect(main.verb).toBe('demand');
      expect(main.directObject).toBe('urgent funding');
      expect(main.adverbials).toBeDefined();
      expect(main.adverbials![0].text).toContain('to transform');
      expect(bengaliCharRegex.test(main.adverbials![0].explanationBengali!)).toBe(true);

      expect(main.subjectExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.subjectExplanationBengali!)).toBe(true);
      expect(main.verbExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.verbExplanationBengali!)).toBe(true);
      expect(main.directObjectExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.directObjectExplanationBengali!)).toBe(true);

      // 3. Pattern summary
      expect(result.patternSummary.formula).toContain('S + V + DO + Purpose Infinitive');
      expect(bengaliCharRegex.test(result.patternSummary.explanationBengali!)).toBe(true);

      // 4. Vocabulary explanations
      expect(result.difficultVocabulary.length).toBeGreaterThan(0);
      const researcherVocab = result.difficultVocabulary.find(v => v.word.toLowerCase() === 'researchers');
      expect(researcherVocab).toBeDefined();
      expect(bengaliCharRegex.test(researcherVocab!.bengali)).toBe(true);
    });

    it('generates simple English explanations with ZERO Bengali characters when "en" is selected', () => {
      const result = SyntaxEngine.analyze(testSentence, 'en');

      // 1. Sentence structure overview
      expect(result.structureOverview.type).toBe('simple');
      expect(result.structureOverview.explanation).toContain('independent clause');
      expect(result.structureOverview.explanationBengali).toBeDefined();
      expect(result.structureOverview.explanationBengali).toContain('Simple sentence: contains exactly one independent clause');
      expect(bengaliCharRegex.test(result.structureOverview.explanationBengali!)).toBe(false);

      // 2. Clause constituents
      const main = result.clauses[0];
      expect(main.subject).toBe('Researchers');
      expect(main.verb).toBe('demand');
      expect(main.directObject).toBe('urgent funding');
      expect(main.adverbials![0].text).toContain('to transform');
      expect(bengaliCharRegex.test(main.adverbials![0].explanationBengali!)).toBe(false);
      expect(main.adverbials![0].explanationBengali).toContain('Infinitive of Purpose');

      expect(main.subjectExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.subjectExplanationBengali!)).toBe(false);
      expect(main.subjectExplanationBengali).toContain('Subject');

      expect(main.verbExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.verbExplanationBengali!)).toBe(false);
      expect(main.verbExplanationBengali).toContain('Finite verb');

      expect(main.directObjectExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(main.directObjectExplanationBengali!)).toBe(false);
      expect(main.directObjectExplanationBengali).toContain('Direct Object');

      // 3. Pattern summary
      expect(result.patternSummary.explanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(result.patternSummary.explanationBengali!)).toBe(false);
      expect(result.patternSummary.explanationBengali).toContain('Sentence pattern: follows');

      // 4. Vocabulary
      for (const vocab of result.difficultVocabulary) {
        expect(bengaliCharRegex.test(vocab.bengali)).toBe(false);
      }
    });

    it('generates natural Spanish explanations when "es" is selected', () => {
      const result = SyntaxEngine.analyze(testSentence, 'es');

      expect(result.structureOverview.explanationBengali).toContain('Oración simple');
      expect(bengaliCharRegex.test(result.structureOverview.explanationBengali!)).toBe(false);

      const main = result.clauses[0];
      expect(main.subjectExplanationBengali).toContain('Sujeto');
      expect(main.verbExplanationBengali).toContain('Verbo principal');
      expect(main.directObjectExplanationBengali).toContain('Objeto Directo');
      expect(main.adverbials![0].explanationBengali).toContain('Infinitivo de propósito');

      expect(result.patternSummary.explanationBengali).toContain('Patrón de la oración');
    });
  });

  describe('2. MockAIProvider Full Sentence Analysis Pipeline', () => {
    it('analyzes sentence in Bengali mode ("bn")', async () => {
      const provider = new MockAIProvider('bn');
      const res = (await provider.analyze(testSentence, 'sentence')) as any;

      expect(res.bengaliTranslation).toContain('গবেষকেরা');
      expect(bengaliCharRegex.test(res.bengaliTranslation)).toBe(true);

      expect(res.clauses[0].subjectExplanationBengali).toBeDefined();
      expect(bengaliCharRegex.test(res.clauses[0].subjectExplanationBengali)).toBe(true);

      expect(res.grammarRules.length).toBeGreaterThan(0);
      const purposeRule = res.grammarRules.find((r: any) => r.ruleName.includes('Infinitive of Purpose'));
      expect(purposeRule).toBeDefined();
      expect(bengaliCharRegex.test(purposeRule.example.bengali)).toBe(true);
    });

    it('analyzes sentence in English mode ("en") with strictly NO Bengali text', async () => {
      const provider = new MockAIProvider('en');
      const res = (await provider.analyze(testSentence, 'sentence')) as any;

      // Paraphrase replaces bengaliTranslation
      expect(res.bengaliTranslation).toContain('Researchers are urgently calling for financial resources');
      expect(bengaliCharRegex.test(res.bengaliTranslation)).toBe(false);

      // Structure explanations
      expect(bengaliCharRegex.test(res.sentenceStructure.explanationBengali)).toBe(false);
      expect(bengaliCharRegex.test(res.clauses[0].subjectExplanationBengali)).toBe(false);
      expect(bengaliCharRegex.test(res.clauses[0].verbExplanationBengali)).toBe(false);
      expect(bengaliCharRegex.test(res.clauses[0].directObjectExplanationBengali)).toBe(false);

      // Phrase breakdown chunks
      for (const phrase of res.phraseBreakdown) {
        expect(bengaliCharRegex.test(phrase.easyBengali)).toBe(false);
      }

      // Grammar rules examples
      for (const rule of res.grammarRules) {
        expect(bengaliCharRegex.test(rule.example.bengali)).toBe(false);
      }
    });

    it('analyzes sentence in Spanish mode ("es")', async () => {
      const provider = new MockAIProvider('es');
      const res = (await provider.analyze(testSentence, 'sentence')) as any;

      expect(res.bengaliTranslation).toContain('Los investigadores exigen financiación urgente');
      expect(bengaliCharRegex.test(res.bengaliTranslation)).toBe(false);
      expect(res.clauses[0].subjectExplanationBengali).toContain('Sujeto');
    });
  });

  describe('3. Cache Partitioning by Target Language', () => {
    it('does not leak cached Bengali explanations when user switches to English', async () => {
      vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
        targetLanguage: 'bn',
        aiProvider: 'mock'
      } as any);

      // 1. First run with Bengali
      const bnResult = (await AIService.analyzeSelection(testSentence, 'sentence')) as any;
      expect(bengaliCharRegex.test(bnResult.bengaliTranslation)).toBe(true);

      // 2. Switch user settings to English
      vi.spyOn(SettingsService, 'getSettings').mockResolvedValue({
        targetLanguage: 'en',
        aiProvider: 'mock'
      } as any);

      // 3. Second run with English — must NOT reuse the Bengali cached result
      const enResult = (await AIService.analyzeSelection(testSentence, 'sentence')) as any;
      expect(bengaliCharRegex.test(enResult.bengaliTranslation)).toBe(false);
      expect(enResult.bengaliTranslation).toContain('Researchers are urgently calling for financial resources');
      expect(bengaliCharRegex.test(enResult.sentenceStructure.explanationBengali)).toBe(false);
    });
  });
});

describe('Teaching language fallback', () => {
  it('uses English, not Bengali, for languages without hand-written grammar text', async () => {
    const { teachingLanguage, getSentenceOverviewTeaching, buildBeginnerBreakdownSections } = await import('../grammarL10n');
    expect(teachingLanguage('ur')).toBe('en');
    expect(teachingLanguage('ja')).toBe('en');
    expect(teachingLanguage('hi')).toBe('hi');
    expect(teachingLanguage('bn')).toBe('bn');
    const overview = getSentenceOverviewTeaching('compound', 'ar');
    expect(overview.explanation).not.toMatch(/[\u0980-\u09FF]/);
    const sections = buildBeginnerBreakdownSections({ text: 'The bank kept rates', subject: 'The bank' }, 'The bank kept rates', 'ja');
    expect(JSON.stringify(sections)).not.toMatch(/[\u0980-\u09FF]/);
  });
});
