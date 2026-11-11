import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../index';
import { SettingsService } from '../../storage/settings';
import { CloudProvider, type CloudExamRequest } from '../cloudProvider';

describe('AIService.completeExamJson', () => {
  beforeEach(() => {
    AIService.clearCache();
    vi.restoreAllMocks();
  });

  it('refuses without an AI provider, so the exam screens show no score', async () => {
    await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
    await expect(AIService.completeExamJson('system', 'user')).rejects.toThrow(/needs an AI provider/);
  });

  it('marks LexiFlow Cloud answers through the exam task route, never sending the prompt', async () => {
    await SettingsService.updateSettings({ aiProvider: 'lexiflow', apiKey: '' });
    const mark = vi.spyOn(CloudProvider.prototype, 'markExam').mockResolvedValue({ content: 2 });
    const cloud: CloudExamRequest = { task: 'pte-essay', prompt: 'Q', text: 'Essay.' };

    const result = await AIService.completeExamJson('Grade this', 'ESSAY: ...', cloud);

    expect(result).toEqual({ rawText: '{"content":2}', model: 'LexiFlow Cloud' });
    expect(mark).toHaveBeenCalledWith(cloud);
  });

  it('refuses a LexiFlow Cloud call that names no exam task, so no raw prompt is proxied', async () => {
    await SettingsService.updateSettings({ aiProvider: 'lexiflow', apiKey: '' });
    const mark = vi.spyOn(CloudProvider.prototype, 'markExam');
    await expect(AIService.completeExamJson('system', 'user')).rejects.toThrow(/cannot be marked on LexiFlow Cloud/);
    expect(mark).not.toHaveBeenCalled();
  });

  it('ignores the exam task for BYOK providers', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '', selectedModel: 'llama3.1' });
    const provider = await AIService.getProvider();
    const spy = vi.spyOn(provider as any, 'completeJson').mockResolvedValue('{}');
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

    await AIService.completeExamJson('Grade this', 'ESSAY', { task: 'pte-swt', passage: 'P', text: 'S.' });
    expect(spy).toHaveBeenCalledWith('Grade this', 'ESSAY');
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
