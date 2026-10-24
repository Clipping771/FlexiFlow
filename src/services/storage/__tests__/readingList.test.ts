import { describe, it, expect, beforeEach } from 'vitest';
import { ReadingListService, normalizeArticleUrl } from '../readingList';

describe('ReadingListService (Read Later)', () => {
  beforeEach(() => {
    ReadingListService._resetMemory();
  });

  it('normalizes article URLs so tracking parameters, fragments and www do not create duplicates', () => {
    const canonical = normalizeArticleUrl('https://www.thedailystar.net/opinion/views/news-123/?utm_source=fb&fbclid=x#comments');
    expect(canonical).toBe('https://thedailystar.net/opinion/views/news-123');
    expect(normalizeArticleUrl('https://thedailystar.net/opinion/views/news-123')).toBe(canonical);
    // Parameters that select the article are kept
    expect(normalizeArticleUrl('https://example.com/read?id=7&utm_medium=x')).toBe('https://example.com/read?id=7');
    expect(normalizeArticleUrl('chrome://extensions')).toBe('');
    expect(normalizeArticleUrl('not a url')).toBe('');
  });

  it('saves an article once and finds it again by any variant of its URL', async () => {
    const saved = await ReadingListService.save({
      url: 'https://www.example.com/story/?utm_source=x',
      title: 'Rethinking development',
      wordCount: 1400
    });
    expect(saved.domain).toBe('example.com');
    expect(saved.title).toBe('Rethinking development');

    const again = await ReadingListService.save({ url: 'https://example.com/story#top', title: 'Rethinking development (updated)' });
    expect(again.id).toBe(saved.id);

    const all = await ReadingListService.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Rethinking development (updated)');
    expect(all[0].wordCount).toBe(1400);
    expect((await ReadingListService.findByUrl('https://example.com/story'))?.id).toBe(saved.id);
  });

  it('falls back to the domain as title and refuses non-web pages', async () => {
    const item = await ReadingListService.save({ url: 'https://news.site.org/a' });
    expect(item.title).toBe('news.site.org');
    await expect(ReadingListService.save({ url: 'chrome://newtab' })).rejects.toThrow();
  });

  it('marks articles finished and unread, removes them, and lists newest first', async () => {
    const first = await ReadingListService.save({ url: 'https://a.com/1', title: 'One' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await ReadingListService.save({ url: 'https://a.com/2', title: 'Two' });

    expect((await ReadingListService.getAll()).map((i) => i.id)).toEqual([second.id, first.id]);

    await ReadingListService.setRead(first.id, true);
    expect((await ReadingListService.findByUrl('https://a.com/1'))?.readAt).toBeTruthy();
    await ReadingListService.setRead(first.id, false);
    expect((await ReadingListService.findByUrl('https://a.com/1'))?.readAt).toBeUndefined();

    await ReadingListService.remove(second.id);
    expect((await ReadingListService.getAll()).map((i) => i.id)).toEqual([first.id]);
  });
});
