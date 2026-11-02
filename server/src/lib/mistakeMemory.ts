import { ApiError } from './errors';
import { TaxonomyService } from '../../../src/services/taxonomy/catalog';
import { MistakeStateMachine, MasteryState } from '../../../src/services/mistake/stateMachine';

export interface OccurrenceParams {
  userId: string;
  errorCode: string;
  taskId: string;
  evidenceText: string;
  contextSnippet?: string;
  detectedByModel?: string;
}

export interface PracticeAttemptParams {
  userId: string;
  errorCode: string;
  isSuccessful: boolean;
}

export class MistakeMemoryDbService {
  /**
   * Records an error occurrence in D1 database and advances the learner's mistake state.
   */
  static async recordOccurrence(db: D1Database, params: OccurrenceParams) {
    const { userId, errorCode, taskId, evidenceText, contextSnippet, detectedByModel = 'ai_model' } = params;

    if (!TaxonomyService.isValidCode(errorCode)) {
      throw new ApiError(400, 'INVALID_REQUEST', `Unknown error_code: ${errorCode}`);
    }

    const now = new Date();
    const isoNow = now.toISOString();

    // 1. Insert occurrence audit record
    const occId = `occ_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db
      .prepare(
        `INSERT INTO error_occurrences (
           id, user_id, error_code, taxonomy_version, task_id, evidence_text, corrected_text, context_snippet, detected_by_model, created_at
         ) VALUES (?1, ?2, ?3, '1.0.0', ?4, ?5, NULL, ?6, ?7, ?8)`
      )
      .bind(occId, userId, errorCode, taskId, evidenceText, contextSnippet ?? '', detectedByModel, isoNow)
      .run();

    // 2. Fetch existing mistake memory row
    const existing = await db
      .prepare(
        `SELECT id, mastery_state, total_occurrences, successful_corrections
         FROM mistake_memories WHERE user_id = ?1 AND error_code = ?2`
      )
      .bind(userId, errorCode)
      .first<{
        id: string;
        mastery_state: MasteryState;
        total_occurrences: number;
        successful_corrections: number;
      }>();

    let memoryId: string;
    let transitionResult;

    if (!existing) {
      transitionResult = MistakeStateMachine.onOccurrence(undefined, 0, 0);
      memoryId = `mm_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

      await db
        .prepare(
          `INSERT INTO mistake_memories (
             id, user_id, error_code, mastery_state, total_occurrences, successful_corrections, last_seen_at, mastered_at, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?7, ?7)`
        )
        .bind(
          memoryId,
          userId,
          errorCode,
          transitionResult.nextState,
          transitionResult.occurrences,
          transitionResult.successfulCorrections,
          isoNow
        )
        .run();

      // Initialize review schedule
      const revId = `rev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const dueDate = MistakeStateMachine.calculateDueDate(transitionResult.nextReviewDays, now);
      await db
        .prepare(
          `INSERT INTO review_schedules (
             id, mistake_memory_id, user_id, due_date, interval_days, stability, difficulty, retrievability, repetitions, last_reviewed_at, created_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, 1.0, 5.0, 1.0, 0, NULL, ?6)`
        )
        .bind(revId, memoryId, userId, dueDate, transitionResult.nextReviewDays, isoNow)
        .run();
    } else {
      memoryId = existing.id;
      transitionResult = MistakeStateMachine.onOccurrence(
        existing.mastery_state,
        existing.total_occurrences,
        existing.successful_corrections
      );

      await db
        .prepare(
          `UPDATE mistake_memories
           SET mastery_state = ?1,
               total_occurrences = ?2,
               successful_corrections = ?3,
               last_seen_at = ?4,
               mastered_at = CASE WHEN ?5 = 1 THEN NULL ELSE mastered_at END,
               updated_at = ?4
           WHERE id = ?6`
        )
        .bind(
          transitionResult.nextState,
          transitionResult.occurrences,
          transitionResult.successfulCorrections,
          isoNow,
          transitionResult.isRelapse ? 1 : 0,
          memoryId
        )
        .run();

      // If relapsed, reset review schedule to tomorrow
      if (transitionResult.isRelapse) {
        const dueDate = MistakeStateMachine.calculateDueDate(1, now);
        await db
          .prepare(
            `UPDATE review_schedules
             SET due_date = ?1, interval_days = 1, repetitions = 0
             WHERE mistake_memory_id = ?2`
          )
          .bind(dueDate, memoryId)
          .run();
      }
    }

    return {
      memoryId,
      occurrenceId: occId,
      errorCode,
      transition: transitionResult
    };
  }

  /**
   * Transitions a mistake to 'Practising' state when a learner begins a practice session.
   */
  static async startPractice(db: D1Database, userId: string, errorCode: string) {
    const existing = await db
      .prepare(
        `SELECT id, mastery_state, total_occurrences, successful_corrections
         FROM mistake_memories WHERE user_id = ?1 AND error_code = ?2`
      )
      .bind(userId, errorCode)
      .first<{
        id: string;
        mastery_state: MasteryState;
        total_occurrences: number;
        successful_corrections: number;
      }>();

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', `Mistake memory not found for error code: ${errorCode}`);
    }

    const transition = MistakeStateMachine.onStartPractice(
      existing.mastery_state,
      existing.total_occurrences,
      existing.successful_corrections
    );

    const isoNow = new Date().toISOString();
    await db
      .prepare(
        `UPDATE mistake_memories
         SET mastery_state = 'Practising', updated_at = ?1
         WHERE id = ?2`
      )
      .bind(isoNow, existing.id)
      .run();

    return {
      memoryId: existing.id,
      errorCode,
      transition
    };
  }

  /**
   * Records a learner's drill attempt (success/failure) and updates mastery state & FSRS intervals.
   */
  static async recordPracticeAttempt(db: D1Database, params: PracticeAttemptParams) {
    const { userId, errorCode, isSuccessful } = params;

    const existing = await db
      .prepare(
        `SELECT id, mastery_state, total_occurrences, successful_corrections
         FROM mistake_memories WHERE user_id = ?1 AND error_code = ?2`
      )
      .bind(userId, errorCode)
      .first<{
        id: string;
        mastery_state: MasteryState;
        total_occurrences: number;
        successful_corrections: number;
      }>();

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', `Mistake memory not found for error code: ${errorCode}`);
    }

    const now = new Date();
    const isoNow = now.toISOString();

    const transition = MistakeStateMachine.onPracticeAttempt(
      existing.mastery_state,
      existing.total_occurrences,
      existing.successful_corrections,
      isSuccessful
    );

    await db
      .prepare(
        `UPDATE mistake_memories
         SET mastery_state = ?1,
             successful_corrections = ?2,
             mastered_at = CASE WHEN ?3 = 1 THEN ?4 ELSE mastered_at END,
             updated_at = ?4
         WHERE id = ?5`
      )
      .bind(
        transition.nextState,
        transition.successfulCorrections,
        transition.isNewlyMastered ? 1 : 0,
        isoNow,
        existing.id
      )
      .run();

    // Update FSRS Review Schedule
    const nextDueDate = MistakeStateMachine.calculateDueDate(transition.nextReviewDays, now);
    await db
      .prepare(
        `UPDATE review_schedules
         SET due_date = ?1,
             interval_days = ?2,
             repetitions = repetitions + 1,
             last_reviewed_at = ?3
         WHERE mistake_memory_id = ?4`
      )
      .bind(nextDueDate, transition.nextReviewDays, isoNow, existing.id)
      .run();

    return {
      memoryId: existing.id,
      errorCode,
      transition,
      nextDueDate
    };
  }

  /**
   * Fetches full mistake memory summary for the learner.
   */
  static async getLearnerMistakes(db: D1Database, userId: string) {
    const memories = await db
      .prepare(
        `SELECT m.id, m.error_code, m.mastery_state, m.total_occurrences, m.successful_corrections,
                m.last_seen_at, m.mastered_at, r.due_date, r.interval_days
         FROM mistake_memories m
         LEFT JOIN review_schedules r ON r.mistake_memory_id = m.id
         WHERE m.user_id = ?1
         ORDER BY m.last_seen_at DESC`
      )
      .bind(userId)
      .all<{
        id: string;
        error_code: string;
        mastery_state: MasteryState;
        total_occurrences: number;
        successful_corrections: number;
        last_seen_at: string;
        mastered_at: string | null;
        due_date: string | null;
        interval_days: number | null;
      }>();

    const items = (memories.results || []).map((row) => ({
      ...row,
      definition: TaxonomyService.getError(row.error_code)
    }));

    const counts = {
      total: items.length,
      new: items.filter((i) => i.mastery_state === 'New').length,
      practising: items.filter((i) => i.mastery_state === 'Practising').length,
      improving: items.filter((i) => i.mastery_state === 'Improving').length,
      mastered: items.filter((i) => i.mastery_state === 'Mastered').length,
      reopened: items.filter((i) => i.mastery_state === 'Reopened').length
    };

    return {
      counts,
      items
    };
  }
}
