import { describe, expect, it } from 'vitest';
import {
  rawScoreToIeltsReadingBand,
  evaluateIeltsTrueFalseNotGiven,
  evaluateIeltsMatchingHeadings
} from '../scorer';

describe('TICKET LF-016: IELTS Reading Scoring Engine', () => {
  it('1. Band converter accurately maps raw score ranges to official IELTS Band scale', () => {
    expect(rawScoreToIeltsReadingBand(40, 40)).toBe(9.0);
    expect(rawScoreToIeltsReadingBand(37, 40)).toBe(8.5);
    expect(rawScoreToIeltsReadingBand(30, 40)).toBe(7.0);
    expect(rawScoreToIeltsReadingBand(23, 40)).toBe(6.0);
    expect(rawScoreToIeltsReadingBand(15, 40)).toBe(5.0);
    expect(rawScoreToIeltsReadingBand(0, 40)).toBe(0.0);
  });

  it('2. True/False/Not Given: correctly distinguishes factual contradiction vs unmentioned claims', () => {
    const answerKey = {
      q1: { answer: 'TRUE' as const, explanation: 'Directly confirmed in paragraph 1.' },
      q2: { answer: 'NOT GIVEN' as const, explanation: 'The text makes no mention of cost.' }
    };

    // User marks FALSE where the text is NOT GIVEN
    const userAnswers = { q1: 'TRUE', q2: 'FALSE' };
    const evalResult = evaluateIeltsTrueFalseNotGiven('ielts_tf_01', userAnswers, answerKey);

    expect(evalResult.rawScore).toBe(1);
    expect(evalResult.maxScore).toBe(2);
    expect(evalResult.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(evalResult.detectedErrors).toContain('IELTS.READING_TF_CONFUSION');
  });

  it('3. Matching Headings: evaluates paragraph headings accurately', () => {
    const answerKey = {
      pA: { heading: 'iv', paragraph: 'A' },
      pB: { heading: 'ii', paragraph: 'B' }
    };
    const userAnswers = { pA: 'iv', pB: 'ii' };

    const evalResult = evaluateIeltsMatchingHeadings('ielts_head_01', userAnswers, answerKey);
    expect(evalResult.rawScore).toBe(2);
    expect(evalResult.bandScore).toBe(9.0);
    expect(evalResult.detectedErrors.length).toBe(0);
  });
});
