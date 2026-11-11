import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRecorder, getSupportedMimeType } from '../recorder';
import { AudioPlayer } from '../player';

describe('TICKET LF-003: Audio Foundation — Mobile Recording & Playback Engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. getSupportedMimeType: Negotiates preferred audio format cleanly', () => {
    const mime = getSupportedMimeType();
    expect(typeof mime).toBe('string');
  });

  it('2. AudioRecorder: Handles permission rejection gracefully', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue({ name: 'NotAllowedError' });
    Object.defineProperty(globalThis, 'navigator', {
      value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
      configurable: true,
      writable: true
    });

    const recorder = new AudioRecorder();
    await expect(recorder.start()).rejects.toThrow('Microphone access was denied');
    expect(recorder.getState()).toBe('inactive');
  });

  it('3. AudioRecorder: Complete recording lifecycle (start -> pause -> resume -> stop)', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack])
    };
    const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

    let onDataAvailableCallback: ((e: any) => void) | null = null;
    let onStopCallback: (() => void) | null = null;

    class MockMediaRecorder {
      state = 'inactive';
      mimeType = 'audio/webm;codecs=opus';
      ondataavailable = null;
      onstop = null;
      static isTypeSupported = vi.fn().mockReturnValue(true);

      constructor() {
        // mock
      }

      start() {
        this.state = 'recording';
      }

      pause() {
        this.state = 'paused';
      }

      resume() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          (this as any).ondataavailable({ data: new Blob(['fake-audio-chunk'], { type: 'audio/webm' }) });
        }
        if (this.onstop) {
          (this as any).onstop();
        }
      }
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      value: MockMediaRecorder,
      configurable: true,
      writable: true
    });

    const recorder = new AudioRecorder();
    expect(recorder.getState()).toBe('inactive');

    await recorder.start();
    expect(recorder.getState()).toBe('recording');

    recorder.pause();
    expect(recorder.getState()).toBe('paused');

    recorder.resume();
    expect(recorder.getState()).toBe('recording');

    const result = await recorder.stop();
    expect(recorder.getState()).toBe('inactive');
    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('4. AudioPlayer: Manages playback state and cleanup', () => {
    const player = new AudioPlayer();
    const fakeBlob = new Blob(['sample-audio'], { type: 'audio/webm' });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateUrl = vi.fn().mockReturnValue('blob:http://localhost/sample-uuid');
    const mockRevokeUrl = vi.fn();
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL: mockCreateUrl, revokeObjectURL: mockRevokeUrl },
      configurable: true,
      writable: true
    });

    player.load(fakeBlob);
    expect(mockCreateUrl).toHaveBeenCalled();

    player.setVolume(0.8);
    player.seek(15);
    player.stop();

    expect(mockRevokeUrl).toHaveBeenCalled();
  });
});
