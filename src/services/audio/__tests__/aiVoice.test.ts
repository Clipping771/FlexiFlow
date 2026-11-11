import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  synthesizeAiSpeech,
  canUseAiVoice,
  pcm16ToWav,
  _clearAiVoiceCache,
  GEMINI_TTS_MODEL,
  OPENAI_TTS_MODEL
} from '../aiVoice';
import { getUsageRecords } from '../../logging/usageRecord';
import { isNaturalBrowserVoice, prepareListening, speechAudioToUrl } from '../listeningPlayer';

const gemini = { aiProvider: 'gemini' as const, apiKey: 'test-key' };
const openai = { aiProvider: 'openai' as const, apiKey: 'test-key' };

function geminiAudioResponse() {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: btoa('\u0001\u0002\u0003\u0004') } }] } }],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 900 }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

beforeEach(() => _clearAiVoiceCache());
afterEach(() => vi.restoreAllMocks());

describe('AI voice for listening', () => {
  it('only uses an AI voice with a Gemini or OpenAI key', () => {
    expect(canUseAiVoice(gemini)).toBe(true);
    expect(canUseAiVoice(openai)).toBe(true);
    expect(canUseAiVoice({ aiProvider: 'gemini', apiKey: ' ' })).toBe(false);
    expect(canUseAiVoice({ aiProvider: 'anthropic', apiKey: 'k' })).toBe(false);
    expect(canUseAiVoice({ aiProvider: 'mock' })).toBe(false);
    expect(canUseAiVoice({ aiProvider: 'lexiflow' })).toBe(true);
    expect(canUseAiVoice({ aiProvider: 'openai', apiKey: 'k', apiEndpoint: 'http://localhost:1234/v1' })).toBe(false);
  });

  it('Gemini: asks the TTS model for audio with a natural female voice, logs usage, and caches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => geminiAudioResponse());
    const audio = await synthesizeAiSpeech('  Hello   learners. ', gemini);

    expect(audio).toMatchObject({ format: 'pcm16', sampleRate: 24000, provider: 'gemini', model: GEMINI_TTS_MODEL, voice: 'Kore' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`models/${GEMINI_TTS_MODEL}:generateContent`);
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(body.contents[0].parts[0].text).toContain('Hello learners.');
    // The key goes in a header, never the URL
    expect(url).not.toContain('test-key');

    await new Promise((r) => setTimeout(r, 0));
    const record = (await getUsageRecords()).find((r) => r.model === GEMINI_TTS_MODEL);
    expect(record).toMatchObject({ taskId: 'listening_tts', promptVersion: 'tts_v1', promptTokens: 40, completionTokens: 900, costKnown: true });

    await synthesizeAiSpeech('Hello learners.', gemini);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('OpenAI: returns MP3 audio from gpt-4o-mini-tts', async () => {
    const mp3 = new Uint8Array(2000).fill(7);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(mp3, { status: 200 }));
    const audio = await synthesizeAiSpeech('A short news brief.', openai);
    expect(audio).toMatchObject({ format: 'mp3', provider: 'openai', model: OPENAI_TTS_MODEL, voice: 'nova' });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ model: OPENAI_TTS_MODEL, voice: 'nova', response_format: 'mp3' });
  });

  it('returns null (so the browser voice is used) on an HTTP error, a network error or no audio', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 429 }));
    expect(await synthesizeAiSpeech('one', gemini)).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await synthesizeAiSpeech('two', gemini)).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    expect(await synthesizeAiSpeech('three', gemini)).toBeNull();
    expect(await synthesizeAiSpeech('   ', gemini)).toBeNull();
  });

  it('wraps PCM in a valid WAV header', () => {
    const wav = pcm16ToWav(new Uint8Array([1, 2, 3, 4]), 24000);
    const v = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(4);
    expect(wav.length).toBe(48);
  });
});

describe('Cloud voice', () => {
  it('signed out LexiFlow Cloud users get the browser voice (null)', async () => {
    expect(await synthesizeAiSpeech('Hello there.', { aiProvider: 'lexiflow' })).toBeNull();
  });
});

describe('Listening player', () => {
  it('treats robotic desktop voices as not natural', () => {
    expect(isNaturalBrowserVoice({ name: 'Microsoft Zira - English (United States)' })).toBe(false);
    expect(isNaturalBrowserVoice({ name: 'Microsoft Zira Desktop' })).toBe(false);
    expect(isNaturalBrowserVoice({ name: 'Microsoft Aria Online (Natural) - English (United States)' })).toBe(true);
    expect(isNaturalBrowserVoice({ name: 'Google UK English Female' })).toBe(true);
    expect(isNaturalBrowserVoice(null)).toBe(false);
  });

  it('has no AI audio outside the extension', async () => {
    expect(await prepareListening('Some text to read.')).toBeNull();
  });

  it('builds a playable URL for both audio formats', () => {
    const create = vi.fn(() => 'blob:x');
    (URL as any).createObjectURL = create;
    expect(speechAudioToUrl({ format: 'pcm16', base64: btoa('ab'), sampleRate: 24000, provider: 'gemini', model: 'm', voice: 'v' })).toBe('blob:x');
    expect((create.mock.calls[0] as any)[0].type).toBe('audio/wav');
    speechAudioToUrl({ format: 'mp3', base64: btoa('ab'), sampleRate: 24000, provider: 'openai', model: 'm', voice: 'v' });
    expect((create.mock.calls[1] as any)[0].type).toBe('audio/mpeg');
  });
});
