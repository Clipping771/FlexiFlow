import { HighlightVocabularyItem, HighlightExtractionResult } from '../../types';

/** Largest piece of an article sent to the model in one highlight request. */
export const HIGHLIGHT_CHUNK_CHARS = 12000;
/** Most chunks analysed per page, which bounds cost and latency on very long pages. */
export const HIGHLIGHT_MAX_CHUNKS = 4;
/** Most article text the content script collects for highlighting. */
export const HIGHLIGHT_MAX_ARTICLE_CHARS = HIGHLIGHT_CHUNK_CHARS * HIGHLIGHT_MAX_CHUNKS;

const APOSTROPHES = /['‘’ʼ]/g;
const QUOTES = /["“”]/g;
const DASHES = /[‐‑–—]/g;

/** Lower-cases and flattens whitespace, quotes and dashes so AI output can be matched to page text. */
export function normalizeForMatch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether `term` occurs in `text` as whole words (both already normalized). */
function containsWholeTerm(normText: string, normTerm: string): boolean {
  if (!normTerm) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normTerm)}(?![\\p{L}\\p{N}])`, 'u').test(normText);
}

/**
 * Splits article text into chunks of at most `maxChars`, breaking between paragraphs where possible
 * (then between sentences, then at a space) so each chunk reads as coherent prose.
 */
export function splitArticleIntoChunks(text: string, maxChars: number, maxChunks: number): string[] {
  const clean = (text || '').trim();
  if (clean.length <= maxChars) return clean ? [clean] : [];

  const pieces: string[] = [];
  for (const para of clean.split(/\n\s*\n+/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= maxChars) {
      pieces.push(p);
      continue;
    }
    // Oversized paragraph: fall back to sentences, then to hard cuts at a space
    for (const sentence of p.match(/[^.!?]+[.!?]+["'”’]?\s*|[^.!?]+$/g) || [p]) {
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(' ', maxChars);
        const at = cut > maxChars / 2 ? cut : maxChars;
        pieces.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) pieces.push(rest);
    }
  }

  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const joined = current ? `${current}\n\n${piece}` : piece;
    if (joined.length <= maxChars) {
      current = joined;
    } else {
      if (current) chunks.push(current);
      current = piece;
    }
    if (chunks.length >= maxChunks) break;
  }
  if (current && chunks.length < maxChunks) chunks.push(current);
  return chunks.slice(0, maxChunks);
}

/**
 * HighlightIntelligenceService
 *
 * Pedagogical decision-making and ranking engine that ensures all highlighted
 * vocabulary, phrases, and idioms provide genuine learning value for students.
 *
 * Enforces:
 * 1. Strict source grounding (rejects fabricated or mismatched text)
 * 2. Trivial everyday word rejection
 * 3. Multiword phrase preference over sub-word fragments
 * 4. Redundancy and overlap elimination
 * 5. Learning-value ranking and dynamic candidate sizing
 */
export class HighlightIntelligenceService {
  /**
   * Non-substantive words that offer negligible language-learning value when highlighted alone.
   * Note: Multi-word phrases and idioms containing these words (e.g. "go beyond", "take for granted")
   * are preserved and prioritized.
   */
  private static readonly TRIVIAL_WORDS = new Set([
    'wearing', 'discover', 'discovering', 'discovered',
    'make', 'making', 'made', 'makes',
    'piece', 'pieces',
    'goes', 'going', 'went', 'gone',
    'taken', 'taking', 'took', 'takes',
    'being', 'having', 'had', 'have',
    'about', 'after', 'before', 'where', 'which', 'whose', 'their', 'there',
    'these', 'those', 'people',
    'start', 'started', 'starting', 'starts',
    'show', 'showing', 'showed', 'shows',
    'need', 'needs', 'needed',
    'good', 'great', 'fine', 'nice',
    'look', 'looked', 'looking', 'looks',
    'come', 'came', 'coming', 'comes',
    'thing', 'things', 'stuff',
    'very', 'really', 'just', 'also', 'even', 'back', 'well',
    'much', 'many', 'most', 'some', 'any',
    'said', 'says', 'saying', 'tell', 'told',
    'first', 'second', 'then', 'now', 'here',
    'find', 'finding', 'found',
    'bring', 'bringing', 'brought',
    'give', 'giving', 'given', 'gave',
    'help', 'helping', 'helped',
    'work', 'working', 'worked',
    'time', 'year', 'years', 'day', 'days',
    'way', 'ways',
    'call', 'called', 'calling',
    'keep', 'keeps', 'keeping', 'kept',
    'like', 'likes', 'liked',
    'every', 'different', 'never', 'always', 'often', 'usual', 'usually'
  ]);

  /** Discourse connectors worth teaching whatever the article's topic. */
  private static readonly DISCOURSE_MARKERS =
    /\b(however|therefore|furthermore|moreover|nevertheless|nonetheless|notwithstanding|consequently|whereas|albeit|hence|thus|conversely)\b/i;

  /**
   * Audits, grounds, deduplicates, and ranks raw extraction candidates
   */
  static processCandidates(
    rawResult: HighlightExtractionResult,
    rawArticleText: string,
    options: { maxItems?: number } = {}
  ): HighlightExtractionResult {
    const text = rawArticleText || '';
    const normText = normalizeForMatch(text);
    const candidateList = Array.isArray(rawResult.items) ? rawResult.items : [];

    // Step 1: Filter out items not grounded in the source text (as whole words, ignoring
    // whitespace, curly-quote and dash differences between the model's copy and the page)
    const groundedItems: HighlightVocabularyItem[] = [];
    for (const item of candidateList) {
      const term = (item.text || '').trim().replace(/\s+/g, ' ');
      if (!term || term.length < 2) continue;

      if (!containsWholeTerm(normText, normalizeForMatch(term))) {
        continue; // REJECT: not grounded in source text
      }

      // Disambiguate context sentence
      let sentence = (item.contextSentence || '').trim();
      if (!sentence || !normText.includes(normalizeForMatch(sentence))) {
        sentence = this.extractSentenceAround(text, term);
      }

      groundedItems.push({
        ...item,
        text: term,
        contextSentence: sentence
      });
    }

    // Step 2: Filter out trivial single words
    const nonTrivialItems = groundedItems.filter((item) => {
      const words = item.text.trim().split(/\s+/);
      const isMultiword = words.length > 1;

      // Multiword phrases and idioms are always allowed
      if (isMultiword || item.type === 'phrase' || item.type === 'idiom') {
        return true;
      }

      const singleLower = item.text.toLowerCase().trim();
      if (this.TRIVIAL_WORDS.has(singleLower)) {
        return false; // REJECT: trivial word
      }

      // Drop single words with fewer than 4 characters unless verified
      if (singleLower.length < 4) {
        return false;
      }

      return true;
    });

    // Step 3: Multiword phrase preference over sub-word fragments
    // E.g. If "goes beyond" is chosen, drop "beyond". Two separately chosen words are never glued
    // into a new phrase: that would invent a meaning the model never gave.
    const multiwordPhrases = nonTrivialItems
      .filter((it) => it.text.includes(' '))
      .map((it) => normalizeForMatch(it.text));
    const filteredHierarchy = nonTrivialItems.filter((item) => {
      const itemText = normalizeForMatch(item.text);
      return !multiwordPhrases.some((phrase) => phrase !== itemText && containsWholeTerm(phrase, itemText));
    });

    // Step 4: Redundancy & overlap elimination
    const deduplicated: HighlightVocabularyItem[] = [];
    const seenPhrases = new Set<string>();

    for (const item of filteredHierarchy) {
      const key = normalizeForMatch(item.text);
      if (seenPhrases.has(key)) continue;

      seenPhrases.add(key);
      deduplicated.push(item);
    }

    // Step 5: Learning-value scoring and ranking
    const scoredItems = deduplicated.map((item) => ({
      ...item,
      learningValueScore: this.calculateLearningValueScore(item)
    }));

    // Filter by learning-value threshold (minimum 0.50 score)
    const highValueItems = scoredItems.filter((item) => (item.learningValueScore ?? 0) >= 0.50);

    // Sort descending by learning value score
    highValueItems.sort((a, b) => (b.learningValueScore ?? 0) - (a.learningValueScore ?? 0));

    // Cap the count to prevent visually cluttering the reading view (longer articles allow more)
    const finalItems = highValueItems.slice(0, options.maxItems ?? 20);

    return {
      items: finalItems,
      pageTitle: rawResult.pageTitle,
      totalAnalyzedWords: text.split(/\s+/).filter(Boolean).length,
      sourceMode: rawResult.sourceMode || 'ai_reasoning',
      articleSummary: rawResult.articleSummary
    };
  }

  /**
   * Computes an educational learning-value score (0.0 to 1.0). When the model rated the item itself,
   * that judgement counts for half, since it has read the whole article.
   */
  public static calculateLearningValueScore(item: HighlightVocabularyItem, _fullText?: string): number {
    let score = 0.55;

    const text = item.text.toLowerCase().trim();
    const isMultiword = text.includes(' ') || item.type === 'phrase' || item.type === 'idiom';

    // 1. Multiword phrases, collocations, and idioms receive high value
    if (item.type === 'idiom') {
      score += 0.25;
    } else if (isMultiword) {
      score += 0.20;
    }

    // 2. Central-idea relevance
    if (item.isArticleCore) {
      score += 0.20;
    }

    // 3. Difficulty weighting
    if (item.difficulty === 'hard') {
      score += 0.15;
    } else if (item.difficulty === 'medium') {
      score += 0.08;
    } else if (item.difficulty === 'easy' && !isMultiword) {
      score -= 0.15; // Penalty for overly easy single words
    }

    // 4. Discourse connectors signal argument structure in any article
    if (this.DISCOURSE_MARKERS.test(text)) {
      score += 0.15;
    }

    // 5. Word length heuristic for single words
    if (!isMultiword && text.length >= 8) {
      score += 0.05;
    }

    let heuristic = Math.min(1.0, Math.max(0.1, score));

    const aiScore = Number(item.learningValueScore);
    if (Number.isFinite(aiScore) && aiScore > 0 && aiScore <= 1) {
      heuristic = (heuristic + aiScore) / 2;
    }

    return Math.min(1.0, Math.max(0.1, Number(heuristic.toFixed(2))));
  }

  /**
   * Helper to locate the exact sentence around a word in the text
   */
  private static extractSentenceAround(fullText: string, term: string): string {
    const match = new RegExp(escapeRegExp(term).replace(/ /g, '[\\s\\u00A0]+'), 'i').exec(fullText);
    if (!match) return term;
    const idx = match.index;

    const start = Math.max(0, fullText.lastIndexOf('.', idx) + 1);
    let end = fullText.indexOf('.', idx + match[0].length);
    if (end === -1) end = fullText.length;

    const sentence = fullText.substring(start, end + 1).trim();
    return sentence.length > term.length ? sentence : term;
  }
}
