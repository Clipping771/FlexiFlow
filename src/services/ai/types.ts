import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary,
  HighlightExtractionResult,
  UsageCoachFeedback
} from '../../types';

export interface AIProvider {
  name: string;
  isAvailable(): boolean;
  analyzeStageA?(
    text: string,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<StageAExplanation>;
  analyzeStageB?(
    lemma: string,
    partOfSpeech?: string,
    contextualSenseId?: string
  ): Promise<StageBDetailedVocabulary>;
  analyze(
    text: string,
    type: SelectionType,
    contextSentence?: string,
    paragraphContext?: string
  ): Promise<LinguisticAnalysisResult>;
  assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult>;
  askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse>;
  extractHighlights?(rawText: string, pageTitle?: string, signal?: AbortSignal): Promise<HighlightExtractionResult>;
  /** Word Difference in one call; providers without it get two analyze(word) calls. */
  compareWords?(wordA: string, wordB: string): Promise<{ wordA: LinguisticAnalysisResult; wordB: LinguisticAnalysisResult }>;
  /** Usage Coach evaluation of the learner's own sentence. */
  evaluateUsage?(targetWord: string, sentence: string): Promise<UsageCoachFeedback>;
}
