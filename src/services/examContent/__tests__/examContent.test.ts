import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeBlanks, makeHighlight, makeNoteGaps, makeReorder, pickPassage, pickSentence, countWords } from '../textTools';
import { buildExamItemPrompt, parseExamItem, EXAM_SOURCE_MAX_CHARS } from '../aiItems';
import { getExamArticle, setExamArticle, _resetExamArticle } from '../articleSource';
import { AIService } from '../../ai/index';
import { SettingsService } from '../../storage/settings';
import { SAMPLE_ARTICLE, SAMPLE_ITEMS, answersFromArticle } from '../../../dashboard/components/__tests__/examTestUtils';

const FLAT = SAMPLE_ARTICLE.replace(/\s+/g, ' ');

describe('textTools: items cut straight from the article', () => {
  it('passages and sentences are the article\'s own unbroken text, within the word limits', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const passage = pickPassage(SAMPLE_ARTICLE, 60, 110, seed)!;
      expect(FLAT).toContain(passage);
      expect(countWords(passage)).toBeGreaterThanOrEqual(60);
      expect(countWords(passage)).toBeLessThanOrEqual(110);
      const sentence = pickSentence(SAMPLE_ARTICLE, 8, 15, seed)!;
      expect(FLAT).toContain(sentence);
    }
  });

  it('different seeds give different questions', () => {
    const passages = new Set(Array.from({ length: 10 }, (_, i) => pickPassage(SAMPLE_ARTICLE, 40, 80, i)));
    expect(passages.size).toBeGreaterThan(3);
  });

  it('every gap has its answer among four distinct options, and the gaps rebuild the passage', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const passage = pickPassage(SAMPLE_ARTICLE, 60, 110, seed)!;
      const fib = makeBlanks(passage, SAMPLE_ARTICLE, 4, seed)!;
      expect(fib.blanks).toHaveLength(4);
      fib.blanks.forEach((b) => {
        expect(b.options).toContain(b.answer);
        expect(new Set(b.options).size).toBe(4);
      });
      expect(answersFromArticle(fib.parts)).toEqual(fib.blanks.map((b) => b.answer));
    }
  });

  it('re-order items are four consecutive sentences, never already in order', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const item = makeReorder(SAMPLE_ARTICLE, seed)!;
      const ordered = item.correctOrder.map((id) => item.items.find((i) => i.id === id)!.text).join(' ');
      expect(FLAT).toContain(ordered);
      expect(item.items.map((i) => i.id)).not.toEqual(item.correctOrder);
    }
  });

  it('highlight items change exactly the listed words', () => {
    const item = makeHighlight(SAMPLE_ARTICLE, 3)!;
    expect(FLAT).toContain(item.spoken);
    expect(item.displayed).not.toBe(item.spoken);
    item.incorrectWords.forEach((w) => {
      expect(item.displayed.toLowerCase()).toContain(w);
      expect(item.spoken.toLowerCase()).not.toContain(w);
    });
  });

  it('note gaps are sentences from the recording with the answer removed', () => {
    const item = makeNoteGaps(SAMPLE_ARTICLE, 5)!;
    expect(item.fields.length).toBeGreaterThanOrEqual(2);
    item.fields.forEach((f) => {
      const [answer] = answersFromArticle(f.label.split('______'), item.spoken);
      expect(f.accepted).toContain(answer.toLowerCase());
    });
  });

  it('returns nothing when the article is too short', () => {
    const short = 'Trees cool cities. They also absorb rain.';
    expect(pickPassage(short, 60, 110, 1)).toBeNull();
    expect(makeReorder(short, 1)).toBeNull();
    expect(makeNoteGaps(short, 1)).toBeNull();
  });
});

describe('aiItems: AI-written items are validated', () => {
  it('accepts the sample items', () => {
    for (const [kind, item] of Object.entries(SAMPLE_ITEMS)) {
      expect(() => parseExamItem(kind as any, item)).not.toThrow();
    }
  });

  it('rejects a multiple-choice answer that points at a missing option', () => {
    expect(() => parseExamItem('pte_mcm', { question: 'Which two are right here?', options: ['a1', 'b1', 'c1', 'd1'], correct: [0, 4] })).toThrow();
  });

  it('rejects a Task 1 table whose rows do not match its columns', () => {
    expect(() =>
      parseExamItem('ielts_task1', { ...(SAMPLE_ITEMS.ielts_task1 as object), rows: [{ label: 'A', values: [1, 2, 3] }, { label: 'B', values: [1, 2] }] })
    ).toThrow();
  });

  it('clips long articles in the prompt and puts the learner answer only in marking prompts', () => {
    const long = 'word '.repeat(5000);
    expect(buildExamItemPrompt('pte_essay', long).user.length).toBeLessThanOrEqual(EXAM_SOURCE_MAX_CHARS + 20);
    expect(buildExamItemPrompt('pte_sst_marks', 'lecture', 'my summary').user).toContain('my summary');
    expect(buildExamItemPrompt('pte_essay', 'article', 'ignored').user).not.toContain('ignored');
  });
});

describe('articleSource', () => {
  beforeEach(() => _resetExamArticle());

  it('keeps the article the popup captured', async () => {
    expect(await getExamArticle()).toBeNull();
    await setExamArticle({ url: 'https://example.com/a', title: 'A', text: SAMPLE_ARTICLE });
    expect((await getExamArticle())?.title).toBe('A');
  });
});

describe('AIService.generateExamItem', () => {
  beforeEach(() => {
    AIService.clearCache();
    vi.restoreAllMocks();
  });

  it('refuses without an AI provider', async () => {
    await SettingsService.updateSettings({ aiProvider: 'mock', apiKey: '' });
    await expect(AIService.generateExamItem('pte_essay', SAMPLE_ARTICLE)).rejects.toThrow(/needs an AI provider/);
  });

  it('retries once with the validation error, then returns the validated item', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
    const provider = await AIService.getProvider();
    const spy = vi
      .spyOn(provider as any, 'completeJson')
      .mockResolvedValueOnce('{"prompt": "too short"}')
      .mockResolvedValueOnce(JSON.stringify(SAMPLE_ITEMS.pte_essay));
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);

    expect(await AIService.generateExamItem('pte_essay', SAMPLE_ARTICLE)).toEqual(SAMPLE_ITEMS.pte_essay);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][1]).toContain('previous reply was not valid');
  });

  it('gives up after two unusable replies instead of inventing questions', async () => {
    await SettingsService.updateSettings({ aiProvider: 'ollama', apiKey: '' });
    const provider = await AIService.getProvider();
    vi.spyOn(provider as any, 'completeJson').mockResolvedValue('not json');
    vi.spyOn(AIService, 'getProvider').mockResolvedValue(provider);
    await expect(AIService.generateExamItem('ielts_tfng', SAMPLE_ARTICLE)).rejects.toThrow(/did not return usable questions/);
  });
});
