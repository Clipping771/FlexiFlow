import { HighlightVocabularyItem, HighlightExtractionResult } from '../../types';

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

  /**
   * Audits, grounds, deduplicates, and ranks raw extraction candidates
   */
  static processCandidates(
    rawResult: HighlightExtractionResult,
    rawArticleText: string
  ): HighlightExtractionResult {
    const text = rawArticleText || '';
    const cleanLowerText = text.toLowerCase();
    const candidateList = Array.isArray(rawResult.items) ? rawResult.items : [];

    // Step 1: Filter out items not grounded in the source text
    const groundedItems: HighlightVocabularyItem[] = [];
    for (const item of candidateList) {
      const term = (item.text || '').trim();
      if (!term || term.length < 2) continue;

      // Exact substring or word boundary check
      const termLower = term.toLowerCase();
      if (!cleanLowerText.includes(termLower)) {
        continue; // REJECT: not grounded in source text
      }

      // Disambiguate context sentence
      let sentence = (item.contextSentence || '').trim();
      if (!sentence || !cleanLowerText.includes(sentence.toLowerCase())) {
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

    // Step 2.5: Coalesce adjacent single-word candidates that form a contiguous collocation in the article
    const mergedList: HighlightVocabularyItem[] = [...nonTrivialItems];
    for (let i = 0; i < nonTrivialItems.length; i++) {
      for (let j = 0; j < nonTrivialItems.length; j++) {
        if (i === j) continue;
        const itemA = nonTrivialItems[i];
        const itemB = nonTrivialItems[j];
        if (itemA.text.includes(' ') || itemB.text.includes(' ')) continue;

        const bigram = `${itemA.text.toLowerCase()} ${itemB.text.toLowerCase()}`;
        // Verify bigram exists as a whole contiguous collocation in the article text
        const bigramRegex = new RegExp(`\\b${itemA.text}\\s+${itemB.text}\\b`, 'i');
        if (bigramRegex.test(text)) {
          if (!mergedList.some((m) => m.text.toLowerCase() === bigram)) {
            const contextSent = (itemB.contextSentence && itemB.contextSentence.toLowerCase().includes(bigram))
              ? itemB.contextSentence
              : (itemA.contextSentence || this.extractSentenceAround(text, `${itemA.text} ${itemB.text}`));

            mergedList.push({
              id: `hl_colloc_${mergedList.length + 1}`,
              text: `${itemA.text} ${itemB.text}`,
              type: 'phrase',
              contextSentence: contextSent,
              easyEnglish: itemB.easyEnglish || itemA.easyEnglish,
              easyBengali: `${itemA.easyBengali || ''} ${itemB.easyBengali || ''}`.trim() || itemB.easyBengali,
              reason: `Key multiword collocation in article: "${itemA.text} ${itemB.text}"`,
              difficulty: 'hard',
              isArticleCore: itemA.isArticleCore || itemB.isArticleCore || cleanLowerText.slice(0, 300).includes(bigram),
              learningValueScore: 0.95
            });
          }
        }
      }
    }

    // Step 3: Multiword phrase preference over sub-word fragments
    // E.g. If "cognitive sovereignty" or "goes beyond" is chosen, drop "sovereignty", "cognitive", or "beyond"
    const multiwordPhrases = mergedList.filter((it) => it.text.trim().includes(' '));
    const filteredHierarchy = mergedList.filter((item) => {
      const itemText = item.text.trim().toLowerCase();
      // If item is a single word (or shorter phrase), check if any longer selected multiword phrase already contains it as a distinct word
      for (const phr of multiwordPhrases) {
        const phrText = phr.text.trim().toLowerCase();
        if (phrText !== itemText) {
          const wordRegex = new RegExp(`\\b${itemText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (wordRegex.test(phrText)) {
            // Drop sub-word or shorter fragment in favor of the complete cohesive phrase
            return false;
          }
        }
      }
      return true;
    });

    // Step 4: Redundancy & overlap elimination
    const deduplicated: HighlightVocabularyItem[] = [];
    const seenPhrases = new Set<string>();

    for (const item of filteredHierarchy) {
      const lower = item.text.toLowerCase();
      if (seenPhrases.has(lower)) continue;

      seenPhrases.add(lower);
      deduplicated.push(item);
    }

    // Step 5: Learning-value scoring and ranking
    const scoredItems = deduplicated.map((item) => {
      const score = this.calculateLearningValueScore(item, text);
      return {
        ...item,
        learningValueScore: score
      };
    });

    // Filter by learning-value threshold (minimum 0.50 score)
    const highValueItems = scoredItems.filter((item) => (item.learningValueScore ?? 0) >= 0.50);

    // Sort descending by learning value score
    highValueItems.sort((a, b) => (b.learningValueScore ?? 0) - (a.learningValueScore ?? 0));

    // Cap at 20 items to prevent visually cluttering the reading view
    const finalItems = highValueItems.slice(0, 20);

    return {
      items: finalItems,
      pageTitle: rawResult.pageTitle,
      totalAnalyzedWords: text.split(/\s+/).filter(Boolean).length,
      sourceMode: rawResult.sourceMode || 'ai_reasoning',
      articleSummary: rawResult.articleSummary
    };
  }

  /**
   * Computes an educational learning-value score (0.0 to 1.0)
   */
  public static calculateLearningValueScore(item: HighlightVocabularyItem, fullText: string): number {
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

    // 4. Academic / Domain / Discourse marker signals
    if (
      /\b(however|therefore|furthermore|notwithstanding|consequently|paradigm|empirical|infrastructure|resilience|sovereignty|mitigate|scrutiny|stewardship|monochrome|silhouette|resonance|aesthetic|minimalist)\b/i.test(
        text
      )
    ) {
      score += 0.15;
    }

    // 5. Word length heuristic for single words
    if (!isMultiword && text.length >= 8) {
      score += 0.05;
    }

    return Math.min(1.0, Math.max(0.1, Number(score.toFixed(2))));
  }

  /**
   * Helper to locate the exact sentence around a word in the text
   */
  private static extractSentenceAround(fullText: string, term: string): string {
    const idx = fullText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return term;

    const start = Math.max(0, fullText.lastIndexOf('.', idx) + 1);
    let end = fullText.indexOf('.', idx + term.length);
    if (end === -1) end = fullText.length;

    const sentence = fullText.substring(start, end + 1).trim();
    return sentence.length > term.length ? sentence : term;
  }
}
