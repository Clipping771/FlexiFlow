// Core TypeScript definitions for AI-Native LexiFlow AI

export type SelectionType = 'word' | 'phrase' | 'sentence' | 'paragraph';

export interface BaseAIAnalysis {
  selectedText: string;
  selectionType: SelectionType;
  contextSentence?: string;
  bengaliTranslation: string;
}

export interface WordAnalysisResult extends BaseAIAnalysis {
  selectionType: 'word';
  contextualMeaning: string;
  simpleEnglishExplanation: string;
  whyFitsContext: string;
  partOfSpeech: string;
  grammaticalRole?: string;
  grammaticalNote?: string;
  transitivityOrPattern?: string;
  wordForms?: string[];
  collocations: string[];
  examples: string[];
  exampleBengali?: string;
  synonyms?: string[];
  antonyms?: string[];
  registerAndTone?: string;
}

export interface PhraseAnalysisResult extends BaseAIAnalysis {
  selectionType: 'phrase';
  phraseType: 'phrasal_verb' | 'idiom' | 'collocation' | 'fixed_expression';
  overallMeaning: string;
  simpleEnglishExplanation?: string;
  literalVsFigurative: string;
  whyFitsContext: string;
  grammaticalStructure?: string;
  componentsBreakdown?: string;
  examples: string[];
}

export interface PhraseExplanation {
  phrase: string;
  easyEnglish: string;
  easyBengali: string;
  grammaticalFunction?: string;
  connection?: string;
  whyItMatters?: string;
  simplerExample?: string;
}

export interface SentenceStructureOverview {
  type: 'simple' | 'compound' | 'complex' | 'compound-complex' | string;
  explanation: string;
  explanationBengali: string;
}

export interface SyntacticClause {
  text: string;
  type: 'main' | 'subordinate' | 'relative' | 'participial' | 'conditional' | 'noun' | 'adverbial' | string;
  typeExplanation?: string;
  category?: string;
  subordinator?: string;
  subjectAndVerb?: string;
  subject?: string;
  subjectExplanation?: string;
  subjectExplanationBengali?: string;
  verb?: string;
  verbPhrase?: string;
  tenseAspect?: string;
  coordinatedVerbs?: string[];
  verbExplanation?: string;
  verbExplanationBengali?: string;
  directObject?: string;
  directObjectExplanation?: string;
  directObjectExplanationBengali?: string;
  indirectObject?: string;
  indirectObjectExplanation?: string;
  indirectObjectExplanationBengali?: string;
  complement?: string;
  complementType?: 'subject_complement' | 'object_complement' | string;
  complementExplanation?: string;
  complementExplanationBengali?: string;
  adverbials?: Array<{
    text: string;
    type?: string;
    explanation: string;
    explanationBengali?: string;
  }>;
  clausePattern?: string;
  adverbialPhrase?: string;
  functionDescription?: string;
  role: string;
  questionAnswered?: string;
  dependsOn?: string;
  standalone?: string | boolean;
  canStandAlone?: boolean;
  example?: string;
  examplePattern?: string;
  explanationBengali: string;
  whyItMatters?: string;
}

export interface ClauseRelationshipInfo {
  formula: string;
  explanation: string;
  explanationBengali?: string;
}

export interface RelevantGrammarFeature {
  feature: string;
  text?: string;
  explanation?: string;
  explanationBengali?: string;
  detail: string;
  detailBengali?: string;
}


export interface PhraseComponent {
  text: string;
  role: string;
  roleLabel: string;
  roleBengali: string;
  explanation: string;
  explanationBengali?: string;
}

export interface PhraseConstituent {
  phrase: string;
  phraseType: 'noun_phrase' | 'verb_phrase' | 'prepositional_phrase' | 'adverbial_phrase' | 'adjective_phrase' | string;
  phraseTypeLabel: string;
  headWord?: string;
  roleInClause?: string;
  components: PhraseComponent[];
  explanation: string;
  explanationBengali?: string;
}

export interface ConversationalElement {
  text: string;
  type: 'self_correction' | 'parenthetical' | 'discourse_marker' | 'interruption' | string;
  typeLabel: string;
  targetOriginal?: string;
  correctedTo?: string;
  explanation: string;
  explanationBengali: string;
}

export interface GrammaticalPatternSummary {
  formula: string;
  explanation: string;
  explanationBengali: string;
}

export interface SentenceStructureMapBranch {
  clauseText: string;
  relationType: string;
  roleInSentence: string;
}

export interface SentenceStructureMapNode {
  clauseOrElement: string;
  relationType: 'main' | 'reason' | 'condition' | 'contrast' | 'description' | 'result' | 'time' | 'purpose' | 'concession' | string;
  connectsTo: string;
  explanation: string;
  bengaliExplanation: string;
}

export interface SentenceStructureMap {
  mainClause: string;
  rootMainClause?: string;
  branches?: SentenceStructureMapBranch[];
  nodes: SentenceStructureMapNode[];
}

export interface GrammarRuleDetail {
  ruleName: string;
  whatIsIt: string;
  whereIsIt: string;
  whyUsed: string;
  howItWorks: string;
  reusablePattern: string;
  targetWords?: string;
  example: {
    english: string;
    easyEnglish: string;
    bengali: string;
  };
  commonConfusion?: string;
}

export interface ConnectorRelationship {
  connector: string;
  meaning: string;
  grammaticalPattern: string;
  pattern?: string;
  logicalRelationship: string;
  logicalRelation?: string;
  whyAppropriate: string;
  contrastWithSimilar?: string;
  contrastWith?: string;
}

export interface WordLevelGrammarDetail {
  word: string;
  partOfSpeech: string;
  syntacticRole: string;
  wordForms?: string[];
  usageNotes?: string;
}

export interface MistakeAndAlternative {
  commonMistake?: string;
  studentMisconception?: string;
  correctedExample?: string;
  correctedSentence?: string;
  naturalAlternative: string;
  nuanceDifference?: string;
}

export interface GrammarPractice {
  reusablePattern: string;
  practiceQuestion: string;
  question?: string;
  options?: string[];
  answer: string;
  correctAnswer?: string;
  explanation: string;
  whyCorrect?: string;
}

export interface SentenceAnalysisResult extends BaseAIAnalysis {
  selectionType: 'sentence';
  plainEnglishParaphrase: string;
  overallMeaning: string;
  mainMessage?: string;
  sentenceStructure?: SentenceStructureOverview;
  phraseBreakdown: PhraseExplanation[];
  clauses: SyntacticClause[];
  structureMap?: SentenceStructureMap;
  grammarRules?: GrammarRuleDetail[];
  connectors?: ConnectorRelationship[];
  wordLevelGrammar?: WordLevelGrammarDetail[];
  commonMistakesAndAlternatives?: MistakeAndAlternative;
  practice?: GrammarPractice;
  grammaticalHighlights: string[];
  difficultVocabulary: Array<{
    word: string;
    meaningInContext: string;
    bengali: string;
    partOfSpeech?: string;
    grammaticalRole?: string;
  }>;
  phraseConstituents?: PhraseConstituent[];
  conversationalElements?: ConversationalElement[];
  patternSummary?: GrammaticalPatternSummary;
  clauseRelationship?: ClauseRelationshipInfo;
  relevantGrammarFeatures?: RelevantGrammarFeature[];
  toneAndRegister: string;
}

export interface ParagraphSentenceItem {
  sentenceIndex: number;
  sentenceText: string;
  bengaliTranslation: string;
  phraseBreakdown: PhraseExplanation[];
  grammaticalStructure?: string;
  toneOrRole?: string;
}

export interface ParagraphBlockItem {
  paragraphIndex: number;
  paragraphText: string;
  mainIdea?: string;
  summary?: string;
  bengaliTranslation?: string;
  sentences: ParagraphSentenceItem[];
}

export interface ParagraphAnalysisResult extends BaseAIAnalysis {
  selectionType: 'paragraph';
  mainIdea: string;
  conciseSummary: string;
  phraseBreakdown: PhraseExplanation[];
  sentenceBreakdown?: string[];
  keyVocabulary: Array<{
    term: string;
    meaning: string;
    bengali: string;
  }>;
  argumentStructure: string;
  toneAndRegister: string;
  // Hierarchical Smart Breakdown
  paragraphs?: ParagraphBlockItem[];
  sentences?: ParagraphSentenceItem[];
}

export type LinguisticAnalysisResult =
  | WordAnalysisResult
  | PhraseAnalysisResult
  | SentenceAnalysisResult
  | ParagraphAnalysisResult;

// Two-Stage AI Architecture for Context-First Reading
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface StageAExplanation {
  selectedText: string;
  lemma: string;
  partOfSpeech: string;
  easyEnglish: string;
  easyBengali: string;
  contextMeaning: string;
  example?: string;
  exampleBengali?: string;
  confidence: ConfidenceLevel;
  uncertaintyReason?: string;
  contextualSenseId: string;
  grammaticalRole?: string;
  grammaticalNote?: string;
  transitivityOrPattern?: string;
  wordForms?: string[];
  literalVsFigurative?: string;
  whyItMatters?: string;
  discourseRole?: string;
}

export interface SenseSynonym {
  word: string;
  easyEnglish: string;
  easyBengali: string;
  nuance?: string;
}

export interface SenseAntonym {
  word: string;
  easyEnglish: string;
  easyBengali: string;
}

export interface StageBSense {
  id: string;
  partOfSpeech: string;
  easyEnglish: string;
  easyBengali: string;
  isContextual: boolean;
  registerOrType?: 'literal' | 'figurative' | 'technical' | 'idiomatic' | 'standard';
  examples: Array<{ english: string; bengali: string }>;
  synonyms: SenseSynonym[];
  antonyms: SenseAntonym[];
}

export interface StageBDetailedVocabulary {
  lemma: string;
  partOfSpeech: string;
  contextualSenseId: string;
  senses: StageBSense[];
  collocations: Array<{ english: string; bengali?: string }>;
  idiomsAndPhrases: Array<{ phrase: string; easyEnglish: string; easyBengali: string }>;
  wordForms?: Array<{ form: string; partOfSpeech: string }>;
  confusingWords?: Array<{ word: string; difference: string; bengaliDifference: string }>;
}

export interface WrongMeaningReport {
  id: string;
  timestamp: string;
  selectedText: string;
  contextSentence?: string;
  reason: string;
  userNote?: string;
  aiProvider?: string;
  model?: string;
}

// Syntactic & Sentence X-Ray
export interface SentenceXRayResult {
  sentence: string;
  bengaliTranslation: string;
  paraphrase: string;
  mainMessage?: string;
  sentenceStructure?: SentenceStructureOverview;
  clauses: SyntacticClause[];
  structureMap?: SentenceStructureMap;
  grammarRules?: GrammarRuleDetail[];
  connectors?: ConnectorRelationship[];
  wordLevelGrammar?: WordLevelGrammarDetail[];
  commonMistakesAndAlternatives?: MistakeAndAlternative;
  practice?: GrammarPractice;
  grammaticalFeatures: string[];
  grammaticalHighlights?: string[];
  phraseBreakdown?: PhraseExplanation[];
  difficultVocabulary?: Array<{
    word: string;
    meaningInContext: string;
    bengali: string;
    partOfSpeech?: string;
    grammaticalRole?: string;
  }>;
  phraseConstituents?: PhraseConstituent[];
  conversationalElements?: ConversationalElement[];
  patternSummary?: GrammaticalPatternSummary;
  clauseRelationship?: ClauseRelationshipInfo;
  relevantGrammarFeatures?: RelevantGrammarFeature[];
  toneAndRegister: string;
}

// Word Comparison / Nuance
export interface MinimalPairComparison {
  sentenceA: string;
  sentenceB: string;
  explanation: string;
}

export interface WordComparisonResult {
  wordA: string;
  wordB: string;
  coreDifference: string;
  bengaliDifference: string;
  minimalPairs: MinimalPairComparison[];
  commonCollocationsA: string[];
  commonCollocationsB: string[];
}

// Writing Assistance & Usage Coach
export type WritingGoal = 'clarity' | 'academic' | 'natural' | 'simplify' | 'formal' | 'concise';

export interface WritingAssistResult {
  originalText: string;
  goal: WritingGoal;
  improvedText: string;
  changesExplanation: string;
  bengaliExplanation: string;
  alternatives: string[];
}

export interface UsageCoachFeedback {
  targetWord: string;
  isGrammaticallyCorrect: boolean;
  collocationScore: number;
  grammarCorrectness?: string;
  naturalAlternative: string;
  bengaliFeedback: string;
  alternativeCollocations?: string[];
}

// Follow-up Q&A
export interface FollowUpResponse {
  question: string;
  answer: string;
  bengaliSummary: string;
  keyTakeaway?: string;
  suggestedFollowUps?: string[];
  examples?: Array<{ english: string; bengali?: string }>;
}

// FSRS Memory Engine & Reviews
export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type LearningState = 'new' | 'learning' | 'review' | 'relearning';

export interface FSRSItemState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: LearningState;
  lastReview?: string;
  nextReview: string;
}

export function createInitialFSRSState(): FSRSItemState {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    nextReview: new Date().toISOString()
  };
}

export interface ReviewLogEntry {
  id?: number;
  vocabId: string;
  rating: FSRSRating;
  reviewDate: string;
  elapsedDays?: number;
  scheduledDays?: number;
  state?: LearningState;
}

export interface VocabularyItem {
  id: string;
  word: string;
  selectionType: SelectionType;
  meaning: string;
  definition?: string;
  partOfSpeech?: string;
  audioUrl?: string;
  bengaliMeaning: string;
  bengaliExplanation?: string;
  contextSentence?: string;
  pageTitle?: string;
  pageUrl?: string;
  dateAdded: string;
  tags: string[];
  collection: string;
  difficulty: 'easy' | 'medium' | 'hard';
  starred?: boolean;
  isMarkedDifficult?: boolean;
  dismissedFromWeakness?: boolean;
  reviewHistory?: ReviewLogEntry[];
  fsrs: FSRSItemState;
  notes?: string;
  fullAnalysis?: LinguisticAnalysisResult;
}

// Personal Weakness Detector & Targeted Practice
export interface WeaknessSignal {
  score: number; // 0 to 100
  reasons: string[];
  lapseCount: number;
  againCount: number;
  isUserMarkedDifficult: boolean;
  retentionEstimate: number; // percentage
}

export interface TargetedPracticeItem {
  vocabularyItem: VocabularyItem;
  weaknessScore: number;
  reasons: string[];
  reviewStatus: 'due' | 'learning' | 'review' | 'relearning';
  isDismissed?: boolean;
}

// Offline Lexicon / Fallback types
export interface PhoneticItem {
  text?: string;
  audio?: string;
}

export interface DefinitionItem {
  definition: string;
  example?: string;
  exampleBengali?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface MeaningItem {
  partOfSpeech: string;
  definitions: DefinitionItem[];
}

export interface DictionaryResult {
  word: string;
  phonetics?: PhoneticItem[];
  meanings: MeaningItem[];
  bengaliMeaning?: string;
  bengaliExplanation?: string;
  contextSentence?: string;
  source?: string;
  isVerified?: boolean;
}

export interface CustomLanguageConfig {
  code: string;            // Unique or ISO code, e.g. 'tr', 'sw', 'syl', 'eo'
  name: string;            // English name, e.g. 'Turkish', 'Swahili'
  nativeName?: string;     // Native script name, e.g. 'Türkçe', 'Kiswahili'
  nativeHeader?: string;   // Native popup header, e.g. 'Kolay Türkçe', 'Kiswahili Rahisi'
  flagEmoji?: string;      // Emoji icon, e.g. '🇹🇷', '🇰🇪', '🌐'
  promptTutorRole?: string; // Custom LLM tutor role description
  promptTargetInstruction?: string; // Custom LLM target instruction
  createdAt?: string;
}

// AI Highlight Mode Types
export type HighlightType = 'word' | 'phrase' | 'idiom';
export type HighlightColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

export interface HighlightFilters {
  words: boolean;
  phrases: boolean;
  idioms: boolean;
}

export interface HighlightVocabularyItem {
  id: string;
  text: string;
  type: HighlightType;
  contextSentence: string;
  easyEnglish: string;
  easyBengali: string;
  reason: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grammaticalNote?: string;
  learningValueScore?: number;
  isArticleCore?: boolean;
}

export interface HighlightExtractionResult {
  items: HighlightVocabularyItem[];
  pageTitle?: string;
  totalAnalyzedWords?: number;
  sourceMode?: 'ai_reasoning' | 'curated_offline_fallback' | 'evaluation_fixture';
  articleSummary?: string;
  /** Why the offline word list was used instead of AI (only set when sourceMode is curated_offline_fallback). */
  fallbackReason?: 'no_ai_configured' | 'ai_unsupported' | 'ai_failed' | 'ai_empty';
}

export interface UserSettings {
  triggerMode: 'auto_selection' | 'double_click' | 'selection_icon' | 'manual_only';
  autoAnalyzeOnSelection: boolean;
  autoPronounce?: boolean;
  showBengaliByDefault: boolean;
  theme: 'light' | 'dark' | 'system';
  aiProvider: 'mock' | 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'lexiflow';
  apiKey?: string;
  apiEndpoint?: string;
  selectedModel?: string;
  dailyNewLimit: number;
  dailyReviewLimit: number;
  sidePanelEnabled?: boolean;
  popupSize?: 'small' | 'medium' | 'large' | 'xlarge';
  sourceLanguage?: string;
  targetLanguage?: string;
  customLanguages?: CustomLanguageConfig[];
  disabledSites?: string[];
  isGloballyPaused?: boolean;
  // Feature A: AI Highlight Mode
  highlightModeEnabled?: boolean;
  highlightColor?: HighlightColor;
  highlightFilters?: HighlightFilters;
  // LexiFlow 2.0 Reading Modes
  readingMode?: 'quick' | 'learn';
}
