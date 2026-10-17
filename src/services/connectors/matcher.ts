/**
 * LexiFlow 2.0 - Closed-List Discourse Connector Matcher & Why This Matters Validator
 *
 * Strict pedagogical discourse connector detection based on an unambiguous closed list.
 * Ambiguous polysemous words (e.g. 'while', 'since', 'as', 'so') are strictly excluded
 * to eliminate false positives in reading comprehension.
 */

export type ConnectorCategory =
  | 'contrast'
  | 'consequence'
  | 'addition'
  | 'condition'
  | 'exemplification';

export interface ConnectorDefinition {
  pattern: string; // Exact phrase / word
  category: ConnectorCategory;
  categoryLabel: string;
  discourseRole: string;
  defaultBengaliRole: string;
}

export interface MatchedConnector {
  text: string;
  normalized: string;
  category: ConnectorCategory;
  categoryLabel: string;
  discourseRole: string;
  defaultBengaliRole: string;
  startIndex: number;
  endIndex: number;
}

export interface ValidatedWhyThisMatters {
  connector: MatchedConnector;
  explanation: string;
  isAiValidated: boolean;
}

/**
 * Strict approved closed list of unambiguous discourse markers.
 */
export const APPROVED_DISCOURSE_CONNECTORS: ConnectorDefinition[] = [
  // 1. Contrast / Concession
  {
    pattern: 'however',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Signals a shift or contrast against the preceding statement',
    defaultBengaliRole: 'পূর্ববর্তী বক্তব্যের বিপরীতে নতুন বা ব্যতিক্রমী বক্তব্য নির্দেশ করে'
  },
  {
    pattern: 'nevertheless',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Emphasizes that the following fact remains true despite earlier points',
    defaultBengaliRole: 'বাধা বা প্রতিকূলতা সত্ত্বেও মূল ঘটনাটি ঘটে বোঝায়'
  },
  {
    pattern: 'nonetheless',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Establishes a concession: the main point holds true regardless',
    defaultBengaliRole: 'যেকোনো প্রতিকূলতা সত্ত্বেও প্রধান বক্তব্য অটুট থাকে'
  },
  {
    pattern: 'although',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Introduces a concessive clause that contrasts with the main clause',
    defaultBengaliRole: 'শর্তসাপেক্ষ বিপরীত ভাব প্রকাশ করে'
  },
  {
    pattern: 'even though',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Strongly emphasizes an unexpected contrast or concession',
    defaultBengaliRole: 'দৃঢ় বৈপরীত্য বা অপ্রত্যাশিত ফলাফল প্রকাশ করে'
  },
  {
    pattern: 'in contrast',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Explicitly juxtaposes two contrasting facts or perspectives',
    defaultBengaliRole: 'স্পষ্টভাবে দুটি ভিন্ন দিক বা তুলনামূলক বৈপরীত্য তুলে ধরে'
  },
  {
    pattern: 'on the contrary',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Rejects the previous assertion and presents the opposite truth',
    defaultBengaliRole: 'পূর্বের বক্তব্য নাকচ করে সঠিক বিপরীত বক্তব্য তুলে ধরে'
  },
  {
    pattern: 'on the other hand',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Presents an alternative perspective or contrasting consideration',
    defaultBengaliRole: 'অন্য দৃষ্টিকোণ বা বিপরীত বিবেচনা উপস্থাপন করে'
  },
  {
    pattern: 'whereas',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Directly balances two contrasting facts in parallel clauses',
    defaultBengaliRole: 'একই সঙ্গে দুটি বিপরীত বিষয়ের মধ্যে তুলনা করে'
  },
  {
    pattern: 'conversely',
    category: 'contrast',
    categoryLabel: 'Contrast / Concession',
    discourseRole: 'Introduces the exact opposite relationship or logical inverse',
    defaultBengaliRole: 'বিপরীত সম্পর্ক বা যৌক্তিক বিপরীত দিক দেখায়'
  },

  // 2. Consequence / Result
  {
    pattern: 'therefore',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Introduces a logical conclusion or deductive outcome',
    defaultBengaliRole: 'পূর্ববর্তী তথ্যের যৌক্তিক সিদ্ধান্ত বা পরিণতি বোঝায়'
  },
  {
    pattern: 'consequently',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Highlights direct consequence or causality resulting from prior events',
    defaultBengaliRole: 'পূর্ববর্তী ঘটনার প্রত্যক্ষ ফলাফল বা প্রভাব নির্দেশ করে'
  },
  {
    pattern: 'as a result',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Clearly marks the outcome of the preceding premise',
    defaultBengaliRole: 'পূর্ববর্তী কারণের ফলশ্রুতি বা পরিণতি ব্যক্ত করে'
  },
  {
    pattern: 'thus',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Summarizes a logical deduction or demonstration',
    defaultBengaliRole: 'যৌক্তিক প্রমাণ বা সংক্ষিপ্ত ফলাফল প্রকাশ করে'
  },
  {
    pattern: 'hence',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Expresses direct inference or origin stemming from the statement',
    defaultBengaliRole: 'উৎস বা প্রত্যক্ষ যুক্তি নির্দেশ করে'
  },
  {
    pattern: 'accordingly',
    category: 'consequence',
    categoryLabel: 'Consequence / Result',
    discourseRole: 'Indicates action or state that follows in accordance with expectations',
    defaultBengaliRole: 'পূর্ববর্তী পরিস্থিতির সাথে সামঞ্জস্যপূর্ণ প্রতিক্রিয়া বোঝায়'
  },

  // 3. Addition / Reinforcement
  {
    pattern: 'furthermore',
    category: 'addition',
    categoryLabel: 'Addition / Reinforcement',
    discourseRole: 'Adds an extra, persuasive layer of supporting argument',
    defaultBengaliRole: 'পূর্বের যুক্তিকে আরও জোরালো করতে অতিরিক্ত তথ্য যোগ করে'
  },
  {
    pattern: 'moreover',
    category: 'addition',
    categoryLabel: 'Addition / Reinforcement',
    discourseRole: 'Supplies an important additional point that reinforces the main thesis',
    defaultBengaliRole: 'মূল বক্তব্যের সমর্থনে অধিকতর গুরুত্বপূর্ণ যুক্তি দেয়'
  },
  {
    pattern: 'in addition',
    category: 'addition',
    categoryLabel: 'Addition / Reinforcement',
    discourseRole: 'Introduces supplementary facts alongside existing evidence',
    defaultBengaliRole: 'বিদ্যমান তথ্যের পাশাপাশি অতিরিক্ত সম্পূরক তথ্য যোগ করে'
  },
  {
    pattern: 'besides that',
    category: 'addition',
    categoryLabel: 'Addition / Reinforcement',
    discourseRole: 'Offers an additional consideration that extends the argument',
    defaultBengaliRole: 'তর্ক বা আলোচনায় অতিরিক্ত বিবেচনা যোগ করে'
  },
  {
    pattern: 'additionally',
    category: 'addition',
    categoryLabel: 'Addition / Reinforcement',
    discourseRole: 'Adds a distinct supporting detail of equal relevance',
    defaultBengaliRole: 'সমমর্যাদাসম্পন্ন আরেকটি তথ্য সংযুক্ত করে'
  },

  // 4. Condition / Qualification
  {
    pattern: 'provided that',
    category: 'condition',
    categoryLabel: 'Condition / Qualification',
    discourseRole: 'Specifies the critical condition that must be met for success',
    defaultBengaliRole: 'নির্দিষ্ট আবশ্যকীয় শর্ত পূরণ হলেই কেবল প্রযোজ্য হবে বোঝায়'
  },
  {
    pattern: 'as long as',
    category: 'condition',
    categoryLabel: 'Condition / Qualification',
    discourseRole: 'Specifies temporal or conditional bounds for the action',
    defaultBengaliRole: 'যতক্ষণ নির্দিষ্ট শর্ত বিদ্যমান থাকে ততক্ষণ কার্যকর থাকবে নির্দেশ করে'
  },
  {
    pattern: 'unless',
    category: 'condition',
    categoryLabel: 'Condition / Qualification',
    discourseRole: 'Sets a negative condition: true except if this specific case occurs',
    defaultBengaliRole: 'ব্যতিক্রমী বা নেতিবাচক শর্ত বোঝায় (যদি না...)'
  },
  {
    pattern: 'on condition that',
    category: 'condition',
    categoryLabel: 'Condition / Qualification',
    discourseRole: 'Imposes a strict contractual or logical prerequisite',
    defaultBengaliRole: 'সুনির্দিষ্ট পূর্বশর্ত নির্ধারণ করে'
  },

  // 5. Exemplification / Clarification
  {
    pattern: 'for example',
    category: 'exemplification',
    categoryLabel: 'Exemplification / Clarification',
    discourseRole: 'Grounds the abstract idea with a tangible real-world instance',
    defaultBengaliRole: 'সাধারণ ধারণাকে বাস্তব উদাহরণের সাহায্যে স্পষ্ট করে'
  },
  {
    pattern: 'for instance',
    category: 'exemplification',
    categoryLabel: 'Exemplification / Clarification',
    discourseRole: 'Presents a specific situation illustrating the broader claim',
    defaultBengaliRole: 'নির্দিষ্ট কোনো পরিস্থিতির মাধ্যমে মূল বক্তব্য চিত্রায়িত করে'
  },
  {
    pattern: 'specifically',
    category: 'exemplification',
    categoryLabel: 'Exemplification / Clarification',
    discourseRole: 'Narrows the focus to precise details or specialized instances',
    defaultBengaliRole: 'সুনির্দিষ্ট বিস্তারিত বা বিশেষ ক্ষেত্র নির্দেশ করে'
  },
  {
    pattern: 'in particular',
    category: 'exemplification',
    categoryLabel: 'Exemplification / Clarification',
    discourseRole: 'Distinguishes one standout example among multiple possibilities',
    defaultBengaliRole: 'বিশেষভাবে উল্লেখযোগ্য একটি উদাহরণ বা ক্ষেত্র চিহ্নিত করে'
  }
];

// Sort patterns by length descending so multi-word connectors match before single words
const SORTED_CONNECTORS = [...APPROVED_DISCOURSE_CONNECTORS].sort(
  (a, b) => b.pattern.length - a.pattern.length
);

/**
 * Scans text deterministically for connectors from the closed list.
 * Respects word boundaries and case-insensitivity.
 */
export function findDiscourseConnectors(text: string): MatchedConnector[] {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (clean.length < 3) return [];

  const results: MatchedConnector[] = [];
  const occupiedIndices = new Set<number>();

  for (const def of SORTED_CONNECTORS) {
    // Escape regex special chars in pattern
    const escaped = def.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Ensure word boundaries: handles start/end of string or punctuation
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])(${escaped})(?:$|[^a-zA-Z0-9])`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clean)) !== null) {
      // Find actual index of captured group within the match
      const fullMatch = match[0];
      const matchedGroup = match[1];
      const groupOffset = fullMatch.indexOf(matchedGroup);
      const startIndex = match.index + groupOffset;
      const endIndex = startIndex + matchedGroup.length;

      // Check for overlap with already matched longer phrases
      let overlaps = false;
      for (let i = startIndex; i < endIndex; i++) {
        if (occupiedIndices.has(i)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        for (let i = startIndex; i < endIndex; i++) {
          occupiedIndices.add(i);
        }
        results.push({
          text: clean.slice(startIndex, endIndex),
          normalized: def.pattern,
          category: def.category,
          categoryLabel: def.categoryLabel,
          discourseRole: def.discourseRole,
          defaultBengaliRole: def.defaultBengaliRole,
          startIndex,
          endIndex
        });
      }
    }
  }

  // Sort matched connectors by appearance position
  return results.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Validates candidate whyItMatters text.
 * Rejects empty, boilerplate, or placeholder strings.
 */
export function validateWhyItMatters(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 8) return null;

  // Reject generic placeholders
  const isGeneric = /^(n\/a|none|null|undefined|placeholder|unknown|not applicable|no importance|why it matters)$/i.test(trimmed);
  if (isGeneric) return null;

  return trimmed;
}

/**
 * Combines rule-based closed-list connector detection with AI whyItMatters validation.
 * Crucial rule: If uncertain or no connector matches, returns null (omit gracefully).
 */
export function getValidatedWhyThisMatters(
  sentenceOrWord: string,
  aiWhyItMatters?: string
): ValidatedWhyThisMatters | null {
  const matches = findDiscourseConnectors(sentenceOrWord);
  if (!matches || matches.length === 0) {
    return null;
  }

  const primary = matches[0];
  const validatedAi = validateWhyItMatters(aiWhyItMatters);

  if (validatedAi) {
    return {
      connector: primary,
      explanation: validatedAi,
      isAiValidated: true
    };
  }

  // Fallback to deterministic pedagogical role if AI explanation was uncertain/missing
  return {
    connector: primary,
    explanation: `${primary.discourseRole}. (${primary.defaultBengaliRole})`,
    isAiValidated: false
  };
}
