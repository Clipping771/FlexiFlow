import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseSummaryEvaluation } from '../summarySchema';
import { buildSummaryEvaluationPrompt } from '../prompts';
import { AIService } from '../index';
import { SettingsService } from '../../storage/settings';

const ARTICLE =
  'Renewable energy is growing quickly, but grids built for coal and gas struggle with its ups and downs. ' +
  'The author argues that storage, not more panels, is now the main bottleneck. Batteries smooth short dips, ' +
  'while long-duration storage and cross-border lines are needed for calm, dark weeks. Without them, countries ' +
  'keep gas plants as backup and lose much of the climate benefit.';

const SUMMARY = 'The article says that the main problem for renewable energy is now storage, because grids need batteries and other storage to stay reliable when there is no sun or wind.';

const raw = {
  summaryLanguage: 'en',
  criteria: [
    { id: 'main_idea', score: 4, comment: 'Correct central claim.' },
    { id: 'key_points', score: 1.7, comment: 'Misses cross-border lines.' },
    { id: 'accuracy', score: -1, comment: 'Fine.' },
    { id: 'expression', score: 1, comment: 'Own words.' }
  ],
  totalScore: 10,
  overallFeedback: 'Good grasp of the main idea.',
  strengths: ['Clear main point', '  '],
  missedPoints: ['Cross-border transmission'],
  misunderstandings: [],
  modelSummary: 'Storage is now the bottleneck for renewables.',
  languageFeedback: { comment: 'Good English.', corrections: [{ original: 'grid need', corrected: 'grids need', explanation: 'Plural.' }] }
};

describe('Summary evaluation parsing', () => {
  it('clamps each criterion to its range in half marks and recomputes the total', () => {
    const e = parseSummaryEvaluation(raw);
    expect(e.criteria.map((c) => [c.id, c.score, c.maxScore])).toEqual([
      ['main_idea', 4, 4],
      ['key_points', 1.5, 3],
      ['accuracy', 0, 2],
      ['expression', 1, 1]
    ]);
    expect(e.totalScore).toBe(6.5); // not the model's 10
    expect(e.strengths).toEqual(['Clear main point']);
    expect(e.languageFeedback?.corrections).toHaveLength(1);
  });

  it('rejects an answer missing a criterion', () => {
    expect(() => parseSummaryEvaluation({ ...raw, criteria: raw.criteria.slice(1) })).toThrow(/main_idea/);
  });

  it('drops English corrections for a summary written in another language', () => {
    const e = parseSummaryEvaluation({ ...raw, summaryLanguage: 'bn' });
    expect(e.summaryLanguage).toBe('bn');
    expect(e.languageFeedback).toBeUndefined();
  });

  it('puts the article and the summary in the prompt and asks for feedback in the summary language', () => {
    const p = buildSummaryEvaluationPrompt({ articleText: ARTICLE, articleTitle: 'Grids', summary: SUMMARY }, 'es');
    expect(p.user).toContain(ARTICLE);
    expect(p.user).toContain(SUMMARY);
    expect(p.system).toContain('Spanish');
    expect(p.system).toContain('SAME language');
  });
});

describe('AIService.evaluateSummary', () => {
  beforeEach(async () => {
    AIService.clearCache();
    vi.restoreAllMocks();
  });

  it('refuses to invent a score without an AI provider', async () => {
    await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
    await expect(AIService.evaluateSummary({ articleText: ARTICLE, summary: SUMMARY })).rejects.toThrow(/needs an AI provider/);
  });

  it('asks for a longer summary before calling the AI', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
    await expect(AIService.evaluateSummary({ articleText: ARTICLE, summary: 'Storage matters.' })).rejects.toThrow(/at least 15 words/);
  });

  it('marks through the configured provider', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
    const provider = await AIService.getProvider();
    const spy = vi.spyOn(provider as any, 'evaluateSummary').mockResolvedValue(parseSummaryEvaluation(raw));
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

    const result = await AIService.evaluateSummary({ articleText: ARTICLE, articleTitle: 'Grids', summary: SUMMARY });
    expect(result.totalScore).toBe(6.5);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ summary: SUMMARY, articleTitle: 'Grids' }));
  });
});
