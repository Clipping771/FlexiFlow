import { describe, it, expect } from 'vitest';
import { buildExamItemPrompt, parseExamItem, EXAM_ITEM_KINDS } from '../../examContent/aiItems';
import { SAMPLE_ARTICLE, SAMPLE_ITEMS } from '../../../dashboard/components/__tests__/examTestUtils';
import {
  answerProblems,
  checkReading,
  checkVocab,
  DEFAULT_PROGRESS,
  findEvidence,
  learnerBrief,
  nextDifficulty,
  recordAnswer,
  speechMetrics,
  weakSkills
} from '../logic';
import type { SmartItem } from '../items';

const SMART = ['smart_reading', 'smart_vocab', 'smart_listening', 'smart_tasks', 'smart_feedback'] as const;

describe('Smart Practice item definitions', () => {
  it('registers every smart kind with the shared item list (Cloud and BYOK use the same prompts)', () => {
    for (const kind of SMART) expect(EXAM_ITEM_KINDS).toContain(kind);
  });

  it('accepts well-formed replies for every kind', () => {
    for (const kind of SMART) expect(() => parseExamItem(kind, SAMPLE_ITEMS[kind])).not.toThrow();
  });

  it('rejects a reading question whose answer points at a missing option', () => {
    const bad = structuredClone(SAMPLE_ITEMS.smart_reading) as any;
    bad.questions[0].answer = 7;
    expect(() => parseExamItem('smart_reading', bad)).toThrow();
  });

  it('rejects duplicate options, so a question always has four real choices', () => {
    const bad = structuredClone(SAMPLE_ITEMS.smart_vocab) as any;
    bad.words[0].options = ['Young trees', 'young trees', 'Garden tools', 'Tree roots'];
    expect(() => parseExamItem('smart_vocab', bad)).toThrow(/same/);
  });

  it('rejects a writing task whose word range is upside down', () => {
    const bad = structuredClone(SAMPLE_ITEMS.smart_tasks) as any;
    bad.writing.minWords = 100;
    bad.writing.maxWords = 80;
    expect(() => parseExamItem('smart_tasks', bad)).toThrow(/maxWords/);
  });

  it('rejects a feedback score above 100', () => {
    const bad = { ...(SAMPLE_ITEMS.smart_feedback as object), score: 140 };
    expect(() => parseExamItem('smart_feedback', bad)).toThrow();
  });

  it('sends the learner brief with generation prompts and never names an exam', () => {
    const prompt = buildExamItemPrompt('smart_reading', SAMPLE_ARTICLE, 'Difficulty: stretch.\nFOCUS: inference.');
    expect(prompt.user).toContain('LEARNER:\nDifficulty: stretch.');
    expect(prompt.user).toContain('ARTICLE:\nCities around the world');
    for (const kind of SMART) {
      const { system } = buildExamItemPrompt(kind, SAMPLE_ARTICLE);
      expect(system).not.toMatch(/PTE Academic|IELTS Academic|band score/i);
    }
  });

  it('puts the learner answer after the task when marking', () => {
    const prompt = buildExamItemPrompt('smart_feedback', 'TASK (written opinion): Should cities plant trees?', 'Trees is good.');
    expect(prompt.user).toMatch(/^TASK \(written opinion\)/);
    expect(prompt.user).toContain('LEARNER ANSWER:\nTrees is good.');
  });
});

describe('Evidence checks against the article', () => {
  it('finds an exact quote regardless of case and punctuation', () => {
    const span = findEvidence(SAMPLE_ARTICLE, 'young trees need regular watering, for at least three years');
    expect(span).not.toBeNull();
    expect(SAMPLE_ARTICLE.slice(span!.start, span!.end)).toBe('Young trees need regular watering for at least three years');
  });

  it('still finds a long quote with a changed ending', () => {
    const span = findEvidence(SAMPLE_ARTICLE, 'Wealthier districts often receive more trees because residents always ask');
    expect(span).not.toBeNull();
  });

  it('returns null for a quote the article does not contain', () => {
    expect(findEvidence(SAMPLE_ARTICLE, 'Melbourne will double its canopy by 2040')).toBeNull();
  });

  it('marks a reading answer uncertain when its evidence is invented', () => {
    const set = structuredClone(SAMPLE_ITEMS.smart_reading) as SmartItem<'smart_reading'>;
    set.questions[1] = { ...set.questions[1], evidence: 'Poorer districts refuse to plant any trees at all' };
    const checked = checkReading(SAMPLE_ARTICLE, set);
    expect(checked[0].uncertain).toBe(false);
    expect(checked[1].uncertain).toBe(true);
    // "Not given" needs no evidence
    expect(checked[3].uncertain).toBe(false);
  });

  it('drops vocabulary words that are not in the article', () => {
    const set = structuredClone(SAMPLE_ITEMS.smart_vocab) as SmartItem<'smart_vocab'>;
    set.words.push({ ...set.words[0], word: 'photosynthesis' });
    expect(checkVocab(SAMPLE_ARTICLE, set).map((w) => w.word)).toEqual(['canopy', 'saplings', 'tolerate']);
  });
});

describe('Adaptive difficulty', () => {
  it('moves up after a strong round and down after a weak one', () => {
    expect(nextDifficulty('standard', 9, 10)).toBe('stretch');
    expect(nextDifficulty('standard', 4, 10)).toBe('gentle');
    expect(nextDifficulty('standard', 6, 10)).toBe('standard');
    expect(nextDifficulty('stretch', 10, 10)).toBe('stretch');
    expect(nextDifficulty('gentle', 0, 10)).toBe('gentle');
  });

  it('does not change difficulty on too few answers', () => {
    expect(nextDifficulty('standard', 2, 2)).toBe('standard');
  });

  it('finds the weakest question types and puts them in the learner brief', () => {
    let p = DEFAULT_PROGRESS;
    for (const correct of [false, false, true]) p = recordAnswer(p, 'inference', correct);
    for (const correct of [true, true, true]) p = recordAnswer(p, 'detail', correct);
    for (const correct of [true, false]) p = recordAnswer(p, 'tone', correct);
    expect(weakSkills(p)).toEqual(['inference', 'tone']);
    const brief = learnerBrief(p, ['canopy']);
    expect(brief).toContain('FOCUS: inference, tone & attitude.');
    expect(brief).toContain('WEAK WORDS: canopy.');
    expect(brief.length).toBeLessThanOrEqual(1000);
  });
});

describe('Answer checks without AI', () => {
  it('measures speaking pace and filler words', () => {
    const m = speechMetrics('Um I think trees are, you know, really useful because uh they cool the street', 10000);
    expect(m.words).toBe(15);
    expect(m.wordsPerMinute).toBe(90);
    expect(m.fillers).toBe(3);
    expect(m.pace).toBe('good');
  });

  it('refuses to send an empty or tiny answer for marking', () => {
    expect(answerProblems('   ', 60)).toEqual(['Write your answer first.']);
    expect(answerProblems('Trees are good.', 60)[0]).toMatch(/at least 20 words/);
    expect(answerProblems('word '.repeat(25), 60)).toEqual([]);
  });
});

describe('Smart Practice errors', () => {
  it('explains what to do when LexiFlow Cloud does not have Smart Practice yet', async () => {
    const { friendlyError } = await import('../../../dashboard/components/SmartPracticeView');
    expect(friendlyError('Unknown exam item kind.')).toMatch(/not on LexiFlow Cloud yet.*Settings/);
    expect(friendlyError('Rate limited')).toBe('Rate limited');
  });
});

describe('Feedback mistakes saved to the Mistakes page', () => {
  it('keeps only fixes with a known code whose wrong text is really in the answer', async () => {
    const { mistakesFromFeedback } = await import('../logic');
    const known = (c: string) => ['GRA.SUBJ_VERB_AGR', 'VOC.COLLOCATION_UNNATURAL'].includes(c);
    const fixes = [
      { original: 'trees is good', better: 'trees are good', why: 'plural', code: 'GRA.SUBJ_VERB_AGR' },
      { original: 'Trees  IS good!', better: 'x', why: 'duplicate code', code: 'GRA.SUBJ_VERB_AGR' },
      { original: 'made a mistake', better: 'x', why: 'not in the answer', code: 'VOC.COLLOCATION_UNNATURAL' },
      { original: 'did a mistake', better: 'made a mistake', why: 'collocation', code: 'voc.collocation_unnatural' },
      { original: 'the city', better: 'x', why: 'exam-only code', code: 'PTE.ORAL_FLUENCY' },
      { original: 'the city', better: 'x', why: 'no code' }
    ];
    const answer = 'I think trees is good for the city, but I did a mistake once.';
    expect(mistakesFromFeedback(fixes as any, answer, known)).toEqual([
      { code: 'GRA.SUBJ_VERB_AGR', evidence: 'trees is good', better: 'trees are good' },
      { code: 'VOC.COLLOCATION_UNNATURAL', evidence: 'did a mistake', better: 'made a mistake' }
    ]);
  });

  it('lists only general-English codes for the coach to use', async () => {
    const { FEEDBACK_ERROR_CODES } = await import('../items');
    expect(FEEDBACK_ERROR_CODES.length).toBeGreaterThan(5);
    expect(FEEDBACK_ERROR_CODES.every((e) => /^(GRA|VOC|MEC)\./.test(e.code))).toBe(true);
  });
});
