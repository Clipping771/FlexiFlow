import { fsrs, generatorParameters, Rating, Card, State } from 'ts-fsrs';
import { FSRSRating, FSRSItemState, LearningState } from '../../types';

export class FSRSEngine {
  private static f = fsrs(generatorParameters({ enable_fuzz: false }));

  /**
   * Initialize a new item's FSRS state
   */
  static createInitialState(): FSRSItemState {
    const now = new Date();
    return {
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      nextReview: now.toISOString()
    };
  }

  /**
   * Process a review rating (1: Again, 2: Hard, 3: Good, 4: Easy)
   */
  static scheduleNextReview(currentState: FSRSItemState, rating: FSRSRating, reviewDate: Date = new Date()): FSRSItemState {
    try {
      // Map rating to ts-fsrs Rating
      let tsRating: Rating = Rating.Good;
      if (rating === 1) tsRating = Rating.Again;
      else if (rating === 2) tsRating = Rating.Hard;
      else if (rating === 3) tsRating = Rating.Good;
      else if (rating === 4) tsRating = Rating.Easy;

      // Construct card
      const card: Card = {
        due: new Date(currentState.nextReview || reviewDate),
        stability: currentState.stability,
        difficulty: currentState.difficulty,
        elapsed_days: currentState.elapsedDays,
        scheduled_days: currentState.scheduledDays,
        reps: currentState.reps,
        lapses: currentState.lapses,
        state: currentState.state === 'new' ? State.New :
               currentState.state === 'learning' ? State.Learning :
               currentState.state === 'review' ? State.Review : State.Relearning,
        last_review: currentState.lastReview ? new Date(currentState.lastReview) : undefined,
        learning_steps: 0
      };

      const schedulingCards = this.f.repeat(card, reviewDate);
      const scheduled = schedulingCards[tsRating];

      let newState: LearningState = 'review';
      if (scheduled.card.state === State.New) newState = 'new';
      else if (scheduled.card.state === State.Learning) newState = 'learning';
      else if (scheduled.card.state === State.Review) newState = 'review';
      else if (scheduled.card.state === State.Relearning) newState = 'relearning';

      return {
        stability: Number(scheduled.card.stability.toFixed(2)),
        difficulty: Number(scheduled.card.difficulty.toFixed(2)),
        elapsedDays: scheduled.card.elapsed_days,
        scheduledDays: scheduled.card.scheduled_days,
        reps: scheduled.card.reps,
        lapses: scheduled.card.lapses,
        state: newState,
        lastReview: reviewDate.toISOString(),
        nextReview: scheduled.card.due.toISOString()
      };
    } catch {
      // Robust mathematical fallback
      const now = reviewDate.getTime();
      let nextDays = 1;
      let newReps = currentState.reps + 1;
      let newLapses = currentState.lapses;

      if (rating === 1) {
        nextDays = 0.5; // review again in 12 hours
        newLapses += 1;
      } else if (rating === 2) {
        nextDays = Math.max(1, (currentState.scheduledDays || 1) * 1.2);
      } else if (rating === 3) {
        nextDays = Math.max(2, (currentState.scheduledDays || 1) * 2.2);
      } else if (rating === 4) {
        nextDays = Math.max(4, (currentState.scheduledDays || 1) * 3.5);
      }

      const nextDue = new Date(now + nextDays * 24 * 60 * 60 * 1000);
      return {
        stability: rating >= 3 ? currentState.stability + 1 : Math.max(0.1, currentState.stability * 0.8),
        difficulty: rating === 1 ? Math.min(10, currentState.difficulty + 0.5) : Math.max(1, currentState.difficulty - 0.2),
        elapsedDays: currentState.scheduledDays,
        scheduledDays: Math.round(nextDays),
        reps: newReps,
        lapses: newLapses,
        state: rating === 1 ? 'relearning' : 'review',
        lastReview: reviewDate.toISOString(),
        nextReview: nextDue.toISOString()
      };
    }
  }

  /**
   * Determine if an item is currently due for review
   */
  static isDue(itemState: FSRSItemState, asOf: Date = new Date()): boolean {
    if (!itemState.nextReview) return true;
    return new Date(itemState.nextReview).getTime() <= asOf.getTime();
  }
}
