import { VocabularyItem, WeaknessSignal, TargetedPracticeItem } from '../../types';

/**
 * Deterministic Personal Weakness Detector for LexiFlow AI
 * 
 * Rules:
 * 1. New words without reviews are NOT classified as weak unless explicitly marked difficult by the user.
 * 2. Repeated lapses (forgetting after previously remembering) carry the highest weight (+20 per lapse, max +60).
 * 3. 'Again' (rating 1) review history adds +15 per occurrence (+25 extra if consecutive).
 * 4. User-marked difficulty ('hard' or isMarkedDifficult) adds +30.
 * 5. Low stability (< 2.0 days) after 3+ repetitions adds +20.
 * 6. High retention / high stability reduces score.
 * 7. Threshold for inclusion in Targeted Practice is score >= 35.
 * 8. Items dismissed by user (dismissedFromWeakness === true) are excluded from active practice list.
 */

export class WeaknessDetector {
  /**
   * Calculate deterministic weakness score and reasons for a vocabulary item
   */
  static calculateWeakness(item: VocabularyItem): WeaknessSignal {
    const fsrs = item.fsrs || {
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      nextReview: new Date().toISOString()
    };

    const reasons: string[] = [];
    let score = 0;

    const lapses = fsrs.lapses || 0;
    const reps = fsrs.reps || 0;
    const isExplicitlyDifficult = item.isMarkedDifficult === true || item.difficulty === 'hard';

    // Count history signals if available
    let againCount = 0;
    let consecutiveAgain = 0;

    if (item.reviewHistory && Array.isArray(item.reviewHistory) && item.reviewHistory.length > 0) {
      for (const log of item.reviewHistory) {
        if (log.rating === 1) againCount++;
      }

      // Check the most recent 2 reviews
      const recent = item.reviewHistory.slice(-2);
      if (recent.length >= 2 && recent.every((r) => r.rating === 1)) {
        consecutiveAgain = 2;
      }
    } else if (lapses > 0) {
      // If review logs not fully logged, each recorded lapse implies at least one Again rating
      againCount = lapses;
    }

    // Rule 1: Brand new items with zero reviews
    if (reps === 0 && lapses === 0 && againCount === 0) {
      if (isExplicitlyDifficult) {
        return {
          score: 35,
          reasons: ['User-flagged as high difficulty before initial review'],
          lapseCount: 0,
          againCount: 0,
          isUserMarkedDifficult: true,
          retentionEstimate: 70
        };
      }
      return {
        score: 0,
        reasons: [],
        lapseCount: 0,
        againCount: 0,
        isUserMarkedDifficult: false,
        retentionEstimate: 95
      };
    }

    // Rule 2: Repeated lapses
    if (lapses > 0) {
      const lapseScore = Math.min(60, lapses * 20);
      score += lapseScore;
      reasons.push(
        lapses === 1
          ? '1 recorded memory lapse after learning'
          : `${lapses} recorded memory lapses during spaced reviews`
      );
    }

    // Rule 3: Again ratings
    if (againCount > 0) {
      const againScore = Math.min(45, againCount * 15);
      score += againScore;
      if (!reasons.some((r) => r.includes('lapses'))) {
        reasons.push(
          againCount === 1
            ? 'Failed 1 review attempt (rated "Again")'
            : `Failed ${againCount} review attempts (repeated "Again" ratings)`
        );
      }
    }

    if (consecutiveAgain >= 2) {
      score += 15;
      reasons.push('Consecutive failed reviews in recent sessions');
    }

    // Rule 4: Explicit user marking
    if (isExplicitlyDifficult) {
      score += 30;
      reasons.push('Marked as difficult word by user');
    }

    // Rule 5: Repetitions without stability gain
    if (reps >= 3 && fsrs.stability < 2.0) {
      score += 20;
      reasons.push(`Low memory stability (${fsrs.stability.toFixed(1)} days) despite ${reps} reviews`);
    }

    // Negative weight: Stable retention
    if (fsrs.stability >= 10 && lapses === 0) {
      score = Math.max(0, score - 30);
    }

    // Clamp score to [0, 100]
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));

    // Approximate retention estimate based on stability and lapses
    let retentionEstimate = 90;
    if (lapses >= 3) retentionEstimate = 45;
    else if (lapses === 2) retentionEstimate = 60;
    else if (lapses === 1) retentionEstimate = 75;
    else if (fsrs.stability >= 7) retentionEstimate = 95;

    return {
      score: finalScore,
      reasons,
      lapseCount: lapses,
      againCount,
      isUserMarkedDifficult: isExplicitlyDifficult,
      retentionEstimate
    };
  }

  /**
   * Generate prioritized list of items for targeted practice
   */
  static getTargetedPracticeList(items: VocabularyItem[]): TargetedPracticeItem[] {
    const list: TargetedPracticeItem[] = [];

    for (const item of items) {
      if (item.dismissedFromWeakness) continue;

      const signal = this.calculateWeakness(item);
      if (signal.score >= 35) {
        let reviewStatus: TargetedPracticeItem['reviewStatus'] = 'review';
        const now = new Date();
        const nextReviewDate = item.fsrs?.nextReview ? new Date(item.fsrs.nextReview) : null;

        if (nextReviewDate && nextReviewDate.getTime() <= now.getTime()) {
          reviewStatus = 'due';
        } else if (item.fsrs?.state === 'learning') {
          reviewStatus = 'learning';
        } else if (item.fsrs?.state === 'relearning') {
          reviewStatus = 'relearning';
        }

        list.push({
          vocabularyItem: item,
          weaknessScore: signal.score,
          reasons: signal.reasons,
          reviewStatus,
          isDismissed: false
        });
      }
    }

    // Sort by weakness score descending (highest priority first)
    list.sort((a, b) => b.weaknessScore - a.weaknessScore);
    return list;
  }
}
