// Shared response cache in KV (CLOUD_BACKEND_DESIGN.md §6). Only word-level results are cached;
// keys hold hashes, never the reader's sentence. Cache failures must never fail a request.
import { PROMPT_VERSION } from '../../../src/services/ai/prompts';
import { sha256Hex } from './crypto';

export const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface StageAKeyInput {
  text: string;
  contextSentence?: string;
  paragraphContext?: string;
  targetLang: string;
}

export async function stageACacheKey(input: StageAKeyInput): Promise<string> {
  const target = input.text.trim().toLowerCase();
  // The prompt sees the sentence and the first 300 characters of the paragraph, so both shape the answer.
  const context = await sha256Hex(`${input.contextSentence ?? ''}\n${(input.paragraphContext ?? '').slice(0, 300)}`);
  return `sa:${PROMPT_VERSION}:${input.targetLang}:${await sha256Hex(target)}:${context}`;
}

export interface AnalyzeKeyInput {
  text: string;
  type: string;
  contextSentence?: string;
  targetLang: string;
}

/**
 * Word and phrase analyses are shareable like Stage A (the full prompt only sees the sentence, not the paragraph).
 * Sentence and paragraph analyses are the reader's own text and are never cached: returns null.
 */
export async function analyzeCacheKey(input: AnalyzeKeyInput): Promise<string | null> {
  if (input.type !== 'word' && input.type !== 'phrase') return null;
  const target = await sha256Hex(input.text.trim().toLowerCase());
  const context = await sha256Hex(input.contextSentence ?? '');
  return `an:${PROMPT_VERSION}:${input.targetLang}:${input.type}:${target}:${context}`;
}

export interface StageBKeyInput {
  lemma: string;
  partOfSpeech?: string;
  contextualSenseId?: string;
  targetLang: string;
}

export function stageBCacheKey(input: StageBKeyInput): string {
  const lemma = input.lemma.trim().toLowerCase();
  const pos = (input.partOfSpeech ?? 'word').trim().toLowerCase();
  // The sense id decides which sense the model puts first, so it is part of the answer too.
  const sense = input.contextualSenseId ?? 'sense_1';
  return `sb:${PROMPT_VERSION}:${input.targetLang}:${encodeURIComponent(lemma)}:${encodeURIComponent(pos)}:${sense}`;
}

export async function cacheGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key, 'json');
  } catch {
    return null;
  }
}

export async function cachePut(kv: KVNamespace, key: string, value: unknown): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: CACHE_TTL_SECONDS });
  } catch {
    // A missed write only costs a future model call.
  }
}
