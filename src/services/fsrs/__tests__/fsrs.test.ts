import { describe, it, expect } from 'vitest';
import { FSRSEngine } from '../engine';
import { FSRSItemState } from '../../../types';

describe('FSRS Spaced Repetition Engine', () => {
  it('initializes card with state "new"', () => {
    const card = FSRSEngine.createInitialState();
    expect(card.state).toBe('new');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(FSRSEngine.isDue(card)).toBe(true);
  });

  it('schedules subsequent review when rated "Good"', () => {
    const initial = FSRSEngine.createInitialState();
    const reviewed = FSRSEngine.scheduleNextReview(initial, 3); // Good

    expect(reviewed.reps).toBe(1);
    expect(new Date(reviewed.nextReview).getTime()).toBeGreaterThan(Date.now());
  });

  it('handles lapse and increments lapse counter when rated "Again"', () => {
    const initial: FSRSItemState = {
      stability: 4.5,
      difficulty: 3.2,
      elapsedDays: 4,
      scheduledDays: 4,
      reps: 2,
      lapses: 0,
      state: 'review',
      nextReview: new Date().toISOString()
    };

    const failed = FSRSEngine.scheduleNextReview(initial, 1); // Again (forgot)
    expect(failed.lapses).toBe(1);
  });

  it('correctly calculates isDue for past vs future review dates', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour in future

    const cardPast: FSRSItemState = {
      stability: 2,
      difficulty: 2,
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      state: 'review',
      nextReview: pastDate
    };

    const cardFuture: FSRSItemState = {
      ...cardPast,
      nextReview: futureDate
    };

    expect(FSRSEngine.isDue(cardPast)).toBe(true);
    expect(FSRSEngine.isDue(cardFuture)).toBe(false);
  });
});
