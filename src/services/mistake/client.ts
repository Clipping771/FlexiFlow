import { MistakeStateMachine, MasteryState } from './stateMachine';
import { TaxonomyService } from '../taxonomy/catalog';
import { sessionPassed } from './drills';
import { FSRSEngine } from '../fsrs/engine';
import type { FSRSItemState, FSRSRating } from '../../types';

export interface ErrorOccurrenceRecord {
  id: string;
  taskId: string;
  evidenceText: string;
  contextSnippet?: string;
  createdAt: string;
}

export interface MistakeMemoryItem {
  id: string;
  errorCode: string;
  masteryState: MasteryState;
  totalOccurrences: number;
  successfulCorrections: number;
  lastSeenAt: string;
  masteredAt?: string;
  nextReviewAt: string;
  nextReviewDays: number;
  recentOccurrences: ErrorOccurrenceRecord[];
  /** Drill sessions finished for this mistake (varies the sentences each time) */
  practiceSessions?: number;
  /** FSRS memory state: sets how long until the next review */
  fsrs?: FSRSItemState;
  /** Last change of any kind (used to merge with LexiFlow Cloud) */
  updatedAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** FSRS rating for a drill session: failed = Again, passed with a slip = Hard, all right = Good */
export function ratingForSession(correct: number, total: number): FSRSRating {
  if (!sessionPassed(correct, total)) return 1;
  return correct === total ? 3 : 2;
}

/** Whole days until an FSRS review date, at least one */
export function daysUntil(nextReview: string, now: Date): number {
  return Math.max(1, Math.round((new Date(nextReview).getTime() - now.getTime()) / DAY_MS));
}

export interface DrillSessionOutcome {
  item: MistakeMemoryItem;
  passed: boolean;
  /** False when the session passed before the review date, so it did not move the mistake forward */
  counted: boolean;
}

/** YYYY-MM-DD in UTC, the same format as `nextReviewAt` */
export function isoDay(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** A mistake is due when its review date has arrived */
export function isDue(item: MistakeMemoryItem, now = new Date()): boolean {
  return !!item.nextReviewAt && item.nextReviewAt <= isoDay(now);
}

export interface MistakeStats {
  total: number;
  byState: Record<MasteryState, number>;
  byCategory: Record<string, number>;
  masteredPercentage: number;
}

const STORAGE_KEY = 'lexiflow_mistake_memories';

export class MistakeMemoryClient {
  private static notifyChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lexiflow_mistakes_updated'));
    }
  }

  static getMistakes(): MistakeMemoryItem[] {
    try {
      // Only the learner's own mistakes: a new learner starts with an empty list
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static getStats(): MistakeStats {
    const items = this.getMistakes();
    const byState: Record<MasteryState, number> = {
      New: 0,
      Practising: 0,
      Improving: 0,
      Mastered: 0,
      Reopened: 0
    };
    const byCategory: Record<string, number> = {};

    for (const item of items) {
      byState[item.masteryState] = (byState[item.masteryState] || 0) + 1;
      const category = item.errorCode.split('.')[0] || 'OTHER';
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    const total = items.length;
    const masteredPercentage = total > 0 ? Math.round((byState.Mastered / total) * 100) : 0;

    return { total, byState, byCategory, masteredPercentage };
  }

  static recordOccurrence(
    errorCode: string,
    taskId: string,
    evidenceText: string,
    contextSnippet?: string
  ): MistakeMemoryItem {
    if (!TaxonomyService.isValidCode(errorCode)) {
      throw new Error(`Invalid taxonomy error code: ${errorCode}`);
    }

    const items = this.getMistakes();
    const existingIndex = items.findIndex((i) => i.errorCode === errorCode);
    const now = new Date();
    const isoNow = now.toISOString();

    const newOccurrence: ErrorOccurrenceRecord = {
      id: `occ_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      evidenceText,
      contextSnippet,
      createdAt: isoNow
    };

    let updatedItem: MistakeMemoryItem;

    if (existingIndex === -1) {
      const transition = MistakeStateMachine.onOccurrence(undefined, 0, 0);
      const dueDate = MistakeStateMachine.calculateDueDate(transition.nextReviewDays, now);

      updatedItem = {
        id: `mm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        errorCode,
        masteryState: transition.nextState,
        totalOccurrences: transition.occurrences,
        successfulCorrections: 0,
        lastSeenAt: isoNow,
        nextReviewAt: dueDate,
        nextReviewDays: transition.nextReviewDays,
        recentOccurrences: [newOccurrence]
      };
      items.unshift(updatedItem);
    } else {
      const existing = items[existingIndex];
      const transition = MistakeStateMachine.onOccurrence(
        existing.masteryState,
        existing.totalOccurrences,
        existing.successfulCorrections
      );
      const dueDate = MistakeStateMachine.calculateDueDate(transition.nextReviewDays, now);

      updatedItem = {
        ...existing,
        // Coming back after mastering is a lapse: FSRS shortens the next intervals
        ...(transition.isRelapse && existing.fsrs
          ? { fsrs: FSRSEngine.scheduleNextReview(existing.fsrs, 1, now) }
          : {}),
        masteryState: transition.nextState,
        totalOccurrences: transition.occurrences,
        successfulCorrections: transition.successfulCorrections,
        lastSeenAt: isoNow,
        nextReviewAt: dueDate,
        nextReviewDays: transition.nextReviewDays,
        recentOccurrences: [newOccurrence, ...(existing.recentOccurrences || [])].slice(0, 10)
      };
      items[existingIndex] = updatedItem;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyChange();
    return updatedItem;
  }

  static startPractice(errorCode: string): MistakeMemoryItem {
    const items = this.getMistakes();
    const index = items.findIndex((i) => i.errorCode === errorCode);
    if (index === -1) {
      throw new Error(`Mistake memory item not found for error code: ${errorCode}`);
    }

    const current = items[index];
    const transition = MistakeStateMachine.onStartPractice(
      current.masteryState,
      current.totalOccurrences,
      current.successfulCorrections
    );

    const updated: MistakeMemoryItem = {
      ...current,
      masteryState: transition.nextState
    };

    items[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyChange();
    return updated;
  }

  static recordPracticeAttempt(
    errorCode: string,
    isSuccessful: boolean,
    now = new Date(),
    schedule?: { fsrs: FSRSItemState; days: number }
  ): MistakeMemoryItem {
    const items = this.getMistakes();
    const index = items.findIndex((i) => i.errorCode === errorCode);
    if (index === -1) {
      throw new Error(`Mistake memory item not found for error code: ${errorCode}`);
    }

    const current = items[index];
    const transition = MistakeStateMachine.onPracticeAttempt(
      current.masteryState,
      current.totalOccurrences,
      current.successfulCorrections,
      isSuccessful
    );

    // FSRS lengthens intervals as memory grows; the mastery steps (3 days, then 21) are the minimum gap
    const days = schedule ? Math.max(schedule.days, isSuccessful ? transition.nextReviewDays : 1) : transition.nextReviewDays;
    const dueDate = MistakeStateMachine.calculateDueDate(days, now);

    const updated: MistakeMemoryItem = {
      ...current,
      ...(schedule ? { fsrs: schedule.fsrs } : {}),
      masteryState: transition.nextState,
      successfulCorrections: transition.successfulCorrections,
      nextReviewAt: dueDate,
      nextReviewDays: days,
      masteredAt: transition.isNewlyMastered ? now.toISOString() : current.masteredAt
    };

    items[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyChange();
    return updated;
  }

  /** Mistakes whose review date has arrived, most urgent first (came back, then oldest due date) */
  static getDueMistakes(now = new Date()): MistakeMemoryItem[] {
    const rank = (i: MistakeMemoryItem) => (i.masteryState === 'Reopened' ? 0 : i.masteryState === 'Mastered' ? 2 : 1);
    return this.getMistakes()
      .filter((i) => isDue(i, now))
      .sort((a, b) => rank(a) - rank(b) || a.nextReviewAt.localeCompare(b.nextReviewAt));
  }

  /**
   * Records a finished drill session.
   * A session passes with 75% or more right. Spacing is enforced: a pass only moves the mistake towards
   * Mastered when it is due for review (or has never been fixed yet); an early pass is good practice
   * but does not count. A failed session always counts, so the mistake comes back tomorrow.
   */
  static recordDrillSession(
    errorCode: string,
    correct: number,
    total: number,
    now = new Date()
  ): DrillSessionOutcome {
    const items = this.getMistakes();
    const index = items.findIndex((i) => i.errorCode === errorCode);
    if (index === -1) {
      throw new Error(`Mistake memory item not found for error code: ${errorCode}`);
    }
    const current = items[index];
    const passed = sessionPassed(correct, total);
    const counted = !passed || current.successfulCorrections === 0 || isDue(current, now);

    let updated: MistakeMemoryItem;
    if (counted) {
      const fsrs = FSRSEngine.scheduleNextReview(current.fsrs ?? FSRSEngine.createInitialState(), ratingForSession(correct, total), now);
      updated = this.recordPracticeAttempt(errorCode, passed, now, { fsrs, days: passed ? daysUntil(fsrs.nextReview, now) : 1 });
      updated = { ...updated, practiceSessions: (current.practiceSessions || 0) + 1, updatedAt: now.toISOString() };
    } else {
      updated = { ...current, practiceSessions: (current.practiceSessions || 0) + 1, updatedAt: now.toISOString() };
    }

    const latest = this.getMistakes();
    const at = latest.findIndex((i) => i.errorCode === errorCode);
    if (at !== -1) latest[at] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
    this.notifyChange();
    return { item: updated, passed, counted };
  }
}
