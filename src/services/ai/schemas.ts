import { z } from 'zod';

export const WordAnalysisSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.selectedText = copy.selectedText || copy.word || copy.text || copy.target || '';
  copy.selectionType = 'word';
  copy.contextualMeaning = copy.contextualMeaning || copy.meaning || copy.definition || copy.contextMeaning || copy.simpleEnglishExplanation || '';
  copy.simpleEnglishExplanation = copy.simpleEnglishExplanation || copy.contextualMeaning || copy.meaning || copy.definition || copy.easyEnglish || '';
  copy.bengaliTranslation = copy.bengaliTranslation || copy.translation || copy.easyBengali || copy.targetTranslation || copy.meaningBengali || '';
  copy.whyFitsContext = copy.whyFitsContext || copy.contextExplanation || copy.contextualFit || copy.reason || 'Fits naturally in this sentence context.';
  copy.partOfSpeech = copy.partOfSpeech || copy.pos || copy.type || 'word';
  if (!Array.isArray(copy.collocations)) {
    copy.collocations = copy.collocations ? [String(copy.collocations)] : [];
  }
  if (!Array.isArray(copy.examples)) {
    copy.examples = copy.examples ? [String(copy.examples)] : [];
  }
  return copy;
}, z.object({
  selectedText: z.string().default(''),
  selectionType: z.literal('word').default('word'),
  contextualMeaning: z.string().default(''),
  simpleEnglishExplanation: z.string().default(''),
  bengaliTranslation: z.string().default(''),
  whyFitsContext: z.string().default('Fits naturally in this sentence context.'),
  partOfSpeech: z.string().default('word'),
  grammaticalNote: z.string().optional(),
  collocations: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  registerAndTone: z.string().optional()
}));

export const PhraseAnalysisSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.selectedText = copy.selectedText || copy.phrase || copy.text || copy.target || '';
  copy.selectionType = 'phrase';
  const validPhraseTypes = ['phrasal_verb', 'idiom', 'collocation', 'fixed_expression'];
  if (!validPhraseTypes.includes(copy.phraseType)) {
    copy.phraseType = 'idiom';
  }
  copy.overallMeaning = copy.overallMeaning || copy.meaning || copy.definition || copy.contextualMeaning || '';
  copy.simpleEnglishExplanation = copy.simpleEnglishExplanation || copy.overallMeaning || '';
  copy.bengaliTranslation = copy.bengaliTranslation || copy.translation || copy.easyBengali || '';
  copy.literalVsFigurative = copy.literalVsFigurative || copy.figurativeMeaning || 'Contextual figurative expression.';
  copy.whyFitsContext = copy.whyFitsContext || copy.contextExplanation || 'Used naturally in this sentence.';
  if (!Array.isArray(copy.examples)) {
    copy.examples = copy.examples ? [String(copy.examples)] : [];
  }
  return copy;
}, z.object({
  selectedText: z.string().default(''),
  selectionType: z.literal('phrase').default('phrase'),
  phraseType: z.enum(['phrasal_verb', 'idiom', 'collocation', 'fixed_expression']).default('idiom'),
  overallMeaning: z.string().default(''),
  simpleEnglishExplanation: z.string().optional(),
  bengaliTranslation: z.string().default(''),
  literalVsFigurative: z.string().default('Contextual meaning'),
  whyFitsContext: z.string().default('Used naturally in this sentence.'),
  componentsBreakdown: z.string().optional(),
  examples: z.array(z.string()).default([])
}));

export const PhraseExplanationSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.phrase = copy.phrase || copy.text || copy.part || '';
  return copy;
}, z.object({
  phrase: z.string().default(''),
  easyEnglish: z.string().default(''),
  easyBengali: z.string().default('')
}));

export const SyntacticClauseSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.text = copy.text || copy.clause || copy.phrase || copy.part || copy.content || '';
  copy.type = copy.type || 'main';
  copy.role = copy.role || copy.function || 'Main Clause';
  copy.explanationBengali = copy.explanationBengali || copy.bengaliExplanation || copy.bengali || copy.explanation || '';
  return copy;
}, z.object({
  text: z.string().default(''),
  type: z.string().default('main'),
  role: z.string().default('Main Clause'),
  explanationBengali: z.string().default('')
}));

export const SentenceAnalysisSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.selectedText = copy.selectedText || copy.sentence || copy.text || '';
  copy.selectionType = 'sentence';
  copy.plainEnglishParaphrase = copy.plainEnglishParaphrase || copy.paraphrase || copy.overallMeaning || copy.simpleEnglish || '';
  copy.overallMeaning = copy.overallMeaning || copy.plainEnglishParaphrase || copy.meaning || '';
  copy.bengaliTranslation = copy.bengaliTranslation || copy.translation || copy.easyBengali || copy.bengali || '';
  const rawHighlights = copy.grammaticalHighlights || copy.grammaticalFeatures || copy.grammarFeatures || copy.grammar || [];
  copy.grammaticalHighlights = Array.isArray(rawHighlights) ? rawHighlights : [String(rawHighlights)];
  if (!Array.isArray(copy.clauses)) {
    copy.clauses = [];
  }
  if (!Array.isArray(copy.phraseBreakdown)) {
    copy.phraseBreakdown = [];
  }
  if (!Array.isArray(copy.difficultVocabulary)) {
    copy.difficultVocabulary = [];
  }
  copy.toneAndRegister = copy.toneAndRegister || copy.tone || 'Standard English';
  return copy;
}, z.object({
  selectedText: z.string().default(''),
  selectionType: z.literal('sentence').default('sentence'),
  plainEnglishParaphrase: z.string().optional().default(''),
  overallMeaning: z.string().optional().default(''),
  bengaliTranslation: z.string().default(''),
  phraseBreakdown: z.array(PhraseExplanationSchema).default([]),
  clauses: z.array(SyntacticClauseSchema).default([]),
  grammaticalHighlights: z.array(z.string()).default([]),
  difficultVocabulary: z.array(z.object({
    word: z.string().default(''),
    meaningInContext: z.string().optional().default(''),
    bengali: z.string().optional().default('')
  })).default([]),
  toneAndRegister: z.string().optional().default('Standard English')
}).transform((data) => {
  if (!data.plainEnglishParaphrase && data.overallMeaning) {
    data.plainEnglishParaphrase = data.overallMeaning;
  }
  if (!data.overallMeaning && data.plainEnglishParaphrase) {
    data.overallMeaning = data.plainEnglishParaphrase;
  }
  return data;
}));

export const ParagraphAnalysisSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.selectedText = copy.selectedText || copy.paragraph || copy.text || '';
  copy.selectionType = 'paragraph';
  return copy;
}, z.object({
  selectedText: z.string().default(''),
  selectionType: z.literal('paragraph').default('paragraph'),
  mainIdea: z.string().optional().default(''),
  conciseSummary: z.string().optional().default(''),
  bengaliTranslation: z.string().default(''),
  phraseBreakdown: z.array(PhraseExplanationSchema).default([]),
  sentenceBreakdown: z.array(z.string()).optional(),
  keyVocabulary: z.array(z.object({
    term: z.string(),
    meaning: z.string().optional().default(''),
    bengali: z.string().optional().default('')
  })).default([]),
  argumentStructure: z.string().optional().default(''),
  toneAndRegister: z.string().optional().default('Standard English')
}));

export const WritingAssistSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.originalText = copy.originalText || copy.text || '';
  const validGoals = ['clarity', 'academic', 'natural', 'simplify', 'formal', 'concise'];
  if (!validGoals.includes(copy.goal)) {
    copy.goal = 'natural';
  }
  copy.improvedText = copy.improvedText || copy.suggestion || copy.result || copy.text || '';
  copy.changesExplanation = copy.changesExplanation || copy.explanation || copy.reason || 'Enhanced for clarity and natural flow.';
  copy.bengaliExplanation = copy.bengaliExplanation || copy.translation || copy.targetExplanation || 'বাক্যের গঠন ও ভাব আরও স্বাভাবিক করা হয়েছে।';
  if (!Array.isArray(copy.alternatives)) {
    copy.alternatives = copy.alternatives ? [String(copy.alternatives)] : [];
  }
  return copy;
}, z.object({
  originalText: z.string().default(''),
  goal: z.enum(['clarity', 'academic', 'natural', 'simplify', 'formal', 'concise']).default('natural'),
  improvedText: z.string().default(''),
  changesExplanation: z.string().default(''),
  bengaliExplanation: z.string().default(''),
  alternatives: z.array(z.string()).default([])
}));

export const FollowUpResponseSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.question = copy.question || 'Question';
  copy.answer = copy.answer || copy.response || copy.explanation || '';
  copy.bengaliSummary = copy.bengaliSummary || copy.summary || copy.bengali || '';
  if (!Array.isArray(copy.suggestedFollowUps)) {
    copy.suggestedFollowUps = copy.suggestedFollowUps ? [String(copy.suggestedFollowUps)] : [];
  }
  if (!Array.isArray(copy.examples)) {
    copy.examples = copy.examples ? [copy.examples] : [];
  }
  return copy;
}, z.object({
  question: z.string().default(''),
  answer: z.string().default(''),
  bengaliSummary: z.string().default(''),
  keyTakeaway: z.string().optional(),
  suggestedFollowUps: z.array(z.string()).default([]),
  examples: z.array(z.object({
    english: z.string(),
    bengali: z.string().optional()
  })).default([])
}));

export const ArticleAnalysisSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceUrl: z.string().optional(),
  rawText: z.string(),
  createdAt: z.string(),
  summary: z.object({
    mainIdea: z.string(),
    conciseSummary: z.string(),
    keyTakeaways: z.array(z.string()).default([]),
    centralArgument: z.string()
  }),
  paragraphs: z.array(z.object({
    paragraphIndex: z.number(),
    originalText: z.string(),
    explanation: z.string(),
    sentenceClarifications: z.array(z.object({
      sentence: z.string(),
      clarification: z.string()
    })).default([]),
    difficultVocabulary: z.array(z.object({
      word: z.string(),
      meaningInContext: z.string(),
      bengali: z.string()
    })).default([]),
    bengaliExplanation: z.string().optional()
  })).default([]),
  connectors: z.array(z.object({
    expression: z.string(),
    type: z.enum(['contrast', 'cause_effect', 'concession', 'addition', 'example', 'conclusion', 'transition']),
    functionInContext: z.string(),
    paragraphIndex: z.number()
  })).default([]),
  claims: z.array(z.object({
    claim: z.string(),
    paragraphIndex: z.number(),
    evidenceProvided: z.string().optional(),
    isAssertedWithoutEvidence: z.boolean().default(false),
    excerpt: z.string(),
    aiInference: z.string().optional(),
    examples: z.array(z.string()).optional()
  })).default([]),
  argumentStructure: z.object({
    developmentFlow: z.string(),
    paragraphRelationships: z.array(z.string()).default([]),
    mainSupportingReasons: z.array(z.string()).default([]),
    counterargumentsAndConcessions: z.array(z.string()).optional(),
    conclusionRole: z.string()
  }),
  extractedVocabulary: z.array(z.object({
    word: z.string(),
    partOfSpeech: z.string().optional(),
    contextualMeaning: z.string(),
    bengaliMeaning: z.string(),
    contextSentence: z.string()
  })).default([])
});

// Stage A — Immediate Contextual Explanation Schema
export const StageAContextualSchema = z.object({
  selectedText: z.string().min(1),
  lemma: z.string().default(''),
  partOfSpeech: z.string().default('word'),
  easyEnglish: z.string().min(1),
  easyBengali: z.string().min(1),
  contextMeaning: z.string().min(1),
  example: z.string().optional(),
  exampleBengali: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
  uncertaintyReason: z.string().optional(),
  contextualSenseId: z.string().default('sense_1')
});

// Stage B — Detailed Vocabulary Exploration Schemas
export const SenseSynonymSchema = z.object({
  word: z.string().min(1),
  easyEnglish: z.string().min(1),
  easyBengali: z.string().min(1),
  nuance: z.string().optional()
});

export const SenseAntonymSchema = z.object({
  word: z.string().min(1),
  easyEnglish: z.string().min(1),
  easyBengali: z.string().min(1)
});

export const StageBSenseSchema = z.object({
  id: z.string().min(1),
  partOfSpeech: z.string().default('word'),
  easyEnglish: z.string().min(1),
  easyBengali: z.string().min(1),
  isContextual: z.boolean().default(false),
  registerOrType: z.enum(['literal', 'figurative', 'technical', 'idiomatic', 'standard']).optional(),
  examples: z.array(z.object({
    english: z.string(),
    bengali: z.string()
  })).default([]),
  synonyms: z.array(SenseSynonymSchema).default([]),
  antonyms: z.array(SenseAntonymSchema).default([])
});

export const StageBDetailedVocabularySchema = z.object({
  lemma: z.string().min(1),
  partOfSpeech: z.string().default('word'),
  contextualSenseId: z.string().default('sense_1'),
  senses: z.array(StageBSenseSchema).min(1),
  collocations: z.array(z.object({
    english: z.string(),
    bengali: z.string().optional()
  })).default([]),
  idiomsAndPhrases: z.array(z.object({
    phrase: z.string(),
    easyEnglish: z.string(),
    easyBengali: z.string()
  })).default([]),
  wordForms: z.array(z.object({
    form: z.string(),
    partOfSpeech: z.string()
  })).optional(),
  confusingWords: z.array(z.object({
    word: z.string(),
    difference: z.string(),
    bengaliDifference: z.string()
  })).optional()
});

