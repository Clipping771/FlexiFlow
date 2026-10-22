// Prompt text was moved here verbatim from the provider classes (M1 of CLOUD_BACKEND_DESIGN.md).
import { getLanguageConfig } from '../../../config/languages';
import { PromptSpec } from './types';

export interface StageAInput {
  text: string;
  contextSentence?: string;
  paragraphContext?: string;
}

export function buildStageAPrompt(
  { text, contextSentence, paragraphContext }: StageAInput,
  targetLang: string
): PromptSpec {
  const cleanText = text.trim();
  const lang = getLanguageConfig(targetLang);
  const system = `You are an ${lang.promptTutorRole}.
Your mission is to explain the selected word or phrase for someone reading a real webpage.
Strict guidelines:
1. "easyEnglish": Genuinely simple everyday English. Short sentence, conversational words, explain one idea at a time. No academic jargon.
2. "easyBengali": ${lang.promptTargetInstruction}
3. "contextMeaning": Explain what it specifically means in this sentence.
4. "example": One natural, short example sentence illustrating this sense.
5. "exampleBengali": Natural ${lang.targetLabel} translation of the example sentence.
6. "confidence": "high", "medium", or "low". If sentence provides minimal clues, set to "low" and give an honest "uncertaintyReason".
7. "contextualSenseId": "sense_1".

Return JSON adhering to StageAContextualSchema:
{
  "selectedText": "${cleanText}",
  "lemma": "base form",
  "partOfSpeech": "word / noun / verb / etc.",
  "easyEnglish": "Very simple everyday English explanation.",
  "easyBengali": "${lang.targetNativeHeader}",
  "contextMeaning": "Meaning in this sentence.",
  "example": "Natural English sentence.",
  "exampleBengali": "Example sentence translated into ${lang.targetLabel}.",
  "confidence": "high" | "medium" | "low",
  "uncertaintyReason": "Optional note if confidence is low",
  "contextualSenseId": "sense_1"
}`;

  const user = `Target: "${cleanText}"\nSentence Context: "${contextSentence || ''}"\nParagraph Context: "${(paragraphContext || '').slice(0, 300)}"`;

  return { system, user, maxTokens: 550 };
}

export function buildStageACorrection(user: string, errors: string[], targetLang: string): string {
  const lang = getLanguageConfig(targetLang);
  return `${user}\n\nYour previous response had validation errors:\n${errors.join('\n')}\nPlease correct these errors and ensure "${lang.targetLabel}" explanation and all required fields are present.`;
}
