/**
 * Keeps Mistake Memory, goals and daily activity in step with LexiFlow Cloud, so progress survives
 * clearing browser data and follows the learner to another computer.
 * Runs only for signed-in LexiFlow Cloud users. Merge rules (deterministic):
 *  - mistakes: per error code, the most recently changed copy wins; codes from both sides are kept
 *  - activity: per day, the larger count of each kind
 *  - goals: the most recently saved
 */
import { z } from 'zod';
import type { MistakeMemoryItem } from '../mistake/client';
import { ACTIVITY_KEY, type DayActivity } from './activity';
import { GOALS_KEY, LearnerGoalsSchema, type LearnerGoals } from './goals';

export const MISTAKES_KEY = 'lexiflow_mistake_memories';

const RemoteSnapshotSchema = z.object({
  mistakes: z.array(z.object({ errorCode: z.string(), masteryState: z.string() }).passthrough()),
  goals: LearnerGoalsSchema.nullable().optional(),
  activity: z.record(z.string(), z.object({ review: z.number(), drill: z.number(), practice: z.number() })).optional()
});

export interface LearnerSnapshot {
  mistakes: MistakeMemoryItem[];
  goals: LearnerGoals | null;
  activity: Record<string, DayActivity>;
}

/** When a mistake last changed */
export function mistakeStamp(item: MistakeMemoryItem): string {
  return [item.updatedAt, item.lastSeenAt, item.fsrs?.lastReview, item.masteredAt]
    .filter((s): s is string => typeof s === 'string')
    .sort()
    .pop() || '';
}

export function mergeMistakes(local: MistakeMemoryItem[], remote: MistakeMemoryItem[]): MistakeMemoryItem[] {
  const byCode = new Map<string, MistakeMemoryItem>();
  for (const item of [...remote, ...local]) {
    const existing = byCode.get(item.errorCode);
    if (!existing || mistakeStamp(item) >= mistakeStamp(existing)) byCode.set(item.errorCode, item);
  }
  return [...byCode.values()].sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));
}

export function mergeActivity(
  local: Record<string, DayActivity>,
  remote: Record<string, DayActivity>
): Record<string, DayActivity> {
  const out: Record<string, DayActivity> = { ...remote };
  for (const [day, a] of Object.entries(local)) {
    const r = out[day];
    out[day] = r
      ? { review: Math.max(a.review, r.review), drill: Math.max(a.drill, r.drill), practice: Math.max(a.practice, r.practice) }
      : a;
  }
  return out;
}

export function mergeGoals(local: LearnerGoals | null, remote: LearnerGoals | null): LearnerGoals | null {
  if (!local) return remote;
  if (!remote) return local;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

export function mergeSnapshots(local: LearnerSnapshot, remote: LearnerSnapshot): LearnerSnapshot {
  return {
    mistakes: mergeMistakes(local.mistakes, remote.mistakes),
    goals: mergeGoals(local.goals, remote.goals),
    activity: mergeActivity(local.activity, remote.activity)
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readLocalSnapshot(): LearnerSnapshot {
  const goals = LearnerGoalsSchema.safeParse(readJson(GOALS_KEY, null));
  return {
    mistakes: readJson<MistakeMemoryItem[]>(MISTAKES_KEY, []),
    goals: goals.success ? goals.data : null,
    activity: readJson<Record<string, DayActivity>>(ACTIVITY_KEY, {})
  };
}

function writeLocalSnapshot(s: LearnerSnapshot): void {
  try {
    localStorage.setItem(MISTAKES_KEY, JSON.stringify(s.mistakes));
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(s.activity));
    if (s.goals) localStorage.setItem(GOALS_KEY, JSON.stringify(s.goals));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lexiflow_mistakes_updated', { detail: { fromSync: true } }));
    window.dispatchEvent(new CustomEvent('lexiflow_activity_updated', { detail: { fromSync: true } }));
  }
}

export type SyncResult = 'synced' | 'skipped' | 'failed';

/** `fetcher` is AuthService.authorizedFetch (injected so this file stays testable and light) */
export async function syncLearnerData(fetcher: (path: string, init?: RequestInit) => Promise<Response>): Promise<SyncResult> {
  try {
    const res = await fetcher('/v1/sync', { method: 'GET' });
    if (!res.ok) return 'failed';
    const parsed = RemoteSnapshotSchema.safeParse(((await res.json()) as { data?: unknown })?.data);
    if (!parsed.success) return 'failed';
    const remote: LearnerSnapshot = {
      mistakes: parsed.data.mistakes as unknown as MistakeMemoryItem[],
      goals: parsed.data.goals ?? null,
      activity: parsed.data.activity ?? {}
    };
    const merged = mergeSnapshots(readLocalSnapshot(), remote);
    writeLocalSnapshot(merged);
    const put = await fetcher('/v1/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mistakes: merged.mistakes.slice(0, 500), goals: merged.goals, activity: merged.activity })
    });
    return put.ok ? 'synced' : 'failed';
  } catch {
    return 'failed';
  }
}
