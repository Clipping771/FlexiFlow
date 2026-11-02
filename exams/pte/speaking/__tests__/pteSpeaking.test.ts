import { describe, expect, it, vi } from 'vitest';
import {
  validateSpeakingAudio,
  alignWords,
  calculateRaContentScore,
  calculateRsContentScore
} from '../deterministicRules';
import { calculatePteSpeakingScore } from '../rubrics';
import {
  evaluateReadAloud,
  evaluateRepeatSentence,
  evaluateAnswerShortQuestion
} from '../evaluator';

describe('PTE Academic Speaking Engine (RA, RS, ASQ)', () => {
  describe('1. Deterministic Audio Checks & Word Alignment', () => {
    it('rejects audio under 1.2s or initial silence over 3s deterministically', () => {
      const tooShort = validateSpeakingAudio(800);
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.fatalErrorCode).toBe('PTE.AUDIO_TOO_SHORT');

      const timeoutSilence = validateSpeakingAudio(12000, 40000, 3200);
      expect(timeoutSilence.isValid).toBe(false);
      expect(timeoutSilence.fatalErrorCode).toBe('PTE.INITIAL_SILENCE_TIMEOUT');

      const validAudio = validateSpeakingAudio(15000, 40000, 500);
      expect(validAudio.isValid).toBe(true);
    });

    it('calculates word alignment and omissions deterministically', () => {
      const prompt = 'The agricultural sector contributes significantly to economic stability.';
      const spoken = 'The agricultural sector contributes to economic stability.'; // omitted 'significantly'

      const alignment = alignWords(prompt, spoken);
      expect(alignment.matchCount).toBe(7);
      expect(alignment.promptWordCount).toBe(8);
      expect(alignment.omittedWords).toEqual(['significantly']);
    });

    it('calculates RA and RS Content scores according to Pearson guides', () => {
      // RA content (0-5)
      expect(calculateRaContentScore(0.96)).toBe(5);
      expect(calculateRaContentScore(0.85)).toBe(4);
      expect(calculateRaContentScore(0.65)).toBe(3);
      expect(calculateRaContentScore(0.10)).toBe(0);

      // RS content (0-3: 100% -> 3, >=50% -> 2, <50% -> 1)
      expect(calculateRsContentScore(1.0)).toBe(3);
      expect(calculateRsContentScore(0.65)).toBe(2);
      expect(calculateRsContentScore(0.35)).toBe(1);
      expect(calculateRsContentScore(0.0)).toBe(0);
    });
  });

  describe('2. Pearson Speaking Rubric Scale Mapping', () => {
    it('maps max traits to 90 Pearson score and fatal zeros to 10', () => {
      const maxRaTraits = { content: 5, pronunciation: 5, oralFluency: 5 };
      expect(calculatePteSpeakingScore(maxRaTraits, 5).overallScore).toBe(90);

      const zeroTraits = { content: 0, pronunciation: 0, oralFluency: 0 };
      const zeroResult = calculatePteSpeakingScore(zeroTraits, 5);
      expect(zeroResult.overallScore).toBe(10);
      expect(zeroResult.isFatalZero).toBe(true);
    });
  });

  describe('3. Evaluator Orchestration & Rule Compliance', () => {
    it('Read Aloud: short-circuits silent audio without calling AI, and labels "LexiFlow estimate"', async () => {
      const aiCaller = vi.fn();
      const result = await evaluateReadAloud('Prompt text', 'Silent', { durationMs: 800 }, { aiCaller });

      expect(aiCaller).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('10');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.errorCodes).toContain('PTE.AUDIO_TOO_SHORT');
    });

    it('Read Aloud: evaluates valid speech via AI caller with Zod validation', async () => {
      const prompt = 'Global trade patterns continue to evolve with emerging technologies.';
      const spoken = 'Global trade patterns continue to evolve with emerging technologies.';

      const mockAiCaller = vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          pronunciation: 4.5,
          oralFluency: 4.8,
          contentAnalysis: 'Articulate delivery with sustained speech rate and natural rhythm.',
          strengths: ['Intelligible phonemes', 'Consistent intonation'],
          weaknesses: [],
          detectedErrorCodes: []
        }),
        tokensUsed: 420,
        costUsd: 0.00018
      });

      const result = await evaluateReadAloud(prompt, spoken, { durationMs: 6500 }, {
        aiCaller: mockAiCaller,
        modelName: 'gemini-2.0-flash'
      });

      expect(mockAiCaller).toHaveBeenCalled();
      expect(result.overallScore).toBe('86'); // (5 + 4.5 + 4.8) / 15 * 80 + 10 = 86
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.tokensUsed).toBe(420);
    });

    it('Repeat Sentence: accurately evaluates partial recall', async () => {
      const prompt = 'Students must complete their laboratory reports by Friday.';
      const spoken = 'Students must complete laboratory reports.';

      const result = await evaluateRepeatSentence(prompt, spoken, { durationMs: 4500 });
      expect(result.overallScore).toBe('68');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
    });

    it('Answer Short Question: scores correct answer as 90 and incorrect as 10', () => {
      const correct = evaluateAnswerShortQuestion(['microscope', 'microscopes'], 'a microscope is used', { durationMs: 2500 });
      expect(correct.overallScore).toBe('90');
      expect(correct.scoreLabel).toBe('LexiFlow estimate');

      const incorrect = evaluateAnswerShortQuestion(['microscope'], 'telescope', { durationMs: 2500 });
      expect(incorrect.overallScore).toBe('10');
      expect(incorrect.scoreLabel).toBe('LexiFlow estimate');
      expect(incorrect.errorCodes).toContain('PTE.ASQ_INCORRECT');
    });
  });
});
