/**
 * Normalization utilities for Cache Keys and Dictionary Lookups.
 * Safe normalization ensures distinct expressions stay distinct while
 * eliminating harmless variations (whitespace, unicode decomposition, outer quotes).
 */

/**
 * FNV-1a fast 32-bit non-cryptographic hash for deterministic sentence fingerprinting.
 */
export function hashString(str: string): string {
  let hash = 2166136261;
  const normalized = (str || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Basic safe text normalization:
 * - NFC Unicode normalization
 * - Collapses consecutive whitespace
 * - Trims leading and trailing whitespace
 * - Does NOT lowercase text (preserves casing like "US", "NASA", "Apple")
 */
export function normalizeCleanText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Strips outer enclosing quotes, parentheses, brackets or trailing terminal punctuation (. , ! ?)
 * without stripping meaningful internal punctuation (hyphens, apostrophes: "state-of-the-art", "don't").
 */
export function stripEnclosingPunctuation(text: string): string {
  let clean = normalizeCleanText(text);
  // Remove enclosing quotes or brackets: "word" -> word, (word) -> word
  clean = clean.replace(/^[«"“'‘(\[{<\s]+/, '');
  clean = clean.replace(/[»"”'’)\]}>\s]+$/, '');
  // Remove trailing sentence punctuation for isolated lookups: e.g. "subsidies." -> "subsidies"
  clean = clean.replace(/[.,;:!?]+$/, '');
  return clean.trim();
}

/**
 * Normalization for local and offline dictionary lookup keys.
 * Dictionary keys are partitioned by:
 * - Language pair (default 'en-bn')
 * - Dictionary dataset/version (default 'v1')
 * - Normalized lookup text
 *
 * Case handling:
 * For standard words, lowercase is used for dictionary indexing, but if the word is an acronym
 * or camelCase/proper noun (e.g., 'US', 'WHO'), casing is preserved in a sub-namespace to avoid collision.
 */
export function normalizeDictionaryKey(
  rawText: string,
  langPair: string = 'en-bn',
  dictVersion: string = 'v1'
): string {
  const stripped = stripEnclosingPunctuation(rawText);
  if (!stripped) return '';

  const isAllUpper = stripped.length > 1 && stripped === stripped.toUpperCase() && /[A-Z]/.test(stripped);
  // If acronym/all-caps like "US" (United States vs "us" pronoun), preserve case tag
  const caseTag = isAllUpper ? ':caps' : '';
  const normalizedToken = stripped.toLowerCase();

  return `dict:${langPair}:${dictVersion}:${normalizedToken}${caseTag}`;
}

/**
 * Normalization for Contextual AI Cache Keys.
 * Contextual AI explanations depend strictly on:
 * - Selected text (stripped of enclosing punctuation, NFC normalized)
 * - The surrounding sentence or paragraph context (hashed deterministically)
 * - Language pair ('en-bn')
 * - Analysis mode / type ('stageA', 'stageB', 'sentence', 'phrase')
 * - Model or prompt version
 *
 * Crucial rule: Contextual AI results MUST NOT be reused across materially different sentences!
 */
export function normalizeAIContextKey(
  selectedText: string,
  contextSentence?: string,
  langPair: string = 'en-bn',
  analysisType: string = 'stageA',
  promptVersion: string = 'v2_master'
): string {
  const cleanSelected = stripEnclosingPunctuation(selectedText).toLowerCase();
  const sentenceHash = hashString(contextSentence || '');
  return `ai:${langPair}:${analysisType}:${promptVersion}:${cleanSelected}::${sentenceHash}`;
}
