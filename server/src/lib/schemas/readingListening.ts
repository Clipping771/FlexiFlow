import { z } from 'zod';

export const ExamTypeSchema = z.enum(['pte_academic', 'ielts_academic']);
export type ExamType = z.infer<typeof ExamTypeSchema>;

export const SectionSchema = z.enum(['reading', 'listening']);
export type Section = z.infer<typeof SectionSchema>;

export const PassageSchema = z.object({
  id: z.string(),
  examType: ExamTypeSchema,
  section: SectionSchema,
  taskType: z.string(),
  title: z.string(),
  textContent: z.string(),
  audioUrl: z.string().optional().nullable(),
  durationSeconds: z.number().int().optional().nullable(),
  wordCount: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string()
});
export type Passage = z.infer<typeof PassageSchema>;

export const ReadingListeningQuestionSchema = z.object({
  id: z.string(),
  passageId: z.string(),
  questionNumber: z.number().int(),
  questionType: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).default([]),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string(),
  points: z.number().int().default(1),
  createdAt: z.string()
});
export type ReadingListeningQuestion = z.infer<typeof ReadingListeningQuestionSchema>;

export const ItemResultSchema = z.object({
  questionId: z.string(),
  questionNumber: z.number().int(),
  userAnswer: z.union([z.string(), z.array(z.string())]),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  isCorrect: z.boolean(),
  earnedPoints: z.number(),
  maxPoints: z.number(),
  explanation: z.string(),
  matchedTaxonomyCode: z.string().optional()
});
export type ItemResult = z.infer<typeof ItemResultSchema>;

export const ReadingListeningAttemptSchema = z.object({
  id: z.string(),
  userId: z.string(),
  passageId: z.string(),
  examType: ExamTypeSchema,
  section: SectionSchema,
  taskType: z.string(),
  rawScore: z.number(),
  maxScore: z.number(),
  scaledScore: z.number(),
  scoreDisplayLabel: z.literal('LexiFlow estimate').default('LexiFlow estimate'),
  timeSpentSeconds: z.number().int().default(0),
  rawResponses: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  itemResults: z.array(ItemResultSchema),
  taxonomyCodes: z.array(z.string()).default([]),
  createdAt: z.string()
});
export type ReadingListeningAttempt = z.infer<typeof ReadingListeningAttemptSchema>;
