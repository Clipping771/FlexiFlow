/**
 * Natural AI voice for listening practice (runs in the background worker, which owns the API key).
 *
 * Uses the learner's own provider:
 *  - Gemini → gemini-2.5-flash-preview-tts (returns raw 24 kHz 16-bit PCM)
 *  - OpenAI → gpt-4o-mini-tts (returns MP3)
 * Other providers return null and the page falls back to the best browser voice.
 * Every call writes a UsageRecord (AGENTS.md rule 5).
 */
import type { UserSettings } from '../../types';
import { recordUsage } from '../logging/usageRecord';

export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
/** Warm, clear female voices (the app's voice policy is female-only) */
export const GEMINI_TTS_VOICE = 'Kore';
export const OPENAI_TTS_VOICE = 'nova';
export const TTS_PROMPT_VERSION = 'tts_v1';
export const MAX_TTS_CHARS = 1200;

const STYLE =
  'Read this aloud like a friendly, professional radio news presenter: natural rhythm, clear pronunciation, ' +
  'a moderate pace for English learners, and short pauses between sentences.';

export interface SpeechAudio {
  /** 'pcm16' is raw little-endian 16-bit mono PCM; 'mp3' is a complete file */
  format: 'pcm16' | 'mp3';
  base64: string;
  sampleRate: number;
  provider: 'gemini' | 'openai';
  model: string;
  voice: string;
}

const cache = new Map<string, SpeechAudio>();
const CACHE_LIMIT = 12;

function remember(key: string, audio: SpeechAudio): void {
  cache.delete(key);
  cache.set(key, audio);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

export function _clearAiVoiceCache(): void {
  cache.clear();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(binary);
}

const TASK = { taskId: 'listening_tts', promptVersion: TTS_PROMPT_VERSION, rubricVersion: 'none' };

async function geminiSpeech(text: string, apiKey: string): Promise<SpeechAudio | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${STYLE}\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } } }
        }
      }),
      signal: AbortSignal.timeout(45000)
    }
  );
  const body = res.ok ? await res.json().catch(() => null) : null;
  void recordUsage({ provider: 'gemini', model: GEMINI_TTS_MODEL, systemPrompt: STYLE, userPrompt: text, body, task: TASK });
  if (!res.ok || !body) return null;

  const part = body?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  const data: string | undefined = part?.inlineData?.data;
  if (!data) return null;
  const mime: string = part.inlineData.mimeType || '';
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
  return { format: 'pcm16', base64: data, sampleRate: rate, provider: 'gemini', model: GEMINI_TTS_MODEL, voice: GEMINI_TTS_VOICE };
}

async function openaiSpeech(text: string, apiKey: string): Promise<SpeechAudio | null> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      instructions: STYLE,
      response_format: 'mp3'
    }),
    signal: AbortSignal.timeout(45000)
  });
  // The speech endpoint returns audio, not token counts, so tokens are estimated from the text
  void recordUsage({
    provider: 'openai',
    model: OPENAI_TTS_MODEL,
    systemPrompt: STYLE,
    userPrompt: text,
    completionText: text,
    task: TASK
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength < 1000) return null;
  return { format: 'mp3', base64: arrayBufferToBase64(buffer), sampleRate: 24000, provider: 'openai', model: OPENAI_TTS_MODEL, voice: OPENAI_TTS_VOICE };
}

/** True when the learner's settings can make a natural AI voice */
export function canUseAiVoice(settings: Pick<UserSettings, 'aiProvider' | 'apiKey' | 'apiEndpoint'>): boolean {
  if (!settings.apiKey?.trim()) return false;
  if (settings.aiProvider === 'gemini') return true;
  if (settings.aiProvider === 'openai') return !settings.apiEndpoint || settings.apiEndpoint.includes('api.openai.com');
  return false;
}

/**
 * Makes natural speech for `text`, or returns null when no AI voice is set up or the call fails
 * (the caller then uses a browser voice). Never throws.
 */
export async function synthesizeAiSpeech(
  text: string,
  settings: Pick<UserSettings, 'aiProvider' | 'apiKey' | 'apiEndpoint'>
): Promise<SpeechAudio | null> {
  const clean = (text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS);
  if (!clean || !canUseAiVoice(settings)) return null;

  const key = `${settings.aiProvider}:${clean}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const audio =
      settings.aiProvider === 'gemini'
        ? await geminiSpeech(clean, settings.apiKey!.trim())
        : await openaiSpeech(clean, settings.apiKey!.trim());
    if (audio) remember(key, audio);
    return audio;
  } catch {
    return null;
  }
}

/** Wraps raw 16-bit mono PCM in a WAV header so an <audio> element can play it */
export function pcm16ToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  write(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}
