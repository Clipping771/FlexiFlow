import { z } from 'zod';

export const WordAnalysisSchema = z.object({
  selectedText: z.string(),
  selectionType: z.literal('word'),
  contextualMeaning: z.string(),
  simpleEnglishExplanation: z.string(),
  bengaliTranslation: z.string(),
  whyFitsContext: z.string(),
  partOfSpeech: z.string(),
  grammaticalNote: z.string().optional(),
  collocations: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).optional(),
  antonyms: z.array(z.string()).optional(),
  registerAndTone: z.string().optional()
});

export const PhraseAnalysisSchema = z.object({
  selectedText: z.string(),
  selectionType: z.literal('phrase'),
  phraseType: z.enum(['phrasal_verb', 'idiom', 'collocation', 'fixed_expression']),
  overallMeaning: z.string(),
  simpleEnglishExplanation: z.string().optional(),
  bengaliTranslation: z.string(),
  literalVsFigurative: z.string(),
  whyFitsContext: z.string(),
  componentsBreakdown: z.string().optional(),
  examples: z.array(z.string()).default([])
});

export const PhraseExplanationSchema = z.object({
  phrase: z.string().min(1),
  easyEnglish: z.string().default(''),
  easyBengali: z.string().default('')
});

export const SentenceAnalysisSchema = z.object({
  selectedText: z.string(),
  selectionType: z.literal('sentence').default('sentence'),
  plainEnglishParaphrase: z.string().optional().default(''),
  overallMeaning: z.string().optional().default(''),
  bengaliTranslation: z.string().default(''),
  phraseBreakdown: z.array(PhraseExplanationSchema).default([]),
  clauses: z.array(z.object({
    text: z.string(),
    type: z.string().default('main'),
    role: z.string().default('Main Clause'),
    explanationBengali: z.string().default('')
  })).default([]),
  grammaticalHighlights: z.array(z.string()).default([]),
  difficultVocabulary: z.array(z.object({
    word: z.string(),
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
});

export const ParagraphAnalysisSchema = z.object({
  selectedText: z.string(),
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
});

export const WritingAssistSchema = z.object({
  originalText: z.string(),
  goal: z.enum(['clarity', 'academic', 'natural', 'simplify', 'formal', 'concise']),
  improvedText: z.string(),
  changesExplanation: z.string(),
  bengaliExplanation: z.string(),
  alternatives: z.array(z.string()).default([])
});

export const FollowUpResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  bengaliSummary: z.string().default(''),
  keyTakeaway: z.string().optional(),
  suggestedFollowUps: z.array(z.string()).default([]),
  examples: z.array(z.object({
    english: z.string(),
    bengali: z.string().optional()
  })).default([])
});

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

