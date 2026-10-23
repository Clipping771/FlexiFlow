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

/**
 * A task that produced no usable answer: the model call failed, or its output stayed invalid after one retry.
 * Carries the tokens already spent so the caller can account for them while refunding the reader.
 */
export class TaskFailedError extends Error {
  constructor(
    readonly reason: 'model_error' | 'invalid_output',
    readonly tokensIn: number,
    readonly tokensOut: number,
    readonly errors: string[] = []
  ) {
    super(reason === 'model_error' ? 'Model call failed' : 'Model output failed validation');
    this.name = 'TaskFailedError';
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
    let res;
    try {
      res = await generateGeminiJson({ ...gemini, system: prompt.system, user, maxTokens: prompt.maxTokens });
    } catch {
      throw new TaskFailedError('model_error', tokensIn, tokensOut);
    }
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
  throw new TaskFailedError('invalid_output', tokensIn, tokensOut, lastErrors);
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
