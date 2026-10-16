import { describe, it, expect } from 'vitest';
import {
  validateStageA,
  validateStageB,
  hasBengaliScript,
  containsWordOrStem
} from '../validation';

describe('Two-Layer Semantic Validation (Layer 1 Schema & Layer 2 Semantic Checks)', () => {
  it('validates genuine Bengali script detection', () => {
    expect(hasBengaliScript('সহজ বাংলা')).toBe(true);
    expect(hasBengaliScript('অর্থ')).toBe(true);
    expect(hasBengaliScript('Simple English')).toBe(false);
    expect(hasBengaliScript('')).toBe(false);
  });

  it('checks target word or inflected stem matching', () => {
    expect(containsWordOrStem('She was running towards the goal.', 'run')).toBe(true);
    expect(containsWordOrStem('They hesitated before speaking.', 'hesitate')).toBe(true);
    expect(containsWordOrStem('The system works completely fine.', 'work')).toBe(true);
    expect(containsWordOrStem('A totally different sentence.', 'bank')).toBe(false);
  });

  describe('Stage A Validation', () => {
    it('passes a fully compliant Stage A response', () => {
      const valid = {
        selectedText: 'reluctant',
        lemma: 'reluctant',
        partOfSpeech: 'adjective',
        easyEnglish: 'Not wanting to do something, even when you may need to.',
        easyBengali: 'কোনো কাজ করতে মন না চাওয়া।',
        contextMeaning: 'In this sentence, the worker felt unsure about accepting the terms.',
        example: 'He was reluctant to sign the contract.',
        exampleBengali: 'সে চুক্তিতে স্বাক্ষর করতে অনাগ্রহী ছিল।',
        confidence: 'high',
        contextualSenseId: 'sense_1'
      };

      const res = validateStageA(valid);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.data?.selectedText).toBe('reluctant');
    });

    it('rejects Stage A if easyBengali lacks Bengali script', () => {
      const invalidBengali = {
        selectedText: 'reluctant',
        lemma: 'reluctant',
        partOfSpeech: 'adjective',
        easyEnglish: 'Not wanting to do something.',
        easyBengali: 'Unwilling in Bengali', // Missing Bengali script!
        contextMeaning: 'Meaning in context',
        confidence: 'high',
        contextualSenseId: 'sense_1'
      };

      const res = validateStageA(invalidBengali);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('easyBengali'))).toBe(true);
    });

    it('rejects Stage A if missing required structural fields', () => {
      const missingField = {
        selectedText: 'reluctant',
        easyBengali: 'অনিচ্ছুক'
        // missing easyEnglish, contextMeaning
      };

      const res = validateStageA(missingField);
      expect(res.isValid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    it('provides uncertaintyReason fallback when confidence is low', () => {
      const lowConf = {
        selectedText: 'set',
        lemma: 'set',
        partOfSpeech: 'noun',
        easyEnglish: 'A collection of things.',
        easyBengali: 'একগুচ্ছ বস্তু',
        contextMeaning: 'A group of matching items.',
        confidence: 'low',
        contextualSenseId: 'sense_1'
      };

      const res = validateStageA(lowConf);
      expect(res.isValid).toBe(true);
      expect(res.data?.uncertaintyReason).toBeTruthy();
    });
  });

  describe('Stage B Validation', () => {
    const validStageB = {
      lemma: 'bank',
      partOfSpeech: 'noun',
      contextualSenseId: 'sense_financial',
      senses: [
        {
          id: 'sense_geographical',
          partOfSpeech: 'noun',
          easyEnglish: 'The land alongside or sloping down to a river or lake.',
          easyBengali: 'নদীর তীর বা পাড়',
          isContextual: false,
          examples: [{ english: 'We sat on the grassy river bank.', bengali: 'আমরা নদীর ঘাসযুক্ত তীরে বসেছিলাম।' }],
          synonyms: [{ word: 'shore', easyEnglish: 'land near water', easyBengali: 'তীর' }],
          antonyms: []
        },
        {
          id: 'sense_financial',
          partOfSpeech: 'noun',
          easyEnglish: 'A business where you can keep, save, or borrow money.',
          easyBengali: 'অর্থ লেনদেন বা সংরক্ষণের প্রতিষ্ঠান',
          isContextual: true,
          examples: [{ english: 'She deposited the cash in the bank.', bengali: 'সে ব্যাংকে টাকা জমা দিয়েছিল।' }],
          synonyms: [],
          antonyms: []
        }
      ],
      collocations: [{ english: 'river bank', bengali: 'নদীর তীর' }, { english: 'bank account', bengali: 'ব্যাংক হিসাব' }],
      idiomsAndPhrases: []
    };

    it('reorders senses so the contextual sense is ordered first (index 0)', () => {
      const res = validateStageB(validStageB, 'bank');
      expect(res.isValid).toBe(true);
      expect(res.data?.senses).toHaveLength(2);
      // Sense financial was at index 1, must now be index 0!
      expect(res.data?.senses[0].id).toBe('sense_financial');
      expect(res.data?.senses[0].isContextual).toBe(true);
      expect(res.data?.senses[1].id).toBe('sense_geographical');
    });

    it('rejects Stage B if a sense lacks Bengali script in easyBengali', () => {
      const invalid = JSON.parse(JSON.stringify(validStageB));
      invalid.senses[0].easyBengali = 'River edge'; // Not Bengali!

      const res = validateStageB(invalid, 'bank');
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('easyBengali'))).toBe(true);
    });

    it('detects duplicate sense IDs and handles safely', () => {
      const dupSense = JSON.parse(JSON.stringify(validStageB));
      dupSense.senses[0].id = 'sense_1';
      dupSense.senses[1].id = 'sense_1'; // duplicate!

      const res = validateStageB(dupSense, 'bank');
      expect(res.isValid).toBe(true);
      expect(res.warnings.some((w) => w.includes('Duplicate sense ID'))).toBe(true);
    });
  });
});
