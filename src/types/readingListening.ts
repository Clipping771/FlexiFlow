export type ExamType = 'pte_academic' | 'ielts_academic';
export type Section = 'reading' | 'listening';

export interface Passage {
  id: string;
  examType: ExamType;
  section: Section;
  taskType: string;
  title: string;
  textContent: string;
  audioUrl?: string | null;
  durationSeconds?: number | null;
  wordCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ReadingListeningQuestion {
  id: string;
  passageId: string;
  questionNumber: number;
  questionType: string;
  prompt: string;
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
  createdAt?: string;
}

export interface ItemResult {
  questionId: string;
  questionNumber: number;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
  matchedTaxonomyCode?: string;
}

export interface ReadingListeningAttempt {
  id: string;
  userId: string;
  passageId: string;
  examType: ExamType;
  section: Section;
  taskType: string;
  rawScore: number;
  maxScore: number;
  scaledScore: number;
  scoreDisplayLabel: 'LexiFlow estimate';
  timeSpentSeconds: number;
  rawResponses: Record<string, string | string[]>;
  itemResults: ItemResult[];
  taxonomyCodes: string[];
  createdAt: string;
}
