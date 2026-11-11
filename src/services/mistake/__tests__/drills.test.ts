import { describe, it, expect, beforeEach } from 'vitest';
import { CANONICAL_ERRORS, TaxonomyService } from '../../taxonomy/catalog';
import { DRILL_BANK } from '../drillBank';
import { BENGALI_HINTS } from '../bengaliHints';
import {
  buildDrillSession,
  gradeChoice,
  gradeFix,
  isSentenceCode,
  ownPairs,
  sessionPassed,
  tokenize,
  FixDrill
} from '../drills';
import { MistakeMemoryClient, MistakeMemoryItem, ratingForSession } from '../client';

function fakeItem(code: string, occurrences: { wrong: string; right?: string; taskId?: string }[] = []): MistakeMemoryItem {
  return {
    id: `mm_${code}`,
    errorCode: code,
    masteryState: 'Practising',
    totalOccurrences: Math.max(1, occurrences.length),
    successfulCorrections: 0,
    lastSeenAt: '2026-11-01T00:00:00.000Z',
    nextReviewAt: '2026-11-02',
    nextReviewDays: 1,
    recentOccurrences: occurrences.map((o, i) => ({
      id: `occ_${i}`,
      taskId: o.taskId || 'smart_practice_writing',
      evidenceText: o.wrong,
      contextSnippet: o.right,
      createdAt: '2026-11-01T00:00:00.000Z'
    }))
  };
}

function fix(wrong: string, answers: string[], strict = false): FixDrill {
  return { kind: 'fix', id: 't', source: 'bank', wrong, answers, why: '', strict };
}

describe('Drill bank content', () => {
  it('has drills for every taxonomy code, and only for taxonomy codes', () => {
    for (const err of CANONICAL_ERRORS) {
      const entry = DRILL_BANK[err.code];
      expect(entry, err.code).toBeDefined();
      if (isSentenceCode(err.code)) {
        expect(entry.pairs?.length ?? 0, err.code).toBeGreaterThanOrEqual(3);
      } else {
        expect(entry.choices?.length ?? 0, err.code).toBeGreaterThanOrEqual(2);
      }
    }
    for (const code of Object.keys(DRILL_BANK)) expect(TaxonomyService.isValidCode(code), code).toBe(true);
  });

  it('every pair is a real correction that the grader accepts, and the wrong sentence is rejected', () => {
    for (const [code, entry] of Object.entries(DRILL_BANK)) {
      for (const pair of entry.pairs || []) {
        const strict = code.startsWith('MEC.') || code === 'GRA.RUN_ON_SENTENCE' || code === 'GRA.FRAGMENT';
        const d = fix(pair.wrong, [pair.right, ...(pair.alsoRight || [])], strict);
        expect(gradeFix(d, pair.right), `${code}: ${pair.right}`).toBe(true);
        for (const alt of pair.alsoRight || []) expect(gradeFix(d, alt), `${code}: ${alt}`).toBe(true);
        expect(gradeFix(d, pair.wrong), `${code}: ${pair.wrong}`).toBe(false);
      }
      for (const c of entry.choices || []) {
        expect(c.answer).toBeGreaterThanOrEqual(0);
        expect(c.answer).toBeLessThan(c.options.length);
        expect(new Set(c.options).size).toBe(c.options.length);
      }
    }
  });
});

describe('Bengali hints', () => {
  it('every taxonomy code has a Bengali explanation in Bengali script', () => {
    for (const err of CANONICAL_ERRORS) {
      expect(BENGALI_HINTS[err.code], err.code).toMatch(/[ঀ-৿]/);
    }
    for (const code of Object.keys(BENGALI_HINTS)) expect(TaxonomyService.isValidCode(code), code).toBe(true);
  });
});

describe('Grading', () => {
  const d = fix('The number of students have risen.', ['The number of students has risen.']);

  it('accepts the exact answer regardless of case, spacing and final punctuation', () => {
    expect(gradeFix(d, '  the number of students   HAS risen ')).toBe(true);
  });

  it('accepts a reworded sentence that makes the same correction', () => {
    expect(gradeFix(d, 'The number of students has risen sharply.')).toBe(true);
  });

  it('rejects the unchanged sentence, an empty answer and a one-word answer', () => {
    expect(gradeFix(d, 'The number of students have risen.')).toBe(false);
    expect(gradeFix(d, '   ')).toBe(false);
    expect(gradeFix(d, 'has')).toBe(false);
  });

  it('rejects an answer that keeps the wrong word next to the right one', () => {
    expect(gradeFix(d, 'The number of students have has risen.')).toBe(false);
  });

  it('strict drills care about punctuation and capitals', () => {
    const p = fix('However the data is weak.', ['However, the data is weak.'], true);
    expect(gradeFix(p, 'However, the data is weak.')).toBe(true);
    expect(gradeFix(p, 'However the data is weak')).toBe(false);
    const c = fix('She lives in dhaka.', ['She lives in Dhaka.'], true);
    expect(gradeFix(c, 'She lives in dhaka.')).toBe(false);
    expect(tokenize('It’s fine.', true)).toEqual(["It's", 'fine', '.']);
  });

  it('choices and session pass rule', () => {
    expect(gradeChoice({ kind: 'choose', id: 'x', source: 'bank', prompt: '', options: ['a', 'b'], answer: 1, why: '' }, 1)).toBe(true);
    expect(sessionPassed(3, 4)).toBe(true);
    expect(sessionPassed(2, 4)).toBe(false);
    expect(sessionPassed(0, 0)).toBe(false);
  });
});

describe('Session building', () => {
  const tax = TaxonomyService.getError('GRA.SUBJ_VERB_AGR')!;

  it('uses the learner\'s own sentences, starts with a choice, and has 4 drills', () => {
    const item = fakeItem('GRA.SUBJ_VERB_AGR', [
      { wrong: 'My brother work in Dhaka.', right: 'My brother works in Dhaka.' },
      { wrong: 'The data shows people is happy.', right: 'The data shows people are happy.' }
    ]);
    const session = buildDrillSession(item, tax, 1);
    expect(session).toHaveLength(4);
    expect(session[0].kind).toBe('choose');
    const own = session.filter((d) => d.source === 'own');
    expect(own).toHaveLength(2);
    expect(own.map((d) => (d as FixDrill).wrong)).toContain('My brother work in Dhaka.');
    expect(new Set(session.map((d) => d.id)).size).toBe(4);
  });

  it('skips own entries without a usable correction, and dedupes repeats', () => {
    const item = fakeItem('GRA.SUBJ_VERB_AGR', [
      { wrong: 'He go home.' },
      { wrong: 'Same text.', right: 'same text' },
      { wrong: 'They was late.', right: 'They were late.' },
      { wrong: 'They was late.', right: 'They were late.' }
    ]);
    expect(ownPairs(item)).toHaveLength(1);
  });

  it('gives different sentences in different sessions', () => {
    const item = fakeItem('GRA.ARTICLE_DEF_INDEF');
    const taxA = TaxonomyService.getError('GRA.ARTICLE_DEF_INDEF')!;
    const keys = new Set<string>();
    for (let seed = 0; seed < 6; seed++) {
      const s = buildDrillSession(item, taxA, seed);
      keys.add(s.map((d) => (d.kind === 'fix' ? d.wrong : d.options.join('|'))).join('#'));
    }
    expect(keys.size).toBeGreaterThan(1);
  });

  it('is stable for the same seed', () => {
    const item = fakeItem('VOC.COLLOCATION_UNNATURAL');
    const t = TaxonomyService.getError('VOC.COLLOCATION_UNNATURAL')!;
    expect(buildDrillSession(item, t, 7)).toEqual(buildDrillSession(item, t, 7));
  });

  it('exam strategy codes get choice drills with a valid answer', () => {
    for (const code of ['PTE.SWT_MULTI_SENTENCE', 'IELTS.TASK1_MISSING_OVERVIEW']) {
      const s = buildDrillSession(fakeItem(code, [{ wrong: 'x y z', right: 'a b c' }]), TaxonomyService.getError(code)!, 3);
      expect(s.length).toBeGreaterThanOrEqual(2);
      for (const d of s) {
        expect(d.kind).toBe('choose');
        if (d.kind === 'choose') expect(d.options[d.answer]).toBeDefined();
      }
    }
  });

  it('spoken own sentences are not graded on punctuation', () => {
    const t = TaxonomyService.getError('MEC.PUNCTUATION_CLAUSE')!;
    const item = fakeItem('MEC.PUNCTUATION_CLAUSE', [
      { wrong: 'however i think so', right: 'however I think it is true', taskId: 'smart_practice_speaking' }
    ]);
    const own = buildDrillSession(item, t, 1).find((d) => d.source === 'own') as FixDrill;
    expect(own.strict).toBe(false);
  });
});

describe('MistakeMemoryClient drill sessions and spacing', () => {
  beforeEach(() => localStorage.clear());

  const day = (iso: string) => new Date(`${iso}T09:00:00Z`);

  it('a pass before the review date is practice only; a pass on the due date masters it', () => {
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'He go.', 'He goes.');

    const first = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, day('2026-11-11'));
    expect(first.counted).toBe(true);
    expect(first.item.masteryState).toBe('Improving');
    expect(first.item.nextReviewAt).toBe('2026-11-14');

    const early = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, day('2026-11-12'));
    expect(early.passed).toBe(true);
    expect(early.counted).toBe(false);
    expect(early.item.masteryState).toBe('Improving');
    expect(early.item.practiceSessions).toBe(2);

    const due = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 3, 4, day('2026-11-14'));
    expect(due.counted).toBe(true);
    expect(due.item.masteryState).toBe('Mastered');
    expect(due.item.nextReviewAt).toBe('2026-12-05');
    expect(MistakeMemoryClient.getMistakes()[0].practiceSessions).toBe(3);
  });

  it('FSRS keeps state and stretches retention checks beyond 21 days for a well-remembered mistake', () => {
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'He go.', 'He goes.');
    let now = day('2026-01-01');
    let last = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, now);
    for (let i = 0; i < 4; i++) {
      now = new Date(`${last.item.nextReviewAt}T09:00:00Z`);
      last = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, now);
    }
    expect(last.item.masteryState).toBe('Mastered');
    expect(last.item.fsrs?.reps).toBe(5);
    expect(last.item.nextReviewDays).toBeGreaterThan(21);
  });

  it('a relapse after mastering is recorded as an FSRS lapse', () => {
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'He go.', 'He goes.');
    MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, day('2026-11-11'));
    MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, day('2026-11-14'));
    const back = MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'She go.', 'She goes.');
    expect(back.masteryState).toBe('Reopened');
    expect(back.fsrs?.lapses).toBe(1);
  });

  it('rates sessions for FSRS', () => {
    expect(ratingForSession(1, 4)).toBe(1);
    expect(ratingForSession(3, 4)).toBe(2);
    expect(ratingForSession(4, 4)).toBe(3);
  });

  it('a failed session always counts and brings the mistake back tomorrow', () => {
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'He go.', 'He goes.');
    MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 4, 4, day('2026-11-11'));
    const failed = MistakeMemoryClient.recordDrillSession('GRA.SUBJ_VERB_AGR', 1, 4, day('2026-11-12'));
    expect(failed.passed).toBe(false);
    expect(failed.counted).toBe(true);
    expect(failed.item.masteryState).toBe('Practising');
    expect(failed.item.nextReviewAt).toBe('2026-11-13');
  });

  it('lists due mistakes with returning ones first', () => {
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'a');
    MistakeMemoryClient.recordOccurrence('VOC.COLLOCATION_UNNATURAL', 't', 'b');
    const items = MistakeMemoryClient.getMistakes().map((i) =>
      i.errorCode === 'VOC.COLLOCATION_UNNATURAL'
        ? { ...i, masteryState: 'Reopened' as const, nextReviewAt: '2026-11-10' }
        : { ...i, nextReviewAt: '2026-11-01' }
    );
    localStorage.setItem('lexiflow_mistake_memories', JSON.stringify(items));
    const due = MistakeMemoryClient.getDueMistakes(day('2026-11-11'));
    expect(due.map((i) => i.errorCode)).toEqual(['VOC.COLLOCATION_UNNATURAL', 'GRA.SUBJ_VERB_AGR']);
    expect(MistakeMemoryClient.getDueMistakes(day('2026-10-01'))).toHaveLength(0);
  });
});
