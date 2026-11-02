import { describe, expect, it } from 'vitest';
import {
  evaluatePteReorderParagraphs,
  evaluatePteMultipleChoiceMultiple,
  evaluatePteFillInBlanks
} from '../scorer';

describe('TICKET LF-015: PTE Reading Scoring Engine', () => {
  it('1. Re-order Paragraphs: awards 1 point per correctly sequenced adjacent pair', () => {
    const correctOrder = ['P1', 'P2', 'P3', 'P4']; // pairs: P1->P2, P2->P3, P3->P4 (3 points total)
    const userOrder = ['P1', 'P2', 'P4', 'P3']; // pairs: P1->P2 (yes), P2->P4 (no), P4->P3 (no) -> 1 point

    const evalResult = evaluatePteReorderParagraphs('pte_ro_01', userOrder, correctOrder);
    expect(evalResult.rawScore).toBe(1);
    expect(evalResult.maxScore).toBe(3);
    expect(evalResult.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(evalResult.detectedErrors).toContain('PTE.READING_REORDER_DISCONNECTION');
  });

  it('2. Multiple Choice (Multiple): applies +1 correct, -1 incorrect, with floor at 0', () => {
    const correct = ['OptA', 'OptC'];
    // User picked 1 correct (OptA) and 1 wrong (OptB) -> net 0
    const evalZero = evaluatePteMultipleChoiceMultiple('pte_mcm_01', ['OptA', 'OptB'], correct);
    expect(evalZero.rawScore).toBe(0);
    expect(evalZero.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(evalZero.detectedErrors).toContain('PTE.READING_MCM_INCORRECT_OPTION');

    // User picked both correct -> 2 points
    const evalFull = evaluatePteMultipleChoiceMultiple('pte_mcm_01', ['OptA', 'OptC'], correct);
    expect(evalFull.rawScore).toBe(2);
    expect(evalFull.scaledScore).toBe(90);
  });

  it('3. Fill in Blanks: scores 1 point per blank and detects collocation mismatch', () => {
    const answerKey = { b1: 'crucial', b2: 'sustainable', b3: 'ecosystem' };
    const userAnswers = { b1: 'crucial', b2: 'heavy', b3: 'ecosystem' };

    const evalResult = evaluatePteFillInBlanks('pte_fib_01', 'pte_fill_in_blanks_rw', userAnswers, answerKey);
    expect(evalResult.rawScore).toBe(2);
    expect(evalResult.maxScore).toBe(3);
    expect(evalResult.detectedErrors).toContain('PTE.READING_COLLOCATION_MISMATCH');
    expect(evalResult.itemResults[1].isCorrect).toBe(false);
  });
});
