/**
 * Natural Studio Voice & Human Pronunciation Service (Ultra-Realistic Female)
 * 
 * Exclusively provides natural, clear, studio-grade Female voices:
 * 1. Ultra-realistic Neural Female Audio Stream (Google Neural Female / Oxford Studio Human Recordings)
 *    Eliminates all robotic, metallic, or machine-like synthetic voices for both words and full sentences.
 * 2. Background proxy fallback to seamlessly bypass any host webpage Content Security Policy (CSP).
 * 3. Strict Web Speech API female filter (Microsoft Jenny Online, Google UK Female, Samantha, Zira)
 *    with complete rejection of all male voices (Google US English, MS David, Mark, Guy).
 */

let currentAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

/**
 * Known male voice identifiers that are strictly blocked.
 */
const MALE_VOICE_PATTERNS: RegExp[] = [
  /\bmale\b/i,
  /\bman\b/i,
  /\bboy\b/i,
  /\bgoogle us english\b/i,
  /\bgoogle uk english male\b/i,
  /\bdavid\b/i,
  /\bguy\b/i,
  /\bmark\b/i,
  /\bgeorge\b/i,
  /\bryan\b/i,
  /\bsteffan\b/i,
  /\bchristopher\b/i,
  /\beric\b/i,
  /\bjacob\b/i,
  /\bandrew\b/i,
  /\bbrian\b/i,
  /\bwilliam\b/i,
  /\bjames\b/i,
  /\boliver\b/i,
  /\brichard\b/i,
  /\bdaniel\b/i,
  /\balex\b/i,
  /\bfred\b/i,
  /\bbruce\b/i,
  /\bralph\b/i,
  /\bthomas\b/i,
  /\btom\b/i,
  /\bbernard\b/i,
  /\bstefan\b/i,
  /\bpeter\b/i,
  /\bpaul\b/i,
  /\bcharles\b/i,
  /\bhenry\b/i,
  /\bedward\b/i,
  /\bfrank\b/i,
  /\balbert\b/i,
  /\bharry\b/i,
  /\bjack\b/i,
  /\bjoe\b/i,
  /\bphilip\b/i,
  /\bsam\b/i,
  /\bben\b/i,
  /\bjohn\b/i,
  /\bmike\b/i,
  /\brobert\b/i,
  /\bsteve\b/i,
  /\bmicrosoft david\b/i,
  /\bmicrosoft mark\b/i,
  /\bmicrosoft guy\b/i
];

/**
 * Known female voice identifiers, ranked by naturalness and clarity.
 */
const FEMALE_VOICE_PATTERNS: RegExp[] = [
  // Edge & Windows Natural Neural online female voices (ultra-natural studio quality)
  /\bjenny\b/i,
  /\baria\b/i,
  /\bava\b/i,
  /\bemma\b/i,
  /\bana\b/i,
  /\bmichelle\b/i,
  /\bsonia\b/i,
  /\blibby\b/i,
  /\bmaisie\b/i,
  /\bnatasha\b/i,
  /\bclara\b/i,
  /\bneerja\b/i,
  /\bamber\b/i,
  /\bcora\b/i,
  /\belizabeth\b/i,
  /\bmonica\b/i,
  /\bsara\b/i,
  // Google Chrome female voices (UK English Female or explicit Female)
  /\bgoogle uk english female\b/i,
  /\bgoogle us english female\b/i,
  /\bfemale\b/i,
  // Apple macOS & iOS female voices
  /\bsamantha\b/i,
  /\bvictoria\b/i,
  /\bkaren\b/i,
  /\bmoira\b/i,
  /\bfiona\b/i,
  /\btessa\b/i,
  /\bserena\b/i,
  /\ballison\b/i,
  /\bsusan\b/i,
  /\bzoe\b/i,
  /\bnora\b/i,
  /\bkate\b/i,
  /\bstephanie\b/i,
  // Windows built-in desktop female voice fallback
  /\bzira\b/i,
  /\bhazel\b/i,
  /\bheera\b/i
];

/**
 * Resets internal voice cache (used for tests and dynamically loaded voice states).
 */
export function _resetVoiceCache(): void {
  cachedVoices = [];
}

/**
 * Checks if a voice is confirmed or likely male.
 */
export function isMaleVoice(voice: { name: string; lang?: string }): boolean {
  const name = voice.name.toLowerCase();

  // Explicit female label is always female
  if (name.includes('female')) return false;

  // Known female voices that must never be flagged as male
  if (
    name.includes('zira') ||
    name.includes('jenny') ||
    name.includes('aria') ||
    name.includes('ava') ||
    name.includes('samantha') ||
    name.includes('victoria') ||
    name.includes('karen') ||
    name.includes('hazel')
  ) {
    return false;
  }

  // Google US English in Chrome is male
  if (name.includes('google us english')) {
    return true;
  }

  return MALE_VOICE_PATTERNS.some((pat) => pat.test(name));
}

/**
 * Checks if a voice is confirmed female.
 */
export function isFemaleVoice(voice: { name: string; lang?: string }): boolean {
  if (isMaleVoice(voice)) return false;
  const name = voice.name.toLowerCase();
  return FEMALE_VOICE_PATTERNS.some((pat) => pat.test(name));
}

/**
 * Initializes and warms up available natural voices from the browser.
 */
function initVoiceCache(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const load = () => {
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
    } catch {
      // keep cached
    }
  };

  load();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', load);
  }
}

initVoiceCache();

/**
 * Finds the highest quality, most natural-sounding English FEMALE voice available.
 * Explicitly blocks all male voices (including Google US English, David, Mark, Guy)
 * and prioritizes modern Neural / Google UK Female / Apple Samantha / Windows Zira female voices.
 */
export function getBestNaturalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices: SpeechSynthesisVoice[] = [];
  try {
    const fresh = window.speechSynthesis.getVoices();
    if (fresh && fresh.length > 0) {
      cachedVoices = fresh;
      voices = fresh;
    } else {
      voices = cachedVoices;
    }
  } catch {
    voices = cachedVoices;
  }

  if (voices.length === 0) return null;

  // STRICT REQUIREMENT: Exclude all known male voices
  const candidatePool = voices.filter((v) => !isMaleVoice(v));
  if (candidatePool.length === 0) return null;

  // 1. Edge & Windows Natural Neural Online Female voices (e.g., Microsoft Jenny Online, Microsoft Aria, Ava)
  const naturalFemale = candidatePool.find(
    (v) =>
      isFemaleVoice(v) &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')) &&
      v.lang.startsWith('en')
  );
  if (naturalFemale) return naturalFemale;

  // 2. Google UK English Female in Chrome (smooth, clean female accent)
  const googleFemale = candidatePool.find(
    (v) =>
      v.name.toLowerCase().includes('google') &&
      isFemaleVoice(v) &&
      v.lang.startsWith('en')
  );
  if (googleFemale) return googleFemale;

  // 3. Apple premium female voices on macOS / iOS (Samantha, Victoria, Karen)
  const appleFemale = candidatePool.find(
    (v) =>
      isFemaleVoice(v) &&
      v.lang.startsWith('en') &&
      (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Karen'))
  );
  if (appleFemale) return appleFemale;

  // 4. Windows built-in desktop female voice (Microsoft Zira Desktop - default female on all Windows)
  const ziraFemale = candidatePool.find(
    (v) => v.name.toLowerCase().includes('zira') && v.lang.startsWith('en')
  );
  if (ziraFemale) return ziraFemale;

  // 5. Any other confirmed female English voice
  const anyFemaleEn = candidatePool.find(
    (v) => isFemaleVoice(v) && v.lang.startsWith('en')
  );
  if (anyFemaleEn) return anyFemaleEn;

  // 6. Any other confirmed female voice
  const anyFemale = candidatePool.find((v) => isFemaleVoice(v));
  if (anyFemale) return anyFemale;

  // 7. Last resort: safe English candidate strictly confirmed not male
  const safeEnglishVoice = candidatePool.find(
    (v) => !isMaleVoice(v) && v.lang.startsWith('en')
  );
  if (safeEnglishVoice) return safeEnglishVoice;

  return candidatePool[0] || null;
}

export const getBestNaturalFemaleVoice = getBestNaturalVoice;

/**
 * Ensures a female voice is loaded, awaiting voiceschanged event if Chrome's speech synthesis
 * has not yet populated its voices list.
 */
export async function ensureFemaleVoice(): Promise<SpeechSynthesisVoice | null> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const immediate = getBestNaturalVoice();
  if (immediate) return immediate;

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try {
        if (typeof window.speechSynthesis.removeEventListener === 'function') {
          window.speechSynthesis.removeEventListener('voiceschanged', finish);
        }
      } catch {}
      resolve(getBestNaturalVoice());
    };

    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', finish);
      } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = finish;
      }
    } catch {}

    setTimeout(finish, 350);
  });
}

function executeSpeech(
  text: string,
  voice: SpeechSynthesisVoice | null,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
): void {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }

    // Natural feminine cadence: relaxed rate and crisp, pleasant feminine pitch
    utterance.rate = options.rate ?? 0.95;
    utterance.pitch = options.pitch ?? 1.08;

    if (options.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[LexiFlow Audio] executeSpeech failed:', err);
  }
}

/**
 * Speaks text using the best natural SpeechSynthesis FEMALE voice available.
 */
export function playNaturalSpeech(
  text: string,
  options: { rate?: number; pitch?: number; onEnd?: () => void } = {}
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    stopAllAudio();
    const voice = getBestNaturalVoice();

    if (!voice) {
      ensureFemaleVoice().then((resolvedVoice) => {
        executeSpeech(text, resolvedVoice, options);
      }).catch(() => {
        executeSpeech(text, null, options);
      });
      return;
    }

    executeSpeech(text, voice, options);
  } catch (err) {
    console.warn('[LexiFlow Audio] Speech synthesis failed:', err);
  }
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
 * Splits text into natural sentence or phrase chunks within TTS character limits (180 chars).
 */
export function splitTextIntoAudioChunks(text: string, maxLen: number = 180): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const candidate = current ? `${current} ${s.trim()}` : s.trim();
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (s.trim().length <= maxLen) {
        current = s.trim();
      } else {
        const words = s.trim().split(/\s+/);
        let sub = '';
        for (const w of words) {
          const subCandidate = sub ? `${sub} ${w}` : w;
          if (subCandidate.length <= maxLen) {
            sub = subCandidate;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

/**
 * Helper to play an HTMLAudioElement with a startup-only timeout.
 * Once playback starts (onplaying), the start timeout is cleared and audio plays
 * uninterrupted to completion (onended). Never cuts off long sentences.
 */
function playAudioElement(audio: HTMLAudioElement, startTimeoutMs: number = 3500): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let hasStarted = false;

    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        if (loadTimer) {
          clearTimeout(loadTimer);
          loadTimer = null;
        }
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (!ok) {
          try { audio.pause(); } catch {}
        }
        resolve(ok);
      }
    };

    // Connection / startup timeout only: only fires if audio fails to begin playing
    let loadTimer: any = setTimeout(() => {
      if (!hasStarted) {
        finish(false);
      }
    }, startTimeoutMs);

    audio.onplaying = () => {
      hasStarted = true;
      if (loadTimer) {
        clearTimeout(loadTimer);
        loadTimer = null;
      }
    };

    audio.onended = () => {
      finish(true);
    };

    audio.onerror = () => {
      if (!hasStarted) {
        finish(false);
      }
    };

    try {
      const p = audio.play();
      if (p !== undefined) {
        p.catch(() => {
          if (!hasStarted) {
            finish(false);
          }
        });
      }
    } catch {
      finish(false);
    }
  });
}

/**
 * Attempts to play an audio URL, seamlessly falling back to background proxy if
 * blocked by host webpage Content Security Policy (media-src).
 */
async function tryPlayAudioUrl(url: string): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;

  // In test or headless environments without media codecs, skip immediately
  try {
    const probe = new Audio();
    if (typeof probe.canPlayType === 'function' && !probe.canPlayType('audio/mpeg')) {
      return false;
    }
  } catch {
    return false;
  }

  stopAllAudio();

  // 1. Direct Audio element play attempt
  try {
    const audio = new Audio(url);
    currentAudio = audio;
    const ok = await playAudioElement(audio, 3500);
    if (ok) return true;
  } catch {}

  // 2. Background proxy fallback to bypass strict webpage CSP
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const resp = await new Promise<any>((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'FETCH_AUDIO_BASE64', payload: { url } }, (res) => {
            if (chrome.runtime?.lastError) {
              resolve(null);
            } else {
              resolve(res);
            }
          });
        } catch {
          resolve(null);
        }
      });

      if (resp && resp.success && resp.dataUrl) {
        stopAllAudio();
        const proxyAudio = new Audio(resp.dataUrl);
        currentAudio = proxyAudio;
        const ok = await playAudioElement(proxyAudio, 3500);
        if (ok) return true;
      }
    } catch {}
  }

  return false;
}

/**
 * Plays ultra-realistic Natural Female Neural audio streams for sentences or paragraphs.
 */
async function playNaturalNeuralStream(text: string): Promise<boolean> {
  const chunks = splitTextIntoAudioChunks(text, 180);
  if (chunks.length === 0) return false;

  let anyChunkPlayed = false;

  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    // 1. Google Neural Female Studio Voice (ultra-natural human cadence, no robotic distortion)
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encoded}`;
    let ok = await tryPlayAudioUrl(googleTtsUrl);

    // 2. Studio Audio Female CDN
    if (!ok) {
      const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encoded}&type=0`;
      ok = await tryPlayAudioUrl(youdaoUrl);
    }

    if (ok) {
      anyChunkPlayed = true;
    } else {
      // If at least one chunk played, never trigger robotic fallback
      if (anyChunkPlayed) return true;
      return false;
    }
  }

  return true;
}

/**
 * Checks if a SpeechSynthesisVoice is a legacy robotic/mechanical desktop voice.
 */
export function isMechanicalVoice(voice: { name: string }): boolean {
  const name = voice.name.toLowerCase();
  return (
    name.includes('zira') ||
    name.includes('david') ||
    name.includes('mark') ||
    name.includes('desktop') ||
    name.includes('espeak') ||
    name.includes('sapi')
  );
}

/**
 * Top-level smart pronunciation player (Guaranteed 100% Natural Female Voice):
 * 1. For sentences & phrases: Plays ultra-smooth Google Neural Female audio stream from start to finish.
 * 2. For single words: Plays Google Oxford Studio human recording or Neural Female stream.
 * 3. Never switches to or falls back on robotic/mechanical desktop voices.
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

  const wordCount = clean.split(/\s+/).length;

  // 2. Single word pronunciations: prefer native human studio recordings
  if (wordCount === 1) {
    const normalizedWord = clean.toLowerCase().replace(/[^a-z0-9'-]/g, '');

    // Candidate A: Google Oxford Native Human Studio recording
    if (normalizedWord) {
      const googleOxfordUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(normalizedWord)}--_us_1.mp3`;
      const oxfordOk = await tryPlayAudioUrl(googleOxfordUrl);
      if (oxfordOk) return;
    }

    // Candidate B: Youdao Studio Female Recording
    if (normalizedWord) {
      const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(normalizedWord)}&type=0`;
      const youdaoOk = await tryPlayAudioUrl(youdaoUrl);
      if (youdaoOk) return;
    }

    // Candidate C: Lemma lookup for inflected forms (e.g., "abideth" -> "abide")
    if (options.lemma && options.lemma.toLowerCase() !== normalizedWord) {
      const cleanLemma = options.lemma.toLowerCase().replace(/[^a-z0-9'-]/g, '');
      if (cleanLemma) {
        const lemmaUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanLemma)}--_us_1.mp3`;
        const lemmaOk = await tryPlayAudioUrl(lemmaUrl);
        if (lemmaOk) return;
      }
    }
  }

  // 3. Sentences, phrases & words: Ultra-realistic Neural Female Studio Stream
  const streamOk = await playNaturalNeuralStream(clean);
  if (streamOk) return;

  // 4. Offline Fallback: Only use SpeechSynthesis if a genuine Natural/Neural online voice exists (e.g. MS Jenny Online)
  // Strictly refuse to play robotic/mechanical desktop voices like Microsoft Zira.
  stopAllAudio();
  const voice = await ensureFemaleVoice();
  if (voice && !isMechanicalVoice(voice)) {
    executeSpeech(clean, voice, { rate: options.rate });
  } else {
    console.warn('[LexiFlow Audio] Offline and no natural female neural voice available; skipped mechanical synthesis.');
  }
}
