/**
 * Natural Voice & Studio Pronunciation Service
 * 
 * Provides:
 * 1. High-fidelity human studio audio recordings for dictionary words (Google Oxford & Native Audio CDN)
 * 2. Ultra-realistic Neural/Natural voice selection for Web Speech API (Edge/Chrome Natural & Google voices)
 * 3. Graceful fallback hierarchy with non-overlapping audio management
 */

let currentAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Initializes and warms up available natural voices from the browser.
 */
function initVoiceCache(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const load = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    } catch {
      cachedVoices = [];
    }
  };

  load();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
}

initVoiceCache();

/**
 * Finds the highest quality, most natural-sounding English voice available.
 * Prioritizes modern Neural / Natural / Google / Apple voices over ancient robotic voices (e.g. MS David).
 */
export function getBestNaturalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    try {
      voices = window.speechSynthesis.getVoices() || [];
      cachedVoices = voices;
    } catch {
      voices = [];
    }
  }

  if (voices.length === 0) return null;

  // 1. Edge & Windows "Natural" / "Online" Neural voices (e.g., Microsoft Jenny Online (Natural), Microsoft Guy Online (Natural), Microsoft Aria)
  const naturalNeural = voices.find(
    (v) =>
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')) &&
      (v.lang.startsWith('en-US') || v.lang.startsWith('en'))
  );
  if (naturalNeural) return naturalNeural;

  // 2. Google US / UK English voices in Chrome (smooth, natural cadence)
  const googleVoice = voices.find(
    (v) =>
      v.name.includes('Google') &&
      (v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en'))
  );
  if (googleVoice) return googleVoice;

  // 3. Apple premium voices on macOS / iOS (Samantha, Daniel, Siri, Premium)
  const appleVoice = voices.find(
    (v) =>
      (v.name.includes('Samantha') ||
        v.name.includes('Daniel') ||
        v.name.includes('Siri') ||
        v.name.includes('Premium')) &&
      v.lang.startsWith('en')
  );
  if (appleVoice) return appleVoice;

  // 4. Any clean en-US voice (better than arbitrary default)
  const enUs = voices.find(
    (v) => v.lang === 'en-US' || v.lang.replace('_', '-') === 'en-US'
  );
  if (enUs) return enUs;

  // 5. Any English voice
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

/**
 * Speaks text using the best natural SpeechSynthesis voice available.
 */
export function playNaturalSpeech(
  text: string,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    stopAllAudio();

    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = getBestNaturalVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    // Natural cadence: slightly relaxed rate for clear, natural pronunciation
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = options.pitch ?? 1.0;

    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[LexiFlow Audio] Speech synthesis failed:', err);
  }
}

/**
 * Attempts to play an audio file by URL with a safety timeout.
 */
function tryPlayAudioUrl(url: string, timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      stopAllAudio();
      const audio = new Audio(url);
      currentAudio = audio;

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { audio.pause(); } catch {}
          resolve(false);
        }
      }, timeoutMs);

      audio.onended = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      };

      audio.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(false);
          }
        });
      }
    } catch {
      resolve(false);
    }
  });
}

/**
 * Stops any currently playing audio or speech synthesis.
 */
export function stopAllAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Top-level smart pronunciation player:
 * 1. If explicit audioUrl provided, plays that.
 * 2. If word/short phrase, tries studio human dictionary recording (Google Oxford CDN, Studio Audio CDN, Lemma fallback).
 * 3. Falls back to lifelike Natural Web Speech API (Edge Natural / Chrome Google voice).
 */
export async function playPronunciation(
  text: string,
  options: { audioUrl?: string; lemma?: string; rate?: number } = {}
): Promise<void> {
  if (!text || typeof text !== 'string') return;
  const clean = text.trim();
  if (!clean) return;

  // 1. Explicit audioUrl provided
  if (options.audioUrl) {
    const success = await tryPlayAudioUrl(options.audioUrl);
    if (success) return;
  }

  // 2. For single words and short phrases, try studio human pronunciations
  const wordCount = clean.split(/\s+/).length;
  if (wordCount <= 3) {
    const normalizedWord = clean.toLowerCase().replace(/[^a-z0-9'-]/g, '');

    // Candidate 1: Google Oxford Studio pronunciation (native human studio recording)
    if (normalizedWord) {
      const googleOxfordUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(normalizedWord)}--_us_1.mp3`;
      const gOk = await tryPlayAudioUrl(googleOxfordUrl, 2500);
      if (gOk) return;
    }

    // Candidate 2: Studio Audio CDN
    if (normalizedWord) {
      const studioCdnUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(normalizedWord)}&type=2`;
      const sOk = await tryPlayAudioUrl(studioCdnUrl, 2500);
      if (sOk) return;
    }

    // Candidate 3: If word is inflected/archaic (e.g. "abideth"), try lemma (e.g. "abide")
    if (options.lemma && options.lemma.toLowerCase() !== normalizedWord) {
      const cleanLemma = options.lemma.toLowerCase().replace(/[^a-z0-9'-]/g, '');
      if (cleanLemma) {
        const lemmaGoogleUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanLemma)}--_us_1.mp3`;
        const lOk = await tryPlayAudioUrl(lemmaGoogleUrl, 2500);
        if (lOk) return;

        const lemmaStudioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanLemma)}&type=2`;
        const lsOk = await tryPlayAudioUrl(lemmaStudioUrl, 2500);
        if (lsOk) return;
      }
    }
  }

  // 3. Fallback: Ultra-natural neural/online speech synthesis
  playNaturalSpeech(clean, { rate: options.rate });
}
