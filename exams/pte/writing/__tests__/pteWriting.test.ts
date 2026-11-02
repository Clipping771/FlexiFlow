import { describe, expect, it, vi } from 'vitest';
import {
  countWords,
  countSentences,
  evaluatePteEssayForm,
  evaluatePteSwtForm
} from '../deterministicRules';
import {
  calculatePteEssayScore,
  calculatePteSwtScore
} from '../rubrics';
import {
  evaluatePteEssay,
  evaluatePteSwt
} from '../evaluator';

describe('PTE Academic Writing Engine (WE & SWT)', () => {
  describe('1. Deterministic Form & Sentence Boundary Rules', () => {
    it('counts words accurately ignoring punctuation and whitespace', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('Hello world! This is PTE writing.')).toBe(6);
    });

    it('counts sentences accurately without false splits on abbreviations like Dr., e.g., U.S.', () => {
      const singleSentenceWithAbbr =
        'According to Dr. Smith, the U.S. economy grew significantly in 2025, which benefited global trade.';
      expect(countSentences(singleSentenceWithAbbr)).toBe(1);

      const twoSentences =
        'According to Dr. Smith, the economy grew. This benefited global trade.';
      expect(countSentences(twoSentences)).toBe(2);
    });

    it('evaluates PTE Essay Form bounds (200-300 optimal, 120-199/301-380 acceptable, <120/>380 fatal)', () => {
      const words250 = new Array(250).fill('word').join(' ');
      expect(evaluatePteEssayForm(words250).formScore).toBe(2);

      const words150 = new Array(150).fill('word').join(' ');
      const underEval = evaluatePteEssayForm(words150);
      expect(underEval.formScore).toBe(1);
      expect(underEval.errorCode).toBe('PTE.ESSAY_UNDER_LENGTH');

      const words350 = new Array(350).fill('word').join(' ');
      const overEval = evaluatePteEssayForm(words350);
      expect(overEval.formScore).toBe(1);
      expect(overEval.errorCode).toBe('PTE.ESSAY_OVER_LENGTH');

      const words80 = new Array(80).fill('word').join(' ');
      const fatalEval = evaluatePteEssayForm(words80);
      expect(fatalEval.formScore).toBe(0);
      expect(fatalEval.errorCode).toBe('PTE.ESSAY_TOO_SHORT');

      const allCaps = new Array(220).fill('ESSAY IN ALL CAPITAL LETTERS').join(' ');
      const capsEval = evaluatePteEssayForm(allCaps);
      expect(capsEval.formScore).toBe(0);
      expect(capsEval.errorCode).toBe('PTE.ESSAY_FORMAT');
    });

    it('evaluates PTE SWT Form strictly (5-75 words, exactly ONE single sentence)', () => {
      const validSwt =
        'Although renewable energy implementation requires substantial upfront capital investment, its long-term environmental benefits make it indispensable.';
      const evalValid = evaluatePteSwtForm(validSwt);
      expect(evalValid.formScore).toBe(1);
      expect(evalValid.isAcceptable).toBe(true);
      expect(evalValid.sentenceCount).toBe(1);

      const multiSentenceSwt =
        'Renewable energy requires capital investment. However, its environmental benefits make it indispensable.';
      const evalMulti = evaluatePteSwtForm(multiSentenceSwt);
      expect(evalMulti.formScore).toBe(0);
      expect(evalMulti.errorCode).toBe('PTE.SWT_MULTI_SENTENCE');
      expect(evalMulti.sentenceCount).toBe(2);

      const tooShortSwt = 'Energy is good.';
      const evalShort = evaluatePteSwtForm(tooShortSwt);
      expect(evalShort.formScore).toBe(0);
      expect(evalShort.errorCode).toBe('PTE.SWT_UNDER_LENGTH');

      const tooLongSwt = new Array(80).fill('word').join(' ') + '.';
      const evalLong = evaluatePteSwtForm(tooLongSwt);
      expect(evalLong.formScore).toBe(0);
      expect(evalLong.errorCode).toBe('PTE.SWT_OVER_LENGTH');
    });
  });

  describe('2. Pearson Score Rubric Mapping', () => {
    it('calculates Essay Pearson score on 10-90 scale and enforces fatal zero on Form = 0', () => {
      const maxTraits = {
        content: 3,
        form: 2,
        grammar: 2,
        vocabulary: 2,
        spelling: 2,
        generalLinguisticRange: 2,
        developmentCoherence: 2
      };
      const perfectResult = calculatePteEssayScore(maxTraits);
      expect(perfectResult.overallScore).toBe(90);
      expect(perfectResult.isFatalZero).toBe(false);

      // Form = 0 -> fatal zero score = 10
      const zeroForm = { ...maxTraits, form: 0 };
      const zeroFormResult = calculatePteEssayScore(zeroForm);
      expect(zeroFormResult.overallScore).toBe(10);
      expect(zeroFormResult.isFatalZero).toBe(true);

      // Content = 0 -> fatal zero score = 10
      const zeroContent = { ...maxTraits, content: 0 };
      const zeroContentResult = calculatePteEssayScore(zeroContent);
      expect(zeroContentResult.overallScore).toBe(10);
      expect(zeroContentResult.isFatalZero).toBe(true);
    });

    it('calculates SWT Pearson score on 10-90 scale and enforces fatal zero on Form = 0', () => {
      const maxSwt = { content: 2, form: 1, grammar: 2, vocabulary: 2 };
      expect(calculatePteSwtScore(maxSwt).overallScore).toBe(90);

      const zeroForm = { ...maxSwt, form: 0 };
      expect(calculatePteSwtScore(zeroForm).overallScore).toBe(10);
    });
  });

  describe('3. Evaluator Orchestration & Rule Compliance', () => {
    it('short-circuits on fatal Form violation without calling AI, and attaches "LexiFlow estimate"', async () => {
      const aiCaller = vi.fn();
      const tooShortEssay = 'Only five words here now.';

      const result = await evaluatePteEssay('Prompt about climate', tooShortEssay, { aiCaller });

      // AI should NOT be called deterministically
      expect(aiCaller).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('10');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.modelUsed).toBe('deterministic_filter');
      expect(result.errorCodes).toContain('PTE.ESSAY_TOO_SHORT');
    });

    it('evaluates valid essay via AI caller with Zod validation and returns "LexiFlow estimate"', async () => {
      const mockAiCaller = vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          content: 3,
          grammar: 2,
          vocabulary: 2,
          spelling: 2,
          generalLinguisticRange: 2,
          developmentCoherence: 2,
          feedbackSummary: 'Exemplary essay with articulate argumentation.',
          strengths: ['Clear structure', 'Academic vocabulary'],
          improvements: [],
          detectedErrorCodes: []
        }),
        tokensUsed: 620,
        costUsd: 0.00025
      });

      const validEssay = new Array(240).fill('academic').join(' ') + ' argument.';
      const result = await evaluatePteEssay('Prompt on artificial intelligence', validEssay, {
        aiCaller: mockAiCaller,
        modelName: 'gemini-2.0-flash'
      });

      expect(mockAiCaller).toHaveBeenCalled();
      expect(result.overallScore).toBe('90');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.tokensUsed).toBe(620);
      expect(result.costUsd).toBe(0.00025);
    });

    it('rejects multi-sentence SWT deterministically without AI invocation', async () => {
      const aiCaller = vi.fn();
      const multiSentence = 'This is sentence one. This is sentence two.';

      const result = await evaluatePteSwt('Passage on renewable energy', multiSentence, { aiCaller });

      expect(aiCaller).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('10');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.errorCodes).toContain('PTE.SWT_MULTI_SENTENCE');
    });
  });
});
