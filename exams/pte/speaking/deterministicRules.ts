/**
 * Deterministic Rules & Alignment Engine for PTE Academic Speaking
 * Implements AGENTS.md Rule 9 (Deterministic First Rule)
 */

export interface AudioValidationResult {
  isValid: boolean;
  fatalErrorCode?: string;
  reason?: string;
}

export function validateSpeakingAudio(
  durationMs: number,
  maxAllowedMs: number = 40000,
  initialSilenceMs: number = 0
): AudioValidationResult {
  if (durationMs < 1200) {
    return {
      isValid: false,
      fatalErrorCode: 'PTE.AUDIO_TOO_SHORT',
      reason: `Recording duration (${(durationMs / 1000).toFixed(1)}s) is too short or silent. Minimum 1.2s required.`
    };
  }

  if (initialSilenceMs >= 3000) {
    return {
      isValid: false,
      fatalErrorCode: 'PTE.INITIAL_SILENCE_TIMEOUT',
      reason: '3 seconds of initial silence detected. In official Pearson PTE exams, the microphone closes after 3 seconds of silence.'
    };
  }

  if (durationMs > maxAllowedMs + 5000) {
    return {
      isValid: false,
      fatalErrorCode: 'PTE.AUDIO_OVER_LIMIT',
      reason: `Recording exceeds official time limit (${(maxAllowedMs / 1000).toFixed(0)}s).`
    };
  }

  return { isValid: true };
}

export interface WordAlignmentResult {
  matchCount: number;
  promptWordCount: number;
  transcriptWordCount: number;
  matchRatio: number;          // 0.0 to 1.0
  omittedWords: string[];
  insertedWords: string[];
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Deterministically aligns transcript words against prompt words.
 */
export function alignWords(promptText: string, transcriptText: string): WordAlignmentResult {
  const promptTokens = normalizeTokens(promptText);
  const transcriptTokens = normalizeTokens(transcriptText);

  if (promptTokens.length === 0) {
    return {
      matchCount: 0,
      promptWordCount: 0,
      transcriptWordCount: transcriptTokens.length,
      matchRatio: 0,
      omittedWords: [],
      insertedWords: transcriptTokens
    };
  }

  const promptSet = new Set(promptTokens);
  const transcriptSet = new Set(transcriptTokens);

  let matchCount = 0;
  const transcriptCopy = [...transcriptTokens];

  for (const pToken of promptTokens) {
    const idx = transcriptCopy.indexOf(pToken);
    if (idx !== -1) {
      matchCount++;
      transcriptCopy.splice(idx, 1); // Consume token
    }
  }

  const matchRatio = matchCount / promptTokens.length;
  const omittedWords = promptTokens.filter((t) => !transcriptSet.has(t));
  const insertedWords = transcriptTokens.filter((t) => !promptSet.has(t));

  return {
    matchCount,
    promptWordCount: promptTokens.length,
    transcriptWordCount: transcriptTokens.length,
    matchRatio,
    omittedWords,
    insertedWords
  };
}

/**
 * Pearson PTE Read Aloud (RA) Content Scoring:
 * Max 5 points based on accurate word reproduction
 */
export function calculateRaContentScore(matchRatio: number): number {
  if (matchRatio >= 0.95) return 5;
  if (matchRatio >= 0.80) return 4;
  if (matchRatio >= 0.60) return 3;
  if (matchRatio >= 0.40) return 2;
  if (matchRatio >= 0.20) return 1;
  return 0;
}

/**
 * Pearson PTE Repeat Sentence (RS) Content Scoring:
 * 3 = 100% of words in correct sequence
 * 2 = 50% or more of words in correct sequence
 * 1 = Less than 50% of words
 * 0 = Almost no words reproduced
 */
export function calculateRsContentScore(matchRatio: number): number {
  if (matchRatio >= 0.95) return 3;
  if (matchRatio >= 0.50) return 2;
  if (matchRatio >= 0.15) return 1;
  return 0;
}
