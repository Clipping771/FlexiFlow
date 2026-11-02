import { MistakeStateMachine, MasteryState } from './stateMachine';
import { TaxonomyService } from '../taxonomy/catalog';

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

  static recordPracticeAttempt(errorCode: string, isSuccessful: boolean): MistakeMemoryItem {
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

    const now = new Date();
    const dueDate = MistakeStateMachine.calculateDueDate(transition.nextReviewDays, now);

    const updated: MistakeMemoryItem = {
      ...current,
      masteryState: transition.nextState,
      successfulCorrections: transition.successfulCorrections,
      nextReviewAt: dueDate,
      nextReviewDays: transition.nextReviewDays,
      masteredAt: transition.isNewlyMastered ? now.toISOString() : current.masteredAt
    };

    items[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    this.notifyChange();
    return updated;
  }
}
