/**
 * Live speech-to-text for the Speaking screens, using the browser's built-in recogniser
 * (Chrome's SpeechRecognition). Nothing is uploaded by LexiFlow itself.
 *
 * Chrome's default recogniser sends audio to Google's speech service, which some browsers
 * (e.g. Brave) and some networks refuse with a "network" error. Newer Chrome can also recognise
 * speech on the device; when the online service fails, the session switches to that and keeps
 * the words heard so far.
 */

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type OnDeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

type RecognitionCtor = (new () => Recognition) & {
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<OnDeviceStatus>;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechToTextSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Whether this browser can recognise `lang` without the internet (installing the language pack if needed). */
export async function prepareOnDeviceRecognition(lang = 'en-US'): Promise<boolean> {
  const Ctor = getRecognitionCtor();
  if (!Ctor?.available) return false;
  try {
    const options = { langs: [lang], processLocally: true };
    const status = await Ctor.available(options);
    if (status === 'available') return true;
    if ((status === 'downloadable' || status === 'downloading') && Ctor.install) return Boolean(await Ctor.install(options));
    return false;
  } catch {
    return false;
  }
}

export interface SpeechToTextSession {
  stop(): void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone for LexiFlow, or type what you said.',
  'service-not-allowed': 'Speech recognition is turned off in this browser. Type what you said instead.',
  'audio-capture': 'No microphone was found. Type what you said instead.',
  network:
    "This browser couldn't reach its speech service (common in Brave, Edge or behind some networks and VPNs). Use Google Chrome, or type what you said.",
  'language-not-supported': "Speech recognition doesn't support English on this device. Type what you said instead."
};

/**
 * Starts listening. `onTranscript` receives the full text heard so far (final + in-progress words)
 * every time it changes. Chrome stops after a pause, so the session restarts itself until stop().
 * `onStatus` reports a switch to on-device recognition.
 */
export function startSpeechToText(handlers: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onStatus?: (message: string) => void;
  lang?: string;
}): SpeechToTextSession | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const lang = handlers.lang || 'en-US';
  let finalText = '';
  let stopped = false;
  let local = false;
  let triedLocal = false;
  let recognition = new Ctor();

  const fail = (code: string) => {
    stopped = true;
    handlers.onError?.(ERROR_MESSAGES[code] || 'Speech recognition stopped. Type what you said instead.');
  };

  const begin = () => {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    if (local) recognition.processLocally = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText = `${finalText} ${result[0].transcript}`.trim();
        else interim += result[0].transcript;
      }
      handlers.onTranscript(`${finalText} ${interim}`.trim());
    };

    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" are normal during pauses and stop()
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'network' && !local && !triedLocal) {
        // The online service is unreachable: try recognising on this device instead
        triedLocal = true;
        recognition.onend = null;
        prepareOnDeviceRecognition(lang).then((ok) => {
          if (stopped) return;
          if (!ok) return fail('network');
          local = true;
          handlers.onStatus?.('Listening on this device (no internet needed).');
          recognition = new Ctor();
          begin();
        });
        return;
      }
      fail(event.error);
    };

    recognition.onend = () => {
      if (stopped) return;
      recognition = new Ctor();
      begin();
    };

    try {
      recognition.start();
    } catch {
      stopped = true;
      handlers.onError?.('Speech recognition could not start. Type what you said instead.');
    }
  };

  begin();

  return {
    stop() {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    }
  };
}
