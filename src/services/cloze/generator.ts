/**
 * LexiFlow 2.0 - Deterministic Rule-Based Cloze & Active Recall Generator
 *
 * Generates fill-in-the-blank (Cloze) active recall exercises from real reading context.
 * Strictly enforces pedagogical rejection rules:
 * - Rejects if context sentence is missing or too short (< 20 chars).
 * - Rejects if target word appears multiple times (eliminating ambiguous blanks).
 * - Rejects if target word cannot be unambiguously located.
 * - Falls back cleanly to Meaning Recall without altering FSRS scheduling.
 */

import { getCandidateLemmas } from '../dictionary/lemmatizer';

export interface ClozeResult {
  sentence: string;
  clozeSentence: string;
  targetWord: string;
  targetLemma: string;
  matchStartIndex: number;
  matchEndIndex: number;
  hint: {
    firstLetter: string;
    length: number;
    partOfSpeech?: string;
  };
}

export type ClozeRejectionReason =
  | 'missing_context'
  | 'context_too_short'
  | 'target_not_found'
  | 'multiple_target_occurrences';

export interface ClozeGenerationOutcome {
  success: boolean;
  cloze?: ClozeResult;
  rejectionReason?: ClozeRejectionReason;
}

const MIN_CONTEXT_LENGTH = 20;

/**
 * Escapes regex characters in string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips punctuation and trims string.
 */
function cleanTerm(str: string): string {
  return str.trim().toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
}

/**
 * Generates cloze outcome for a vocabulary item in its real context sentence.
 */
export function generateCloze(
  word: string,
  contextSentence?: string,
  partOfSpeech?: string
): ClozeGenerationOutcome {
  if (!contextSentence || typeof contextSentence !== 'string') {
    return { success: false, rejectionReason: 'missing_context' };
  }

  const sentence = contextSentence.trim();
  if (sentence.length < MIN_CONTEXT_LENGTH) {
    return { success: false, rejectionReason: 'context_too_short' };
  }

  const baseWord = cleanTerm(word);
  if (!baseWord) {
    return { success: false, rejectionReason: 'target_not_found' };
  }

  // 1. Collect candidate surface forms (exact word, lemmatized stems, inflections)
  const candidateForms = new Set<string>();
  candidateForms.add(baseWord);

  const stems = getCandidateLemmas(baseWord);
  for (const s of stems) {
    if (s.length >= 2) candidateForms.add(s);
  }

  // 2. Scan sentence words and identify matches
  // Try exact candidate forms with word boundary regex
  const matchSpans: Array<{ start: number; end: number; matchedText: string }> = [];

  for (const form of Array.from(candidateForms)) {
    const escaped = escapeRegex(form);
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(sentence)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Prevent overlapping duplicate matches
      if (!matchSpans.some((existing) => existing.start === start && existing.end === end)) {
        matchSpans.push({ start, end, matchedText: m[0] });
      }
    }
  }

  // If no direct regex match, try reverse lemmatization on sentence tokens
  if (matchSpans.length === 0) {
    const tokenRegex = /\b([a-zA-Z]{3,})\b/g;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenRegex.exec(sentence)) !== null) {
      const token = tokenMatch[1].toLowerCase();
      const tokenStems = getCandidateLemmas(token);
      if (tokenStems.includes(baseWord) || candidateForms.has(token)) {
        matchSpans.push({
          start: tokenMatch.index,
          end: tokenMatch.index + tokenMatch[0].length,
          matchedText: tokenMatch[0]
        });
      }
    }
  }

  // 3. Apply strict rejection checks
  if (matchSpans.length === 0) {
    return { success: false, rejectionReason: 'target_not_found' };
  }

  if (matchSpans.length > 1) {
    // Ambiguous target: word occurs more than once in the sentence
    return { success: false, rejectionReason: 'multiple_target_occurrences' };
  }

  // 4. Construct successful cloze sentence with masked blank
  const singleMatch = matchSpans[0];
  const blankPlaceholder = '________';
  const clozeSentence =
    sentence.slice(0, singleMatch.start) +
    blankPlaceholder +
    sentence.slice(singleMatch.end);

  const matchedWord = singleMatch.matchedText;

  return {
    success: true,
    cloze: {
      sentence,
      clozeSentence,
      targetWord: matchedWord,
      targetLemma: baseWord,
      matchStartIndex: singleMatch.start,
      matchEndIndex: singleMatch.end,
      hint: {
        firstLetter: matchedWord.charAt(0).toUpperCase(),
        length: matchedWord.length,
        partOfSpeech: partOfSpeech ? partOfSpeech.toUpperCase() : undefined
      }
    }
  };
}
