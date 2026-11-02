import { describe, expect, it } from 'vitest';
import {
  evaluatePteWriteFromDictation,
  evaluatePteHighlightIncorrectWords,
  evaluatePteSummarizeSpokenText
} from '../scorer';

describe('TICKET LF-015: PTE Listening Scoring Engine', () => {
  it('1. Write from Dictation: scores points for accurately identified words regardless of punctuation', () => {
    const prompt = 'The university offers various undergraduate degree programmes.';
    const userSubmission = 'The university offers undergraduate degree programs.';

    const evalResult = evaluatePteWriteFromDictation('pte_wfd_01', userSubmission, prompt);
    // Missing 'various' and 'programmes' spelled as 'programs'
    expect(evalResult.rawScore).toBe(5);
    expect(evalResult.maxScore).toBe(7);
    expect(evalResult.scoreDisplayLabel).toBe('LexiFlow estimate');
    expect(evalResult.detectedErrors).toContain('PTE.LISTENING_DICTATION_OMISSION');
  });

  it('2. Highlight Incorrect Words: scores +1 for discrepancy, -1 for false alarm, floor at 0', () => {
    const targetIncorrect = ['catastrophic', 'instability'];
    // User picked 1 target ('catastrophic') + 1 regular word ('economy')
    const evalMixed = evaluatePteHighlightIncorrectWords('pte_hiw_01', ['catastrophic', 'economy'], targetIncorrect);
    expect(evalMixed.rawScore).toBe(0);
    expect(evalMixed.detectedErrors).toContain('PTE.LISTENING_HIW_FALSE_ALARM');

    // User picked both targets cleanly
    const evalClean = evaluatePteHighlightIncorrectWords('pte_hiw_01', ['catastrophic', 'instability'], targetIncorrect);
    expect(evalClean.rawScore).toBe(2);
    expect(evalClean.scaledScore).toBe(90);
  });

  it('3. Summarize Spoken Text: verifies form constraint 50-70 words and trait scoring', () => {
    // 55-word compliant summary
    const compliantWords = new Array(55).fill('word').join(' ');
    const traits = { content: 2, grammar: 2, vocabulary: 2, spelling: 2 };
    const evalCompliant = evaluatePteSummarizeSpokenText('pte_sst_01', compliantWords, traits);
    expect(evalCompliant.rawScore).toBe(10);
    expect(evalCompliant.scaledScore).toBe(90);

    // 25-word summary (fatal word count < 40 words)
    const shortWords = new Array(25).fill('word').join(' ');
    const evalShort = evaluatePteSummarizeSpokenText('pte_sst_01', shortWords, traits);
    expect(evalShort.rawScore).toBe(8); // form is 0
    expect(evalShort.detectedErrors).toContain('PTE.SST_WORD_COUNT_FATAL');
  });
});
