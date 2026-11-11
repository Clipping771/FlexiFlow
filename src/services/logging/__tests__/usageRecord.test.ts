import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  TAXONOMY_VERSION,
  describeTask,
  estimateCostUSD,
  getUsageRecords,
  recordUsage,
  recordUsageFromResponse,
  tokensFromBody,
  _resetUsageRecords
} from '../usageRecord';
import { buildExamItemPrompt } from '../../examContent/aiItems';

beforeEach(() => {
  delete (globalThis as any).chrome;
  _resetUsageRecords();
});

describe('Usage records for own-key AI calls (AGENTS.md rule 5)', () => {
  it('reads token counts from each provider reply', () => {
    expect(tokensFromBody('gemini', { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40, thoughtsTokenCount: 5 } })).toEqual({ prompt: 120, completion: 45 });
    expect(tokensFromBody('openai', { usage: { prompt_tokens: 10, completion_tokens: 3 } })).toEqual({ prompt: 10, completion: 3 });
    expect(tokensFromBody('anthropic', { usage: { input_tokens: 7, output_tokens: 2 } })).toEqual({ prompt: 7, completion: 2 });
    expect(tokensFromBody('ollama', { prompt_eval_count: 50, eval_count: 9 })).toEqual({ prompt: 50, completion: 9 });
    expect(tokensFromBody('openai', { choices: [] })).toBeNull();
  });

  it('prices known models, marks unknown ones, and local models cost nothing', () => {
    expect(estimateCostUSD('gemini', 'gemini-2.0-flash', 1_000_000, 1_000_000)).toEqual({ cost: 0.5, known: true });
    expect(estimateCostUSD('openai', 'some-new-model', 1000, 1000)).toEqual({ cost: 0, known: false });
    expect(estimateCostUSD('ollama', 'llama3.2', 5000, 5000)).toEqual({ cost: 0, known: true });
  });

  it('names Smart Practice and exam item calls with their prompt version', () => {
    const { system } = buildExamItemPrompt('smart_reading', 'ARTICLE TEXT');
    expect(describeTask(system)).toEqual({ taskId: 'exam_item:smart_reading', promptVersion: 'exam_item_v1_smart_reading', rubricVersion: 'none' });
    const other = describeTask('You are a dictionary. Explain the word.');
    expect(other.taskId).toMatch(/^prompt:/);
    expect(other.promptVersion).toBe('unversioned');
  });

  it('stores every required field, estimating tokens when the provider gives none', async () => {
    const rec = await recordUsage({ provider: 'openai', model: 'gpt-4o-mini', systemPrompt: 'x'.repeat(400), userPrompt: 'y'.repeat(400), completionText: 'z'.repeat(80) });
    expect(rec).toMatchObject({
      userId: 'local',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 201,
      completionTokens: 20,
      tokensEstimated: true,
      costKnown: true,
      rubricVersion: 'none',
      taxonomyVersion: TAXONOMY_VERSION
    });
    for (const key of ['taskId', 'promptVersion', 'estimatedCostUSD']) expect(rec).toHaveProperty(key);
    expect(await getUsageRecords()).toHaveLength(1);
  });

  it('records from a copy of the HTTP reply without consuming it', async () => {
    const res = new Response(JSON.stringify({ usage: { input_tokens: 30, output_tokens: 12 }, content: [] }), { status: 200 });
    recordUsageFromResponse('anthropic', 'claude-3-5-haiku-20241022', res, 'System', 'User');
    expect(await res.json()).toHaveProperty('usage'); // the caller can still read it
    await new Promise((r) => setTimeout(r, 0));
    const [rec] = await getUsageRecords();
    expect(rec).toMatchObject({ promptTokens: 30, completionTokens: 12, tokensEstimated: false });
  });

  it('keeps the taxonomy version in step with taxonomy/errors.yaml', () => {
    const yaml = readFileSync(resolve(__dirname, '../../../../taxonomy/errors.yaml'), 'utf8');
    expect(yaml).toContain(`version: "${TAXONOMY_VERSION}"`);
  });
});
