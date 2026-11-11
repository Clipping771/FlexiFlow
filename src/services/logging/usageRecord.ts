/**
 * Usage records for AI calls made with the learner's own provider key (AGENTS.md rule 5).
 * LexiFlow Cloud writes these on the server; this covers Gemini, OpenAI, Claude and Ollama
 * called straight from the extension. Kept on this device only (chrome.storage.local), newest
 * MAX_RECORDS. Logging never blocks or breaks the AI call it describes.
 */
import { EXAM_ITEM_KINDS, EXAM_ITEM_PROMPT_VERSION, buildExamItemPrompt, type ExamItemKind } from '../examContent/aiItems';

/** Matches metadata.version in taxonomy/errors.yaml (a test keeps them in step). */
export const TAXONOMY_VERSION = '1.0.0';

export const USAGE_RECORDS_KEY = 'lexiflow_usage_records';
export const MAX_RECORDS = 500;

export type UsageProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

export interface UsageRecord {
  id: string;
  at: string;
  userId: string;
  taskId: string;
  provider: UsageProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** True when the provider did not report token counts and they were estimated from text length. */
  tokensEstimated: boolean;
  estimatedCostUSD: number;
  /** False when the model is not in the price table (cost then shows 0). */
  costKnown: boolean;
  promptVersion: string;
  rubricVersion: string;
  taxonomyVersion: string;
}

/**
 * Public list prices in USD per million tokens [input, output]. Used for estimates only;
 * a model not listed here is recorded with costKnown: false. Local Ollama models cost nothing.
 */
const PRICES_PER_MTOK: Array<[RegExp, number, number]> = [
  // Speech models first: their names start like the text models (output priced per audio token)
  [/^gemini-2\.5-flash-preview-tts/, 0.5, 10],
  [/^gpt-4o-mini-tts/, 0.6, 12],
  [/^gemini-2\.0-flash-lite/, 0.075, 0.3],
  [/^gemini-2\.0-flash/, 0.1, 0.4],
  [/^gemini-2\.5-flash/, 0.3, 2.5],
  [/^gemini-1\.5-flash/, 0.075, 0.3],
  [/^gemini-1\.5-pro/, 1.25, 5],
  [/^gpt-4o-mini/, 0.15, 0.6],
  [/^gpt-4o/, 2.5, 10],
  [/^claude-3-5-haiku/, 0.8, 4],
  [/^claude-3-5-sonnet/, 3, 15]
];

export function estimateCostUSD(provider: UsageProvider, model: string, promptTokens: number, completionTokens: number) {
  if (provider === 'ollama') return { cost: 0, known: true };
  const row = PRICES_PER_MTOK.find(([re]) => re.test(model));
  if (!row) return { cost: 0, known: false };
  const cost = (promptTokens * row[1] + completionTokens * row[2]) / 1_000_000;
  return { cost: Math.round(cost * 1e8) / 1e8, known: true };
}

/** Rough count used only when a provider does not report tokens (about 4 characters per token). */
export const estimateTokens = (text: string) => Math.ceil((text || '').length / 4);

/** Token counts from a provider's JSON reply, or null when it has none. */
export function tokensFromBody(provider: UsageProvider, body: any): { prompt: number; completion: number } | null {
  if (!body || typeof body !== 'object') return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  let prompt: number | null = null;
  let completion: number | null = null;
  if (provider === 'gemini') {
    prompt = n(body.usageMetadata?.promptTokenCount);
    completion = (n(body.usageMetadata?.candidatesTokenCount) ?? 0) + (n(body.usageMetadata?.thoughtsTokenCount) ?? 0);
  } else if (provider === 'openai') {
    prompt = n(body.usage?.prompt_tokens);
    completion = n(body.usage?.completion_tokens);
  } else if (provider === 'anthropic') {
    prompt = n(body.usage?.input_tokens);
    completion = n(body.usage?.output_tokens);
  } else if (provider === 'ollama') {
    prompt = n(body.prompt_eval_count);
    completion = n(body.eval_count);
  }
  return prompt === null || completion === null ? null : { prompt, completion };
}

let knownPrompts: Array<{ prefix: string; kind: ExamItemKind }> | null = null;

/** Which task a system prompt belongs to, and the prompt / rubric versions to record. */
export function describeTask(systemPrompt: string): { taskId: string; promptVersion: string; rubricVersion: string } {
  if (!knownPrompts) {
    knownPrompts = EXAM_ITEM_KINDS.map((kind) => ({ kind, prefix: buildExamItemPrompt(kind, '').system.slice(0, 120) }));
  }
  const match = knownPrompts.find((k) => systemPrompt.startsWith(k.prefix));
  if (match) {
    return {
      taskId: `exam_item:${match.kind}`,
      promptVersion: `${EXAM_ITEM_PROMPT_VERSION}_${match.kind}`,
      rubricVersion: match.kind === 'pte_sst_marks' ? 'pte_pearson_v1' : 'none'
    };
  }
  // Other prompts are not versioned yet: identify them by a short fingerprint of their text
  let h = 0x811c9dc5;
  for (let i = 0; i < Math.min(systemPrompt.length, 400); i++) {
    h ^= systemPrompt.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return { taskId: `prompt:${(h >>> 0).toString(36)}`, promptVersion: 'unversioned', rubricVersion: 'none' };
}

let memory: UsageRecord[] = [];
const hasStorage = () => typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

export async function getUsageRecords(): Promise<UsageRecord[]> {
  if (!hasStorage()) return [...memory];
  try {
    const res = await chrome.storage.local.get(USAGE_RECORDS_KEY);
    return Array.isArray(res?.[USAGE_RECORDS_KEY]) ? res[USAGE_RECORDS_KEY] : [];
  } catch {
    return [];
  }
}

/** Saves one record. Never throws. */
export async function recordUsage(input: {
  provider: UsageProvider;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  body?: unknown;
  completionText?: string;
  /** Overrides the task detected from the system prompt (for calls that are not JSON prompts, like speech) */
  task?: { taskId: string; promptVersion: string; rubricVersion: string };
}): Promise<UsageRecord | null> {
  try {
    const counted = tokensFromBody(input.provider, input.body);
    const promptTokens = counted?.prompt ?? estimateTokens(`${input.systemPrompt}\n${input.userPrompt}`);
    const completionTokens = counted?.completion ?? estimateTokens(input.completionText || '');
    const { cost, known } = estimateCostUSD(input.provider, input.model, promptTokens, completionTokens);
    const task = input.task ?? describeTask(input.systemPrompt);
    const record: UsageRecord = {
      id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      userId: 'local',
      taskId: task.taskId,
      provider: input.provider,
      model: input.model,
      promptTokens,
      completionTokens,
      tokensEstimated: !counted,
      estimatedCostUSD: cost,
      costKnown: known,
      promptVersion: task.promptVersion,
      rubricVersion: task.rubricVersion,
      taxonomyVersion: TAXONOMY_VERSION
    };
    const next = [...(await getUsageRecords()), record].slice(-MAX_RECORDS);
    if (hasStorage()) await chrome.storage.local.set({ [USAGE_RECORDS_KEY]: next });
    else memory = next;
    return record;
  } catch {
    return null;
  }
}

/** Reads a copy of a provider's HTTP reply and records it, without touching the original. */
export function recordUsageFromResponse(
  provider: UsageProvider,
  model: string,
  res: Response,
  systemPrompt: string,
  userPrompt: string
): void {
  if (!res?.ok || typeof res.clone !== 'function') return;
  let copy: Response;
  try {
    copy = res.clone();
  } catch {
    return;
  }
  void copy
    .json()
    .then((body) => recordUsage({ provider, model, systemPrompt, userPrompt, body }))
    .catch(() => undefined);
}

export function _resetUsageRecords(): void {
  memory = [];
  knownPrompts = null;
}
