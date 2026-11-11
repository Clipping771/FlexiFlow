import { z } from 'zod';

/** One Mistake Memory item as the extension stores it (validated before it is saved). */
export const SyncMistakeSchema = z.object({
  id: z.string().min(1).max(64),
  errorCode: z.string().regex(/^[A-Z]+\.[A-Z0-9_]+$/).max(64),
  masteryState: z.enum(['New', 'Practising', 'Improving', 'Mastered', 'Reopened']),
  totalOccurrences: z.number().int().min(0).max(100000),
  successfulCorrections: z.number().int().min(0).max(100000),
  lastSeenAt: z.string().max(40),
  masteredAt: z.string().max(40).optional(),
  nextReviewAt: z.string().max(40),
  nextReviewDays: z.number().min(0).max(36500),
  practiceSessions: z.number().int().min(0).max(100000).optional(),
  updatedAt: z.string().max(40).optional(),
  fsrs: z
    .object({
      stability: z.number(),
      difficulty: z.number(),
      elapsedDays: z.number(),
      scheduledDays: z.number(),
      reps: z.number().int(),
      lapses: z.number().int(),
      state: z.enum(['new', 'learning', 'review', 'relearning']),
      lastReview: z.string().max(40).optional(),
      nextReview: z.string().max(40),
      learningSteps: z.number().int().optional()
    })
    .optional(),
  recentOccurrences: z
    .array(
      z.object({
        id: z.string().max(64),
        taskId: z.string().max(120),
        evidenceText: z.string().max(400),
        contextSnippet: z.string().max(400).optional(),
        createdAt: z.string().max(40)
      })
    )
    .max(10)
});

export const SyncGoalsSchema = z.object({
  level: z.enum(['A2', 'B1', 'B2', 'C1']),
  focus: z.array(z.enum(['reading', 'listening', 'writing', 'speaking', 'vocabulary', 'grammar'])).min(1).max(6),
  dailyMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  updatedAt: z.string().max(40)
});

const DayActivitySchema = z.object({
  review: z.number().int().min(0).max(100000),
  drill: z.number().int().min(0).max(100000),
  practice: z.number().int().min(0).max(100000)
});

export const SyncActivitySchema = z
  .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), DayActivitySchema)
  .refine((r) => Object.keys(r).length <= 400, 'activity: at most 400 days');

export const SyncSnapshotSchema = z.object({
  mistakes: z.array(SyncMistakeSchema).max(500),
  goals: SyncGoalsSchema.nullable().optional(),
  activity: SyncActivitySchema.optional()
});

export type SyncSnapshot = z.infer<typeof SyncSnapshotSchema>;
