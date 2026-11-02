/**
 * PTE Academic Reading Scoring Engine
 * Adheres strictly to official Pearson PTE Academic Score Guide:
 * - Re-order Paragraphs: 1 point per correctly sequenced adjacent pair
 * - Multiple Choice (Multiple): +1 correct, -1 incorrect, minimum 0
 * - Fill in the Blanks: 1 point per correct blank
 * - Scale: 10–90 Pearson scale
 */

export interface PteReadingItemResult {
  questionId: string;
  questionNumber: number;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  explanation: string;
  matchedTaxonomyCode?: string;
}

export interface PteReadingEvaluation {
  taskId: string;
  taskType: 'pte_reorder_paragraphs' | 'pte_fill_in_blanks_rw' | 'pte_fill_in_blanks_r' | 'pte_mcm' | 'pte_mcs';
  rawScore: number;
  maxScore: number;
  scaledScore: number;
  scoreDisplayLabel: 'LexiFlow estimate';
  itemResults: PteReadingItemResult[];
  detectedErrors: string[];
}

/**
 * Evaluates PTE Re-order Paragraphs by testing correct adjacent pair sequences.
 * Pearson Rule: 1 point per correctly matched adjacent pair.
 */
export function evaluatePteReorderParagraphs(
  taskId: string,
  userOrder: string[],
  correctOrder: string[]
): PteReadingEvaluation {
  if (correctOrder.length < 2) {
    throw new Error('Correct order must contain at least 2 paragraphs');
  }

  // Generate target adjacent pairs
  const correctPairs = new Set<string>();
  for (let i = 0; i < correctOrder.length - 1; i++) {
    correctPairs.add(`${correctOrder[i]}->${correctOrder[i + 1]}`);
  }

  const maxPoints = correctOrder.length - 1;
  let earnedPoints = 0;
  const itemResults: PteReadingItemResult[] = [];
  const detectedErrors: string[] = [];

  for (let i = 0; i < userOrder.length - 1; i++) {
    const pair = `${userOrder[i]}->${userOrder[i + 1]}`;
    const isPairCorrect = correctPairs.has(pair);
    if (isPairCorrect) {
      earnedPoints++;
    } else {
      detectedErrors.push('PTE.READING_REORDER_DISCONNECTION');
    }

    itemResults.push({
      questionId: `pair_${i + 1}`,
      questionNumber: i + 1,
      earnedPoints: isPairCorrect ? 1 : 0,
      maxPoints: 1,
      isCorrect: isPairCorrect,
      explanation: isPairCorrect
        ? `Correct pair: [${userOrder[i]}] is properly followed by [${userOrder[i + 1]}].`
        : `Incorrect sequence: [${userOrder[i]}] does not logically lead to [${userOrder[i + 1]}].`,
      matchedTaxonomyCode: isPairCorrect ? undefined : 'PTE.READING_REORDER_DISCONNECTION'
    });
  }

  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (earnedPoints / maxPoints) * 80)));

  return {
    taskId,
    taskType: 'pte_reorder_paragraphs',
    rawScore: earnedPoints,
    maxScore: maxPoints,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}

/**
 * Evaluates PTE Multiple Choice (Multiple Answers).
 * Pearson Rule: +1 for correct option, -1 for incorrect option, minimum score 0.
 */
export function evaluatePteMultipleChoiceMultiple(
  taskId: string,
  userSelections: string[],
  correctOptions: string[]
): PteReadingEvaluation {
  const correctSet = new Set(correctOptions);
  const userSet = new Set(userSelections);

  let correctCount = 0;
  let incorrectCount = 0;
  const detectedErrors: string[] = [];

  for (const sel of userSet) {
    if (correctSet.has(sel)) {
      correctCount++;
    } else {
      incorrectCount++;
      detectedErrors.push('PTE.READING_MCM_INCORRECT_OPTION');
    }
  }

  const rawScore = Math.max(0, correctCount - incorrectCount);
  const maxScore = correctOptions.length;
  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (rawScore / maxScore) * 80)));

  const itemResults: PteReadingItemResult[] = [
    {
      questionId: `${taskId}_mcm`,
      questionNumber: 1,
      earnedPoints: rawScore,
      maxPoints: maxScore,
      isCorrect: rawScore === maxScore,
      explanation: `Selected ${correctCount} correct and ${incorrectCount} incorrect options. Net points: ${rawScore}/${maxScore}.`,
      matchedTaxonomyCode: incorrectCount > 0 ? 'PTE.READING_MCM_INCORRECT_OPTION' : undefined
    }
  ];

  return {
    taskId,
    taskType: 'pte_mcm',
    rawScore,
    maxScore,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}

/**
 * Evaluates PTE Fill in the Blanks (Reading & Writing or Reading).
 * Pearson Rule: 1 point per correct blank.
 */
export function evaluatePteFillInBlanks(
  taskId: string,
  taskType: 'pte_fill_in_blanks_rw' | 'pte_fill_in_blanks_r',
  userAnswers: Record<string, string>,
  answerKey: Record<string, string>
): PteReadingEvaluation {
  const keys = Object.keys(answerKey);
  const maxScore = keys.length;
  let rawScore = 0;
  const itemResults: PteReadingItemResult[] = [];
  const detectedErrors: string[] = [];

  keys.forEach((key, index) => {
    const userVal = (userAnswers[key] || '').trim().toLowerCase();
    const correctVal = (answerKey[key] || '').trim().toLowerCase();
    const isCorrect = userVal === correctVal && userVal.length > 0;

    if (isCorrect) {
      rawScore++;
    } else {
      detectedErrors.push('PTE.READING_COLLOCATION_MISMATCH');
    }

    itemResults.push({
      questionId: key,
      questionNumber: index + 1,
      earnedPoints: isCorrect ? 1 : 0,
      maxPoints: 1,
      isCorrect,
      explanation: isCorrect
        ? `Blank ${index + 1} correctly identified as "${answerKey[key]}".`
        : `Blank ${index + 1}: expected "${answerKey[key]}", but got "${userAnswers[key] || '(empty)'}".`,
      matchedTaxonomyCode: isCorrect ? undefined : 'PTE.READING_COLLOCATION_MISMATCH'
    });
  });

  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (rawScore / Math.max(1, maxScore)) * 80)));

  return {
    taskId,
    taskType,
    rawScore,
    maxScore,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}
