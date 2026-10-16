import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  ArticleAnalysisResult,
  StageAExplanation,
  StageBDetailedVocabulary
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
  analyzeArticle?(rawText: string, title?: string, mode?: string, signal?: AbortSignal): Promise<ArticleAnalysisResult>;
}
