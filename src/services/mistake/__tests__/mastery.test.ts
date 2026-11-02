import { describe, it, expect } from 'vitest';
import { MistakeStateMachine } from '../stateMachine';
import { TaxonomyService } from '../../taxonomy/catalog';

describe('TICKET LF-002: Mistake Memory Mastery Lifecycle & Taxonomy', () => {
  it('1. End-to-End Fake Error Mastery Flow: New -> Practising -> Improving -> Mastered -> Reopened', () => {
    // Step 1: Learner commits a fake error (e.g. GRA.SUBJ_VERB_AGR) for the first time
    const step1 = MistakeStateMachine.onOccurrence(undefined, 0, 0);
    expect(step1.nextState).toBe('New');
    expect(step1.occurrences).toBe(1);
    expect(step1.successfulCorrections).toBe(0);
    expect(step1.isRelapse).toBe(false);

    // Step 2: Learner opens the Improvement Lab to practice
    const step2 = MistakeStateMachine.onStartPractice(step1.nextState, step1.occurrences, step1.successfulCorrections);
    expect(step2.nextState).toBe('Practising');

    // Step 3: Learner completes first practice drill successfully
    const step3 = MistakeStateMachine.onPracticeAttempt(
      step2.nextState,
      step2.occurrences,
      step2.successfulCorrections,
      true
    );
    expect(step3.nextState).toBe('Improving');
    expect(step3.successfulCorrections).toBe(1);
    expect(step3.nextReviewDays).toBe(3);
    expect(step3.isNewlyMastered).toBe(false);

    // Step 4: Learner completes second practice drill successfully after interval
    const step4 = MistakeStateMachine.onPracticeAttempt(
      step3.nextState,
      step3.occurrences,
      step3.successfulCorrections,
      true
    );
    expect(step4.nextState).toBe('Mastered');
    expect(step4.successfulCorrections).toBe(2);
    expect(step4.nextReviewDays).toBe(21);
    expect(step4.isNewlyMastered).toBe(true);

    // Step 5: Relapse! Student commits the same error again in a subsequent exam essay
    const step5 = MistakeStateMachine.onOccurrence(step4.nextState, step4.occurrences, step4.successfulCorrections);
    expect(step5.nextState).toBe('Reopened');
    expect(step5.occurrences).toBe(2);
    expect(step5.successfulCorrections).toBe(0); // Reset on relapse
    expect(step5.isRelapse).toBe(true);
  });

  it('2. Failure during practice resets next review to 1 day and stays in Practising', () => {
    const res = MistakeStateMachine.onPracticeAttempt('Improving', 2, 1, false);
    expect(res.nextState).toBe('Practising');
    expect(res.nextReviewDays).toBe(1);
  });

  it('3. Taxonomy validation: Canonical codes are verified and unknown codes rejected', () => {
    expect(TaxonomyService.isValidCode('GRA.SUBJ_VERB_AGR')).toBe(true);
    expect(TaxonomyService.isValidCode('PTE.SWT_MULTI_SENTENCE')).toBe(true);
    expect(TaxonomyService.isValidCode('IELTS.TASK2_TR_INCOMPLETE')).toBe(true);
    expect(TaxonomyService.isValidCode('NON_EXISTENT.CODE')).toBe(false);

    const error = TaxonomyService.getError('GRA.SUBJ_VERB_AGR');
    expect(error).toBeDefined();
    expect(error?.category).toBe('GRA');
    expect(error?.severity).toBe('high');
    expect(error?.correct_example).toContain('was reviewed');
  });

  it('4. FSRS due date calculation produces ISO YYYY-MM-DD strings', () => {
    const today = new Date('2026-11-01T00:00:00Z');
    expect(MistakeStateMachine.calculateDueDate(1, today)).toBe('2026-11-02');
    expect(MistakeStateMachine.calculateDueDate(3, today)).toBe('2026-11-04');
    expect(MistakeStateMachine.calculateDueDate(7, today)).toBe('2026-11-08');
    expect(MistakeStateMachine.calculateDueDate(21, today)).toBe('2026-11-22');
  });
});
