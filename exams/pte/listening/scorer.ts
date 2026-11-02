/**
 * PTE Academic Listening Scoring Engine
 * Adheres strictly to official Pearson PTE Academic Score Guide:
 * - Summarize Spoken Text (SST): 10-point trait scoring scaled to 10-90
 * - Highlight Incorrect Words (HIW): +1 correct, -1 incorrect, minimum 0
 * - Write from Dictation (WFD): 1 point per correct word
 * - Scale: 10–90 Pearson scale
 */

export interface PteListeningItemResult {
  questionId: string;
  questionNumber: number;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  explanation: string;
  matchedTaxonomyCode?: string;
}

export interface PteListeningEvaluation {
  taskId: string;
  taskType: 'pte_summarize_spoken_text' | 'pte_highlight_incorrect_words' | 'pte_write_from_dictation';
  rawScore: number;
  maxScore: number;
  scaledScore: number;
  scoreDisplayLabel: 'LexiFlow estimate';
  itemResults: PteListeningItemResult[];
  detectedErrors: string[];
}

/**
 * Evaluates PTE Write from Dictation (WFD).
 * Pearson Rule: 1 point per correctly spelled and identified word.
 */
export function evaluatePteWriteFromDictation(
  taskId: string,
  userTranscript: string,
  correctSentence: string
): PteListeningEvaluation {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const correctWords = clean(correctSentence);
  const userWords = clean(userTranscript);

  const correctCounts = new Map<string, number>();
  for (const w of correctWords) {
    correctCounts.set(w, (correctCounts.get(w) || 0) + 1);
  }

  let earnedPoints = 0;
  const userRemaining = new Map<string, number>();
  for (const w of userWords) {
    userRemaining.set(w, (userRemaining.get(w) || 0) + 1);
  }

  for (const [w, count] of userRemaining.entries()) {
    const required = correctCounts.get(w) || 0;
    earnedPoints += Math.min(count, required);
  }

  const maxScore = correctWords.length;
  const detectedErrors: string[] = [];
  if (earnedPoints < maxScore) {
    detectedErrors.push('PTE.LISTENING_DICTATION_OMISSION');
  }

  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (earnedPoints / Math.max(1, maxScore)) * 80)));

  const itemResults: PteListeningItemResult[] = [
    {
      questionId: `${taskId}_wfd`,
      questionNumber: 1,
      earnedPoints,
      maxPoints: maxScore,
      isCorrect: earnedPoints === maxScore,
      explanation: `Matched ${earnedPoints} of ${maxScore} dictated words accurately.`,
      matchedTaxonomyCode: earnedPoints < maxScore ? 'PTE.LISTENING_DICTATION_OMISSION' : undefined
    }
  ];

  return {
    taskId,
    taskType: 'pte_write_from_dictation',
    rawScore: earnedPoints,
    maxScore,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors
  };
}

/**
 * Evaluates PTE Highlight Incorrect Words (HIW).
 * Pearson Rule: +1 for correct click, -1 for incorrect click, minimum 0.
 */
export function evaluatePteHighlightIncorrectWords(
  taskId: string,
  userClickedWords: string[],
  targetIncorrectWords: string[]
): PteListeningEvaluation {
  const targetSet = new Set(targetIncorrectWords.map((w) => w.toLowerCase()));
  const clickedSet = new Set(userClickedWords.map((w) => w.toLowerCase()));

  let correctCount = 0;
  let falsePositiveCount = 0;
  const detectedErrors: string[] = [];

  for (const clicked of clickedSet) {
    if (targetSet.has(clicked)) {
      correctCount++;
    } else {
      falsePositiveCount++;
      detectedErrors.push('PTE.LISTENING_HIW_FALSE_ALARM');
    }
  }

  const maxScore = targetSet.size;
  const rawScore = Math.max(0, correctCount - falsePositiveCount);
  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (rawScore / Math.max(1, maxScore)) * 80)));

  const itemResults: PteListeningItemResult[] = [
    {
      questionId: `${taskId}_hiw`,
      questionNumber: 1,
      earnedPoints: rawScore,
      maxPoints: maxScore,
      isCorrect: rawScore === maxScore,
      explanation: `Identified ${correctCount} discrepancies with ${falsePositiveCount} false alarms. Net score: ${rawScore}/${maxScore}.`,
      matchedTaxonomyCode: falsePositiveCount > 0 ? 'PTE.LISTENING_HIW_FALSE_ALARM' : undefined
    }
  ];

  return {
    taskId,
    taskType: 'pte_highlight_incorrect_words',
    rawScore,
    maxScore,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors: Array.from(new Set(detectedErrors))
  };
}

/**
 * Evaluates PTE Summarize Spoken Text (SST).
 * Form rule: 50–70 words receives 2 points; 40–49 or 71–100 words receives 1 point; <40 or >100 words receives 0 points.
 */
export function evaluatePteSummarizeSpokenText(
  taskId: string,
  summaryText: string,
  traits: { content: number; grammar: number; vocabulary: number; spelling: number }
): PteListeningEvaluation {
  const wordCount = summaryText.trim().split(/\s+/).filter(Boolean).length;
  let formScore = 0;
  const detectedErrors: string[] = [];

  if (wordCount >= 50 && wordCount <= 70) {
    formScore = 2;
  } else if ((wordCount >= 40 && wordCount <= 49) || (wordCount >= 71 && wordCount <= 100)) {
    formScore = 1;
    detectedErrors.push('PTE.SST_WORD_COUNT_BOUNDARY');
  } else {
    formScore = 0;
    detectedErrors.push('PTE.SST_WORD_COUNT_FATAL');
  }

  const rawScore = traits.content + formScore + traits.grammar + traits.vocabulary + traits.spelling;
  const maxScore = 10; // 2 each for 5 traits
  const scaledScore = Math.min(90, Math.max(10, Math.round(10 + (rawScore / maxScore) * 80)));

  const itemResults: PteListeningItemResult[] = [
    {
      questionId: `${taskId}_sst_traits`,
      questionNumber: 1,
      earnedPoints: rawScore,
      maxPoints: maxScore,
      isCorrect: rawScore >= 8,
      explanation: `SST Form: ${formScore}/2 (${wordCount} words). Total traits: Content ${traits.content}/2, Grammar ${traits.grammar}/2, Vocabulary ${traits.vocabulary}/2, Spelling ${traits.spelling}/2.`,
      matchedTaxonomyCode: detectedErrors[0]
    }
  ];

  return {
    taskId,
    taskType: 'pte_summarize_spoken_text',
    rawScore,
    maxScore,
    scaledScore,
    scoreDisplayLabel: 'LexiFlow estimate',
    itemResults,
    detectedErrors
  };
}
