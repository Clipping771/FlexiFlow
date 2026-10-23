// The remaining AI tasks, built from the shared 'full' prompt set (the one GeminiProvider uses).
import type { ZodType } from 'zod';
import {
  buildAnalyzePrompt,
  buildFollowUpPrompt,
  buildHighlightsPrompt,
  buildSchemaCorrection,
  buildUsageEvaluationPrompt,
  buildWritingAssistPrompt,
  type PromptSpec
} from '../../../src/services/ai/prompts';
import {
  FollowUpResponseSchema,
  HighlightExtractionResultSchema,
  ParagraphAnalysisSchema,
  PhraseAnalysisSchema,
  SentenceAnalysisSchema,
  WordAnalysisSchema,
  WritingAssistSchema
} from '../../../src/services/ai/schemas';
import { UsageCoachFeedbackSchema } from '../../../src/services/ai/usageCoachSchema';
import type {
  FollowUpResponse,
  HighlightExtractionResult,
  LinguisticAnalysisResult,
  SelectionType,
  UsageCoachFeedback,
  WritingAssistResult,
  WritingGoal
} from '../../../src/types';
import { analyzeCacheKey, cacheGet, cachePut } from './cache';
import { type GeminiConfig, type TaskResult, TaskFailedError, type Validation, runValidated } from './stageTasks';

/** Large structured outputs (Sentence X-Ray, paragraphs, highlights) can take well over the default 20 s. */
const LONG_TIMEOUT_MS = 45000;

/**
 * What makes an answer worth charging for, checked on the model's raw output: the shared schemas fill
 * missing fields with defaults (even stock translations), so a schema pass alone can be an empty answer.
 */
interface Required {
  /** Each entry is a group of fields of which at least one must be a non-empty string. */
  anyOf?: string[][];
  /** Fields that must be non-empty arrays. */
  arrays?: string[];
  /** For Bengali, fields that must contain Bengali script. */
  bengali?: string[];
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function missing(raw: Record<string, unknown>, required: Required, targetLang: string): string[] {
  const errors: string[] = [];
  for (const group of required.anyOf ?? []) {
    if (!group.some((key) => nonEmpty(raw[key]))) errors.push(`${group.join(' or ')}: required, must not be empty`);
  }
  for (const key of required.arrays ?? []) {
    if (!Array.isArray(raw[key]) || (raw[key] as unknown[]).length === 0) errors.push(`${key}: must be a non-empty array`);
  }
  if (targetLang === 'bn') {
    for (const key of required.bengali ?? []) {
      if (nonEmpty(raw[key]) && !/[ঀ-৿]/.test(raw[key] as string)) errors.push(`${key}: must be written in Bengali script`);
    }
  }
  return errors;
}

function schemaValidator<T>(
  schema: ZodType,
  targetLang: string,
  required: Required = {},
  prepare?: (raw: Record<string, unknown>) => void
) {
  return (raw: unknown): Validation<T> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { isValid: false, errors: ['response must be a JSON object'] };
    const obj = raw as Record<string, unknown>;
    prepare?.(obj);
    const absent = missing(obj, required, targetLang);
    if (absent.length) return { isValid: false, errors: absent };
    const parsed = schema.safeParse(obj);
    return parsed.success
      ? { isValid: true, data: parsed.data as T, errors: [] }
      : { isValid: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  };
}

function run<T>(gemini: GeminiConfig, prompt: PromptSpec, validate: (raw: unknown) => Validation<T>, timeoutMs?: number) {
  return runValidated(gemini, prompt, validate, (errors) => buildSchemaCorrection(prompt.user, errors), timeoutMs);
}

const ANALYSIS: Record<SelectionType, { schema: ZodType; required: Required }> = {
  word: {
    schema: WordAnalysisSchema,
    required: { anyOf: [['contextualMeaning', 'simpleEnglishExplanation'], ['bengaliTranslation']], bengali: ['bengaliTranslation'] }
  },
  phrase: {
    schema: PhraseAnalysisSchema,
    required: { anyOf: [['overallMeaning', 'simpleEnglishExplanation'], ['bengaliTranslation']], bengali: ['bengaliTranslation'] }
  },
  sentence: {
    schema: SentenceAnalysisSchema,
    required: { anyOf: [['plainEnglishParaphrase', 'overallMeaning'], ['bengaliTranslation']], bengali: ['bengaliTranslation'] }
  },
  paragraph: {
    schema: ParagraphAnalysisSchema,
    required: { anyOf: [['mainIdea', 'conciseSummary'], ['bengaliTranslation']], bengali: ['bengaliTranslation'] }
  }
};

export interface AnalyzeInput {
  text: string;
  type: SelectionType;
  contextSentence?: string;
  paragraphContext?: string;
  targetLang: string;
}

export function runAnalyze(gemini: GeminiConfig, input: AnalyzeInput): Promise<TaskResult<LinguisticAnalysisResult>> {
  const prompt = buildAnalyzePrompt(input, input.targetLang, 'full');
  // Same defaults the compact providers apply before parsing.
  const { schema, required } = ANALYSIS[input.type];
  const validate = schemaValidator<LinguisticAnalysisResult>(schema, input.targetLang, required, (raw) => {
    if (!raw.selectedText) raw.selectedText = input.text;
    if (!raw.selectionType) raw.selectionType = input.type;
  });
  const long = input.type === 'sentence' || input.type === 'paragraph';
  return run(gemini, prompt, validate, long ? LONG_TIMEOUT_MS : undefined);
}

export function runAssistWriting(
  gemini: GeminiConfig,
  input: { text: string; goal: WritingGoal; targetLang: string }
): Promise<TaskResult<WritingAssistResult>> {
  const prompt = buildWritingAssistPrompt(input, input.targetLang, 'full');
  return run(gemini, prompt, schemaValidator<WritingAssistResult>(WritingAssistSchema, input.targetLang, {
    anyOf: [['improvedText'], ['changesExplanation'], ['bengaliExplanation']],
    bengali: ['bengaliExplanation']
  }));
}

export function runFollowUp(
  gemini: GeminiConfig,
  input: { text: string; context: string; question: string; targetLang: string }
): Promise<TaskResult<FollowUpResponse>> {
  const prompt = buildFollowUpPrompt(input, input.targetLang, 'full');
  return run(gemini, prompt, schemaValidator<FollowUpResponse>(FollowUpResponseSchema, input.targetLang, {
    anyOf: [['answer'], ['bengaliSummary']],
    bengali: ['bengaliSummary']
  }));
}

export async function runHighlights(
  gemini: GeminiConfig,
  input: { rawText: string; pageTitle?: string; targetLang: string }
): Promise<TaskResult<HighlightExtractionResult>> {
  const prompt = buildHighlightsPrompt(input, input.targetLang, 'full');
  const result = await run(gemini, prompt, schemaValidator<HighlightExtractionResult>(HighlightExtractionResultSchema, input.targetLang, { arrays: ['items'] }), LONG_TIMEOUT_MS);
  result.data.sourceMode = 'ai_reasoning';
  return result;
}

export function runUsageEvaluation(
  gemini: GeminiConfig,
  input: { targetWord: string; sentence: string; targetLang: string }
): Promise<TaskResult<UsageCoachFeedback>> {
  const prompt = buildUsageEvaluationPrompt(input, input.targetLang);
  return run(gemini, prompt, schemaValidator<UsageCoachFeedback>(
    UsageCoachFeedbackSchema,
    input.targetLang,
    { anyOf: [['naturalAlternative'], ['bengaliFeedback']], bengali: ['bengaliFeedback'] },
    (raw) => {
      raw.targetWord = input.targetWord;
    }
  ));
}

export interface CompareWordsResult {
  wordA: LinguisticAnalysisResult;
  wordB: LinguisticAnalysisResult;
}

/**
 * Word Difference: the two word analyses the extension builds the comparison from, run here so the reader
 * pays once (2 credits) and each word reuses the shared analyze cache.
 */
export async function runCompareWords(
  gemini: GeminiConfig,
  kv: KVNamespace,
  input: { wordA: string; wordB: string; targetLang: string }
): Promise<TaskResult<CompareWordsResult>> {
  let tokensIn = 0;
  let tokensOut = 0;
  const analyses: LinguisticAnalysisResult[] = [];

  for (const word of [input.wordA, input.wordB]) {
    const key = await analyzeCacheKey({ text: word, type: 'word', targetLang: input.targetLang });
    const hit = key ? await cacheGet<LinguisticAnalysisResult>(kv, key) : null;
    if (hit) {
      analyses.push({ ...hit, selectedText: word } as LinguisticAnalysisResult);
      continue;
    }
    try {
      const result = await runAnalyze(gemini, { text: word, type: 'word', targetLang: input.targetLang });
      tokensIn += result.tokensIn;
      tokensOut += result.tokensOut;
      if (key) await cachePut(kv, key, result.data);
      analyses.push(result.data);
    } catch (err) {
      // Keep the tokens of the word that did succeed in the accounting.
      if (err instanceof TaskFailedError) throw new TaskFailedError(err.reason, tokensIn + err.tokensIn, tokensOut + err.tokensOut, err.errors);
      throw err;
    }
  }
  return { data: { wordA: analyses[0], wordB: analyses[1] }, tokensIn, tokensOut };
}
