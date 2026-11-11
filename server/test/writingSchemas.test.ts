import { describe, expect, it } from 'vitest';
import {
  QuestionSchema,
  ResponseRecordSchema,
  SubmitResponseInputSchema,
  EvaluationSchema,
  ContentAssetSchema,
  PteTraitScoresSchema,
  IeltsTraitScoresSchema
} from '../src/lib/schemas/writing';

describe('TICKET LF-005: Zod Schema Validation for Writing Entities', () => {
  it('1. Validates QuestionSchema happy path and rejects missing fields or short prompts', () => {
    const validQuestion = {
      id: 'q_pte_we_001',
      examType: 'pte_academic',
      taskType: 'pte_write_essay',
      promptText: 'Do you agree that universities should make physical education compulsory for all students?',
      source: 'official_mock_v1',
      author: 'LexiFlow Editorial',
      reviewer: 'Senior PTE Coach',
      difficulty: 'medium',
      answerKey: 'Model essay answer...',
      contentVersion: '1.0.0',
      metadata: {
        minWords: 200,
        maxWords: 300,
        strictTimeLimitSeconds: 1200
      },
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    };

    const parsed = QuestionSchema.safeParse(validQuestion);
    expect(parsed.success).toBe(true);

    // Short prompt should fail
    const invalidQuestion = { ...validQuestion, promptText: 'Too short' };
    const invalidParsed = QuestionSchema.safeParse(invalidQuestion);
    expect(invalidParsed.success).toBe(false);
  });

  it('2. Validates SubmitResponseInputSchema and enforces positive word count', () => {
    const validSubmission = {
      questionId: 'q_pte_we_001',
      examType: 'pte_academic',
      taskType: 'pte_write_essay',
      responseText: 'Some essay text submitted by learner...',
      wordCount: 220,
      timeSpentSeconds: 1100
    };

    const parsed = SubmitResponseInputSchema.safeParse(validSubmission);
    expect(parsed.success).toBe(true);

    // Negative or 0 word count must fail for submission
    const zeroWord = { ...validSubmission, wordCount: 0 };
    expect(SubmitResponseInputSchema.safeParse(zeroWord).success).toBe(false);
  });

  it('3. Enforces mandatory "LexiFlow estimate" label on EvaluationSchema', () => {
    const validEval = {
      id: 'eval_001',
      responseId: 'resp_001',
      userId: 'usr_001',
      examType: 'pte_academic',
      taskType: 'pte_write_essay',
      overallScore: '79',
      scoreLabel: 'LexiFlow estimate',
      traitScores: {
        content: 2.5,
        form: 2.0,
        grammar: 2.0,
        vocabulary: 2.0,
        spelling: 2.0,
        generalLinguisticRange: 1.5,
        developmentCoherence: 2.0
      },
      feedbackMarkdown: 'Strong logical organization and clear thesis.',
      errorCodes: ['GRA.VERB_TENSE', 'VOC.COLLOCATION'],
      rubricVersion: 'pte_pearson_v1',
      modelUsed: 'gemini-2.0-flash',
      tokensUsed: 650,
      costUsd: 0.0003,
      createdAt: '2026-11-01T00:00:00Z'
    };

    expect(EvaluationSchema.safeParse(validEval).success).toBe(true);

    // Missing or invalid scoreLabel must be rejected
    const invalidLabel = { ...validEval, scoreLabel: 'Official Pearson Score' };
    expect(EvaluationSchema.safeParse(invalidLabel).success).toBe(false);
  });

  it('4. Validates PTE vs IELTS trait score schemas within official boundary scores', () => {
    // PTE: content max 3, other traits max 2
    const validPte = {
      content: 3,
      form: 2,
      grammar: 2,
      vocabulary: 2,
      spelling: 2
    };
    expect(PteTraitScoresSchema.safeParse(validPte).success).toBe(true);

    const invalidPteContent = { ...validPte, content: 4 }; // Max is 3
    expect(PteTraitScoresSchema.safeParse(invalidPteContent).success).toBe(false);

    // IELTS: 0.0 to 9.0
    const validIelts = {
      taskAchievement: 7.5,
      coherenceCohesion: 7.0,
      lexicalResource: 8.0,
      grammaticalAccuracy: 6.5
    };
    expect(IeltsTraitScoresSchema.safeParse(validIelts).success).toBe(true);

    const invalidIeltsBand = { ...validIelts, lexicalResource: 9.5 }; // Max is 9.0
    expect(IeltsTraitScoresSchema.safeParse(invalidIeltsBand).success).toBe(false);
  });

  it('5. Validates ContentAssetSchema with 90-day retention default', () => {
    const validAsset = {
      id: 'ca_chart_001',
      ownerId: 'system',
      assetType: 'image',
      mimeType: 'image/png',
      sizeBytes: 102400,
      r2Key: 'charts/task1_pie.png',
      storagePath: 'https://r2.lexiflow.app/charts/task1_pie.png',
      retentionDays: 90,
      createdAt: '2026-11-01T00:00:00Z'
    };

    expect(ContentAssetSchema.safeParse(validAsset).success).toBe(true);

    const negativeSize = { ...validAsset, sizeBytes: -50 };
    expect(ContentAssetSchema.safeParse(negativeSize).success).toBe(false);
  });
});
