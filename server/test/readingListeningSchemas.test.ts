import { describe, expect, it } from 'vitest';
import {
  PassageSchema,
  ReadingListeningQuestionSchema,
  ReadingListeningAttemptSchema
} from '../src/lib/schemas/readingListening';

describe('TICKET LF-014: Reading & Listening Zod Schemas', () => {
  it('1. Successfully validates a Passage schema', () => {
    const validPassage = {
      id: 'pas_pte_01',
      examType: 'pte_academic',
      section: 'reading',
      taskType: 'pte_reorder_paragraphs',
      title: 'Solar Energy Transformation',
      textContent: 'Solar panels convert sunlight directly into electricity.',
      wordCount: 120,
      createdAt: '2026-11-01T00:00:00Z'
    };

    const parsed = PassageSchema.safeParse(validPassage);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.examType).toBe('pte_academic');
      expect(parsed.data.wordCount).toBe(120);
    }
  });

  it('2. Successfully validates ReadingListeningQuestion with multiple options and array answers', () => {
    const validQuestion = {
      id: 'rlq_100',
      passageId: 'pas_pte_01',
      questionNumber: 1,
      questionType: 'multiple_choice_multiple',
      prompt: 'Which two advantages of solar panels are mentioned?',
      options: ['Zero carbon emissions', 'Low installation cost', 'Scalability'],
      correctAnswer: ['Zero carbon emissions', 'Scalability'],
      explanation: 'Lines 2 and 4 directly state emission-free generation and scalable deployment.',
      points: 2,
      createdAt: '2026-11-01T00:00:00Z'
    };

    const parsed = ReadingListeningQuestionSchema.safeParse(validQuestion);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.points).toBe(2);
      expect(parsed.data.options.length).toBe(3);
    }
  });

  it('3. Validates ReadingListeningAttempt with mandatory "LexiFlow estimate" label and error codes', () => {
    const validAttempt = {
      id: 'rla_999',
      userId: 'usr_abc',
      passageId: 'pas_pte_01',
      examType: 'ielts_academic',
      section: 'listening',
      taskType: 'ielts_form_completion',
      rawScore: 9,
      maxScore: 10,
      scaledScore: 8.0,
      scoreDisplayLabel: 'LexiFlow estimate',
      timeSpentSeconds: 450,
      rawResponses: { q1: 'Oakridge Avenue', q2: '94827361' },
      itemResults: [
        {
          questionId: 'q1',
          questionNumber: 1,
          userAnswer: 'Oakridge Avenue',
          correctAnswer: 'Oakridge Avenue',
          isCorrect: true,
          earnedPoints: 1,
          maxPoints: 1,
          explanation: 'Exact street address correctly matched.'
        }
      ],
      taxonomyCodes: ['IELTS.LISTENING_SPELLING_SLIP'],
      createdAt: '2026-11-01T00:10:00Z'
    };

    const parsed = ReadingListeningAttemptSchema.safeParse(validAttempt);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scoreDisplayLabel).toBe('LexiFlow estimate');
      expect(parsed.data.scaledScore).toBe(8.0);
    }

    // Attempting invalid score display label must fail
    const invalidAttempt = { ...validAttempt, scoreDisplayLabel: 'Official IELTS Score' };
    const invalidParsed = ReadingListeningAttemptSchema.safeParse(invalidAttempt);
    expect(invalidParsed.success).toBe(false);
  });
});
