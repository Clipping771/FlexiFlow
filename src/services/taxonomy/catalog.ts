import { z } from 'zod';

export const TaxonomyCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string()
});

export type TaxonomyCategory = z.infer<typeof TaxonomyCategorySchema>;

export const TaxonomyErrorSchema = z.object({
  code: z.string(),
  category: z.string(),
  name: z.string(),
  definition: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  context: z.string(),
  incorrect_example: z.string(),
  correct_example: z.string()
});

export type TaxonomyError = z.infer<typeof TaxonomyErrorSchema>;

export const CANONICAL_CATEGORIES: TaxonomyCategory[] = [
  { id: 'GRA', name: 'Grammar & Syntax', description: 'Structural, syntactical, and morphological errors' },
  { id: 'VOC', name: 'Lexical & Vocabulary', description: 'Word choice, collocations, precision, and academic register' },
  { id: 'MEC', name: 'Mechanics & Orthography', description: 'Punctuation, capitalization, and spelling' },
  { id: 'PTE', name: 'PTE Task & Trait Mechanics', description: 'Format, oral fluency, and automated scoring penalties specific to PTE Academic' },
  { id: 'IELTS', name: 'IELTS Rubric & Discourse Structure', description: 'Task response, coherence, and band descriptor criteria specific to IELTS Academic' }
];

export const CANONICAL_ERRORS: TaxonomyError[] = [
  // GRA
  {
    code: 'GRA.SUBJ_VERB_AGR',
    category: 'GRA',
    name: 'Subject-Verb Agreement Error',
    definition: 'The subject and verb do not agree in number or person.',
    severity: 'high',
    context: 'Universal (Writing & Speaking)',
    incorrect_example: 'The list of candidate items were reviewed by the examiner.',
    correct_example: 'The list of candidate items was reviewed by the examiner.'
  },
  {
    code: 'GRA.TENSE_INCONSISTENCY',
    category: 'GRA',
    name: 'Tense Inconsistency / Shift',
    definition: 'Unwarranted shift between past, present, or future tenses within a single discourse or paragraph.',
    severity: 'medium',
    context: 'Universal (Writing & Speaking)',
    incorrect_example: 'When the author publishes the study, researchers had verified the data.',
    correct_example: 'When the author published the study, researchers verified the data.'
  },
  {
    code: 'GRA.ARTICLE_DEF_INDEF',
    category: 'GRA',
    name: 'Article Usage (Definite vs Indefinite vs Zero Article)',
    definition: "Incorrect omission, insertion, or confusion between 'the', 'a/an', or zero article with countable/uncountable nouns.",
    severity: 'medium',
    context: 'Universal (Writing)',
    incorrect_example: 'Government should invest in the education to improve economy.',
    correct_example: 'The government should invest in education to improve the economy.'
  },
  {
    code: 'GRA.RUN_ON_SENTENCE',
    category: 'GRA',
    name: 'Run-On Sentence / Comma Splice',
    definition: 'Two independent clauses joined with only a comma or without any coordinating conjunction.',
    severity: 'high',
    context: 'Universal (Writing)',
    incorrect_example: 'Technological advancements accelerate quickly, universities must adapt their curricula.',
    correct_example: 'Technological advancements accelerate quickly; therefore, universities must adapt their curricula.'
  },
  {
    code: 'GRA.FRAGMENT',
    category: 'GRA',
    name: 'Sentence Fragment',
    definition: 'A dependent clause or phrase punctuated as an independent sentence without a main subject and finite verb.',
    severity: 'high',
    context: 'Universal (Writing)',
    incorrect_example: 'Although international migration promotes cross-cultural exchange. Leading to global innovation.',
    correct_example: 'Although international migration promotes cross-cultural exchange, it also leads to global innovation.'
  },
  {
    code: 'GRA.PREPOSITION_COLLOCATION',
    category: 'GRA',
    name: 'Prepositional Error',
    definition: 'Incorrect preposition following a dependent adjective, noun, or verb.',
    severity: 'medium',
    context: 'Universal (Writing & Speaking)',
    incorrect_example: 'The university is responsible of providing accommodation.',
    correct_example: 'The university is responsible for providing accommodation.'
  },
  {
    code: 'GRA.PASSIVE_CONSTRUCTION',
    category: 'GRA',
    name: 'Faulty Passive Voice Formation',
    definition: 'Incorrect auxiliary verb or past participle form in passive voice structures.',
    severity: 'medium',
    context: 'Universal (Writing)',
    incorrect_example: 'The questionnaire was distribute to three hundred participants.',
    correct_example: 'The questionnaire was distributed to three hundred participants.'
  },
  {
    code: 'GRA.CONDITIONAL_ERROR',
    category: 'GRA',
    name: 'Faulty Conditional Clause',
    definition: 'Mismatched verb forms across if-clause and main result clause.',
    severity: 'high',
    context: 'Universal (Writing & Speaking)',
    incorrect_example: 'If governments will impose strict policies, pollution would decrease.',
    correct_example: 'If governments imposed strict policies, pollution would decrease.'
  },

  // VOC
  {
    code: 'VOC.COLLOCATION_UNNATURAL',
    category: 'VOC',
    name: 'Unnatural Word Collocation',
    definition: 'Pairing words that do not naturally co-occur in standard English academic usage.',
    severity: 'medium',
    context: 'Universal (Writing & Speaking)',
    incorrect_example: 'He did a heavy mistake by ignoring empirical statistics.',
    correct_example: 'He made a grave mistake by ignoring empirical statistics.'
  },
  {
    code: 'VOC.IMPRECISE_WORD_CHOICE',
    category: 'VOC',
    name: 'Imprecise or Inaccurate Lexical Choice',
    definition: 'Using a word whose dictionary definition roughly matches but whose semantic connotation fails in context.',
    severity: 'medium',
    context: 'Universal (Writing)',
    incorrect_example: 'The chart exposes that vehicle sales augmented significantly.',
    correct_example: 'The chart demonstrates that vehicle sales increased significantly.'
  },
  {
    code: 'VOC.INFORMAL_REGISTER',
    category: 'VOC',
    name: 'Informal / Slang Register in Academic Discourse',
    definition: 'Using colloquialisms, contractions, or conversational idioms inappropriate for academic essays.',
    severity: 'medium',
    context: 'Academic Writing',
    incorrect_example: "A lot of folks don't get the importance of renewable energy.",
    correct_example: 'Many individuals fail to comprehend the significance of renewable energy.'
  },
  {
    code: 'VOC.REDUNDANT_WORDINESS',
    category: 'VOC',
    name: 'Tautology & Redundant Wordiness',
    definition: 'Unnecessary repetition of the same idea using overlapping words.',
    severity: 'low',
    context: 'Universal (Writing)',
    incorrect_example: 'The past history of the region reveals prior existing conflicts.',
    correct_example: 'The history of the region reveals prior conflicts.'
  },
  {
    code: 'VOC.FALSE_FRIEND_L1',
    category: 'VOC',
    name: 'L1 Negative Transfer / Calque',
    definition: 'Direct literal translation from mother tongue (e.g. Bengali) resulting in awkward English structure.',
    severity: 'medium',
    context: 'Universal',
    incorrect_example: 'He gave an exam yesterday.',
    correct_example: 'He took an exam yesterday.'
  },
  {
    code: 'VOC.MALAPROPISM_CONFUSION',
    category: 'VOC',
    name: 'Confusing Minimal Pairs / Sound-Alikes',
    definition: 'Substituting a word for another phonetically similar but semantically distinct word.',
    severity: 'high',
    context: 'Universal (Writing)',
    incorrect_example: 'The tax policies have a detrimental affect on small businesses.',
    correct_example: 'The tax policies have a detrimental effect on small businesses.'
  },

  // MEC
  {
    code: 'MEC.SPELLING_ACADEMIC',
    category: 'MEC',
    name: 'High-Frequency Academic Spelling Error',
    definition: 'Misspelling standard academic vocabulary.',
    severity: 'medium',
    context: 'Writing',
    incorrect_example: 'The goverment has committed to environmental accomodation.',
    correct_example: 'The government has committed to environmental accommodation.'
  },
  {
    code: 'MEC.APOSTROPHE_CONFUSION',
    category: 'MEC',
    name: 'Apostrophe for Possession vs Contraction',
    definition: "Confusing its/it's, their/they're, or misuse of apostrophe in plural nouns.",
    severity: 'medium',
    context: 'Writing',
    incorrect_example: "The company improved it's environmental footprint in the 1990's.",
    correct_example: 'The company improved its environmental footprint in the 1990s.'
  },
  {
    code: 'MEC.PUNCTUATION_CLAUSE',
    category: 'MEC',
    name: 'Introductory Clause Punctuation Error',
    definition: 'Omitting a comma after an introductory adverbial clause or transitional linking adverb.',
    severity: 'low',
    context: 'Writing',
    incorrect_example: 'Furthermore the experimental results validate the primary hypothesis.',
    correct_example: 'Furthermore, the experimental results validate the primary hypothesis.'
  },
  {
    code: 'MEC.CAPITALIZATION_PROPER',
    category: 'MEC',
    name: 'Capitalization Error',
    definition: 'Failing to capitalize proper nouns, nationalities, languages, or beginning of sentences.',
    severity: 'low',
    context: 'Writing',
    incorrect_example: 'The european union introduced new green legislation in march.',
    correct_example: 'The European Union introduced new green legislation in March.'
  },

  // PTE
  {
    code: 'PTE.SWT_MULTI_SENTENCE',
    category: 'PTE',
    name: 'PTE SWT: Multiple Sentence Form Penalty',
    definition: 'Summarize Written Text must be strictly ONE single complete sentence.',
    severity: 'critical',
    context: 'PTE Summarize Written Text',
    incorrect_example: 'Renewable energy is growing rapidly. However, storage costs remain high.',
    correct_example: 'While renewable energy is growing rapidly, high storage costs continue to hinder widespread adoption.'
  },
  {
    code: 'PTE.SWT_WORD_COUNT_BOUNDARY',
    category: 'PTE',
    name: 'PTE SWT: Word Count Boundary Breach',
    definition: 'PTE SWT response must be between 5 and 75 words.',
    severity: 'critical',
    context: 'PTE Summarize Written Text',
    incorrect_example: 'Summary response containing 78 words.',
    correct_example: 'Concise summary response containing 42 words.'
  },
  {
    code: 'PTE.ORAL_HESITATION_LONG',
    category: 'PTE',
    name: 'PTE Speaking: Extended Hesitation (>3 Seconds)',
    definition: 'In PTE speaking, pausing for 3 consecutive seconds causes the microphone to shut off.',
    severity: 'critical',
    context: 'PTE Speaking (All Tasks)',
    incorrect_example: 'The speaker pauses for 3.4 seconds searching for words.',
    correct_example: 'The speaker utilizes natural continuous pacing without dead pauses.'
  },
  {
    code: 'PTE.READ_ALOUD_FLAT_PITCH',
    category: 'PTE',
    name: 'PTE Read Aloud: Monotone / Unnatural Chunking',
    definition: 'Reading robotic, word-by-word without rhythm or thought-group chunking.',
    severity: 'high',
    context: 'PTE Read Aloud',
    incorrect_example: 'Word. By. Word. Flat. Cadence.',
    correct_example: 'Smooth phrasal chunking with appropriate rising and falling intonation.'
  },
  {
    code: 'PTE.ESSAY_WORD_LIMIT',
    category: 'PTE',
    name: 'PTE Write Essay: Word Count Under/Over Limit',
    definition: 'PTE Write Essay requires 200–300 words.',
    severity: 'high',
    context: 'PTE Write Essay',
    incorrect_example: 'An essay containing 182 words.',
    correct_example: 'A well-structured essay containing 255 words.'
  },
  {
    code: 'PTE.REPEAT_SENTENCE_OMISSION',
    category: 'PTE',
    name: 'PTE Repeat Sentence: Sequential Content Drop',
    definition: 'Omitting the middle or final 50% of the sentence.',
    severity: 'high',
    context: 'PTE Repeat Sentence',
    incorrect_example: 'Repeating only first 3 words out of a 10-word sentence.',
    correct_example: 'Repeating at least 80% of words in their correct original sequence.'
  },

  // IELTS
  {
    code: 'IELTS.TASK2_TR_INCOMPLETE',
    category: 'IELTS',
    name: 'IELTS Task 2: Incomplete Task Response',
    definition: 'Failing to address all parts of the essay prompt.',
    severity: 'critical',
    context: 'IELTS Writing Task 2',
    incorrect_example: 'Writing exclusively about benefits when asked to analyze advantages and disadvantages.',
    correct_example: 'Equitably analyzing both advantages and disadvantages with clear personal perspective.'
  },
  {
    code: 'IELTS.TASK2_MEMORIZED_TEMPLATE',
    category: 'IELTS',
    name: 'IELTS Task 2: Memorized Formulaic Clichés',
    definition: "Using generic overused template fillers penalized by examiners.",
    severity: 'high',
    context: 'IELTS Writing Task 2',
    incorrect_example: 'Since the dawn of human civilization, this debatable topic has been controversial.',
    correct_example: 'Whether governments should subsidize electric vehicles has sparked significant economic debate.'
  },
  {
    code: 'IELTS.TASK1_MISSING_OVERVIEW',
    category: 'IELTS',
    name: 'IELTS Task 1: Missing or Ineffective Overview',
    definition: 'Failing to present a clear overall trend or summary of main features caps Task Achievement at Band 5.',
    severity: 'critical',
    context: 'IELTS Writing Task 1',
    incorrect_example: 'Listing every single percentage figure year-by-year without an overall trend sentence.',
    correct_example: 'Overall, solar energy consumption experienced an upward trajectory, whereas coal declined steadily.'
  },
  {
    code: 'IELTS.COHESION_OVERUSE_CONNECTORS',
    category: 'IELTS',
    name: 'IELTS CC: Mechanical Overuse of Cohesive Linkers',
    definition: 'Starting every sentence with a mechanical linker (Furthermore, Moreover, In addition).',
    severity: 'medium',
    context: 'IELTS Writing (Tasks 1 & 2)',
    incorrect_example: 'First of all, X. Furthermore, Y. Moreover, Z. Consequently, W.',
    correct_example: 'Blending referential pronouns, thematic progression, and varied transitional devices naturally.'
  },
  {
    code: 'IELTS.SPEAKING_SHORT_TURNS',
    category: 'IELTS',
    name: 'IELTS Speaking Part 3: Under-Extended Responses',
    definition: 'Providing one-sentence superficial answers without explanation or examples.',
    severity: 'high',
    context: 'IELTS Speaking Part 3',
    incorrect_example: 'Yes, I think pollution is bad because it harms health.',
    correct_example: 'Extending with root causes, institutional regulations, and future implications.'
  },
  {
    code: 'IELTS.SPEAKING_SELF_CORRECTION_OVERLOAD',
    category: 'IELTS',
    name: 'IELTS Speaking: Excessive Self-Correction Affecting Fluency',
    definition: 'Constantly restarting phrases to correct minor grammar, breaking fluency below Band 6.',
    severity: 'medium',
    context: 'IELTS Speaking (All Parts)',
    incorrect_example: 'The people was... were... have been... had been going to the market.',
    correct_example: 'Maintaining natural communicative momentum with minimal hesitation.'
  }
];

export class TaxonomyService {
  private static errorMap = new Map<string, TaxonomyError>(
    CANONICAL_ERRORS.map((e) => [e.code, TaxonomyErrorSchema.parse(e)])
  );

  static getError(code: string): TaxonomyError | undefined {
    return this.errorMap.get(code);
  }

  static isValidCode(code: string): boolean {
    return this.errorMap.has(code);
  }

  static getByCategory(category: string): TaxonomyError[] {
    return CANONICAL_ERRORS.filter((e) => e.category === category);
  }

  static getAll(): TaxonomyError[] {
    return CANONICAL_ERRORS;
  }

  static getCategories(): TaxonomyCategory[] {
    return CANONICAL_CATEGORIES;
  }
}
