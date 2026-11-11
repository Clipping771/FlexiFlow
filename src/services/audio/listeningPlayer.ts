/**
 * Plays listening-practice audio with the most natural voice available:
 *  1. AI voice (Gemini or OpenAI TTS, made by the background worker with the learner's key)
 *  2. A natural browser voice (Edge "Natural"/"Online" voices, Google voices), sentence by sentence
 *  3. The online pronunciation stream used elsewhere in LexiFlow
 * Robotic desktop voices (Microsoft Zira, David, eSpeak) are avoided whenever anything better exists.
 */
import type { SpeechAudio } from './aiVoice';
import { pcm16ToWav } from './aiVoice';
import {
  getBestNaturalVoice,
  ensureFemaleVoice,
  isMechanicalVoice,
  playPronunciation,
  stopPronunciation,
  splitTextIntoAudioChunks
} from './voiceService';

export type VoiceKind = 'ai' | 'browser';

const urlCache = new Map<string, Promise<string | null>>();
let current: HTMLAudioElement | null = null;
let generation = 0;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Turns AI audio into a playable object URL */
export function speechAudioToUrl(audio: SpeechAudio): string {
  const bytes = base64ToBytes(audio.base64);
  const blob =
    audio.format === 'pcm16'
      ? new Blob([pcm16ToWav(bytes, audio.sampleRate) as BlobPart], { type: 'audio/wav' })
      : new Blob([bytes as BlobPart], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

function requestAiSpeech(text: string): Promise<SpeechAudio | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve(null);
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: 'SYNTHESIZE_SPEECH', payload: { text } }, (res) => {
        if (chrome.runtime?.lastError || !res?.success || !res.data) resolve(null);
        else resolve(res.data as SpeechAudio);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Starts making the AI audio early (for example when the listening card opens) so Play is instant.
 * Resolves to an object URL, or null when no AI voice is available.
 */
export function prepareListening(text: string): Promise<string | null> {
  const key = text.trim();
  let pending = urlCache.get(key);
  if (!pending) {
    pending = requestAiSpeech(key).then((audio) => (audio ? speechAudioToUrl(audio) : null));
    urlCache.set(key, pending);
    // A failed attempt can be retried next time
    pending.then((url) => {
      if (!url) urlCache.delete(key);
    });
    while (urlCache.size > 12) urlCache.delete(urlCache.keys().next().value as string);
  }
  return pending;
}

export function _clearListeningCache(): void {
  urlCache.clear();
}

/** A browser voice good enough for a whole passage (not a robotic desktop voice) */
export function isNaturalBrowserVoice(voice: { name: string } | null): boolean {
  if (!voice) return false;
  if (isMechanicalVoice(voice)) return false;
  return /natural|online|neural|google|premium|enhanced|siri/i.test(voice.name) || /samantha|karen|moira|tessa/i.test(voice.name);
}

function speakWithBrowserVoice(text: string, voice: SpeechSynthesisVoice, rate: number, isCancelled: () => boolean): Promise<void> {
  // Chrome cuts off long utterances, so speak sentence by sentence
  const chunks = splitTextIntoAudioChunks(text, 220);
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (isCancelled() || i >= chunks.length) {
        resolve();
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
      u.rate = rate;
      u.pitch = 1;
      u.onend = next;
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    };
    try {
      window.speechSynthesis.cancel();
    } catch {}
    next();
  });
}

function playUrl(url: string, rate: number, isCancelled: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    current = audio;
    audio.playbackRate = rate;
    // Keep the voice's natural pitch when slowed down
    (audio as any).preservesPitch = true;
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.onpause = () => {
      if (isCancelled()) resolve(true);
    };
    audio.play().catch(() => resolve(false));
  });
}

/**
 * Plays `text` and resolves when it finishes or is stopped. Returns which kind of voice was used.
 * `slow` plays at about 80% speed.
 */
export async function playListening(text: string, options: { slow?: boolean } = {}): Promise<VoiceKind> {
  stopListening();
  const myGeneration = ++generation;
  const isCancelled = () => myGeneration !== generation;
  const slow = Boolean(options.slow);

  const url = await prepareListening(text);
  if (isCancelled()) return url ? 'ai' : 'browser';
  if (url) {
    const ok = await playUrl(url, slow ? 0.82 : 1, isCancelled);
    if (ok || isCancelled()) return 'ai';
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voice = getBestNaturalVoice() ?? (await ensureFemaleVoice());
    if (isCancelled()) return 'browser';
    if (voice && isNaturalBrowserVoice(voice)) {
      await speakWithBrowserVoice(text, voice, slow ? 0.82 : 0.98, isCancelled);
      return 'browser';
    }
  }

  // Online pronunciation stream (natural Google voice); avoids robotic desktop voices
  await playPronunciation(text, { rate: slow ? 0.82 : 0.98 });
  return 'browser';
}

export function stopListening(): void {
  generation++;
  if (current) {
    try {
      current.pause();
    } catch {}
    current = null;
  }
  stopPronunciation();
}
