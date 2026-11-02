/**
 * IELTS Academic Reading Scoring Engine
 * Adheres strictly to Cambridge/IDP Official IELTS Academic Band Descriptors:
 * - True/False/Not Given, Matching Headings, Sentence Completion
 * - Raw score conversion (0-40) to Band Scale (0.0 to 9.0 in 0.5 increments)
 * - Mandatory "LexiFlow estimate" label
 */

export interface IeltsReadingItemResult {
  questionId: string;
  questionNumber: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
  matchedTaxonomyCode?: string;
}

export interface IeltsReadingEvaluation {
  taskId: string;
  taskType: 'ielts_true_false_not_given' | 'ielts_matching_headings' | 'ielts_sentence_completion';
  rawScore: number;
  maxScore: number;
  bandScore: number;
  scoreDisplayLabel: 'LexiFlow estimate';
  itemResults: IeltsReadingItemResult[];
  detectedErrors: string[];
}

/**
 * Converts IELTS Academic Reading raw score (out of 40) into official Band (0.0–9.0).
 * Handles partial sets by proportional normalization.
 */
export function rawScoreToIeltsReadingBand(rawScore: number, maxScore = 40): number {
  if (maxScore <= 0 || rawScore <= 0) return 0.0;
  // Normalize to 40 items
  const normalized40 = Math.round((rawScore / maxScore) * 40);

  if (normalized40 >= 39) return 9.0;
  if (normalized40 >= 37) return 8.5;
  if (normalized40 >= 35) return 8.0;
  if (normalized40 >= 33) return 7.5;
  if (normalized40 >= 30) return 7.0;
  if (normalized40 >= 27) return 6.5;
  if (normalized40 >= 23) return 6.0;
  if (normalized40 >= 19) return 5.5;
  if (normalized40 >= 15) return 5.0;
  if (normalized40 >= 13) return 4.5;
  if (normalized40 >= 10) return 4.0;
  if (normalized40 >= 8) return 3.5;
  if (normalized40 >= 6) return 3.0;
  if (normalized40 >= 4) return 2.5;
  return 2.0;
}

/**
 * Evaluates True/False/Not Given questions.
 * Distinguishes between contradictory (FALSE) and unmentioned (NOT GIVEN).
 */
export function evaluateIeltsTrueFalseNotGiven(
  taskId: string,
  userAnswers: Record<string, string>,
  answerKey: Record<string, { answer: 'TRUE' | 'FALSE' | 'NOT GIVEN'; explanation: string }>
): IeltsReadingEvaluation {
  const keys = Object.keys(answerKey);
  const maxScore = keys.length;
  let rawScore = 0;
  const itemResults: IeltsReadingItemResult[] = [];
  const detectedErrors: string[] = [];

  keys.forEach((key, index) => {
    const userVal = (userAnswers[key] || '').trim().toUpperCase();
    const target = answerKey[key].answer;
    const isCorrect = userVal === target;

    let matchedTaxonomyCode: string | undefined;
    if (isCorrect) {
      rawScore++;
    } else {
      if (
        (userVal === 'FALSE' && target === 'NOT GIVEN') ||
        (userVal === 'NOT GIVEN' && target === 'FALSE')
      ) {
        matchedTaxonomyCode = 'IELTS.READING_TF_CONFUSION';
        detectedErrors.push('IELTS.READING_TF_CONFUSION');
      } else {
        matchedTaxonomyCode = 'IELTS.READING_FACTUAL_CONTRADICTION';
        detectedErrors.push('IELTS.READING_FACTUAL_CONTRADICTION');
      }
    }

    itemResults.push({
      questionId: key,
      questionNumber: index + 1,
      userAnswer: userAnswers[key] || '(blank)',
      correctAnswer: target,
      isCorrect,
      earnedPoints: isCorrect ? 1 : 0,
      maxPoints: 1,
      explanation: answerKey[key].explanation,
      matchedTaxonomyCode
    });
  });

  const bandScore = rawScoreToIeltsReadingBand(rawScore, maxScore);

  return {
    taskId,
    taskType: 'ielts_true_false_not_given',
    rawScore,
    maxScore,
    bandScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}

/**
 * Evaluates Matching Headings tasks.
 */
export function evaluateIeltsMatchingHeadings(
  taskId: string,
  userAnswers: Record<string, string>,
  answerKey: Record<string, { heading: string; paragraph: string }>
): IeltsReadingEvaluation {
  const keys = Object.keys(answerKey);
  const maxScore = keys.length;
  let rawScore = 0;
  const itemResults: IeltsReadingItemResult[] = [];
  const detectedErrors: string[] = [];

  keys.forEach((key, index) => {
    const userVal = (userAnswers[key] || '').trim().toUpperCase();
    const correctHeading = answerKey[key].heading.trim().toUpperCase();
    const isCorrect = userVal === correctHeading;

    if (isCorrect) {
      rawScore++;
    } else {
      detectedErrors.push('IELTS.READING_HEADING_MISMATCH');
    }

    itemResults.push({
      questionId: key,
      questionNumber: index + 1,
      userAnswer: userAnswers[key] || '(blank)',
      correctAnswer: answerKey[key].heading,
      isCorrect,
      earnedPoints: isCorrect ? 1 : 0,
      maxPoints: 1,
      explanation: `Paragraph ${answerKey[key].paragraph}: Correct heading is ${answerKey[key].heading}.`,
      matchedTaxonomyCode: isCorrect ? undefined : 'IELTS.READING_HEADING_MISMATCH'
    });
  });

  const bandScore = rawScoreToIeltsReadingBand(rawScore, maxScore);

  return {
    taskId,
    taskType: 'ielts_matching_headings',
    rawScore,
    maxScore,
    bandScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}
