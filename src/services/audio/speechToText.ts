/**
 * Live speech-to-text for the Speaking engine, using the browser's built-in recogniser
 * (Chrome's webkitSpeechRecognition). Nothing is uploaded by LexiFlow itself.
 */

type RecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechToTextSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface SpeechToTextSession {
  stop(): void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone for LexiFlow, or type what you said.',
  'service-not-allowed': 'Speech recognition is turned off in this browser. Type what you said instead.',
  'audio-capture': 'No microphone was found. Type what you said instead.',
  network: 'Speech recognition needs an internet connection. Type what you said instead.'
};

/**
 * Starts listening. `onTranscript` receives the full text heard so far (final + in-progress words)
 * every time it changes. Chrome stops after a pause, so the session restarts itself until stop().
 */
export function startSpeechToText(handlers: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  lang?: string;
}): SpeechToTextSession | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  let finalText = '';
  let stopped = false;
  let recognition = new Ctor();

  const begin = () => {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = handlers.lang || 'en-US';

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
      stopped = true;
      handlers.onError?.(ERROR_MESSAGES[event.error] || 'Speech recognition stopped. Type what you said instead.');
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
