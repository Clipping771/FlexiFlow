import { describe, it, expect, vi, afterEach } from 'vitest';
import { startSpeechToText, prepareOnDeviceRecognition } from '../speechToText';

/** A fake recogniser: each instance is recorded so a test can drive it. */
function installRecognizer(options: { onDevice?: 'available' | 'downloadable' | 'unavailable' | null } = {}) {
  const instances: any[] = [];
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    processLocally?: boolean;
    onresult: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      instances.push(this);
    }
    static available = options.onDevice === null ? undefined : vi.fn(async () => options.onDevice ?? 'available');
    static install = vi.fn(async () => true);
  }
  (window as any).SpeechRecognition = FakeRecognition;
  return { instances, FakeRecognition };
}

const say = (rec: any, text: string) =>
  rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] });

afterEach(() => {
  delete (window as any).SpeechRecognition;
});

describe('Speech to text', () => {
  it('switches to on-device recognition when the online service fails, keeping what was heard', async () => {
    const { instances } = installRecognizer({ onDevice: 'available' });
    const onTranscript = vi.fn();
    const onError = vi.fn();
    const onStatus = vi.fn();
    startSpeechToText({ onTranscript, onError, onStatus });

    say(instances[0], 'Trees cool the city');
    instances[0].onerror({ error: 'network' });
    await vi.waitFor(() => expect(instances).toHaveLength(2));

    expect(instances[1].processLocally).toBe(true);
    expect(instances[1].start).toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('on this device'));
    expect(onError).not.toHaveBeenCalled();

    say(instances[1], 'in summer');
    expect(onTranscript).toHaveBeenLastCalledWith('Trees cool the city in summer');
  });

  it('installs the language pack when on-device recognition is downloadable', async () => {
    const { FakeRecognition } = installRecognizer({ onDevice: 'downloadable' });
    expect(await prepareOnDeviceRecognition('en-US')).toBe(true);
    expect(FakeRecognition.install).toHaveBeenCalledWith({ langs: ['en-US'], processLocally: true });
  });

  it('explains the problem when neither online nor on-device recognition works', async () => {
    const { instances } = installRecognizer({ onDevice: null });
    const onError = vi.fn();
    startSpeechToText({ onTranscript: vi.fn(), onError });
    instances[0].onerror({ error: 'network' });
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toMatch(/Google Chrome|type what you said/i);
    expect(instances).toHaveLength(1);
  });

  it('a blocked microphone is reported straight away', () => {
    const { instances } = installRecognizer();
    const onError = vi.fn();
    startSpeechToText({ onTranscript: vi.fn(), onError });
    instances[0].onerror({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Microphone access was blocked'));
  });
});
