import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadingListView } from '../ReadingListView';
import { ReadingListService } from '../../../services/storage/readingList';
import { VocabularyItem } from '../../../types';
import { FSRSEngine } from '../../../services/fsrs/engine';

describe('ReadingListView', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.restoreAllMocks();
    ReadingListService._resetMemory();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  const render = async (vocabItems: VocabularyItem[] = []) => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<ReadingListView vocabItems={vocabItems} />);
    });
    return root;
  };

  it('explains how to save articles when the list is empty', async () => {
    await render();
    expect(container.textContent).toContain('No saved articles yet');
    expect(container.textContent).toContain('Save for later');
  });

  it('lists saved articles with reading time and the words saved from them', async () => {
    await ReadingListService.save({ url: 'https://www.example.com/story?utm_source=x', title: 'Rethinking development', wordCount: 1000 });
    const word: VocabularyItem = {
      id: 'v1',
      word: 'prescription',
      selectionType: 'word',
      meaning: 'a recommended course of action',
      bengaliMeaning: 'নির্দেশনা',
      pageUrl: 'https://example.com/story#para-3',
      dateAdded: new Date().toISOString(),
      tags: [],
      collection: 'General',
      difficulty: 'medium',
      fsrs: FSRSEngine.createInitialState()
    };

    await render([word]);
    expect(container.textContent).toContain('Rethinking development');
    expect(container.textContent).toContain('example.com');
    expect(container.textContent).toContain('5 min read');
    expect(container.textContent).toContain('1 word saved from this article');
    expect(container.textContent).toContain('prescription');
  });

  it('moves an article to Finished when marked and hides it from the To read filter', async () => {
    await ReadingListService.save({ url: 'https://a.com/1', title: 'Long read' });
    await render();

    const markBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Mark finished'))!;
    await act(async () => {
      markBtn.click();
    });

    expect(container.textContent).toContain('All caught up');
    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'read';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Long read');
    expect(container.textContent).toContain('Finished');
  });

  it('asks the background to open the article and highlight it', async () => {
    await ReadingListService.save({ url: 'https://a.com/1', title: 'Long read' });
    const sendMessage = vi.fn((_msg: any, cb?: () => void) => cb?.());
    (globalThis as any).chrome = { runtime: { sendMessage, lastError: undefined } };
    try {
      await render();
      const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Open & highlight'))!;
      await act(async () => {
        btn.click();
      });
      expect(sendMessage).toHaveBeenCalledWith(
        { type: 'OPEN_SAVED_ARTICLE', payload: { url: 'https://a.com/1', highlight: true } },
        expect.any(Function)
      );
    } finally {
      delete (globalThis as any).chrome;
    }
  });
});
