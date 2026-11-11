/**
 * Deterministic Rules & Validation Engine for IELTS Academic Writing
 * Implements AGENTS.md Rule 9 (Deterministic First Rule)
 */

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const tokens = text.trim().split(/\s+/);
  return tokens.filter((t) => /[a-zA-Z0-9]/.test(t)).length;
}

export interface UnderLengthCheck {
  isUnderLength: boolean;
  minRecommendedWords: number;
  wordCount: number;
  penaltyBandDeduction: number;
  errorCode?: string;
  reason?: string;
}

/**
 * Evaluates underlength penalty according to official IELTS examiner guidelines:
 * - Task 1: 150 words minimum
 * - Task 2: 250 words minimum
 */
export function checkUnderLengthPenalty(
  taskType: 'ielts_writing_task_1' | 'ielts_writing_task_2',
  wordCount: number
): UnderLengthCheck {
  const minRecommendedWords = taskType === 'ielts_writing_task_1' ? 150 : 250;

  if (wordCount >= minRecommendedWords) {
    return {
      isUnderLength: false,
      minRecommendedWords,
      wordCount,
      penaltyBandDeduction: 0.0
    };
  }

  // Under length penalty bands
  if (taskType === 'ielts_writing_task_1') {
    if (wordCount >= 120) {
      return {
        isUnderLength: true,
        minRecommendedWords,
        wordCount,
        penaltyBandDeduction: 0.5,
        errorCode: 'IELTS.TASK1_UNDER_LENGTH',
        reason: `Word count (${wordCount}) is below the recommended 150 words, capping Task Achievement at Band 5 or 6.`
      };
    }
    return {
      isUnderLength: true,
      minRecommendedWords,
      wordCount,
      penaltyBandDeduction: 1.0,
      errorCode: 'IELTS.TASK1_UNDER_LENGTH',
      reason: `Word count (${wordCount}) is severely under length (min 150), severely penalizing Task Achievement.`
    };
  }

  // Task 2
  if (wordCount >= 200) {
    return {
      isUnderLength: true,
      minRecommendedWords,
      wordCount,
      penaltyBandDeduction: 0.5,
      errorCode: 'IELTS.TASK2_UNDER_LENGTH',
      reason: `Word count (${wordCount}) is below the 250 word requirement, restricting Task Response.`
    };
  }

  return {
    isUnderLength: true,
    minRecommendedWords,
    wordCount,
    penaltyBandDeduction: 1.0,
    errorCode: 'IELTS.TASK2_UNDER_LENGTH',
    reason: `Word count (${wordCount}) is severely under 250 words, severely capping Task Response.`
  };
}

export interface ParagraphStructure {
  paragraphCount: number;
  hasParagraphs: boolean;
  hasSufficientSeparation: boolean;
}

export function detectParagraphStructure(text: string): ParagraphStructure {
  if (!text.trim()) {
    return { paragraphCount: 0, hasParagraphs: false, hasSufficientSeparation: false };
  }

  const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const paragraphCount = rawParagraphs.length;

  return {
    paragraphCount,
    hasParagraphs: paragraphCount >= 3,
    hasSufficientSeparation: paragraphCount >= 4
  };
}
