/**
 * Learner goals (general English, no exam): level, focus skills, daily minutes and an optional
 * daily reminder. Kept in localStorage for the dashboard and mirrored to chrome.storage.local so the
 * background worker can schedule the reminder.
 */
import { z } from 'zod';

export const LEVELS = ['A2', 'B1', 'B2', 'C1'] as const;
export const FOCUS_SKILLS = ['reading', 'listening', 'writing', 'speaking', 'vocabulary', 'grammar'] as const;
export const DAILY_MINUTES = [10, 15, 20, 30] as const;

export const LearnerGoalsSchema = z.object({
  level: z.enum(LEVELS),
  focus: z.array(z.enum(FOCUS_SKILLS)).min(1).max(6),
  dailyMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  /** "HH:MM" in local time, or null for no reminder */
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  updatedAt: z.string()
});

export type LearnerGoals = z.infer<typeof LearnerGoalsSchema>;
export type FocusSkill = (typeof FOCUS_SKILLS)[number];

export const GOALS_KEY = 'lexiflow_learner_goals';

export const FOCUS_LABELS: Record<FocusSkill, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
  vocabulary: 'Vocabulary',
  grammar: 'Grammar'
};

export const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  A2: 'A2 · Basic',
  B1: 'B1 · Intermediate',
  B2: 'B2 · Upper intermediate',
  C1: 'C1 · Advanced'
};

export function loadGoals(): LearnerGoals | null {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return null;
    const parsed = LearnerGoalsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Saves goals and asks the background worker to (re)schedule the daily reminder. */
export function saveGoals(goals: Omit<LearnerGoals, 'updatedAt'>): LearnerGoals {
  const full = LearnerGoalsSchema.parse({ ...goals, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(GOALS_KEY, JSON.stringify(full));
  } catch {}
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      void chrome.storage.local.set({ [GOALS_KEY]: full });
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SET_REMINDER', payload: { time: full.reminderTime } }, () => {
        void chrome.runtime?.lastError;
      });
    }
  } catch {}
  return full;
}
