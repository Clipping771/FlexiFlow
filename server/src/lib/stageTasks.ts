// Stage A / Stage B on the server, built from the same prompts and validators as the extension's providers.
import {
  buildStageAPrompt,
  buildStageACorrection,
  buildStageBPrompt,
  buildStageBCorrection,
  withJsonOnlyReminder,
  type PromptSpec
} from '../../../src/services/ai/prompts';
import { validateStageA, validateStageB } from '../../../src/services/ai/validation';
import { safeParseJSON } from '../../../src/services/ai/safeJson';
import { SUPPORTED_PAIRS } from '../../../src/config/languages';
import type { StageAExplanation, StageBDetailedVocabulary } from '../../../src/types';
import { generateGeminiJson } from './gemini';

/** Built-in target languages only: custom language configs are prompt text the client controls. */
export function isSupportedTargetLang(code: string): boolean {
  return code !== 'en' && Object.prototype.hasOwnProperty.call(SUPPORTED_PAIRS, `en-${code}`);
}

/** Raised when the model's output stays unusable after one retry; the caller refunds. */
export class InvalidModelOutputError extends Error {
  constructor(readonly errors: string[]) {
    super('Model output failed validation');
    this.name = 'InvalidModelOutputError';
  }
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface TaskResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
}

type Validation<T> = { isValid: boolean; data?: T; errors: string[] };

/** One call, plus at most one retry carrying the parse or validation errors back to the model. */
async function runValidated<T>(
  gemini: GeminiConfig,
  prompt: PromptSpec,
  validate: (raw: unknown) => Validation<T>,
  correction: (errors: string[]) => string
): Promise<TaskResult<T>> {
  let tokensIn = 0;
  let tokensOut = 0;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0
      ? prompt.user
      : lastErrors.length ? correction(lastErrors) : withJsonOnlyReminder(prompt.user);
    const res = await generateGeminiJson({ ...gemini, system: prompt.system, user, maxTokens: prompt.maxTokens });
    tokensIn += res.tokensIn;
    tokensOut += res.tokensOut;

    let parsed: unknown;
    try {
      parsed = safeParseJSON(res.text);
    } catch {
      lastErrors = [];
      continue;
    }
    const result = validate(parsed);
    if (result.isValid && result.data) return { data: result.data, tokensIn, tokensOut };
    lastErrors = result.errors;
  }
  throw new InvalidModelOutputError(lastErrors);
}

export interface StageAInput {
  text: string;
  contextSentence?: string;
  paragraphContext?: string;
  targetLang: string;
}

export async function runStageA(gemini: GeminiConfig, input: StageAInput): Promise<TaskResult<StageAExplanation>> {
  const prompt = buildStageAPrompt(input, input.targetLang);
  const result = await runValidated(
    gemini,
    prompt,
    (raw) => validateStageA(raw, input.targetLang),
    (errors) => buildStageACorrection(prompt.user, errors, input.targetLang)
  );
  // Same normalisation as the providers: echo the user's exact selection.
  result.data.selectedText = input.text.trim();
  return result;
}

export interface StageBInput {
  lemma: string;
  partOfSpeech?: string;
  contextualSenseId?: string;
  targetLang: string;
}

export async function runStageB(gemini: GeminiConfig, input: StageBInput): Promise<TaskResult<StageBDetailedVocabulary>> {
  const prompt = buildStageBPrompt(input, input.targetLang);
  const lemma = input.lemma.trim().toLowerCase();
  return runValidated(
    gemini,
    prompt,
    (raw) => validateStageB(raw, lemma, input.targetLang),
    (errors) => buildStageBCorrection(prompt.user, errors, input.targetLang)
  );
}
