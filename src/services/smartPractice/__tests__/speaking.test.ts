import { describe, it, expect } from 'vitest';
import { longPauses, pickReadAloudSentence, readAloudScore } from '../logic';

describe('Long pauses', () => {
  it('counts gaps of 3 seconds or more, including before the first word', () => {
    expect(longPauses(0, [500, 1000, 4500, 5000, 9000])).toEqual({ count: 2, longestSeconds: 4 });
    expect(longPauses(0, [3500])).toEqual({ count: 1, longestSeconds: 3.5 });
    expect(longPauses(0, [])).toEqual({ count: 0, longestSeconds: 0 });
  });
});

describe('Read aloud', () => {
  const article =
    'Short one. Cities around the world are planting more trees to cool their streets during long summer heatwaves. ' +
    'See https://example.com for the full report on this topic which is rather long. ' +
    'Scientists say that green spaces can lower local temperatures by several degrees on the hottest days.';

  it('picks a 10–30 word sentence without links, varying with the seed', () => {
    const a = pickReadAloudSentence(article, 0);
    const b = pickReadAloudSentence(article, 1);
    expect(a).toMatch(/^Cities|^Scientists/);
    expect(a).not.toBe(b);
    expect(pickReadAloudSentence('Too short. Also short.', 0)).toBeNull();
  });

  it('scores a perfect reading at 100% ignoring case and punctuation', () => {
    const r = readAloudScore('Cities are planting more trees.', 'cities are planting more trees');
    expect(r.accuracy).toBe(100);
    expect(r.words.every((w) => w.ok)).toBe(true);
  });

  it('marks missed and misheard words', () => {
    const r = readAloudScore('Scientists say that green spaces can lower temperatures.', 'scientist say that green places can lower temperatures');
    expect(r.words.filter((w) => !w.ok).map((w) => w.word)).toEqual(['Scientists', 'spaces']);
    expect(r.accuracy).toBe(75);
    expect(r.extra).toBe(2);
  });

  it('an empty reading scores 0', () => {
    expect(readAloudScore('Cities are planting trees.', '').accuracy).toBe(0);
  });
});
