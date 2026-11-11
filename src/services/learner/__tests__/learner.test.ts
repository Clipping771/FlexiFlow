import { describe, it, expect, beforeEach } from 'vitest';
import { loadGoals, saveGoals, LearnerGoalsSchema, GOALS_KEY } from '../goals';
import { recordActivity, currentStreak, lastSevenDays, loadActivity, minutesFor, localDay, ACTIVITY_KEY } from '../activity';
import { nextReminderAt, shouldRemind } from '../../../background/reminder';
import { focusForDay } from '../../../dashboard/components/TodayView';

beforeEach(() => localStorage.clear());

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 0, 0);

describe('Learner goals', () => {
  it('saves and loads valid goals', () => {
    const saved = saveGoals({ level: 'B1', focus: ['speaking', 'vocabulary'], dailyMinutes: 15, reminderTime: '20:30' });
    expect(saved.updatedAt).toBeTruthy();
    expect(loadGoals()).toEqual(saved);
  });

  it('rejects bad goals and ignores corrupted storage', () => {
    expect(() => saveGoals({ level: 'B1', focus: [], dailyMinutes: 15, reminderTime: null })).toThrow();
    expect(LearnerGoalsSchema.safeParse({ level: 'B1', focus: ['reading'], dailyMinutes: 15, reminderTime: '25:00', updatedAt: 'x' }).success).toBe(false);
    localStorage.setItem(GOALS_KEY, '{not json');
    expect(loadGoals()).toBeNull();
    localStorage.setItem(GOALS_KEY, JSON.stringify({ level: 'Z9' }));
    expect(loadGoals()).toBeNull();
  });
});

describe('Activity and streak', () => {
  it('counts activity per day and estimates minutes', () => {
    recordActivity('review', 8, at(2026, 11, 10));
    recordActivity('drill', 4, at(2026, 11, 10));
    recordActivity('practice', 1, at(2026, 11, 10));
    const day = loadActivity()['2026-11-10'];
    expect(day).toEqual({ review: 8, drill: 4, practice: 1 });
    expect(minutesFor(day)).toBe(Math.round(8 * 0.25 + 4 + 0.75));
  });

  it('streak counts consecutive days and survives until the day is over', () => {
    recordActivity('review', 1, at(2026, 11, 8));
    recordActivity('review', 1, at(2026, 11, 9));
    recordActivity('review', 1, at(2026, 11, 10));
    // Nothing yet on the 11th: the streak still shows 3
    expect(currentStreak(at(2026, 11, 11))).toBe(3);
    recordActivity('drill', 1, at(2026, 11, 11));
    expect(currentStreak(at(2026, 11, 11))).toBe(4);
    // A missed day breaks it
    expect(currentStreak(at(2026, 11, 13))).toBe(0);
  });

  it('streak crosses month boundaries', () => {
    recordActivity('review', 1, at(2026, 10, 31));
    recordActivity('review', 1, at(2026, 11, 1));
    expect(currentStreak(at(2026, 11, 1))).toBe(2);
  });

  it('week strip has 7 days ending today', () => {
    recordActivity('practice', 2, at(2026, 11, 11));
    const week = lastSevenDays(at(2026, 11, 11));
    expect(week).toHaveLength(7);
    expect(week[6]).toMatchObject({ day: '2026-11-11', active: true });
    expect(week[0].day).toBe('2026-11-05');
  });

  it('survives corrupted storage', () => {
    localStorage.setItem(ACTIVITY_KEY, 'oops');
    expect(loadActivity()).toEqual({});
    expect(currentStreak()).toBe(0);
    expect(localDay(at(2026, 1, 5))).toBe('2026-01-05');
  });
});

describe('Daily reminder', () => {
  it('schedules for later today, or tomorrow when the time has passed', () => {
    expect(new Date(nextReminderAt('20:00', at(2026, 11, 11, 10))).getDate()).toBe(11);
    const tomorrow = new Date(nextReminderAt('08:00', at(2026, 11, 11, 10)));
    expect(tomorrow.getDate()).toBe(12);
    expect(tomorrow.getHours()).toBe(8);
  });

  it('is skipped on days the learner already studied', () => {
    expect(shouldRemind('2026-11-11', at(2026, 11, 11))).toBe(false);
    expect(shouldRemind('2026-11-10', at(2026, 11, 11))).toBe(true);
    expect(shouldRemind(undefined, at(2026, 11, 11))).toBe(true);
  });
});

describe('Today focus rotation', () => {
  it('rotates through the focus skills day by day', () => {
    const f = ['speaking', 'reading'] as const;
    expect(focusForDay([...f], '2026-11-10')).not.toBe(focusForDay([...f], '2026-11-11'));
    expect(focusForDay([], '2026-11-11')).toBe('reading');
  });
});
