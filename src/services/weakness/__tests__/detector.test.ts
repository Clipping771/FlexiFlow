import { describe, it, expect } from 'vitest';
import { WeaknessDetector } from '../detector';
import { VocabularyItem } from '../../../types';

describe('Personal Weakness Detector', () => {
  const createBaseItem = (overrides: Partial<VocabularyItem> = {}): VocabularyItem => ({
    id: 'test_vocab_1',
    word: 'scrutiny',
    selectionType: 'word',
    meaning: 'Critical observation or examination.',
    definition: 'Critical observation or examination.',
    bengaliMeaning: 'পুঙ্খানুপুঙ্খ পরীক্ষা',
    dateAdded: '2026-01-01T00:00:00.000Z',
    tags: ['test'],
    collection: 'General',
    difficulty: 'medium',
    fsrs: {
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      nextReview: '2026-01-01T00:00:00.000Z'
    },
    ...overrides
  });

  it('evaluates new word with no review history as score 0 and not weak', () => {
    const item = createBaseItem();
    const signal = WeaknessDetector.calculateWeakness(item);

    expect(signal.score).toBe(0);
    expect(signal.reasons).toEqual([]);
    expect(signal.lapseCount).toBe(0);
    expect(signal.isUserMarkedDifficult).toBe(false);

    const practiceList = WeaknessDetector.getTargetedPracticeList([item]);
    expect(practiceList.length).toBe(0);
  });

  it('evaluates one failed review with 1 lapse appropriately', () => {
    const item = createBaseItem({
      fsrs: {
        stability: 0.5,
        difficulty: 6,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
        lapses: 1,
        state: 'relearning',
        nextReview: '2026-01-02T00:00:00.000Z'
      }
    });

    const signal = WeaknessDetector.calculateWeakness(item);
    expect(signal.score).toBeGreaterThanOrEqual(20);
    expect(signal.lapseCount).toBe(1);
    expect(signal.reasons.some((r) => r.includes('lapse'))).toBe(true);
  });

  it('evaluates repeated Again ratings with higher weighted penalty', () => {
    const item = createBaseItem({
      reviewHistory: [
        { vocabId: 'test_vocab_1', rating: 1, reviewDate: '2026-01-02T00:00:00.000Z' },
        { vocabId: 'test_vocab_1', rating: 1, reviewDate: '2026-01-03T00:00:00.000Z' },
        { vocabId: 'test_vocab_1', rating: 1, reviewDate: '2026-01-04T00:00:00.000Z' }
      ],
      fsrs: {
        stability: 0.2,
        difficulty: 8,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 3,
        lapses: 2,
        state: 'relearning',
        nextReview: '2026-01-04T00:00:00.000Z'
      }
    });

    const signal = WeaknessDetector.calculateWeakness(item);
    expect(signal.score).toBeGreaterThanOrEqual(70);
    expect(signal.againCount).toBe(3);
    expect(signal.reasons.some((r) => r.includes('consecutive') || r.includes('Again') || r.includes('lapses'))).toBe(true);

    const practiceList = WeaknessDetector.getTargetedPracticeList([item]);
    expect(practiceList.length).toBe(1);
    expect(practiceList[0].vocabularyItem.word).toBe('scrutiny');
  });

  it('evaluates multiple recorded lapses with prominent warning and high score', () => {
    const item = createBaseItem({
      fsrs: {
        stability: 1.0,
        difficulty: 7.5,
        elapsedDays: 2,
        scheduledDays: 2,
        reps: 5,
        lapses: 3,
        state: 'relearning',
        nextReview: '2026-01-05T00:00:00.000Z'
      }
    });

    const signal = WeaknessDetector.calculateWeakness(item);
    expect(signal.score).toBeGreaterThanOrEqual(60);
    expect(signal.reasons.some((r) => r.includes('3 recorded memory lapses'))).toBe(true);
  });

  it('incorporates user-marked difficult flag even without many lapses', () => {
    const item = createBaseItem({
      difficulty: 'hard',
      isMarkedDifficult: true
    });

    const signal = WeaknessDetector.calculateWeakness(item);
    expect(signal.score).toBe(35);
    expect(signal.isUserMarkedDifficult).toBe(true);
    expect(signal.reasons.some((r) => r.includes('difficult'))).toBe(true);

    const practiceList = WeaknessDetector.getTargetedPracticeList([item]);
    expect(practiceList.length).toBe(1);
  });

  it('reduces weakness score for items with repeated successful reviews and high stability', () => {
    const item = createBaseItem({
      fsrs: {
        stability: 25.0,
        difficulty: 2.0,
        elapsedDays: 20,
        scheduledDays: 25,
        reps: 6,
        lapses: 0,
        state: 'review',
        nextReview: '2026-02-01T00:00:00.000Z'
      }
    });

    const signal = WeaknessDetector.calculateWeakness(item);
    expect(signal.score).toBe(0);
    expect(signal.retentionEstimate).toBeGreaterThanOrEqual(90);

    const practiceList = WeaknessDetector.getTargetedPracticeList([item]);
    expect(practiceList.length).toBe(0);
  });

  it('safely handles old records with missing optional fields without throwing', () => {
    const incompleteItem = {
      id: 'incomplete_1',
      word: 'ephemeral',
      selectionType: 'word',
      meaning: 'Lasting for a very short time.',
      bengaliMeaning: 'ক্ষণস্থায়ী',
      dateAdded: '2026-01-01T00:00:00.000Z',
      tags: [],
      collection: 'General',
      difficulty: 'medium'
    } as unknown as VocabularyItem;

    expect(() => {
      const signal = WeaknessDetector.calculateWeakness(incompleteItem);
      expect(signal).toBeDefined();
      expect(typeof signal.score).toBe('number');
    }).not.toThrow();
  });

  it('excludes dismissed words from the targeted practice list without deleting record', () => {
    const item = createBaseItem({
      difficulty: 'hard',
      isMarkedDifficult: true,
      dismissedFromWeakness: true
    });

    const practiceList = WeaknessDetector.getTargetedPracticeList([item]);
    expect(practiceList.length).toBe(0);
  });
});
