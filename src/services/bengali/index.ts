import { BENGALI_LEXICON, BengaliEntry } from './dictionary';
import { getCandidateLemmas } from '../dictionary/lemmatizer';

export interface BengaliTranslationResult {
  bengaliWord: string;
  bengaliExplanation: string;
  nuance?: string;
  isCurated: boolean;
  pos?: string;
}

export class BengaliService {
  /**
   * Look up curated Bengali explanation for a given word or phrase
   */
  static getMeaning(word: string, contextSentence?: string): BengaliTranslationResult {
    const raw = (word || '').trim().toLowerCase();
    
    // Context heuristic for words with multiple common meanings (e.g., 'address')
    if (raw === 'address' && contextSentence) {
      const lowerSentence = contextSentence.toLowerCase();
      if (lowerSentence.includes('issue') || lowerSentence.includes('problem') || lowerSentence.includes('concern')) {
        return {
          bengaliWord: 'সমস্যার সমাধান করা / মোকাবিলা করা',
          bengaliExplanation: 'এখানে address শব্দটি ক্রিয়াপদ হিসেবে কোনো সমস্যা সমাধানের উদ্যোগ নেওয়া বোঝাচ্ছে।',
          pos: 'verb',
          isCurated: true
        };
      } else if (lowerSentence.includes('audience') || lowerSentence.includes('crowd') || lowerSentence.includes('meeting')) {
        return {
          bengaliWord: 'ভাষণ দেওয়া / সম্বোধন করা',
          bengaliExplanation: 'শ্রোতাদের উদ্দেশ্যে আনুষ্ঠানিকভাবে বক্তব্য রাখা।',
          pos: 'verb',
          isCurated: true
        };
      }
    }

    // Check all morphological lemmas and spelling variants
    const candidateLemmas = getCandidateLemmas(raw);
    let entry: BengaliEntry | undefined;

    for (const lemma of candidateLemmas) {
      if (BENGALI_LEXICON[lemma]) {
        entry = BENGALI_LEXICON[lemma];
        break;
      }
    }

    // Handle multi-word phrase head lookup fallback
    if (!entry && raw.includes(' ')) {
      const words = raw.split(/\s+/);
      const head = words[0];
      if (BENGALI_LEXICON[head]) {
        entry = BENGALI_LEXICON[head];
      }
    }

    if (entry) {
      return {
        bengaliWord: entry.bengali,
        bengaliExplanation: entry.explanation,
        nuance: entry.nuance,
        pos: entry.pos,
        isCurated: true
      };
    }

    // Fallback: If not directly in offline curated dictionary, provide clear label
    return {
      bengaliWord: 'বাংলা অর্থ অনুসন্ধানযোগ্য',
      bengaliExplanation: `"${word}" শব্দটির বিস্তারিত বাংলা বিশ্লেষণ AI মোডে বা অনলাইন অভিধানে উপলব্ধ।`,
      isCurated: false
    };
  }
}
