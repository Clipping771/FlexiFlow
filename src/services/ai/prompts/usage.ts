import { getLanguageConfig } from '../../../config/languages';
import { PromptSpec } from './types';

export interface UsageEvaluationInput {
  targetWord: string;
  sentence: string;
}

/**
 * Usage Coach: judges the learner's own sentence that practises `targetWord`.
 * Output matches UsageCoachFeedback (src/types) and is checked by UsageCoachFeedbackSchema.
 */
export function buildUsageEvaluationPrompt({ targetWord, sentence }: UsageEvaluationInput, targetLang: string): PromptSpec {
  const lang = getLanguageConfig(targetLang);
  const system = `You are an encouraging but honest English writing examiner for an ESL ${lang.targetLabel} learner.
The learner wrote one sentence to practise the word or phrase "${targetWord}". Judge THEIR sentence; do not judge the word in general.

Strict guidelines:
1. "isGrammaticallyCorrect": true only if the sentence has no grammar, agreement, tense, article or word-form errors. Minor style choices are not errors.
2. "collocationScore": integer 0-100 for how naturally "${targetWord}" is used with its surrounding words (collocations, register, meaning).
   90-100 = what a fluent writer would say; 70-89 = understandable but slightly unnatural; 40-69 = awkward or partly wrong meaning; 0-39 = wrong meaning or missing the target word.
3. "grammarCorrectness": one or two short sentences in simple English naming each concrete problem, or confirming it is correct.
4. "naturalAlternative": the learner's sentence rewritten the way a fluent writer would, keeping their meaning and the target word. If it is already natural, repeat it unchanged.
5. "bengaliFeedback": the same feedback in natural ${lang.targetLabel} (${lang.promptTargetInstruction}).
6. "alternativeCollocations": 2-4 common, natural phrases that use "${targetWord}".
Never invent errors to sound helpful, and never praise a sentence that has an error.

Return JSON adhering to UsageCoachFeedbackSchema:
{
  "targetWord": "${targetWord}",
  "isGrammaticallyCorrect": true | false,
  "collocationScore": 0-100,
  "grammarCorrectness": "Short assessment in simple English",
  "naturalAlternative": "Natural rewrite of the learner's sentence",
  "bengaliFeedback": "${lang.targetNativeHeader}",
  "alternativeCollocations": ["phrase 1", "phrase 2"]
}`;

  return { system, user: `Target word: ${targetWord}\nLearner's sentence: ${sentence}`, maxTokens: 700 };
}
