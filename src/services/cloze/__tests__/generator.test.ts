import { describe, it, expect } from 'vitest';
import { generateCloze } from '../generator';

describe('Deterministic Cloze & Active Recall Generator', () => {
  it('generates a clean cloze card for an exact word in sentence context', () => {
    const word = 'resilient';
    const sentence = 'The local economy proved remarkably resilient following the unexpected downturn.';
    const res = generateCloze(word, sentence, 'adjective');

    expect(res.success).toBe(true);
    expect(res.cloze).toBeDefined();
    expect(res.cloze?.targetWord).toBe('resilient');
    expect(res.cloze?.clozeSentence).toBe(
      'The local economy proved remarkably ________ following the unexpected downturn.'
    );
    expect(res.cloze?.hint.firstLetter).toBe('R');
    expect(res.cloze?.hint.length).toBe('resilient'.length);
    expect(res.cloze?.hint.partOfSpeech).toBe('ADJECTIVE');
  });

  it('locates inflected verb forms in context using morphological lemmatization', () => {
    const lemma = 'mitigate';
    const sentence = 'New engineering protocols are actively mitigating flood risks across the coastal delta.';
    const res = generateCloze(lemma, sentence, 'verb');

    expect(res.success).toBe(true);
    expect(res.cloze).toBeDefined();
    expect(res.cloze?.targetWord).toBe('mitigating');
    expect(res.cloze?.targetLemma).toBe('mitigate');
    expect(res.cloze?.clozeSentence).toBe(
      'New engineering protocols are actively ________ flood risks across the coastal delta.'
    );
  });

  it('rejects candidates when contextSentence is missing or undefined', () => {
    const res1 = generateCloze('subtle', undefined);
    expect(res1.success).toBe(false);
    expect(res1.rejectionReason).toBe('missing_context');

    const res2 = generateCloze('subtle', '');
    expect(res2.success).toBe(false);
    expect(res2.rejectionReason).toBe('missing_context');
  });

  it('rejects candidates when contextSentence is too short (< 20 characters)', () => {
    const res = generateCloze('cat', 'The cat sat down.');
    expect(res.success).toBe(false);
    expect(res.rejectionReason).toBe('context_too_short');
  });

  it('rejects candidates when target word occurs multiple times (ambiguous blank)', () => {
    const sentence = 'A good teacher must lead by example and lead with patience.';
    const res = generateCloze('lead', sentence);

    expect(res.success).toBe(false);
    expect(res.rejectionReason).toBe('multiple_target_occurrences');
  });

  it('rejects candidates when target word is not present in sentence', () => {
    const sentence = 'The satellite orbit was adjusted to prevent atmospheric friction decay.';
    const res = generateCloze('biology', sentence);

    expect(res.success).toBe(false);
    expect(res.rejectionReason).toBe('target_not_found');
  });
});
