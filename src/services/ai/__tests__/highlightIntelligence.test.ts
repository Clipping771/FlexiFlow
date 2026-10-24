import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HighlightIntelligenceService } from '../highlightIntelligence';
import { MockAIProvider } from '../mockProvider';
import { AIService } from '../index';
import { SettingsService } from '../../storage/settings';
import { ARTICLE_FIXTURES } from './fixtures/articleFixtures';
import { HighlightExtractionResult } from '../../../types';

describe('Highlight Intelligence & Pedagogical Value Evaluation Suite', () => {
  beforeEach(async () => {
    AIService.clearCache();
    await SettingsService.updateSettings({
      aiProvider: 'mock',
      apiKey: '',
      targetLanguage: 'bn'
    });
  });

  describe('1. Strict Source Text Grounding', () => {
    it('rejects hallucinated or fabricated terms not present in the article', () => {
      const articleText = 'The monetary policy committee decided to safeguard liquidity in financial markets.';
      const rawCandidates: HighlightExtractionResult = {
        pageTitle: 'Banking News',
        totalAnalyzedWords: 12,
        items: [
          {
            id: 'hl_1',
            text: 'liquidity',
            type: 'word',
            contextSentence: 'The monetary policy committee decided to safeguard liquidity.',
            easyEnglish: 'Available cash',
            easyBengali: 'তারল্য',
            reason: 'Crucial financial concept',
            difficulty: 'hard'
          },
          {
            id: 'hl_2',
            text: 'hallucinated phrase',
            type: 'phrase',
            contextSentence: 'This sentence never existed in the source article at all.',
            easyEnglish: 'Fake meaning',
            easyBengali: 'ভুয়া অর্থ',
            reason: 'Fabricated candidate',
            difficulty: 'medium'
          }
        ]
      };

      const processed = HighlightIntelligenceService.processCandidates(rawCandidates, articleText);
      const texts = processed.items.map((i) => i.text.toLowerCase());

      expect(texts).toContain('liquidity');
      expect(texts).not.toContain('hallucinated phrase');
    });
  });

  describe('2. Trivial Word Rejection', () => {
    it('strictly filters out trivial everyday words even if passed in candidate list', () => {
      const articleText = 'Wearing a beautiful piece of jewelry makes people discover new joy in nice outfits.';
      const rawCandidates: HighlightExtractionResult = {
        pageTitle: 'Jewelry Piece',
        totalAnalyzedWords: 15,
        items: [
          {
            id: 'hl_t1',
            text: 'wearing',
            type: 'word',
            contextSentence: 'Wearing a beautiful piece...',
            easyEnglish: 'putting on clothes',
            easyBengali: 'পরিধান করা',
            reason: 'Common verb',
            difficulty: 'easy'
          },
          {
            id: 'hl_t2',
            text: 'discover',
            type: 'word',
            contextSentence: 'makes people discover new joy...',
            easyEnglish: 'find something',
            easyBengali: 'আবিষ্কার করা',
            reason: 'Common verb',
            difficulty: 'easy'
          },
          {
            id: 'hl_t3',
            text: 'piece',
            type: 'word',
            contextSentence: 'piece of jewelry...',
            easyEnglish: 'an item',
            easyBengali: 'টুকরো বা অংশ',
            reason: 'Common noun',
            difficulty: 'easy'
          },
          {
            id: 'hl_t4',
            text: 'makes',
            type: 'word',
            contextSentence: 'makes people discover...',
            easyEnglish: 'causes',
            easyBengali: 'তৈরি করে',
            reason: 'Common verb',
            difficulty: 'easy'
          }
        ]
      };

      const processed = HighlightIntelligenceService.processCandidates(rawCandidates, articleText);
      expect(processed.items.length).toBe(0);
    });
  });

  describe('3. Multiword Preference & Sub-word Fragment Pruning', () => {
    it('prioritizes complete multiword phrases and prunes isolated sub-word fragments', () => {
      const articleText = 'Contemporary design goes beyond nostalgic homage by reinventing traditional silhouettes.';
      const rawCandidates: HighlightExtractionResult = {
        pageTitle: 'Design Article',
        totalAnalyzedWords: 12,
        items: [
          {
            id: 'hl_p1',
            text: 'goes beyond',
            type: 'phrase',
            contextSentence: 'Contemporary design goes beyond nostalgic homage.',
            easyEnglish: 'Exceeds standard limits',
            easyBengali: 'সীমানা ছাড়িয়ে যায়',
            reason: 'High-utility verb phrase',
            difficulty: 'medium'
          },
          {
            id: 'hl_p2',
            text: 'beyond',
            type: 'word',
            contextSentence: 'Contemporary design goes beyond nostalgic homage.',
            easyEnglish: 'past something',
            easyBengali: 'ছাড়িয়ে',
            reason: 'Isolated preposition',
            difficulty: 'easy'
          },
          {
            id: 'hl_p3',
            text: 'silhouettes',
            type: 'word',
            contextSentence: 'reinventing traditional silhouettes.',
            easyEnglish: 'the contour or shape of garments',
            easyBengali: 'পোশাকের সামগ্রিক অবয়ব',
            reason: 'Key fashion design vocabulary',
            difficulty: 'hard'
          }
        ]
      };

      const processed = HighlightIntelligenceService.processCandidates(rawCandidates, articleText);
      const texts = processed.items.map((i) => i.text.toLowerCase());

      expect(texts).toContain('goes beyond');
      expect(texts).not.toContain('beyond'); // Sub-word fragment must be dropped!
      expect(texts).toContain('silhouettes');
    });
  });

  describe('4. Dynamic Sizing & Sparse Article Handling', () => {
    it('does not force a fixed number of highlights on sparse articles with few learning targets', async () => {
      const sparse = ARTICLE_FIXTURES.sparseElementaryArticle;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(sparse.text, sparse.title);

      // Must NOT pad to 5, 15, or 25 words!
      expect(result.items.length).toBeLessThanOrEqual(2);

      // Must NOT highlight any forbidden trivial words
      const lowerTexts = result.items.map((i) => i.text.toLowerCase());
      for (const forbidden of sparse.forbiddenTrivialWords) {
        expect(lowerTexts).not.toContain(forbidden.toLowerCase());
      }
    });
  });

  describe('5. Genre-Specific Pedagogical Evaluation Fixtures', () => {
    it('evaluates News fixture: identifies diplomatic/geopolitical vocabulary and rejects filler words', async () => {
      const fixture = ARTICLE_FIXTURES.newsAndCurrentAffairs;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(fixture.text, fixture.title);

      const resultTexts = result.items.map((i) => i.text.toLowerCase());

      // Key positive targets identified
      expect(resultTexts.some((t) => t.includes('proliferation'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('sovereignty'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('scrutiny'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('multilateral'))).toBe(true);

      // Forbidden trivial words rejected 100%
      for (const forbidden of fixture.forbiddenTrivialWords) {
        expect(resultTexts).not.toContain(forbidden.toLowerCase());
      }

      // Check scoring
      for (const item of result.items) {
        expect(item.learningValueScore).toBeGreaterThanOrEqual(0.50);
        expect(item.easyEnglish.length).toBeGreaterThan(5);
        expect(item.easyBengali.length).toBeGreaterThan(2);
      }
    });

    it('evaluates Academic fixture: prioritizes research discourse and methodology terms', async () => {
      const fixture = ARTICLE_FIXTURES.academicWriting;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(fixture.text, fixture.title);

      const resultTexts = result.items.map((i) => i.text.toLowerCase());

      expect(resultTexts.some((t) => t.includes('paradigm shift'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('empirical evidence'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('substantiate'))).toBe(true);

      for (const forbidden of fixture.forbiddenTrivialWords) {
        expect(resultTexts).not.toContain(forbidden.toLowerCase());
      }
    });

    it('evaluates Technology fixture: identifies neural architecture and latency bottlenecks', async () => {
      const fixture = ARTICLE_FIXTURES.technologyAndAI;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(fixture.text, fixture.title);

      const resultTexts = result.items.map((i) => i.text.toLowerCase());

      expect(resultTexts.some((t) => t.includes('neural architecture'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('latency bottleneck'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('emerging technologies'))).toBe(true);

      for (const forbidden of fixture.forbiddenTrivialWords) {
        expect(resultTexts).not.toContain(forbidden.toLowerCase());
      }
    });

    it('evaluates Business fixture: identifies monetary policy, liquidity, and supply chain', async () => {
      const fixture = ARTICLE_FIXTURES.businessEconomics;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(fixture.text, fixture.title);

      const resultTexts = result.items.map((i) => i.text.toLowerCase());

      expect(resultTexts.some((t) => t.includes('monetary policy'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('supply chain'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('liquidity'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('volatility'))).toBe(true);

      for (const forbidden of fixture.forbiddenTrivialWords) {
        expect(resultTexts).not.toContain(forbidden.toLowerCase());
      }
    });

    it('evaluates Lifestyle/Culture fixture: identifies traditional drape, blouse pairings, craftsmanship', async () => {
      const fixture = ARTICLE_FIXTURES.lifestyleCulture;
      const provider = new MockAIProvider('bn');
      const result = await provider.extractHighlights(fixture.text, fixture.title);

      const resultTexts = result.items.map((i) => i.text.toLowerCase());

      expect(resultTexts.some((t) => t.includes('traditional drape'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('blouse pairings'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('craftsmanship'))).toBe(true);
      expect(resultTexts.some((t) => t.includes('goes beyond'))).toBe(true);

      // Verifies that 'wearing', 'discover', 'piece' are rejected
      for (const forbidden of fixture.forbiddenTrivialWords) {
        expect(resultTexts).not.toContain(forbidden.toLowerCase());
      }
    });
  });

  describe('6. Real Provider vs Curated Fallback Transparency', () => {
    it('sets sourceMode to curated_offline_fallback when no API key is active', async () => {
      await SettingsService.updateSettings({
        aiProvider: 'mock',
        apiKey: ''
      });

      const fixture = ARTICLE_FIXTURES.newsAndCurrentAffairs;
      const result = await AIService.extractHighlights(fixture.text, fixture.title);

      expect(result.sourceMode).toBe('curated_offline_fallback');
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('sets sourceMode to ai_reasoning when AI provider succeeds', async () => {
      // Mocking GeminiProvider response through HighlightIntelligenceService
      const rawAiResult: HighlightExtractionResult = {
        pageTitle: 'AI Test',
        totalAnalyzedWords: 20,
        sourceMode: 'ai_reasoning',
        articleSummary: 'Summary of article',
        items: [
          {
            id: 'hl_ai_1',
            text: 'multilateral',
            type: 'word',
            contextSentence: 'multilateral negotiations led to peace.',
            easyEnglish: 'Involving multiple nations',
            easyBengali: 'বহুপাক্ষিক',
            reason: 'Central diplomatic concept',
            difficulty: 'hard',
            isArticleCore: true
          }
        ]
      };

      const processed = HighlightIntelligenceService.processCandidates(rawAiResult, 'multilateral negotiations led to peace.');
      processed.sourceMode = 'ai_reasoning';

      expect(processed.sourceMode).toBe('ai_reasoning');
      expect(processed.items[0].text).toBe('multilateral');
      expect(processed.items[0].learningValueScore).toBeGreaterThanOrEqual(0.70);
    });

    it('routes through OllamaProvider when aiProvider is ollama without requiring an API key', async () => {
      await SettingsService.updateSettings({
        aiProvider: 'ollama',
        selectedModel: 'gemma4:31b-cloud',
        apiKey: ''
      });

      const mockHighlightRes = {
        items: [
          {
            id: 'hl_ol_1',
            text: 'landmark treaty',
            type: 'phrase',
            contextSentence: 'Global leaders signed a landmark treaty on AI safety.',
            easyEnglish: 'A historically important agreement.',
            easyBengali: 'যুগান্তকারী চুক্তি',
            reason: 'High-value diplomatic phrase',
            difficulty: 'medium',
            learningValueScore: 0.9,
            isArticleCore: true
          }
        ],
        pageTitle: 'AI Treaty',
        articleSummary: 'Summit leaders sign pact.'
      };

      const ollamaProvider = await AIService.getProvider();
      expect(ollamaProvider.name).toBe('ollama');

      const spy = vi.spyOn(ollamaProvider, 'extractHighlights').mockResolvedValue(mockHighlightRes as any);

      // AIService creates a new provider instance per execution
      const getProviderSpy = vi.spyOn(AIService, 'getProvider').mockResolvedValue(ollamaProvider);

      const result = await AIService.extractHighlights(
        'Global leaders signed a landmark treaty on AI safety.',
        'AI Treaty'
      );

      expect(result.sourceMode).toBe('ai_reasoning');
      expect(result.items.length).toBe(1);
      expect(result.items[0].text).toBe('landmark treaty');

      getProviderSpy.mockRestore();
      spy.mockRestore();
    });

    it('keeps separately chosen adjacent words separate instead of inventing a phrase with a glued meaning', () => {
      const articleText = 'This brings us to the concept of cognitive sovereignty which may become crucial.';
      const rawCandidates: HighlightExtractionResult = {
        pageTitle: 'Future Concepts',
        totalAnalyzedWords: 14,
        items: [
          {
            id: 'hl_1',
            text: 'cognitive',
            type: 'word',
            contextSentence: 'This brings us to the concept of cognitive sovereignty which may become crucial.',
            easyEnglish: 'Related to mental processes and thinking',
            easyBengali: 'জ্ঞানীয় বা চিন্তা সম্পর্কিত',
            reason: 'Academic term',
            difficulty: 'hard'
          },
          {
            id: 'hl_2',
            text: 'sovereignty',
            type: 'word',
            contextSentence: 'This brings us to the concept of cognitive sovereignty which may become crucial.',
            easyEnglish: 'Supreme power or autonomous authority',
            easyBengali: 'সার্বভৌমত্ব বা স্বায়ত্তশাসন',
            reason: 'Political and conceptual term',
            difficulty: 'hard'
          }
        ]
      };

      const processed = HighlightIntelligenceService.processCandidates(rawCandidates, articleText);
      const texts = processed.items.map((i) => i.text.toLowerCase());

      expect(texts).not.toContain('cognitive sovereignty');
      expect(texts).toContain('cognitive');
      expect(texts).toContain('sovereignty');
      // Each keeps the meaning the model gave it
      expect(processed.items.find((i) => i.text === 'sovereignty')?.easyBengali).toBe('সার্বভৌমত্ব বা স্বায়ত্তশাসন');
    });

    it('grounds terms despite curly quotes, line breaks and dashes, but never inside a longer word', () => {
      const articleText = 'Officials won’t back down.\nThey will  pave\nthe way for a long–term deal at the start.';
      const processed = HighlightIntelligenceService.processCandidates(
        {
          items: [
            { id: 'a', text: "won't back down", type: 'phrase', contextSentence: '', easyEnglish: 'refuse to yield', easyBengali: 'x', reason: 'r', difficulty: 'medium' },
            { id: 'b', text: 'pave the way', type: 'idiom', contextSentence: '', easyEnglish: 'make possible', easyBengali: 'x', reason: 'r', difficulty: 'medium' },
            { id: 'c', text: 'long-term', type: 'word', contextSentence: '', easyEnglish: 'lasting', easyBengali: 'x', reason: 'r', difficulty: 'hard' },
            { id: 'd', text: 'tart', type: 'word', contextSentence: '', easyEnglish: 'pastry', easyBengali: 'x', reason: 'r', difficulty: 'hard' }
          ]
        },
        articleText
      );
      const texts = processed.items.map((i) => i.text);
      expect(texts).toEqual(expect.arrayContaining(["won't back down", 'pave the way', 'long-term']));
      expect(texts).not.toContain('tart'); // only appears inside "start"
    });

    it('does not throw on terms containing regex characters', () => {
      expect(() =>
        HighlightIntelligenceService.processCandidates(
          {
            items: [
              { id: 'a', text: 'C++', type: 'word', contextSentence: '', easyEnglish: 'language', easyBengali: 'x', reason: 'r', difficulty: 'hard' },
              { id: 'b', text: 'compilers', type: 'word', contextSentence: '', easyEnglish: 'tools', easyBengali: 'x', reason: 'r', difficulty: 'hard' }
            ]
          },
          'Modern C++ compilers (and others) optimise aggressively.'
        )
      ).not.toThrow();
    });

    it('weighs the model’s own learning-value score', () => {
      const base = { id: 'a', text: 'mitigation', type: 'word' as const, contextSentence: '', easyEnglish: 'e', easyBengali: 'b', reason: 'r', difficulty: 'medium' as const };
      const low = HighlightIntelligenceService.calculateLearningValueScore({ ...base, learningValueScore: 0.1 });
      const high = HighlightIntelligenceService.calculateLearningValueScore({ ...base, learningValueScore: 0.95 });
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('Article chunking', () => {
    it('keeps short articles whole and splits long ones between paragraphs within the size limit', async () => {
      const { splitArticleIntoChunks } = await import('../highlightIntelligence');
      expect(splitArticleIntoChunks('Short text.', 100, 4)).toEqual(['Short text.']);

      const para = 'Sentence one is here. Sentence two follows it.';
      const article = Array.from({ length: 10 }, () => para).join('\n\n');
      const chunks = splitArticleIntoChunks(article, 120, 10);
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) expect(c.length).toBeLessThanOrEqual(120);
      expect(chunks.join('\n\n').replace(/\s+/g, ' ')).toBe(article.replace(/\s+/g, ' '));

      expect(splitArticleIntoChunks(article, 120, 2).length).toBe(2);
    });

    it('sends every chunk of a long article to the AI and merges the results', async () => {
      await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
      const provider = await AIService.getProvider();
      const first = 'The treaty was a watershed moment for regional diplomacy. '.repeat(150);
      const second = 'Critics warned of unintended consequences for small economies. '.repeat(150);
      const article = `${first.trim()}\n\n${second.trim()}`;

      const spy = vi.spyOn(provider, 'extractHighlights').mockImplementation(async (chunk: string) => ({
        items: [
          chunk.includes('watershed')
            ? { id: 'hl_1', text: 'watershed moment', type: 'phrase', contextSentence: '', easyEnglish: 'turning point', easyBengali: 'x', reason: 'r', difficulty: 'hard' }
            : { id: 'hl_1', text: 'unintended consequences', type: 'phrase', contextSentence: '', easyEnglish: 'side effects', easyBengali: 'x', reason: 'r', difficulty: 'hard' }
        ]
      }) as any);
      const getProviderSpy = vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

      const result = await AIService.extractHighlights(article, 'Treaty');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(result.sourceMode).toBe('ai_reasoning');
      expect(result.items.map((i) => i.text)).toEqual(
        expect.arrayContaining(['watershed moment', 'unintended consequences'])
      );
      expect(new Set(result.items.map((i) => i.id)).size).toBe(result.items.length);

      getProviderSpy.mockRestore();
      spy.mockRestore();
    });

    it('says why it fell back to the offline list', async () => {
      await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
      const result = await AIService.extractHighlights('Leaders agreed to pave the way for talks in the wake of the crisis.', 'Talks');
      expect(result.sourceMode).toBe('curated_offline_fallback');
      expect(result.fallbackReason).toBe('no_ai_configured');
    });
  });
});


