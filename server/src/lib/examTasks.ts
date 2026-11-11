// Exam marking on LexiFlow Cloud. Each task runs the exam engine's own evaluator on the server, so the
// grading prompt is the engine's (never text the client sends) and the model's reply must pass the
// engine's Zod schema. The client gets the validated marks back and runs the same evaluator to score them.
import { z } from 'zod';
import { evaluatePteEssay, evaluatePteSwt, PteEvaluationZodSchema } from '../../../exams/pte/writing/evaluator';
import { evaluateReadAloud, PteSpeakingAiZodSchema } from '../../../exams/pte/speaking/evaluator';
import { evaluateIeltsTask1, evaluateIeltsTask2, IeltsEvaluationZodSchema } from '../../../exams/ielts/writing/evaluator';
import { evaluateIeltsSpeakingPart1, evaluateIeltsSpeakingPart2, IeltsSpeakingAiZodSchema } from '../../../exams/ielts/speaking/evaluator';
import { safeParseJSON } from '../../../src/services/ai/safeJson';
import { generateGeminiJson } from './gemini';
import { type GeminiConfig, type TaskResult, TaskFailedError } from './stageTasks';

import {
  buildExamItemPrompt,
  examItemSchema,
  parseExamItem,
  EXAM_ITEM_PROMPT_VERSION,
  type ExamItemKind
} from '../../../src/services/examContent/aiItems';

/** Matches metadata.version in taxonomy/errors.yaml (a test keeps them in step). */
export const TAXONOMY_VERSION = '1.0.0';

/** Exam replies are a handful of marks and short comments; this also stops the route being used as a free text generator. */
const EXAM_MAX_TOKENS = 900;
const MAX_COMMENT_CHARS = 600;
const MAX_LIST_ITEMS = 8;
const ERROR_CODE = /^[A-Z]+\.[A-Z0-9_]+$/;

type AiCaller = (systemPrompt: string, userPrompt: string) => Promise<{ rawText: string }>;

/** The SWT evaluator reads its reply without a schema, so the server brings one. */
export const PteSwtAiZodSchema = z.object({
  content: z.number().min(0).max(2),
  grammar: z.number().min(0).max(2),
  vocabulary: z.number().min(0).max(2),
  feedback: z.string().min(1),
  errors: z.array(z.string()).default([])
});

interface SafeParser {
  safeParse(raw: unknown): { success: true; data: unknown } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
}

export interface ExamTaskSpec<I> {
  promptVersion: string;
  rubricVersion: string;
  schema: SafeParser;
  /** Runs the engine's evaluator. It only calls `aiCaller` when the answer needs AI marking. */
  evaluate: (input: I, aiCaller: AiCaller) => Promise<unknown>;
}

export interface WritingInput {
  prompt: string;
  text: string;
}
export interface SwtInput {
  passage: string;
  text: string;
}
export interface IeltsTaskInput extends WritingInput {
  task: 1 | 2;
}
export interface SpeakingInput {
  prompt: string;
  transcript: string;
  durationMs: number;
}
export interface IeltsSpeakingInput extends SpeakingInput {
  part: 1 | 2;
}

export const EXAM_TASKS = {
  'pte-essay': {
    promptVersion: 'pte_essay_prompt_v1',
    rubricVersion: 'pte_pearson_v1',
    schema: PteEvaluationZodSchema,
    evaluate: (input, aiCaller) => evaluatePteEssay(input.prompt, input.text, { aiCaller })
  } satisfies ExamTaskSpec<WritingInput>,
  'pte-swt': {
    promptVersion: 'pte_swt_prompt_v1',
    rubricVersion: 'pte_pearson_v1',
    schema: PteSwtAiZodSchema,
    evaluate: (input, aiCaller) => evaluatePteSwt(input.passage, input.text, { aiCaller })
  } satisfies ExamTaskSpec<SwtInput>,
  'pte-read-aloud': {
    promptVersion: 'pte_read_aloud_prompt_v1',
    rubricVersion: 'pte_speaking_v1',
    schema: PteSpeakingAiZodSchema,
    evaluate: (input, aiCaller) => evaluateReadAloud(input.prompt, input.transcript, { durationMs: input.durationMs }, { aiCaller })
  } satisfies ExamTaskSpec<SpeakingInput>,
  'ielts-task': {
    promptVersion: 'ielts_writing_prompt_v1',
    rubricVersion: 'ielts_band_v1',
    schema: IeltsEvaluationZodSchema,
    evaluate: (input, aiCaller) =>
      (input.task === 1 ? evaluateIeltsTask1 : evaluateIeltsTask2)(input.prompt, input.text, { aiCaller })
  } satisfies ExamTaskSpec<IeltsTaskInput>,
  'ielts-speaking': {
    promptVersion: 'ielts_speaking_prompt_v1',
    rubricVersion: 'ielts_speaking_v1',
    schema: IeltsSpeakingAiZodSchema,
    evaluate: (input, aiCaller) =>
      (input.part === 1 ? evaluateIeltsSpeakingPart1 : evaluateIeltsSpeakingPart2)(
        input.prompt,
        input.transcript,
        { durationMs: input.durationMs },
        { aiCaller }
      )
  } satisfies ExamTaskSpec<IeltsSpeakingInput>
};

export type ExamTaskName = keyof typeof EXAM_TASKS;

class ProbeStop extends Error {}

/**
 * Whether the evaluator would ask the model at all. Answers the engine's rules already decide
 * (empty, too short, wrong form) are scored on the device and must not cost credits or a model call.
 */
export async function examNeedsModel<I>(spec: ExamTaskSpec<I>, input: I): Promise<boolean> {
  let called = false;
  await spec.evaluate(input, async () => {
    called = true;
    throw new ProbeStop();
  });
  return called;
}

/** Length and shape limits on the strings a model may put in an exam reply. */
function boundErrors(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > MAX_COMMENT_CHARS) errors.push(`${key}: longer than ${MAX_COMMENT_CHARS} characters`);
    if (!Array.isArray(value)) continue;
    if (value.length > MAX_LIST_ITEMS) errors.push(`${key}: more than ${MAX_LIST_ITEMS} items`);
    if (value.some((item) => typeof item === 'string' && item.length > MAX_COMMENT_CHARS)) {
      errors.push(`${key}: an item is longer than ${MAX_COMMENT_CHARS} characters`);
    }
  }
  return errors;
}

function validate(spec: { schema: SafeParser }, raw: unknown): { data?: Record<string, unknown>; errors: string[] } {
  const parsed = spec.schema.safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`) };
  const data = { ...(parsed.data as Record<string, unknown>) };
  // Codes outside the taxonomy's shape are dropped rather than failing an otherwise good mark.
  for (const key of ['detectedErrorCodes', 'errors']) {
    if (Array.isArray(data[key])) data[key] = (data[key] as unknown[]).filter((c) => typeof c === 'string' && ERROR_CODE.test(c));
  }
  const errors = boundErrors(data);
  return errors.length ? { errors } : { data, errors };
}

export interface ExamItemInput {
  kind: ExamItemKind;
  source: string;
  answer?: string;
}

/**
 * Writes an exam item from the article the learner is reading (or marks a Summarize Spoken Text
 * answer). The prompt comes from the shared item definitions, never from the client.
 */
export function examItemTask(kind: ExamItemKind): ExamTaskSpec<ExamItemInput> {
  return {
    promptVersion: `${EXAM_ITEM_PROMPT_VERSION}_${kind}`,
    rubricVersion: kind === 'pte_sst_marks' ? 'pte_pearson_v1' : 'none',
    schema: {
      safeParse: (raw: unknown) => {
        const shape = examItemSchema(kind).safeParse(raw);
        if (!shape.success) return shape;
        try {
          return { success: true, data: parseExamItem(kind, raw) };
        } catch (err) {
          return { success: false, error: { issues: [{ path: [], message: (err as Error).message }] } };
        }
      }
    } as SafeParser,
    evaluate: async (input, aiCaller) => {
      const prompt = buildExamItemPrompt(input.kind, input.source, input.answer);
      // Like the engines' evaluators, absorb the caller's failure: runExamTask records and rethrows it
      try {
        return await aiCaller(prompt.system, prompt.user);
      } catch {
        return null;
      }
    }
  };
}

export interface UsageRecordInput {
  userId: string;
  taskId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUSD: number;
  promptVersion: string;
  rubricVersion: string;
  latencyMs: number;
  status: 'success' | 'uncertain' | 'failed';
}

/** AGENTS.md rule 5: one usage_records row per AI invocation. Never pass the learner's text here. */
export async function writeUsageRecord(db: D1Database, record: UsageRecordInput, now: Date = new Date()): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_records (id, user_id, task_id, provider, model, prompt_tokens, completion_tokens, total_tokens,
         estimated_cost_usd, prompt_version, rubric_version, taxonomy_version, latency_ms, status, created_at)
       VALUES (?1, ?2, ?3, 'gemini', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
    .bind(
      `rec_${crypto.randomUUID().replace(/-/g, '')}`,
      record.userId,
      record.taskId,
      record.model,
      record.promptTokens,
      record.completionTokens,
      record.promptTokens + record.completionTokens,
      record.estimatedCostUSD,
      record.promptVersion,
      record.rubricVersion,
      TAXONOMY_VERSION,
      record.latencyMs,
      record.status,
      now.toISOString()
    )
    .run();
}

export interface ExamRunContext {
  db: D1Database;
  userId: string;
  taskId: string | null;
  /** USD for the given token counts at the configured model prices. */
  costUsd: (tokensIn: number, tokensOut: number) => number;
}

/**
 * Marks one answer: the engine's prompt, one model call plus at most one retry carrying the
 * validation errors back, and a usage record whether or not the reply was usable.
 */
export async function runExamTask<I>(
  gemini: GeminiConfig,
  spec: ExamTaskSpec<I>,
  input: I,
  ctx: ExamRunContext
): Promise<TaskResult<unknown>> {
  let tokensIn = 0;
  let tokensOut = 0;
  let marks: unknown;
  let failure = null as TaskFailedError | null;
  const started = Date.now();

  const record = (status: UsageRecordInput['status']) =>
    writeUsageRecord(ctx.db, {
      userId: ctx.userId,
      taskId: ctx.taskId,
      model: gemini.model,
      promptTokens: tokensIn,
      completionTokens: tokensOut,
      estimatedCostUSD: ctx.costUsd(tokensIn, tokensOut),
      promptVersion: spec.promptVersion,
      rubricVersion: spec.rubricVersion,
      latencyMs: Date.now() - started,
      status
    });

  const aiCaller: AiCaller = async (system, user) => {
    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt = attempt === 0
        ? user
        : `${user}\n\nYour previous reply was not valid${lastErrors.length ? ` (${lastErrors.slice(0, 5).join('; ')})` : ''}. Reply again with only the JSON object.`;
      let res;
      try {
        res = await generateGeminiJson({ ...gemini, system, user: prompt, maxTokens: EXAM_MAX_TOKENS });
      } catch {
        await record('failed');
        failure = new TaskFailedError('model_error', tokensIn, tokensOut);
        throw failure;
      }
      tokensIn += res.tokensIn;
      tokensOut += res.tokensOut;

      let raw: unknown;
      try {
        raw = safeParseJSON(res.text);
      } catch {
        lastErrors = [];
        continue;
      }
      const result = validate(spec, raw);
      if (result.data !== undefined) {
        marks = result.data;
        await record('success');
        return { rawText: JSON.stringify(marks) };
      }
      lastErrors = result.errors;
    }
    await record('failed');
    failure = new TaskFailedError('invalid_output', tokensIn, tokensOut, lastErrors);
    throw failure;
  };

  await spec.evaluate(input, aiCaller);
  if (failure) throw failure;
  // The route checks examNeedsModel first, so the evaluator always asks; this guards a rule change.
  if (marks === undefined) throw new TaskFailedError('invalid_output', tokensIn, tokensOut, ['no model call']);
  return { data: marks, tokensIn, tokensOut };
}
