/**
 * IELTS Academic Listening Scoring Engine
 * Adheres strictly to Cambridge/IDP Official IELTS Band Descriptors:
 * - Form/Note Completion, Multiple Choice, Map Labeling
 * - Word limit validation (e.g. NO MORE THAN TWO WORDS)
 * - Raw score conversion (0-40) to Band Scale (0.0 to 9.0 in 0.5 increments)
 * - Mandatory "LexiFlow estimate" label
 */

export interface IeltsListeningItemResult {
  questionId: string;
  questionNumber: number;
  userAnswer: string;
  correctAnswer: string | string[];
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
  matchedTaxonomyCode?: string;
}

export interface IeltsListeningEvaluation {
  taskId: string;
  taskType: 'ielts_form_completion' | 'ielts_listening_multiple_choice';
  rawScore: number;
  maxScore: number;
  bandScore: number;
  scoreDisplayLabel: 'LexiFlow estimate';
  itemResults: IeltsListeningItemResult[];
  detectedErrors: string[];
}

/**
 * Converts IELTS Listening raw score (out of 40) into official Band (0.0–9.0).
 */
export function rawScoreToIeltsListeningBand(rawScore: number, maxScore = 40): number {
  if (maxScore <= 0 || rawScore <= 0) return 0.0;
  const normalized40 = Math.round((rawScore / maxScore) * 40);

  if (normalized40 >= 39) return 9.0;
  if (normalized40 >= 37) return 8.5;
  if (normalized40 >= 35) return 8.0;
  if (normalized40 >= 32) return 7.5;
  if (normalized40 >= 30) return 7.0;
  if (normalized40 >= 26) return 6.5;
  if (normalized40 >= 23) return 6.0;
  if (normalized40 >= 18) return 5.5;
  if (normalized40 >= 16) return 5.0;
  if (normalized40 >= 13) return 4.5;
  if (normalized40 >= 10) return 4.0;
  if (normalized40 >= 8) return 3.5;
  if (normalized40 >= 6) return 3.0;
  if (normalized40 >= 4) return 2.5;
  return 2.0;
}

/**
 * Evaluates Form/Note Completion questions with strict word limit checking.
 */
export function evaluateIeltsFormCompletion(
  taskId: string,
  userAnswers: Record<string, string>,
  answerKey: Record<string, { acceptedAnswers: string[]; maxWords: number; explanation: string }>
): IeltsListeningEvaluation {
  const keys = Object.keys(answerKey);
  const maxScore = keys.length;
  let rawScore = 0;
  const itemResults: IeltsListeningItemResult[] = [];
  const detectedErrors: string[] = [];

  keys.forEach((key, index) => {
    const rawUser = (userAnswers[key] || '').trim();
    const cleanUser = rawUser.toLowerCase().replace(/[^\w\s]/g, '');
    const userWords = cleanUser.split(/\s+/).filter(Boolean);
    const config = answerKey[key];

    // Check word limit
    if (userWords.length > config.maxWords) {
      detectedErrors.push('IELTS.LISTENING_WORD_LIMIT_EXCEEDED');
      itemResults.push({
        questionId: key,
        questionNumber: index + 1,
        userAnswer: rawUser || '(blank)',
        correctAnswer: config.acceptedAnswers,
        isCorrect: false,
        earnedPoints: 0,
        maxPoints: 1,
        explanation: `Exceeded word limit: write NO MORE THAN ${config.maxWords} words. You wrote ${userWords.length} words.`,
        matchedTaxonomyCode: 'IELTS.LISTENING_WORD_LIMIT_EXCEEDED'
      });
      return;
    }

    const isMatch = config.acceptedAnswers.some(
      (accepted) => accepted.trim().toLowerCase().replace(/[^\w\s]/g, '') === cleanUser
    );

    if (isMatch) {
      rawScore++;
    } else {
      detectedErrors.push('IELTS.LISTENING_SPELLING_SLIP');
    }

    itemResults.push({
      questionId: key,
      questionNumber: index + 1,
      userAnswer: rawUser || '(blank)',
      correctAnswer: config.acceptedAnswers,
      isCorrect: isMatch,
      earnedPoints: isMatch ? 1 : 0,
      maxPoints: 1,
      explanation: config.explanation,
      matchedTaxonomyCode: isMatch ? undefined : 'IELTS.LISTENING_SPELLING_SLIP'
    });
  });

  const bandScore = rawScoreToIeltsListeningBand(rawScore, maxScore);

  return {
    taskId,
    taskType: 'ielts_form_completion',
    rawScore,
    maxScore,
    bandScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}
