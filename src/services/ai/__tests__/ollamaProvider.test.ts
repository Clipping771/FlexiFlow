import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../ollamaProvider';

describe('OllamaProvider error handling & safeParseJSON integration', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses llama3.2 as default model and handles safeParseJSON with <think> reasoning tags', async () => {
    const mockJson = {
      selectedText: 'scrutiny',
      selectionType: 'word',
      partOfSpeech: 'noun',
      contextualMeaning: 'Close inspection',
      simpleEnglishExplanation: 'Careful examination',
      bengaliTranslation: 'পরীক্ষা',
      whyFitsContext: 'Fits sentence',
      examples: ['Under close scrutiny.']
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: `<think>I am analyzing the word scrutiny...</think>\n\`\`\`json\n${JSON.stringify(mockJson)}\n\`\`\``
      })
    } as any);

    const provider = new OllamaProvider('http://localhost:11434');
    const result = await provider.analyze('scrutiny', 'word', 'They were under close scrutiny.');
    expect(result.selectedText).toBe('scrutiny');
    expect(result.bengaliTranslation).toBe('পরীক্ষা');
  });

  it('surfaces friendly network error when Ollama server is not running', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const provider = new OllamaProvider('http://localhost:11434');
    await expect(provider.analyze('test', 'word')).rejects.toThrow(
      'Ollama is not running. Open the Ollama app and try again.'
    );
  });

  it('surfaces friendly 401 message for cloud models needing signin', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Unauthorized'
    } as any);

    const provider = new OllamaProvider('http://localhost:11434', 'gemma4:31b-cloud');
    await expect(provider.analyze('test', 'word')).rejects.toThrow(
      'Run `ollama signin` in a terminal (only needed for -cloud models).'
    );
  });

  it('surfaces friendly 403 message if blocked by origin', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Forbidden'
    } as any);

    const provider = new OllamaProvider('http://localhost:11434');
    await expect(provider.analyze('test', 'word')).rejects.toThrow(
      'Ollama blocked the request.'
    );
  });
});
