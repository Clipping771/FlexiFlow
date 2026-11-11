import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mergeMistakes, mergeActivity, mergeGoals, syncLearnerData, readLocalSnapshot, MISTAKES_KEY } from '../sync';
import type { MistakeMemoryItem } from '../../mistake/client';

beforeEach(() => localStorage.clear());

const item = (code: string, stamp: string, state: MistakeMemoryItem['masteryState'] = 'New'): MistakeMemoryItem => ({
  id: `mm_${code}`,
  errorCode: code,
  masteryState: state,
  totalOccurrences: 1,
  successfulCorrections: 0,
  lastSeenAt: '2026-11-01T00:00:00.000Z',
  nextReviewAt: '2026-11-02',
  nextReviewDays: 1,
  recentOccurrences: [],
  updatedAt: stamp
});

describe('Learner sync merge', () => {
  it('keeps the newest copy of each mistake and the union of codes', () => {
    const merged = mergeMistakes(
      [item('GRA.SUBJ_VERB_AGR', '2026-11-10T00:00:00Z', 'Improving'), item('VOC.FALSE_FRIEND_L1', '2026-11-01T00:00:00Z')],
      [item('GRA.SUBJ_VERB_AGR', '2026-11-09T00:00:00Z', 'New'), item('MEC.SPELLING_ACADEMIC', '2026-11-05T00:00:00Z')]
    );
    expect(merged).toHaveLength(3);
    expect(merged.find((m) => m.errorCode === 'GRA.SUBJ_VERB_AGR')?.masteryState).toBe('Improving');
  });

  it('activity keeps the larger count per day; goals keep the newest', () => {
    expect(mergeActivity({ d: { review: 5, drill: 0, practice: 2 } }, { d: { review: 3, drill: 4, practice: 0 }, e: { review: 1, drill: 0, practice: 0 } })).toEqual({
      d: { review: 5, drill: 4, practice: 2 },
      e: { review: 1, drill: 0, practice: 0 }
    });
    const a = { level: 'B1' as const, focus: ['reading' as const], dailyMinutes: 15 as const, reminderTime: null, updatedAt: '2026-11-01' };
    const b = { ...a, level: 'B2' as const, updatedAt: '2026-11-05' };
    expect(mergeGoals(a, b)?.level).toBe('B2');
    expect(mergeGoals(null, a)).toBe(a);
    expect(mergeGoals(a, null)).toBe(a);
  });

  it('pulls, merges, saves locally and pushes the merged snapshot', async () => {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify([item('GRA.SUBJ_VERB_AGR', '2026-11-10T00:00:00Z')]));
    const fetcher = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return new Response('{}', { status: 200 });
      return new Response(JSON.stringify({ data: { mistakes: [item('VOC.FALSE_FRIEND_L1', '2026-11-03T00:00:00Z')], goals: null, activity: {} } }), { status: 200 });
    });
    expect(await syncLearnerData(fetcher)).toBe('synced');
    expect(readLocalSnapshot().mistakes.map((m) => m.errorCode).sort()).toEqual(['GRA.SUBJ_VERB_AGR', 'VOC.FALSE_FRIEND_L1']);
    const pushed = JSON.parse(String((fetcher.mock.calls[1][1] as RequestInit).body));
    expect(pushed.mistakes).toHaveLength(2);
  });

  it('fails safely without touching local data', async () => {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify([item('GRA.SUBJ_VERB_AGR', '2026-11-10T00:00:00Z')]));
    expect(await syncLearnerData(async () => new Response('{}', { status: 500 }))).toBe('failed');
    expect(await syncLearnerData(async () => new Response(JSON.stringify({ data: { mistakes: 'x' } }), { status: 200 }))).toBe('failed');
    expect(await syncLearnerData(async () => {
      throw new Error('offline');
    })).toBe('failed');
    expect(readLocalSnapshot().mistakes).toHaveLength(1);
  });
});
