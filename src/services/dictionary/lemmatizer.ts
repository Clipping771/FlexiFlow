/**
 * Morphological Lemmatizer and Candidate Stem Generator (Stage 7).
 * Provides instantaneous (< 0.005ms) rule-based morphological normalization for:
 * - Plural nouns (-ies, -es, -s, irregulars)
 * - Verb inflections (-ing, -ed, silent 'e', double consonant gemination, irregulars)
 * - Adverbial inflections (-ly)
 * - British / American spelling variants (-ise/-ize, -our/-or, fertiliser/fertilizer)
 * - Contractions (won't, can't, don't, etc.)
 */

// Irregular verb mappings (past/participle -> base)
const IRREGULAR_VERBS: Record<string, string> = {
  led: 'lead',
  sought: 'seek',
  bought: 'buy',
  sold: 'sell',
  rose: 'rise',
  risen: 'rise',
  grew: 'grow',
  grown: 'grow',
  drove: 'drive',
  driven: 'drive',
  chose: 'choose',
  chosen: 'choose',
  felt: 'feel',
  found: 'find',
  held: 'hold',
  kept: 'keep',
  lost: 'lose',
  paid: 'pay',
  ran: 'run',
  sent: 'send',
  spent: 'spend',
  stood: 'stand',
  took: 'take',
  taken: 'take',
  wrote: 'write',
  written: 'write',
  knew: 'know',
  known: 'know',
  saw: 'see',
  seen: 'see',
  came: 'come',
  became: 'become',
  began: 'begin',
  begun: 'begin',
  built: 'build',
  brought: 'bring',
  caught: 'catch',
  drew: 'draw',
  drawn: 'draw',
  fell: 'fall',
  fallen: 'fall',
  gave: 'give',
  given: 'give',
  went: 'go',
  gone: 'go',
  heard: 'hear',
  laid: 'lay',
  left: 'leave',
  met: 'meet',
  read: 'read',
  said: 'say',
  set: 'set',
  spoke: 'speak',
  spoken: 'speak',
  told: 'tell',
  thought: 'think',
  understood: 'understand',
  won: 'win',
  worn: 'wear',
  wore: 'wear'
};

// Irregular plural mappings
const IRREGULAR_PLURALS: Record<string, string> = {
  indices: 'index',
  indexes: 'index',
  criteria: 'criterion',
  phenomena: 'phenomenon',
  analyses: 'analysis',
  crises: 'crisis',
  hypotheses: 'hypothesis',
  children: 'child',
  people: 'person',
  data: 'datum',
  matrices: 'matrix',
  appendices: 'appendix',
  curricula: 'curriculum',
  diagnoses: 'diagnosis',
  theses: 'thesis'
};

// Common spelling dualisms (British <-> American)
const SPELLING_VARIANTS: Record<string, string> = {
  fertiliser: 'fertilizer',
  fertilizer: 'fertiliser',
  subsidise: 'subsidize',
  subsidize: 'subsidise',
  subsidised: 'subsidized',
  subsidized: 'subsidised',
  privatise: 'privatize',
  privatize: 'privatise',
  privatised: 'privatized',
  privatized: 'privatised',
  scrutinise: 'scrutinize',
  scrutinize: 'scrutinise',
  favour: 'favor',
  favor: 'favour',
  labour: 'labor',
  labor: 'labour',
  colour: 'color',
  color: 'colour',
  centre: 'center',
  center: 'centre',
  programme: 'program',
  program: 'programme',
  catalyse: 'catalyze',
  catalyze: 'catalyse'
};

// Contractions mapping
const CONTRACTIONS: Record<string, string> = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "won't": "will not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "couldn't": "could not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "it's": "it is",
  "that's": "that is",
  "what's": "what is",
  "there's": "there is",
  "they're": "they are",
  "we're": "we are",
  "you're": "you are"
};

/**
 * Generates an ordered list of candidate lemmas for a given input token.
 * Output order prioritizes exact form, then direct lemmas, then inflection stems.
 */
export function getCandidateLemmas(rawWord: string): string[] {
  if (!rawWord || typeof rawWord !== 'string') return [];
  const normalized = rawWord.trim().toLowerCase().replace(/^['"“‘]+|['"”’]+$/g, '');
  if (!normalized) return [];

  const candidates: Set<string> = new Set();

  // 1. Exact raw word
  candidates.add(normalized);

  // 2. Direct contraction resolution
  if (CONTRACTIONS[normalized]) {
    candidates.add(CONTRACTIONS[normalized]);
  }

  // 3. Known British/American spelling twin
  if (SPELLING_VARIANTS[normalized]) {
    candidates.add(SPELLING_VARIANTS[normalized]);
  }

  // 4. Irregular verbs
  if (IRREGULAR_VERBS[normalized]) {
    candidates.add(IRREGULAR_VERBS[normalized]);
  }

  // 5. Irregular plurals
  if (IRREGULAR_PLURALS[normalized]) {
    candidates.add(IRREGULAR_PLURALS[normalized]);
  }

  // 6. Plural suffixes
  if (normalized.endsWith('ies') && normalized.length > 4) {
    candidates.add(normalized.slice(0, -3) + 'y');
  } else if (normalized.endsWith('ves') && normalized.length > 4) {
    candidates.add(normalized.slice(0, -3) + 'f');
    candidates.add(normalized.slice(0, -3) + 'fe');
  } else if (normalized.endsWith('es') && normalized.length > 3) {
    candidates.add(normalized.slice(0, -2));
    candidates.add(normalized.slice(0, -1)); // e.g. crises -> crise? usually irregular handled above
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 2) {
    candidates.add(normalized.slice(0, -1));
  }

  // 7. Participle & Gerund suffixes (-ing)
  if (normalized.endsWith('ing') && normalized.length > 4) {
    const stem = normalized.slice(0, -3);
    candidates.add(stem);        // e.g. rethink -> rethinking
    candidates.add(stem + 'e');   // e.g. mitigate -> mitigating, smuggle -> smuggling

    // Degemination (e.g. running -> run, stopping -> stop)
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      candidates.add(stem.slice(0, -1));
    }
  }

  // 8. Past tense suffixes (-ed)
  if (normalized.endsWith('ed') && normalized.length > 3) {
    if (normalized.endsWith('ied') && normalized.length > 4) {
      candidates.add(normalized.slice(0, -3) + 'y'); // e.g. subsidized -> subsidize or studied -> study
    }
    const stemNoEd = normalized.slice(0, -2);
    const stemNoD = normalized.slice(0, -1);
    candidates.add(stemNoEd); // e.g. reform -> reformed
    candidates.add(stemNoD);  // e.g. allocate -> allocated

    // Degemination (e.g. stopped -> stop, occurred -> occur)
    if (stemNoEd.length > 2 && stemNoEd[stemNoEd.length - 1] === stemNoEd[stemNoEd.length - 2]) {
      candidates.add(stemNoEd.slice(0, -1));
    }
  }

  // 9. Adverb suffixes (-ly)
  if (normalized.endsWith('ly') && normalized.length > 4) {
    if (normalized.endsWith('ily')) {
      candidates.add(normalized.slice(0, -3) + 'y');
    }
    candidates.add(normalized.slice(0, -2)); // e.g. substantially -> substantial
  }

  // Also include spelling variants of any derived stems
  for (const c of Array.from(candidates)) {
    if (SPELLING_VARIANTS[c]) {
      candidates.add(SPELLING_VARIANTS[c]);
    }
  }

  return Array.from(candidates);
}
