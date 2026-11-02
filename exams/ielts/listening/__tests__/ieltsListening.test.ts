import { describe, expect, it } from 'vitest';
import { rawScoreToIeltsListeningBand, evaluateIeltsFormCompletion } from '../scorer';

describe('TICKET LF-016: IELTS Listening Scoring Engine', () => {
  it('1. Band converter accurately maps raw score ranges to official IELTS Listening scale', () => {
    expect(rawScoreToIeltsListeningBand(39, 40)).toBe(9.0);
    expect(rawScoreToIeltsListeningBand(35, 40)).toBe(8.0);
    expect(rawScoreToIeltsListeningBand(30, 40)).toBe(7.0);
    expect(rawScoreToIeltsListeningBand(23, 40)).toBe(6.0);
    expect(rawScoreToIeltsListeningBand(16, 40)).toBe(5.0);
  });

  it('2. Form Completion: rejects answers that violate word count limits', () => {
    const answerKey = {
      q1: {
        acceptedAnswers: ['blue jacket', 'a blue jacket'],
        maxWords: 2,
        explanation: 'Speaker explicitly notes a blue jacket.'
      }
    };

    // User submits 4 words for a 2-word limit
    const userAnswers = { q1: 'wearing a blue jacket' };
    const evalResult = evaluateIeltsFormCompletion('ielts_form_01', userAnswers, answerKey);

    expect(evalResult.rawScore).toBe(0);
    expect(evalResult.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(evalResult.detectedErrors).toContain('IELTS.LISTENING_WORD_LIMIT_EXCEEDED');
  });

  it('3. Form Completion: accepts normalized valid answers and catches spelling mistakes', () => {
    const answerKey = {
      q1: {
        acceptedAnswers: ['Oakridge Avenue'],
        maxWords: 2,
        explanation: 'Street name mentioned in conversation.'
      }
    };

    // Correct normalized match (case-insensitive)
    const evalCorrect = evaluateIeltsFormCompletion('ielts_form_01', { q1: 'oakridge avenue' }, answerKey);
    expect(evalCorrect.rawScore).toBe(1);
    expect(evalCorrect.bandScore).toBe(9.0);

    // Spelling mistake
    const evalTypo = evaluateIeltsFormCompletion('ielts_form_01', { q1: 'Oakridg Avnue' }, answerKey);
    expect(evalTypo.rawScore).toBe(0);
    expect(evalTypo.detectedErrors).toContain('IELTS.LISTENING_SPELLING_SLIP');
  });
});
