// Natural speech for listening practice (Gemini TTS). Same model and voice as the extension's
// own-key path, so cloud and own-key learners hear the same voice.
import type { GeminiConfig, TaskResult } from './stageTasks';
import { TaskFailedError } from './stageTasks';

export const SPEECH_MODEL = 'gemini-2.5-flash-preview-tts';
export const SPEECH_VOICE = 'Kore';
export const SPEECH_MAX_CHARS = 1200;
/** List price of the TTS model per million tokens (audio output is far dearer than text). */
export const SPEECH_USD_PER_MTOK = { input: 0.5, output: 10 };

const STYLE =
  'Read this aloud like a friendly, professional radio news presenter: natural rhythm, clear pronunciation, ' +
  'a moderate pace for English learners, and short pauses between sentences.';

export interface SpeechData {
  format: 'pcm16';
  base64: string;
  sampleRate: number;
  provider: 'gemini';
  model: string;
  voice: string;
}

export async function runSpeech(gemini: GeminiConfig, text: string): Promise<TaskResult<SpeechData>> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${SPEECH_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gemini.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${STYLE}\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEECH_VOICE } } }
        }
      }),
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    throw new TaskFailedError('model_error', 0, 0);
  }
  if (!res.ok) throw new TaskFailedError('model_error', 0, 0);
  const body = (await res.json().catch(() => null)) as any;
  const tokensIn = Number(body?.usageMetadata?.promptTokenCount) || 0;
  const tokensOut = Number(body?.usageMetadata?.candidatesTokenCount) || 0;
  const part = body?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  const data: string | undefined = part?.inlineData?.data;
  if (!data) throw new TaskFailedError('invalid_output', tokensIn, tokensOut);
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return {
    data: { format: 'pcm16', base64: data, sampleRate: rate, provider: 'gemini', model: SPEECH_MODEL, voice: SPEECH_VOICE },
    tokensIn,
    tokensOut,
    spendMicroUsd: Math.round(tokensIn * SPEECH_USD_PER_MTOK.input + tokensOut * SPEECH_USD_PER_MTOK.output)
  };
}
