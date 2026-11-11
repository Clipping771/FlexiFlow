// Prompt text was moved here verbatim from the provider classes (M1 of CLOUD_BACKEND_DESIGN.md).
import { getLanguageConfig } from '../../../config/languages';
import { PromptSpec } from './types';

export interface StageBInput {
  lemma: string;
  partOfSpeech?: string;
  contextualSenseId?: string;
}

export function buildStageBPrompt(
  { lemma, partOfSpeech = 'word', contextualSenseId = 'sense_1' }: StageBInput,
  targetLang: string
): PromptSpec {
  const cleanLemma = lemma.trim().toLowerCase();
  const lang = getLanguageConfig(targetLang);
  const system = `You are an elite bilingual lexicographer. Provide a comprehensive, structured vocabulary entry for "${cleanLemma}".
Strict guidelines:
1. ORDER SENSES SO THE CONTEXTUAL SENSE IS FIRST in the "senses" array with id "${contextualSenseId}".
2. Provide easy English and natural ${lang.targetLabel} (${lang.promptTargetInstruction}) for every sense.
3. For each sense provide 1-2 natural examples with natural ${lang.targetLabel} translations.
4. Synonyms must be sense-specific.
5. Antonyms: ONLY GENUINE DIRECT OPPOSITES. NEVER invent an antonym if none exists; leave as empty array [].
6. Collocations, idioms / phrasal verbs, word forms, and confusing words if applicable.

Return JSON adhering to StageBDetailedVocabularySchema:
{
  "lemma": "${cleanLemma}",
  "partOfSpeech": "${partOfSpeech}",
  "contextualSenseId": "${contextualSenseId}",
  "senses": [
    {
      "id": "${contextualSenseId}",
      "partOfSpeech": "${partOfSpeech}",
      "easyEnglish": "Simple everyday English definition.",
      "easyBengali": "${lang.targetNativeHeader}",
      "isContextual": true,
      "registerOrType": "standard" | "literal" | "figurative" | "technical" | "idiomatic",
      "examples": [{"english": "Natural example.", "bengali": "Example translated into ${lang.targetLabel}."}],
      "synonyms": [{"word": "synonym", "easyEnglish": "Simple meaning", "easyBengali": "Meaning in ${lang.targetLabel}"}],
      "antonyms": []
    }
  ],
  "collocations": [{"english": "common phrase", "bengali": "${lang.targetLabel}"}],
  "idiomsAndPhrases": [{"phrase": "idiom", "easyEnglish": "simple meaning", "easyBengali": "${lang.targetLabel}"}],
  "wordForms": [{"form": "${cleanLemma}", "partOfSpeech": "${partOfSpeech}"}],
  "confusingWords": []
}`;

  const user = `Word: "${cleanLemma}"\nPart of Speech: "${partOfSpeech}"\nContextual Sense ID: "${contextualSenseId}"`;

  return { system, user, maxTokens: 2500 };
}

export function buildStageBCorrection(user: string, errors: string[], targetLang: string): string {
  const lang = getLanguageConfig(targetLang);
  return `${user}\n\nYour previous response had validation errors:\n${errors.join('\n')}\nPlease ensure the contextual sense is ordered first, all ${lang.targetLabel} fields are accurate, and return valid JSON.`;
}
