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
  grammaticalRole: z.string().optional(),
  grammaticalNote: z.string().optional(),
  transitivityOrPattern: z.string().optional(),
  wordForms: z.array(z.string()).default([]),
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
  copy.grammaticalStructure = copy.grammaticalStructure || copy.grammarPattern || '';
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
  grammaticalStructure: z.string().optional(),
  componentsBreakdown: z.string().optional(),
  examples: z.array(z.string()).default([])
}));

export const PhraseExplanationSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.phrase = copy.phrase || copy.text || copy.part || '';
  copy.easyEnglish = copy.easyEnglish || copy.english || copy.meaning || '';
  copy.easyBengali = copy.easyBengali || copy.bengali || copy.translation || '';
  copy.grammaticalFunction = copy.grammaticalFunction || copy.grammarRole || copy.role || '';
  copy.connection = copy.connection || copy.relation || '';
  copy.whyItMatters = copy.whyItMatters || copy.significance || '';
  copy.simplerExample = copy.simplerExample || copy.example || '';
  return copy;
}, z.object({
  phrase: z.string().default(''),
  easyEnglish: z.string().default(''),
  easyBengali: z.string().default(''),
  grammaticalFunction: z.string().optional(),
  connection: z.string().optional(),
  whyItMatters: z.string().optional(),
  simplerExample: z.string().optional()
}));

export const SyntacticClauseSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.text = copy.text || copy.clause || copy.phrase || copy.part || copy.content || '';
  copy.type = copy.type || 'main';
  copy.role = copy.role || copy.function || 'Main Clause';
  copy.explanationBengali = copy.explanationBengali || copy.bengaliExplanation || copy.bengali || copy.explanation || '';
  copy.typeExplanation = copy.typeExplanation || copy.definition || '';
  copy.subjectAndVerb = copy.subjectAndVerb || copy.subjectVerb || '';
  copy.questionAnswered = copy.questionAnswered || copy.question || '';
  copy.dependsOn = copy.dependsOn || copy.dependency || '';
  copy.standalone = copy.standalone !== undefined ? String(copy.standalone) : undefined;
  copy.example = copy.example || copy.simplerExample || '';
  return copy;
}, z.object({
  text: z.string().default(''),
  type: z.string().default('main'),
  typeExplanation: z.string().optional(),
  subjectAndVerb: z.string().optional(),
  role: z.string().default('Main Clause'),
  questionAnswered: z.string().optional(),
  dependsOn: z.string().optional(),
  standalone: z.string().optional(),
  example: z.string().optional(),
  explanationBengali: z.string().default('')
}));

export const SentenceStructureOverviewSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.type = copy.type || 'complex';
  copy.explanation = copy.explanation || copy.description || '';
  copy.explanationBengali = copy.explanationBengali || copy.bengaliExplanation || '';
  return copy;
}, z.object({
  type: z.string().default('complex'),
  explanation: z.string().default(''),
  explanationBengali: z.string().default('')
}));

export const SentenceStructureMapNodeSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.clauseOrElement = copy.clauseOrElement || copy.element || copy.clause || copy.text || '';
  copy.relationType = copy.relationType || copy.type || copy.relation || 'main';
  copy.connectsTo = copy.connectsTo || copy.parent || 'Main Clause';
  copy.explanation = copy.explanation || '';
  copy.bengaliExplanation = copy.bengaliExplanation || copy.explanationBengali || '';
  return copy;
}, z.object({
  clauseOrElement: z.string().default(''),
  relationType: z.string().default('main'),
  connectsTo: z.string().default('Main Clause'),
  explanation: z.string().default(''),
  bengaliExplanation: z.string().default('')
}));

export const SentenceStructureMapBranchSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.clauseText = copy.clauseText || copy.clause || copy.text || '';
  copy.relationType = copy.relationType || copy.type || 'subordinate';
  copy.roleInSentence = copy.roleInSentence || copy.role || '';
  return copy;
}, z.object({
  clauseText: z.string().default(''),
  relationType: z.string().default('subordinate'),
  roleInSentence: z.string().default('')
}));

export const SentenceStructureMapSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return { mainClause: '', rootMainClause: '', nodes: [], branches: [] };
  const copy = { ...val };
  copy.mainClause = copy.mainClause || copy.rootMainClause || copy.root || '';
  copy.rootMainClause = copy.rootMainClause || copy.mainClause || '';
  copy.nodes = Array.isArray(copy.nodes) ? copy.nodes : [];
  copy.branches = Array.isArray(copy.branches) ? copy.branches : [];
  return copy;
}, z.object({
  mainClause: z.string().default(''),
  rootMainClause: z.string().default(''),
  nodes: z.array(SentenceStructureMapNodeSchema).default([]),
  branches: z.array(SentenceStructureMapBranchSchema).default([])
}));

export const GrammarRuleDetailSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.ruleName = copy.ruleName || copy.name || copy.rule || 'Grammar Rule';
  copy.whatIsIt = copy.whatIsIt || copy.definition || copy.meaning || '';
  copy.whereIsIt = copy.whereIsIt || copy.location || copy.excerpt || '';
  copy.whyUsed = copy.whyUsed || copy.purpose || copy.reason || '';
  copy.howItWorks = copy.howItWorks || copy.mechanism || copy.pattern || '';
  copy.reusablePattern = copy.reusablePattern || copy.formula || '';
  copy.example = copy.example || {
    english: 'Natural example.',
    easyEnglish: 'Simple meaning.',
    bengali: 'বাংলা উদাহরণ।'
  };
  copy.commonConfusion = copy.commonConfusion || copy.confusion || copy.contrast || '';
  return copy;
}, z.object({
  ruleName: z.string().default('Grammar Rule'),
  whatIsIt: z.string().default(''),
  whereIsIt: z.string().default(''),
  whyUsed: z.string().default(''),
  howItWorks: z.string().default(''),
  reusablePattern: z.string().default(''),
  example: z.object({
    english: z.string().default(''),
    easyEnglish: z.string().default(''),
    bengali: z.string().default('')
  }).default({ english: '', easyEnglish: '', bengali: '' }),
  commonConfusion: z.string().optional()
}));

export const ConnectorRelationshipSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.connector = copy.connector || copy.word || copy.linkingWord || '';
  copy.meaning = copy.meaning || '';
  copy.grammaticalPattern = copy.grammaticalPattern || copy.pattern || '';
  copy.logicalRelationship = copy.logicalRelationship || copy.relation || '';
  copy.whyAppropriate = copy.whyAppropriate || copy.reason || '';
  copy.contrastWithSimilar = copy.contrastWithSimilar || copy.contrast || '';
  return copy;
}, z.object({
  connector: z.string().default(''),
  meaning: z.string().default(''),
  grammaticalPattern: z.string().default(''),
  logicalRelationship: z.string().default(''),
  whyAppropriate: z.string().default(''),
  contrastWithSimilar: z.string().optional()
}));

export const WordLevelGrammarDetailSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.word = copy.word || copy.term || '';
  copy.partOfSpeech = copy.partOfSpeech || copy.pos || 'word';
  copy.syntacticRole = copy.syntacticRole || copy.role || '';
  copy.wordForms = Array.isArray(copy.wordForms) ? copy.wordForms : [];
  copy.usageNotes = copy.usageNotes || copy.notes || '';
  return copy;
}, z.object({
  word: z.string().default(''),
  partOfSpeech: z.string().default('word'),
  syntacticRole: z.string().default(''),
  wordForms: z.array(z.string()).default([]),
  usageNotes: z.string().optional()
}));

export const MistakeAndAlternativeSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.commonMistake = copy.commonMistake || copy.mistake || '';
  copy.correctedExample = copy.correctedExample || copy.corrected || '';
  copy.naturalAlternative = copy.naturalAlternative || copy.alternative || '';
  copy.nuanceDifference = copy.nuanceDifference || copy.difference || '';
  return copy;
}, z.object({
  commonMistake: z.string().optional(),
  correctedExample: z.string().optional(),
  naturalAlternative: z.string().default(''),
  nuanceDifference: z.string().optional()
}));

export const GrammarPracticeSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.reusablePattern = copy.reusablePattern || copy.pattern || '';
  copy.practiceQuestion = copy.practiceQuestion || copy.question || '';
  copy.options = Array.isArray(copy.options) ? copy.options : [];
  copy.answer = copy.answer || '';
  copy.explanation = copy.explanation || copy.reason || '';
  return copy;
}, z.object({
  reusablePattern: z.string().default(''),
  practiceQuestion: z.string().default(''),
  options: z.array(z.string()).optional(),
  answer: z.string().default(''),
  explanation: z.string().default('')
}));

export const SentenceAnalysisSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.selectedText = copy.selectedText || copy.sentence || copy.text || '';
  copy.selectionType = 'sentence';
  copy.plainEnglishParaphrase = copy.plainEnglishParaphrase || copy.paraphrase || copy.overallMeaning || copy.simpleEnglish || '';
  copy.overallMeaning = copy.overallMeaning || copy.plainEnglishParaphrase || copy.meaning || '';
  copy.bengaliTranslation = copy.bengaliTranslation || copy.translation || copy.easyBengali || copy.bengali || '';
  copy.mainMessage = copy.mainMessage || copy.coreMessage || copy.plainEnglishParaphrase || '';
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
  mainMessage: z.string().optional(),
  sentenceStructure: SentenceStructureOverviewSchema.optional(),
  bengaliTranslation: z.string().default(''),
  phraseBreakdown: z.array(PhraseExplanationSchema).default([]),
  clauses: z.array(SyntacticClauseSchema).default([]),
  structureMap: SentenceStructureMapSchema.optional(),
  grammarRules: z.array(GrammarRuleDetailSchema).optional().default([]),
  connectors: z.array(ConnectorRelationshipSchema).optional().default([]),
  wordLevelGrammar: z.array(WordLevelGrammarDetailSchema).optional().default([]),
  commonMistakesAndAlternatives: MistakeAndAlternativeSchema.optional(),
  practice: GrammarPracticeSchema.optional(),
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
  if (!data.mainMessage) {
    data.mainMessage = data.plainEnglishParaphrase || data.overallMeaning || '';
  }
  return data;
}));

// Highlight Mode Schemas
export const HighlightVocabularyItemSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const copy = { ...val };
  copy.id = copy.id || `hl_${Math.random().toString(36).substring(2, 9)}`;
  copy.text = copy.text || copy.word || copy.phrase || '';
  const validTypes = ['word', 'phrase', 'idiom'];
  const rawType = copy.type || copy.category;
  copy.type = validTypes.includes(rawType) ? rawType : 'word';
  copy.category = copy.type;
  copy.contextSentence = copy.contextSentence || copy.context || copy.sentence || '';
  copy.easyEnglish = copy.easyEnglish || copy.meaning || copy.definition || '';
  copy.easyBengali = copy.easyBengali || copy.bengali || copy.translation || '';
  copy.reason = copy.reason || copy.whyUseful || 'Useful language learning vocabulary.';
  const validDiff = ['easy', 'medium', 'hard'];
  copy.difficulty = validDiff.includes(copy.difficulty) ? copy.difficulty : 'medium';
  const rawScore = Number(copy.learningValueScore);
  copy.learningValueScore = Number.isFinite(rawScore) ? Math.min(1, Math.max(0, rawScore)) : 0.8;
  copy.isArticleCore = Boolean(copy.isArticleCore);
  return copy;
}, z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['word', 'phrase', 'idiom']),
  category: z.enum(['word', 'phrase', 'idiom']).optional(),
  contextSentence: z.string().default(''),
  easyEnglish: z.string().default(''),
  easyBengali: z.string().default(''),
  reason: z.string().default('Useful vocabulary for learners.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  grammaticalNote: z.string().optional(),
  learningValueScore: z.number().min(0).max(1).default(0.8),
  isArticleCore: z.boolean().default(false)
}));

export const HighlightExtractionResultSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return { items: [] };
  const copy = { ...val };
  copy.items = Array.isArray(copy.items) ? copy.items : [];
  const validModes = ['ai_reasoning', 'curated_offline_fallback', 'evaluation_fixture'];
  copy.sourceMode = validModes.includes(copy.sourceMode) ? copy.sourceMode : 'ai_reasoning';
  return copy;
}, z.object({
  items: z.array(HighlightVocabularyItemSchema).default([]),
  pageTitle: z.string().optional(),
  totalAnalyzedWords: z.number().optional(),
  sourceMode: z.enum(['ai_reasoning', 'curated_offline_fallback', 'evaluation_fixture']).default('ai_reasoning'),
  articleSummary: z.string().optional()
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

