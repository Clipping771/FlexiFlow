import { describe, it, expect } from 'vitest';
import { FSRSEngine } from '../engine';

describe('FSRS learning steps', () => {
  it('a card answered Good graduates from learning to multi-day review', () => {
    let s = FSRSEngine.createInitialState();
    let now = new Date('2026-01-01T09:00:00Z');
    const days: number[] = [];
    for (let i = 0; i < 5; i++) {
      s = FSRSEngine.scheduleNextReview(s, 3, now);
      days.push((new Date(s.nextReview).getTime() - now.getTime()) / 86400000);
      now = new Date(s.nextReview);
    }
    expect(s.state).toBe('review');
    // Intervals keep growing once the card leaves the learning steps
    expect(days[4]).toBeGreaterThan(days[2]);
    expect(days[4]).toBeGreaterThan(3);
  });

  it('old saved cards without learningSteps still schedule', () => {
    const legacy = { stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: 'new' as const, nextReview: '2026-01-01T09:00:00Z' };
    const next = FSRSEngine.scheduleNextReview(legacy, 3, new Date('2026-01-01T09:00:00Z'));
    expect(typeof next.learningSteps).toBe('number');
  });
});
