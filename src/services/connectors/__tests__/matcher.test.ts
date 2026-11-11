import { describe, it, expect } from 'vitest';
import {
  findDiscourseConnectors,
  validateWhyItMatters,
  getValidatedWhyThisMatters
} from '../matcher';

describe('Discourse Connector Matcher & Why This Matters Validator', () => {
  describe('Closed List Connector Detection', () => {
    it('detects single-word contrast connectors with word boundaries', () => {
      const sentence = 'The model scored high; however, memory usage spiked.';
      const matches = findDiscourseConnectors(sentence);
      expect(matches.length).toBe(1);
      expect(matches[0].normalized).toBe('however');
      expect(matches[0].category).toBe('contrast');
      expect(matches[0].categoryLabel).toBe('Contrast / Concession');
    });

    it('detects multi-word connectors without splitting', () => {
      const s1 = 'She prepared diligently; as a result, she won first prize.';
      const m1 = findDiscourseConnectors(s1);
      expect(m1.length).toBe(1);
      expect(m1[0].normalized).toBe('as a result');
      expect(m1[0].category).toBe('consequence');

      const s2 = 'Even though the rain was pouring, the game continued.';
      const m2 = findDiscourseConnectors(s2);
      expect(m2.length).toBe(1);
      expect(m2[0].normalized).toBe('even though');
      expect(m2[0].category).toBe('contrast');
    });

    it('strictly excludes ambiguous polysemous words (while, since, as, so)', () => {
      const ambiguousSentence = 'While he was reading, since 2020, as it happened, so we left.';
      const matches = findDiscourseConnectors(ambiguousSentence);
      expect(matches.length).toBe(0);
    });

    it('detects condition and exemplification connectors', () => {
      const sCondition = 'You can attend provided that you register in advance.';
      const mCond = findDiscourseConnectors(sCondition);
      expect(mCond.length).toBe(1);
      expect(mCond[0].normalized).toBe('provided that');
      expect(mCond[0].category).toBe('condition');

      const sExample = 'Many mammals, for instance dolphins, display high social intelligence.';
      const mEx = findDiscourseConnectors(sExample);
      expect(mEx.length).toBe(1);
      expect(mEx[0].normalized).toBe('for instance');
      expect(mEx[0].category).toBe('exemplification');
    });
  });

  describe('validateWhyItMatters', () => {
    it('accepts substantive pedagogical explanations', () => {
      const valid = 'Introduces an unexpected contrast that shifts the reader focus.';
      expect(validateWhyItMatters(valid)).toBe(valid);
    });

    it('rejects empty, short, or generic placeholders', () => {
      expect(validateWhyItMatters('')).toBeNull();
      expect(validateWhyItMatters('   ')).toBeNull();
      expect(validateWhyItMatters('short')).toBeNull();
      expect(validateWhyItMatters('N/A')).toBeNull();
      expect(validateWhyItMatters('none')).toBeNull();
      expect(validateWhyItMatters('placeholder')).toBeNull();
      expect(validateWhyItMatters(undefined)).toBeNull();
      expect(validateWhyItMatters(null)).toBeNull();
    });
  });

  describe('getValidatedWhyThisMatters', () => {
    it('returns validated AI explanation when AI produces a solid answer', () => {
      const sentence = 'The method is fast; however, it consumes significant RAM.';
      const aiNote = 'Highlights the key trade-off between execution speed and memory footprint.';
      const result = getValidatedWhyThisMatters(sentence, aiNote);

      expect(result).not.toBeNull();
      expect(result?.connector.normalized).toBe('however');
      expect(result?.explanation).toBe(aiNote);
      expect(result?.isAiValidated).toBe(true);
    });

    it('falls back to rule-based pedagogical discourse role when AI note is absent or invalid', () => {
      const sentence = 'Profits rose; therefore, hiring resumed immediately.';
      const result = getValidatedWhyThisMatters(sentence, 'N/A');

      expect(result).not.toBeNull();
      expect(result?.connector.normalized).toBe('therefore');
      expect(result?.isAiValidated).toBe(false);
      expect(result?.explanation).toContain('logical conclusion');
    });

    it('returns null when no closed-list connector is present (omits gracefully)', () => {
      const plain = 'The quick brown fox jumps over the lazy dog.';
      const result = getValidatedWhyThisMatters(plain, 'Some explanation');
      expect(result).toBeNull();
    });
  });
});
