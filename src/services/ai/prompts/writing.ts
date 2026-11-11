// Prompt text was moved here verbatim from the provider classes (M1 of CLOUD_BACKEND_DESIGN.md).
import { WritingGoal } from '../../../types';
import { getLanguageConfig } from '../../../config/languages';
import { PromptDetail, PromptSpec } from './types';

export interface WritingAssistInput {
  text: string;
  goal: WritingGoal;
}

export function buildWritingAssistPrompt(
  { text, goal }: WritingAssistInput,
  targetLang: string,
  detail: PromptDetail
): PromptSpec {
  if (detail === 'full') {
    const system = `You are a writing coach. Polish the learner's text for goal "${goal}".
Return JSON adhering to WritingAssistSchema:
{
  "originalText": "${text}",
  "goal": "${goal}",
  "improvedText": "Improved sentence",
  "changesExplanation": "What was improved and why",
  "bengaliExplanation": "Bengali explanation of changes",
  "alternatives": ["alternative 1", "alternative 2"]
}`;
    return { system, user: `Goal: ${goal}\nText:\n${text}`, maxTokens: 800 };
  }

  const lang = getLanguageConfig(targetLang);
  const system = `Writing assistant for goal "${goal}".
In "bengaliExplanation", provide ${lang.promptTargetInstruction}.
Return a valid raw JSON object strictly adhering to this schema:
{
  "originalText": "${text}",
  "goal": "${goal}",
  "improvedText": "Improved version of text",
  "changesExplanation": "Clear explanation of improvements made",
  "bengaliExplanation": "Explanation in ${lang.targetLabel}",
  "alternatives": ["Alternative phrasing 1", "Alternative phrasing 2"]
}`;
  return { system, user: text, maxTokens: 800 };
}
