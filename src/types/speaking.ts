export type SpeakingExamType = 'pte_academic' | 'ielts_academic';

export type PteSpeakingTaskType =
  | 'pte_read_aloud'
  | 'pte_repeat_sentence'
  | 'pte_describe_image'
  | 'pte_retell_lecture'
  | 'pte_answer_short_question'
  | 'pte_personal_introduction';

export type IeltsSpeakingTaskType =
  | 'ielts_speaking_part_1'
  | 'ielts_speaking_part_2'
  | 'ielts_speaking_part_3';

export type SpeakingTaskType = PteSpeakingTaskType | IeltsSpeakingTaskType;

export interface Recording {
  id: string;
  userId: string;
  taskId: string;
  examType: SpeakingExamType;
  audioFormat: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  r2Key: string;
  storageUrl: string;
  retentionDays: number;
  expiresAt: string;
  createdAt: string;
}

export interface WordTimestamp {
  id: string;
  transcriptId: string;
  wordIndex: number;
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
  pauseBeforeMs: number;
  createdAt: string;
}

export interface Transcript {
  id: string;
  recordingId: string;
  userId: string;
  verbatimText: string;
  confidence: number;
  wpm: number;
  language: string;
  modelUsed: string;
  wordTimestamps?: WordTimestamp[];
  createdAt: string;
}

export interface PhonemeIssue {
  word: string;
  expectedPhoneme: string;
  detectedPhoneme: string;
  position: 'initial' | 'medial' | 'final';
  issueType: 'substitution' | 'omission' | 'distortion' | 'unnatural_vowel_length';
}

export interface PronunciationEvaluation {
  id: string;
  recordingId: string;
  userId: string;
  examType: SpeakingExamType;
  taskType: string;
  overallScore: string;
  scoreLabel: 'LexiFlow estimate';
  pronunciationScore: number;
  fluencyScore: number;
  contentScore: number;
  traitScores: Record<string, number>;
  feedbackMarkdown: string;
  phonemeIssues: PhonemeIssue[];
  errorCodes: string[];
  rubricVersion: string;
  modelUsed: string;
  createdAt: string;
}
