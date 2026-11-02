export type MasteryState = 'New' | 'Practising' | 'Improving' | 'Mastered' | 'Reopened';

export const FSRS_REVIEW_INTERVALS = [1, 3, 7, 21] as const;

export interface StateTransitionResult {
  previousState?: MasteryState;
  nextState: MasteryState;
  occurrences: number;
  successfulCorrections: number;
  nextReviewDays: number;
  isRelapse: boolean;
  isNewlyMastered: boolean;
}

export class MistakeStateMachine {
  /**
   * Called whenever a new occurrence of an error is detected in a learner's submission.
   */
  static onOccurrence(
    currentState?: MasteryState,
    currentOccurrences = 0,
    currentSuccesses = 0
  ): StateTransitionResult {
    const occurrences = currentOccurrences + 1;

    // First time ever seeing this error
    if (!currentState) {
      return {
        previousState: undefined,
        nextState: 'New',
        occurrences,
        successfulCorrections: 0,
        nextReviewDays: 1,
        isRelapse: false,
        isNewlyMastered: false
      };
    }

    // Relapse: error was previously Mastered, but appeared again!
    if (currentState === 'Mastered') {
      return {
        previousState: 'Mastered',
        nextState: 'Reopened',
        occurrences,
        successfulCorrections: 0, // Reset correction streak on relapse
        nextReviewDays: 1,
        isRelapse: true,
        isNewlyMastered: false
      };
    }

    // Already in progress (New, Practising, Improving, Reopened)
    return {
      previousState: currentState,
      nextState: currentState,
      occurrences,
      successfulCorrections: currentSuccesses,
      nextReviewDays: currentState === 'Improving' ? 3 : 1,
      isRelapse: false,
      isNewlyMastered: false
    };
  }

  /**
   * Called when a learner enters the Improvement Lab to actively practice an error.
   */
  static onStartPractice(
    currentState: MasteryState,
    currentOccurrences: number,
    currentSuccesses: number
  ): StateTransitionResult {
    return {
      previousState: currentState,
      nextState: 'Practising',
      occurrences: currentOccurrences,
      successfulCorrections: currentSuccesses,
      nextReviewDays: 1,
      isRelapse: false,
      isNewlyMastered: false
    };
  }

  /**
   * Called when a learner completes a practice drill for an error.
   * Requirement: At least 2 successful corrections needed to graduate to Mastered.
   */
  static onPracticeAttempt(
    currentState: MasteryState,
    currentOccurrences: number,
    currentSuccesses: number,
    isSuccessful: boolean
  ): StateTransitionResult {
    if (!isSuccessful) {
      return {
        previousState: currentState,
        nextState: 'Practising',
        occurrences: currentOccurrences,
        successfulCorrections: Math.max(0, currentSuccesses - 1),
        nextReviewDays: 1, // Repeat tomorrow
        isRelapse: false,
        isNewlyMastered: false
      };
    }

    const successes = currentSuccesses + 1;

    if (successes >= 2) {
      return {
        previousState: currentState,
        nextState: 'Mastered',
        occurrences: currentOccurrences,
        successfulCorrections: successes,
        nextReviewDays: 21, // 21-day retention check
        isRelapse: false,
        isNewlyMastered: true
      };
    }

    return {
      previousState: currentState,
      nextState: 'Improving',
      occurrences: currentOccurrences,
      successfulCorrections: successes,
      nextReviewDays: 3, // 3-day interval
      isRelapse: false,
      isNewlyMastered: false
    };
  }

  /**
   * Calculates the ISO-8601 YYYY-MM-DD due date given an interval in days.
   */
  static calculateDueDate(intervalDays: number, fromDate = new Date()): string {
    const due = new Date(fromDate);
    due.setUTCDate(due.getUTCDate() + intervalDays);
    return due.toISOString().split('T')[0];
  }
}
