import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../index';
import { SettingsService } from '../../storage/settings';
import { isPlaceholderScore } from '../examCaller';

describe('AIService.completeExamJson', () => {
  beforeEach(() => {
    AIService.clearCache();
    vi.restoreAllMocks();
  });

  it('refuses without an AI provider, so the exam screens show no score', async () => {
    await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
    await expect(AIService.completeExamJson('system', 'user')).rejects.toThrow(/needs an AI provider/);
  });

  it('says LexiFlow Cloud cannot mark exams yet', async () => {
    await SettingsService.updateSettings({ aiProvider: 'lexiflow', apiKey: '' });
    await expect(AIService.completeExamJson('system', 'user')).rejects.toThrow(/not available on LexiFlow Cloud/);
  });

  it('sends the grading prompt to the configured provider', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '', selectedModel: 'llama3.1' });
    const provider = await AIService.getProvider();
    const spy = vi.spyOn(provider as any, 'completeJson').mockResolvedValue('{"content":2}');
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

    const result = await AIService.completeExamJson('Grade this', 'ESSAY: ...');
    expect(result).toEqual({ rawText: '{"content":2}', model: 'llama3.1' });
    expect(spy).toHaveBeenCalledWith('Grade this', 'ESSAY: ...');
  });
});

describe('isPlaceholderScore', () => {
  it('flags the fixed fallback marks, not rule-based or AI marks', () => {
    expect(isPlaceholderScore('deterministic_heuristic')).toBe(true);
    expect(isPlaceholderScore('deterministic_recovery')).toBe(true);
    expect(isPlaceholderScore('deterministic_filter')).toBe(false);
    expect(isPlaceholderScore('deterministic_alignment')).toBe(false);
    expect(isPlaceholderScore('gemini-2.0-flash')).toBe(false);
  });
});
