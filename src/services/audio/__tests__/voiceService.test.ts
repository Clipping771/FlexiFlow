import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMaleVoice,
  isFemaleVoice,
  getBestNaturalVoice,
  playPronunciation,
  playNaturalSpeech,
  _resetVoiceCache
} from '../voiceService';

describe('voiceService - Female Only Audio Pronunciation', () => {
  let mockGetVoices: ReturnType<typeof vi.fn>;
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    _resetVoiceCache();

    mockGetVoices = vi.fn().mockReturnValue([]);
    mockSpeak = vi.fn();
    mockCancel = vi.fn();

    // Mock speechSynthesis in jsdom environment
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: mockGetVoices,
        speak: mockSpeak,
        cancel: mockCancel,
        onvoiceschanged: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true,
      configurable: true
    });

    // Mock SpeechSynthesisUtterance in jsdom environment
    (window as any).SpeechSynthesisUtterance = class {
      text: string;
      voice: any = null;
      lang: string = 'en-US';
      rate: number = 1.0;
      pitch: number = 1.0;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  describe('isMaleVoice identification', () => {
    it('correctly identifies male voices and blocks them (including Google US English)', () => {
      expect(isMaleVoice({ name: 'Microsoft David Desktop - English (United States)' })).toBe(true);
      expect(isMaleVoice({ name: 'Microsoft Guy Online (Natural) - English (United States)' })).toBe(true);
      expect(isMaleVoice({ name: 'Microsoft Mark - English (United States)' })).toBe(true);
      expect(isMaleVoice({ name: 'Microsoft George - English (United Kingdom)' })).toBe(true);
      expect(isMaleVoice({ name: 'Google US English' })).toBe(true);
      expect(isMaleVoice({ name: 'Google UK English Male' })).toBe(true);
      expect(isMaleVoice({ name: 'Daniel (English (United Kingdom))' })).toBe(true);
      expect(isMaleVoice({ name: 'Alex' })).toBe(true);
      expect(isMaleVoice({ name: 'Microsoft Ryan Online (Natural)' })).toBe(true);
    });

    it('does not classify confirmed female voices as male', () => {
      expect(isMaleVoice({ name: 'Microsoft Jenny Online (Natural) - English (United States)' })).toBe(false);
      expect(isMaleVoice({ name: 'Microsoft Aria Online (Natural) - English (United States)' })).toBe(false);
      expect(isMaleVoice({ name: 'Google UK English Female' })).toBe(false);
      expect(isMaleVoice({ name: 'Samantha' })).toBe(false);
      expect(isMaleVoice({ name: 'Microsoft Zira Desktop - English (United States)' })).toBe(false);
    });
  });

  describe('isFemaleVoice identification', () => {
    it('correctly identifies premier female voices', () => {
      expect(isFemaleVoice({ name: 'Microsoft Jenny Online (Natural) - English (United States)' })).toBe(true);
      expect(isFemaleVoice({ name: 'Microsoft Aria Online (Natural) - English (United States)' })).toBe(true);
      expect(isFemaleVoice({ name: 'Google UK English Female' })).toBe(true);
      expect(isFemaleVoice({ name: 'Samantha (Enhanced)' })).toBe(true);
      expect(isFemaleVoice({ name: 'Microsoft Zira Desktop - English (United States)' })).toBe(true);
      expect(isFemaleVoice({ name: 'Victoria' })).toBe(true);
      expect(isFemaleVoice({ name: 'Karen' })).toBe(true);
    });

    it('rejects male voices (including Google US English and MS David)', () => {
      expect(isFemaleVoice({ name: 'Google US English' })).toBe(false);
      expect(isFemaleVoice({ name: 'Microsoft David Desktop' })).toBe(false);
      expect(isFemaleVoice({ name: 'Microsoft Guy Online (Natural)' })).toBe(false);
      expect(isFemaleVoice({ name: 'Microsoft Mark' })).toBe(false);
    });
  });

  describe('getBestNaturalVoice selection', () => {
    it('picks the female Jenny voice even when male voices are first in list', () => {
      const mockVoices = [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' }
      ] as SpeechSynthesisVoice[];

      mockGetVoices.mockReturnValue(mockVoices);

      const selected = getBestNaturalVoice();
      expect(selected).toBeDefined();
      expect(selected?.name).toContain('Jenny');
      expect(isMaleVoice(selected!)).toBe(false);
    });

    it('picks Google UK English Female in Chrome when Jenny is unavailable, strictly rejecting Google US English', () => {
      const mockVoices = [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Google US English', lang: 'en-US' },
        { name: 'Google UK English Female', lang: 'en-GB' },
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' }
      ] as SpeechSynthesisVoice[];

      mockGetVoices.mockReturnValue(mockVoices);

      const selected = getBestNaturalVoice();
      expect(selected).toBeDefined();
      expect(selected?.name).toBe('Google UK English Female');
      expect(isMaleVoice(selected!)).toBe(false);
      expect(isFemaleVoice(selected!)).toBe(true);
    });

    it('falls back to Zira when only desktop voices are present, strictly avoiding David and Mark', () => {
      const mockVoices = [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Mark Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' }
      ] as SpeechSynthesisVoice[];

      mockGetVoices.mockReturnValue(mockVoices);

      const selected = getBestNaturalVoice();
      expect(selected).toBeDefined();
      expect(selected?.name).toContain('Zira');
      expect(isMaleVoice(selected!)).toBe(false);
    });
  });

  describe('playPronunciation execution', () => {
    it('dispatches speech synthesis with female voice settings', async () => {
      const mockVoices = [
        { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' }
      ] as SpeechSynthesisVoice[];
      mockGetVoices.mockReturnValue(mockVoices);

      await playPronunciation('serendipity');

      expect(mockSpeak).toHaveBeenCalledTimes(1);
      const utterance = mockSpeak.mock.calls[0][0];
      expect(utterance.text).toBe('serendipity');
      expect(utterance.pitch).toBeGreaterThanOrEqual(1.0);
    });
  });
});
