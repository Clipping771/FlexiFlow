import { z } from 'zod';

export const WritingExamType = z.enum(['pte_academic', 'ielts_academic'] as const);
export type WritingExamType = z.infer<typeof WritingExamType>;

export const WritingTaskType = z.enum([
  'pte_write_essay',
  'pte_summarize_written_text',
  'ielts_writing_task_1',
  'ielts_writing_task_2'
] as const);
export type WritingTaskType = z.infer<typeof WritingTaskType>;

export const QuestionDifficulty = z.enum(['easy', 'medium', 'hard'] as const);
export type QuestionDifficulty = z.infer<typeof QuestionDifficulty>;

export const QuestionMetadataSchema = z.object({
  minWords: z.number().int().nonnegative().optional(),
  maxWords: z.number().int().positive().optional(),
  recommendedTimeMinutes: z.number().int().positive().optional(),
  strictTimeLimitSeconds: z.number().int().positive().optional(),
  chartAssetId: z.string().optional()
});
export type QuestionMetadata = z.infer<typeof QuestionMetadataSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  examType: WritingExamType,
  taskType: WritingTaskType,
  promptText: z.string().min(10),
  source: z.string().min(1),
  author: z.string().min(1),
  reviewer: z.string().min(1),
  difficulty: QuestionDifficulty,
  answerKey: z.string().nullable().optional(),
  contentVersion: z.string().min(1).default('1.0.0'),
  metadata: QuestionMetadataSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Question = z.infer<typeof QuestionSchema>;

export const ResponseStatus = z.enum([
  'draft',
  'submitted',
  'evaluating',
  'evaluated',
  'error'
] as const);
export type ResponseStatus = z.infer<typeof ResponseStatus>;

export const ResponseRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  questionId: z.string().min(1),
  examType: WritingExamType,
  taskType: WritingTaskType,
  responseText: z.string(),
  wordCount: z.number().int().nonnegative(),
  timeSpentSeconds: z.number().int().nonnegative(),
  status: ResponseStatus,
  submittedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ResponseRecord = z.infer<typeof ResponseRecordSchema>;

export const SaveDraftInputSchema = z.object({
  responseId: z.string().optional(),
  questionId: z.string().min(1),
  examType: WritingExamType,
  taskType: WritingTaskType,
  responseText: z.string(),
  wordCount: z.number().int().nonnegative(),
  timeSpentSeconds: z.number().int().nonnegative()
});
export type SaveDraftInput = z.infer<typeof SaveDraftInputSchema>;

export const SubmitResponseInputSchema = z.object({
  questionId: z.string().min(1),
  examType: WritingExamType,
  taskType: WritingTaskType,
  responseText: z.string().min(1),
  wordCount: z.number().int().positive(),
  timeSpentSeconds: z.number().int().nonnegative()
});
export type SubmitResponseInput = z.infer<typeof SubmitResponseInputSchema>;

// PTE Pearson Trait Scores (Write Essay: 7 traits; SWT: 4 traits)
export const PteTraitScoresSchema = z.object({
  content: z.number().min(0).max(3),
  form: z.number().min(0).max(2),
  grammar: z.number().min(0).max(2),
  vocabulary: z.number().min(0).max(2),
  spelling: z.number().min(0).max(2).optional(),
  generalLinguisticRange: z.number().min(0).max(2).optional(),
  developmentCoherence: z.number().min(0).max(2).optional()
});
export type PteTraitScores = z.infer<typeof PteTraitScoresSchema>;

// IELTS Official 4 Criteria (Band 0.0–9.0 in 0.5 increments)
export const IeltsTraitScoresSchema = z.object({
  taskAchievement: z.number().min(0).max(9),      // TR for Task 2, TA for Task 1
  coherenceCohesion: z.number().min(0).max(9),
  lexicalResource: z.number().min(0).max(9),
  grammaticalAccuracy: z.number().min(0).max(9)
});
export type IeltsTraitScores = z.infer<typeof IeltsTraitScoresSchema>;

export const EvaluationSchema = z.object({
  id: z.string().min(1),
  responseId: z.string().min(1),
  userId: z.string().min(1),
  examType: WritingExamType,
  taskType: WritingTaskType,
  overallScore: z.string().min(1),               // e.g. '79' or '7.5'
  scoreLabel: z.literal('LexiFlow estimate'),
  traitScores: z.union([PteTraitScoresSchema, IeltsTraitScoresSchema, z.record(z.string(), z.number())]),
  feedbackMarkdown: z.string().min(1),
  errorCodes: z.array(z.string()),              // Taxonomy error codes detected
  rubricVersion: z.string().min(1),
  modelUsed: z.string().min(1),
  tokensUsed: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0.0),
  createdAt: z.string()
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const AssetType = z.enum(['image', 'audio', 'document'] as const);
export type AssetType = z.infer<typeof AssetType>;

export const ContentAssetSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  assetType: AssetType,
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  r2Key: z.string().min(1),
  storagePath: z.string().min(1),
  retentionDays: z.number().int().positive().default(90),
  createdAt: z.string()
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;
