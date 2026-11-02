/**
 * Deterministic Rules & Validation Engine for PTE Academic Writing
 * Implements AGENTS.md Rule 9 (Deterministic First Rule)
 */

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  // Match contiguous non-whitespace sequences that contain letters or numbers
  const tokens = text.trim().split(/\s+/);
  return tokens.filter((t) => /[a-zA-Z0-9]/.test(t)).length;
}

/**
 * Counts the number of terminal sentences in the text.
 * Avoids false sentence breaks on common abbreviations (e.g., Mr., Dr., etc.)
 */
export function countSentences(text: string): number {
  if (!text || !text.trim()) return 0;

  // Protect known abbreviations before splitting
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|i\.e|e\.g|U\.S|U\.K)\./gi, '$1_DOT_')
    .replace(/\b([A-Z])\./g, '$1_DOT_'); // Initialisms like J. Doe

  // Split on sentence-ending punctuation (. ? !) followed by whitespace or end of string
  const sentences = protectedText
    .split(/[.?!]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[a-zA-Z0-9]/.test(s));

  return sentences.length;
}

export interface PteFormEvaluation {
  formScore: number;
  wordCount: number;
  isAcceptable: boolean;
  errorCode?: string;
  reason: string;
}

/**
 * PTE Write Essay (WE) Form Rules:
 * - 200–300 words: 2 points
 * - 120–199 or 301–380 words: 1 point
 * - Less than 120 or more than 380 words: 0 points
 * - Capital letters only / no punctuation / bullet points: 0 points
 */
export function evaluatePteEssayForm(text: string): PteFormEvaluation {
  const wordCount = countWords(text);

  if (!text.trim() || wordCount === 0) {
    return {
      formScore: 0,
      wordCount: 0,
      isAcceptable: false,
      errorCode: 'PTE.ESSAY_TOO_SHORT',
      reason: 'No response submitted.'
    };
  }

  // Check if text is all uppercase (at least 30 chars)
  const lettersOnly = text.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length >= 30 && lettersOnly === lettersOnly.toUpperCase()) {
    return {
      formScore: 0,
      wordCount,
      isAcceptable: false,
      errorCode: 'PTE.ESSAY_FORMAT',
      reason: 'Essay is written entirely in capital letters, which invalidates Pearson Form scoring.'
    };
  }

  if (wordCount >= 200 && wordCount <= 300) {
    return {
      formScore: 2,
      wordCount,
      isAcceptable: true,
      reason: `Length of ${wordCount} words is within the optimal 200–300 word band.`
    };
  }

  if ((wordCount >= 120 && wordCount <= 199) || (wordCount >= 301 && wordCount <= 380)) {
    return {
      formScore: 1,
      wordCount,
      isAcceptable: true,
      errorCode: wordCount < 200 ? 'PTE.ESSAY_UNDER_LENGTH' : 'PTE.ESSAY_OVER_LENGTH',
      reason: `Length of ${wordCount} words is acceptable but penalized (target is 200–300 words).`
    };
  }

  return {
    formScore: 0,
    wordCount,
    isAcceptable: false,
    errorCode: wordCount < 120 ? 'PTE.ESSAY_TOO_SHORT' : 'PTE.ESSAY_TOO_LONG',
    reason: `Length of ${wordCount} words is outside the acceptable limit (min 120, max 380).`
  };
}

/**
 * PTE Summarize Written Text (SWT) Form Rules:
 * - 5–75 words: required
 * - Strictly ONE single sentence: required
 * - If word count < 5 or > 75, OR more than one sentence: Form = 0
 */
export function evaluatePteSwtForm(text: string): PteFormEvaluation & { sentenceCount: number } {
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);

  if (!text.trim() || wordCount === 0) {
    return {
      formScore: 0,
      wordCount: 0,
      sentenceCount: 0,
      isAcceptable: false,
      errorCode: 'PTE.SWT_UNDER_LENGTH',
      reason: 'No summary submitted.'
    };
  }

  if (sentenceCount > 1) {
    return {
      formScore: 0,
      wordCount,
      sentenceCount,
      isAcceptable: false,
      errorCode: 'PTE.SWT_MULTI_SENTENCE',
      reason: `Summary contains ${sentenceCount} sentences. Pearson PTE strictly requires exactly ONE single sentence.`
    };
  }

  if (wordCount < 5) {
    return {
      formScore: 0,
      wordCount,
      sentenceCount,
      isAcceptable: false,
      errorCode: 'PTE.SWT_UNDER_LENGTH',
      reason: `Summary has only ${wordCount} words (minimum required is 5 words).`
    };
  }

  if (wordCount > 75) {
    return {
      formScore: 0,
      wordCount,
      sentenceCount,
      isAcceptable: false,
      errorCode: 'PTE.SWT_OVER_LENGTH',
      reason: `Summary exceeds limit with ${wordCount} words (maximum allowed is 75 words).`
    };
  }

  return {
    formScore: 1,
    wordCount,
    sentenceCount: 1,
    isAcceptable: true,
    reason: `Summary is exactly one sentence with ${wordCount} words (within 5–75 range).`
  };
}
