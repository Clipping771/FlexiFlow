import { describe, expect, it, vi } from 'vitest';
import {
  countWords,
  checkUnderLengthPenalty,
  detectParagraphStructure
} from '../deterministicRules';
import {
  roundToIeltsBand,
  calculateIeltsTaskBand,
  calculateOverallWritingBand
} from '../rubrics';
import {
  evaluateIeltsTask1,
  evaluateIeltsTask2
} from '../evaluator';

describe('IELTS Academic Writing Engine (Task 1 & Task 2)', () => {
  describe('1. Deterministic Word Count & Underlength Rules', () => {
    it('accurately counts words and detects underlength penalties for Task 1 (150 words) and Task 2 (250 words)', () => {
      // Task 1: optimal >= 150 words
      expect(checkUnderLengthPenalty('ielts_writing_task_1', 165).penaltyBandDeduction).toBe(0.0);

      // Task 1: 130 words (minor underlength -> 0.5 deduction)
      const minorT1 = checkUnderLengthPenalty('ielts_writing_task_1', 130);
      expect(minorT1.penaltyBandDeduction).toBe(0.5);
      expect(minorT1.errorCode).toBe('IELTS.TASK1_UNDER_LENGTH');

      // Task 2: optimal >= 250 words
      expect(checkUnderLengthPenalty('ielts_writing_task_2', 280).penaltyBandDeduction).toBe(0.0);

      // Task 2: 190 words (severe underlength -> 1.0 deduction)
      const severeT2 = checkUnderLengthPenalty('ielts_writing_task_2', 190);
      expect(severeT2.penaltyBandDeduction).toBe(1.0);
      expect(severeT2.errorCode).toBe('IELTS.TASK2_UNDER_LENGTH');
    });

    it('detects paragraph separation', () => {
      const singleBlock = 'First sentence. Second sentence. Third sentence.';
      expect(detectParagraphStructure(singleBlock).hasParagraphs).toBe(false);

      const structuredEssay = 'Introduction paragraph here.\n\nFirst body paragraph with evidence.\n\nSecond body paragraph counter-argument.\n\nConclusion summarising position.';
      expect(detectParagraphStructure(structuredEssay).hasParagraphs).toBe(true);
      expect(detectParagraphStructure(structuredEssay).paragraphCount).toBe(4);
    });
  });

  describe('2. Official IELTS Band Rounding Algorithm', () => {
    it('rounds fractional raw scores strictly according to official IELTS rules', () => {
      // < 0.25 rounds down
      expect(roundToIeltsBand(6.125)).toBe(6.0);
      expect(roundToIeltsBand(6.0)).toBe(6.0);

      // >= 0.25 and < 0.75 rounds to 0.5
      expect(roundToIeltsBand(6.25)).toBe(6.5);
      expect(roundToIeltsBand(6.375)).toBe(6.5);
      expect(roundToIeltsBand(6.5)).toBe(6.5);
      expect(roundToIeltsBand(6.625)).toBe(6.5);

      // >= 0.75 rounds up to next whole band
      expect(roundToIeltsBand(6.75)).toBe(7.0);
      expect(roundToIeltsBand(6.875)).toBe(7.0);
    });

    it('calculates task band from 4 criteria', () => {
      // 7.0 + 7.5 + 7.0 + 6.5 = 28 / 4 = 7.0
      const criteria = {
        taskAchievement: 7.0,
        coherenceCohesion: 7.5,
        lexicalResource: 7.0,
        grammaticalAccuracy: 6.5
      };
      const result = calculateIeltsTaskBand(criteria);
      expect(result.overallBand).toBe(7.0);
    });

    it('aggregates overall writing band with Task 2 weighted 2x', () => {
      // Task 1: 6.0, Task 2: 7.0 -> (6.0 + 14.0) / 3 = 6.666... -> 6.5
      const overall1 = calculateOverallWritingBand(6.0, 7.0);
      expect(overall1.overallBand).toBe(6.5);

      // Task 1: 6.5, Task 2: 7.0 -> (6.5 + 14.0) / 3 = 6.833... -> 7.0
      const overall2 = calculateOverallWritingBand(6.5, 7.0);
      expect(overall2.overallBand).toBe(7.0);
    });
  });

  describe('3. Evaluator Orchestration & Rule Compliance', () => {
    it('short-circuits trivial submissions (< 30 words) deterministically with Band 1.0 and "LexiFlow estimate"', async () => {
      const aiCaller = vi.fn();
      const trivialText = 'Very short essay text.';

      const result = await evaluateIeltsTask2('Prompt', trivialText, { aiCaller });

      expect(aiCaller).not.toHaveBeenCalled();
      expect(result.overallScore).toBe('1.0');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.errorCodes).toContain('IELTS.TASK2_UNDER_LENGTH');
    });

    it('evaluates valid Task 1 report via AI caller, validates with Zod, and returns "LexiFlow estimate"', async () => {
      const mockAiCaller = vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          taskAchievement: 7.5,
          coherenceCohesion: 7.0,
          lexicalResource: 8.0,
          grammaticalAccuracy: 7.5,
          feedbackSummary: 'Clear overview identifying key trends in the bar chart with accurate data reporting.',
          strengths: ['Identified main trends', 'Varied data comparison vocabulary'],
          improvements: ['Combine sentences using participial clauses'],
          detectedErrorCodes: []
        }),
        tokensUsed: 580,
        costUsd: 0.00022
      });

      const report = new Array(165).fill('trend').join(' ') + ' observed.';
      const result = await evaluateIeltsTask1('Bar chart prompt', report, {
        aiCaller: mockAiCaller,
        modelName: 'gemini-2.0-flash'
      });

      expect(mockAiCaller).toHaveBeenCalled();
      // Average: (7.5 + 7.0 + 8.0 + 7.5)/4 = 7.5
      expect(result.overallScore).toBe('7.5');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
      expect(result.tokensUsed).toBe(580);
    });

    it('penalizes Task 2 essays lacking paragraphs by capping Coherence & Cohesion at Band 5.0', async () => {
      const mockAiCaller = vi.fn().mockResolvedValue({
        rawText: JSON.stringify({
          taskAchievement: 7.0,
          coherenceCohesion: 7.5, // Should get capped at 5.0 because essay has no paragraph breaks
          lexicalResource: 7.0,
          grammaticalAccuracy: 7.0,
          feedbackSummary: 'Relevant content but presented as a single monolithic block of text.',
          strengths: [],
          improvements: ['Break text into paragraphs'],
          detectedErrorCodes: []
        }),
        tokensUsed: 600,
        costUsd: 0.00024
      });

      // 260 words without any newline breaks
      const singleBlockEssay = new Array(260).fill('word').join(' ');
      const result = await evaluateIeltsTask2('Discuss both views', singleBlockEssay, {
        aiCaller: mockAiCaller
      });

      expect(result.traitScores.coherenceCohesion).toBe(5.0);
      expect(result.errorCodes).toContain('IELTS.NO_PARAGRAPHS');
      expect(result.scoreLabel).toBe('LexiFlow estimate');
    });
  });
});
