/**
 * Daily activity and streak. Counts what the learner did each day (reviews, drills, practice
 * questions) and estimates minutes studied from it, deterministically.
 * The last active day is mirrored to chrome.storage.local so the reminder can skip days already done.
 */

export type ActivityKind = 'review' | 'drill' | 'practice';

export interface DayActivity {
  review: number;
  drill: number;
  practice: number;
}

export const ACTIVITY_KEY = 'lexiflow_activity';
export const LAST_ACTIVE_KEY = 'lexiflow_last_active_day';
const KEEP_DAYS = 400;

/** Rough minutes each action takes, used for the daily goal ring */
const MINUTES_PER: Record<ActivityKind, number> = { review: 0.25, drill: 1, practice: 0.75 };

/** Local calendar day, YYYY-MM-DD */
export function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + delta));
}

export function loadActivity(): Record<string, DayActivity> {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function recordActivity(kind: ActivityKind, count = 1, now = new Date()): DayActivity {
  const all = loadActivity();
  const day = localDay(now);
  const prev = all[day];
  const today: DayActivity = { review: prev?.review ?? 0, drill: prev?.drill ?? 0, practice: prev?.practice ?? 0 };
  today[kind] += Math.max(0, count);
  all[day] = today;

  // Keep the history small
  const days = Object.keys(all).sort();
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete all[old];

  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(all));
  } catch {}
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) void chrome.storage.local.set({ [LAST_ACTIVE_KEY]: day });
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lexiflow_activity_updated'));
  return today;
}

export function minutesFor(day: DayActivity | undefined): number {
  if (!day) return 0;
  return Math.round(day.review * MINUTES_PER.review + day.drill * MINUTES_PER.drill + day.practice * MINUTES_PER.practice);
}

function isActive(day: DayActivity | undefined): boolean {
  return Boolean(day && day.review + day.drill + day.practice > 0);
}

/**
 * Consecutive active days ending today, or ending yesterday when today has nothing yet
 * (the streak is not lost until the day is over).
 */
export function currentStreak(now = new Date(), activity = loadActivity()): number {
  let day = localDay(now);
  if (!isActive(activity[day])) day = addDays(day, -1);
  let streak = 0;
  while (isActive(activity[day])) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** The last 7 days, oldest first, for the week strip */
export function lastSevenDays(now = new Date(), activity = loadActivity()): { day: string; active: boolean; minutes: number }[] {
  const today = localDay(now);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, active: isActive(activity[day]), minutes: minutesFor(activity[day]) };
  });
}
