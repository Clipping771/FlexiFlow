import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIService } from '../index';
import { SettingsService } from '../../storage/settings';
import { GeminiProvider } from '../geminiProvider';
import { OllamaProvider } from '../ollamaProvider';

const modelAnswer = {
  isGrammaticallyCorrect: false,
  collocationScore: 55,
  grammarCorrectness: 'Use "mitigate" with an object.',
  naturalAlternative: 'We must mitigate the risk.',
  bengaliFeedback: '"mitigate" এর পরে একটি object দরকার।',
  alternativeCollocations: ['mitigate the risk']
};

describe('Usage Coach evaluation', () => {
  beforeEach(() => {
    AIService.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to give a verdict without an AI provider instead of inventing a score', async () => {
    await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
    await expect(AIService.evaluateUsage('mitigate', 'We must mitigate.')).rejects.toThrow(/needs an AI provider/);
  });

  it('Gemini asks the model to judge the sentence and returns its own score', async () => {
    const provider = new GeminiProvider('test-key', 'gemini-2.0-flash', 'bn');
    const call = vi.spyOn(provider as any, 'callGemini').mockResolvedValue(JSON.stringify(modelAnswer));

    const result = await provider.evaluateUsage('mitigate', 'We must mitigate.');
    expect(result.collocationScore).toBe(55);
    expect(result.isGrammaticallyCorrect).toBe(false);
    expect(result.targetWord).toBe('mitigate');
    expect(call.mock.calls[0][1]).toContain("Learner's sentence: We must mitigate.");
  });

  it('Ollama returns the model’s verdict and rejects an out-of-range score', async () => {
    const provider = new OllamaProvider('http://localhost:11434', 'llama3', 'bn');
    vi.spyOn(provider as any, 'callOllama').mockResolvedValueOnce(JSON.stringify(modelAnswer));
    expect((await provider.evaluateUsage('mitigate', 'We must mitigate.')).collocationScore).toBe(55);

    vi.spyOn(provider as any, 'callOllama').mockResolvedValueOnce(JSON.stringify({ ...modelAnswer, collocationScore: 140 }));
    await expect(provider.evaluateUsage('mitigate', 'We must mitigate.')).rejects.toThrow();
  });

  it('routes through the configured provider', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
    const provider = await AIService.getProvider();
    vi.spyOn(provider as any, 'evaluateUsage').mockResolvedValue({ targetWord: 'mitigate', ...modelAnswer });
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

    const result = await AIService.evaluateUsage('mitigate', 'We must mitigate.');
    expect(result.collocationScore).toBe(55);
  });
});
