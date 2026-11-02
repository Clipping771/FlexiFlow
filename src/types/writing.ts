export type WritingExamType = 'pte_academic' | 'ielts_academic';

export type WritingTaskType =
  | 'pte_write_essay'
  | 'pte_summarize_written_text'
  | 'ielts_writing_task_1'
  | 'ielts_writing_task_2';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionMetadata {
  minWords?: number;
  maxWords?: number;
  recommendedTimeMinutes?: number;
  strictTimeLimitSeconds?: number;
  chartAssetId?: string;
}

export interface Question {
  id: string;
  examType: WritingExamType;
  taskType: WritingTaskType;
  promptText: string;
  source: string;
  author: string;
  reviewer: string;
  difficulty: QuestionDifficulty;
  answerKey?: string | null;
  contentVersion: string;
  metadata?: QuestionMetadata;
  createdAt: string;
  updatedAt: string;
}

export type ResponseStatus = 'draft' | 'submitted' | 'evaluating' | 'evaluated' | 'error';

export interface ResponseRecord {
  id: string;
  userId: string;
  questionId: string;
  examType: WritingExamType;
  taskType: WritingTaskType;
  responseText: string;
  wordCount: number;
  timeSpentSeconds: number;
  status: ResponseStatus;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PteTraitScores {
  content: number;
  form: number;
  grammar: number;
  vocabulary: number;
  spelling?: number;
  generalLinguisticRange?: number;
  developmentCoherence?: number;
}

export interface IeltsTraitScores {
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalAccuracy: number;
}

export interface Evaluation {
  id: string;
  responseId: string;
  userId: string;
  examType: WritingExamType;
  taskType: WritingTaskType;
  overallScore: string;
  scoreLabel: 'LexiFlow estimate';
  traitScores: PteTraitScores | IeltsTraitScores | Record<string, number>;
  feedbackMarkdown: string;
  errorCodes: string[];
  rubricVersion: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
}
