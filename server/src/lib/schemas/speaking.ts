import { z } from 'zod';

export const SpeakingExamType = z.enum(['pte_academic', 'ielts_academic'] as const);
export type SpeakingExamType = z.infer<typeof SpeakingExamType>;

export const PteSpeakingTaskType = z.enum([
  'pte_read_aloud',
  'pte_repeat_sentence',
  'pte_describe_image',
  'pte_retell_lecture',
  'pte_answer_short_question',
  'pte_personal_introduction'
] as const);
export type PteSpeakingTaskType = z.infer<typeof PteSpeakingTaskType>;

export const IeltsSpeakingTaskType = z.enum([
  'ielts_speaking_part_1',
  'ielts_speaking_part_2',
  'ielts_speaking_part_3'
] as const);
export type IeltsSpeakingTaskType = z.infer<typeof IeltsSpeakingTaskType>;

export const SpeakingTaskType = z.union([PteSpeakingTaskType, IeltsSpeakingTaskType]);
export type SpeakingTaskType = z.infer<typeof SpeakingTaskType>;

export const RecordingSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  taskId: z.string().min(1),
  examType: SpeakingExamType,
  audioFormat: z.string().min(1),
  mimeType: z.string().min(1),
  durationMs: z.number().int().positive(),
  sizeBytes: z.number().int().positive(),
  r2Key: z.string().min(1),
  storageUrl: z.string().url(),
  retentionDays: z.number().int().positive().default(90),
  expiresAt: z.string(),
  createdAt: z.string()
});
export type Recording = z.infer<typeof RecordingSchema>;

export const WordTimestampSchema = z.object({
  id: z.string().min(1),
  transcriptId: z.string().min(1),
  wordIndex: z.number().int().nonnegative(),
  word: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).default(1.0),
  pauseBeforeMs: z.number().int().nonnegative().default(0),
  createdAt: z.string()
});
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const TranscriptSchema = z.object({
  id: z.string().min(1),
  recordingId: z.string().min(1),
  userId: z.string().min(1),
  verbatimText: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1.0),
  wpm: z.number().nonnegative().default(0.0),
  language: z.string().default('en'),
  modelUsed: z.string().min(1),
  wordTimestamps: z.array(WordTimestampSchema).optional(),
  createdAt: z.string()
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export const PhonemeIssueSchema = z.object({
  word: z.string().min(1),
  expectedPhoneme: z.string().min(1),
  detectedPhoneme: z.string().min(1),
  position: z.enum(['initial', 'medial', 'final']),
  issueType: z.enum(['substitution', 'omission', 'distortion', 'unnatural_vowel_length'])
});
export type PhonemeIssue = z.infer<typeof PhonemeIssueSchema>;

export const PronunciationEvaluationSchema = z.object({
  id: z.string().min(1),
  recordingId: z.string().min(1),
  userId: z.string().min(1),
  examType: SpeakingExamType,
  taskType: z.string().min(1),
  overallScore: z.string().min(1),               // e.g. '79' for PTE or '7.5' for IELTS
  scoreLabel: z.literal('LexiFlow estimate'),
  pronunciationScore: z.number().nonnegative(),
  fluencyScore: z.number().nonnegative(),
  contentScore: z.number().nonnegative(),
  traitScores: z.record(z.string(), z.number()),
  feedbackMarkdown: z.string().min(1),
  phonemeIssues: z.array(PhonemeIssueSchema).default([]),
  errorCodes: z.array(z.string()).default([]),  // Taxonomy error codes
  rubricVersion: z.string().min(1),
  modelUsed: z.string().min(1),
  createdAt: z.string()
});
export type PronunciationEvaluation = z.infer<typeof PronunciationEvaluationSchema>;
