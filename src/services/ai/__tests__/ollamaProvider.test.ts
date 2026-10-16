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

  it('gracefully parses and normalizes loose/variant model responses without Zod validation failure', async () => {
    // Model returns alternative keys (e.g. word instead of selectedText, meaning instead of contextualMeaning)
    const variantJson = {
      word: 'resilient',
      meaning: 'Able to recover quickly from difficult conditions.',
      translation: 'সহনশীল বা প্রতিকূলতা জয় করতে সক্ষম',
      pos: 'adjective'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: JSON.stringify(variantJson)
      })
    } as any);

    const provider = new OllamaProvider('http://localhost:11434', 'gemma4:31b-cloud');
    const result = await provider.analyze('resilient', 'word', 'They remained resilient during challenging times.');

    expect(result.selectedText).toBe('resilient');
    expect(result.selectionType).toBe('word');
    expect(result.partOfSpeech).toBe('adjective');
    expect(result.contextualMeaning).toBe('Able to recover quickly from difficult conditions.');
    expect(result.bengaliTranslation).toBe('সহনশীল বা প্রতিকূলতা জয় করতে সক্ষম');
  });

  it('handles chat-only models like d1:latest returning message.content from /api/chat', async () => {
    const mockWord = {
      selectedText: 'resilient',
      selectionType: 'word',
      partOfSpeech: 'adjective',
      contextualMeaning: 'Able to withstand shock.',
      simpleEnglishExplanation: 'Recovers fast.',
      bengaliTranslation: 'সহনশীল',
      whyFitsContext: 'Fits sentence context.',
      examples: ['Resilient people adapt.']
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              role: 'assistant',
              content: JSON.stringify(mockWord)
            }
          })
        };
      }
      return {
        ok: false,
        status: 400,
        text: async () => '"d1:latest" does not support generate'
      };
    });

    const provider = new OllamaProvider('http://localhost:11434', 'd1:latest');
    const result = await provider.analyze('resilient', 'word', 'They remained resilient.');

    expect(result.selectedText).toBe('resilient');
    expect(result.contextualMeaning).toBe('Able to withstand shock.');
    expect(result.bengaliTranslation).toBe('সহনশীল');
  });
});
