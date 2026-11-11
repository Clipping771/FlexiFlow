import { describe, expect, it } from 'vitest';
import {
  RecordingSchema,
  TranscriptSchema,
  WordTimestampSchema,
  PronunciationEvaluationSchema
} from '../src/lib/schemas/speaking';

describe('TICKET LF-009: Zod Schema Validation for Speaking Entities', () => {
  it('1. Validates RecordingSchema happy path and enforces positive duration', () => {
    const validRecording = {
      id: 'rec_01',
      userId: 'usr_01',
      taskId: 'pte_read_aloud_01',
      examType: 'pte_academic',
      audioFormat: 'webm',
      mimeType: 'audio/webm;codecs=opus',
      durationMs: 14200,
      sizeBytes: 98000,
      r2Key: 'audio/rec_01.webm',
      storageUrl: 'https://r2.lexiflow.app/audio/rec_01.webm',
      retentionDays: 90,
      expiresAt: '2027-01-30T00:00:00Z',
      createdAt: '2026-11-01T00:00:00Z'
    };

    expect(RecordingSchema.safeParse(validRecording).success).toBe(true);

    const zeroDuration = { ...validRecording, durationMs: 0 };
    expect(RecordingSchema.safeParse(zeroDuration).success).toBe(false);
  });

  it('2. Validates TranscriptSchema with word timestamps', () => {
    const validTranscript = {
      id: 'tr_01',
      recordingId: 'rec_01',
      userId: 'usr_01',
      verbatimText: 'Renewable energy adoption continues to accelerate globally.',
      confidence: 0.97,
      wpm: 135.2,
      language: 'en',
      modelUsed: 'deepgram-nova-2',
      wordTimestamps: [
        {
          id: 'wt_01',
          transcriptId: 'tr_01',
          wordIndex: 0,
          word: 'Renewable',
          startMs: 200,
          endMs: 700,
          confidence: 0.98,
          pauseBeforeMs: 200,
          createdAt: '2026-11-01T00:00:00Z'
        }
      ],
      createdAt: '2026-11-01T00:00:00Z'
    };

    expect(TranscriptSchema.safeParse(validTranscript).success).toBe(true);
  });

  it('3. Enforces mandatory "LexiFlow estimate" label on PronunciationEvaluationSchema', () => {
    const validEval = {
      id: 'pe_01',
      recordingId: 'rec_01',
      userId: 'usr_01',
      examType: 'pte_academic',
      taskType: 'pte_read_aloud',
      overallScore: '79',
      scoreLabel: 'LexiFlow estimate',
      pronunciationScore: 82,
      fluencyScore: 78,
      contentScore: 90,
      traitScores: {
        content: 5,
        pronunciation: 4.5,
        oralFluency: 4.2
      },
      feedbackMarkdown: 'Clear articulation of polysyllabic words with minimal hesitation.',
      phonemeIssues: [
        {
          word: 'accelerate',
          expectedPhoneme: 'k',
          detectedPhoneme: 's',
          position: 'medial',
          issueType: 'substitution'
        }
      ],
      errorCodes: ['PTE.PRON_PHONEME'],
      rubricVersion: 'pte_speaking_v1',
      modelUsed: 'gemini-2.0-flash',
      createdAt: '2026-11-01T00:00:00Z'
    };

    expect(PronunciationEvaluationSchema.safeParse(validEval).success).toBe(true);

    // Reject non-"LexiFlow estimate" label
    const invalidLabel = { ...validEval, scoreLabel: 'Official Pearson Result' };
    expect(PronunciationEvaluationSchema.safeParse(invalidLabel).success).toBe(false);
  });
});
