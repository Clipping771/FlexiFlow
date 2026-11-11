import { describe, expect, it, vi } from 'vitest';
import {
  validateSpeakingDuration,
  calculateSpeechRateWpm,
  evaluateFluencyThreshold
} from '../deterministicRules';
import {
  roundToIeltsSpeakingBand,
  calculateIeltsSpeakingBand
} from '../rubrics';
import { evaluateIeltsSpeakingPart2 } from '../evaluator';

describe('IELTS Academic Speaking Engine (Part 1, 2, 3)', () => {
  describe('1. Deterministic Speaking Checks & Fluency WPM', () => {
    it('detects short audio (<3s) and Part 2 under-time (<60s)', () => {
      const tooShort = validateSpeakingDuration(1, 2000);
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.fatalErrorCode).toBe('IELTS.AUDIO_TOO_SHORT');

      // Part 2 under 60 seconds gets 1.0 band deduction on FC
      const underTimeP2 = validateSpeakingDuration(2, 45000);
      expect(underTimeP2.isValid).toBe(true);
      expect(underTimeP2.penaltyBandDeduction).toBe(1.0);

      // Part 2 optimal (~105 seconds) has 0 penalty
      const optimalP2 = validateSpeakingDuration(2, 105000);
      expect(optimalP2.isValid).toBe(true);
      expect(optimalP2.penaltyBandDeduction).toBe(0.0);
    });

    it('calculates WPM accurately and evaluates fluency band ceilings', () => {
      // 130 words in 60 seconds = 130 WPM
      const wpm130 = calculateSpeechRateWpm(130, 60000);
      expect(wpm130).toBe(130);
      expect(evaluateFluencyThreshold(wpm130).fluencyBandCeiling).toBe(9.0);

      // 65 words in 60 seconds = 65 WPM (<80 WPM caps at 5.0)
      const wpm65 = calculateSpeechRateWpm(65, 60000);
      expect(wpm65).toBe(65);
      expect(evaluateFluencyThreshold(wpm65).fluencyBandCeiling).toBe(5.0);
    });
  });

  describe('2. Official IELTS Speaking Band Rounding', () => {
    it('rounds raw fractional criteria to nearest 0.5 band', () => {
      expect(roundToIeltsSpeakingBand(6.125)).toBe(6.0);
      expect(roundToIeltsSpeakingBand(6.25)).toBe(6.5);
      expect(roundToIeltsSpeakingBand(6.75)).toBe(7.0);

      const criteria = {
        fluencyCoherence: 7.0,
        lexicalResource: 7.5,
        grammaticalAccuracy: 7.0,
        pronunciation: 7.0
      };
      // (7.0 + 7.5 + 7.0 + 7.0) / 4 = 7.125 -> 7.0
      expect(calculateIeltsSpeakingBand(criteria).overallBand).toBe(7.0);
    });
  });

  describe('3. Evaluator Orchestration & Rule Compliance', () => {
    it('short-circuits trivial audio (<3s) deterministically to Band 1.0 with "LexiFlow estimate"', async () => {
      const aiCaller = vi.fn();
      const result = await evaluateIeltsSpeakingPart2('Describe a teacher', 'Very short', { durationMs: 2000 }, { aiCaller });

      expect(aiCaller).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('1.0');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.errorCodes).toContain('IELTS.AUDIO_TOO_SHORT');
    });

    it('evaluates sustained Part 2 speech via AI caller with Zod validation', async () => {
      const transcript =
        'I would like to describe an exceptional mentor who inspired my interest in computational linguistics.\n\nShe possessed a unique pedagogical approach that made complex abstract concepts accessible and engaging.\n\nHer dedication profoundly shaped my academic aspirations.';
      const paddedTranscript = new Array(150).fill('fluent academic explanation').join(' ') + '\n\n' + transcript;

      const mockAiCaller = vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          fluencyCoherence: 7.5,
          lexicalResource: 7.5,
          grammaticalAccuracy: 7.0,
          pronunciation: 7.5,
          feedbackSummary: 'Spoke fluently with minimal hesitation and excellent lexical control.',
          strengths: ['Idiomatic phrasing', 'Natural intonation'],
          weaknesses: [],
          detectedErrorCodes: []
        }),
        tokensUsed: 480,
        costUsd: 0.00019
      });

      const result = await evaluateIeltsSpeakingPart2('Describe a mentor', paddedTranscript, { durationMs: 100000 }, {
        aiCaller: mockAiCaller,
        modelName: 'gemini-2.0-flash'
      });

      expect(mockAiCaller).toHaveBeenCalled();
      // (7.5 + 7.5 + 7.0 + 7.5) / 4 = 7.375 -> 7.5
      expect(result.overallScore).toBe('7.5');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.tokensUsed).toBe(480);
    });
  });
});
