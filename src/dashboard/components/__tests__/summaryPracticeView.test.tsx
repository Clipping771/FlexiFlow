import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SummaryPracticeView } from '../SummaryPracticeView';
import { SummaryPracticeService } from '../../../services/storage/summaryPractice';
import { parseSummaryEvaluation } from '../../../services/ai/summarySchema';

const evaluation = parseSummaryEvaluation({
  summaryLanguage: 'en',
  criteria: [
    { id: 'main_idea', score: 3.5, comment: 'States the main claim.' },
    { id: 'key_points', score: 2, comment: 'Misses one point.' },
    { id: 'accuracy', score: 2, comment: 'Accurate.' },
    { id: 'expression', score: 1, comment: 'Own words.' }
  ],
  overallFeedback: 'You understood the article well.',
  strengths: ['Clear main idea'],
  missedPoints: ['Cross-border lines'],
  misunderstandings: [],
  modelSummary: 'Storage is the bottleneck.',
  languageFeedback: { comment: 'Nearly correct.', corrections: [{ original: 'grid need', corrected: 'grids need', explanation: 'Plural.' }] }
});

const SUMMARY = 'The article argues that storage is now the main problem for renewable energy because grids need it to stay reliable when there is no wind.';

function setTextarea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SummaryPracticeView', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    SummaryPracticeService._resetMemory();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  const render = async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<SummaryPracticeView />);
    });
  };

  it('explains how to start when no article is picked', async () => {
    await render();
    expect(container.textContent).toContain('Pick an article to summarize');
  });

  it('hides the article by default, needs 15 words, then shows the marked report', async () => {
    await SummaryPracticeService.setDraft({ url: 'https://a.com/grid', title: 'The grid problem', text: 'Article body text here.' });
    const sendMessage = vi.fn((msg: any, cb: (res: any) => void) => cb({ success: true, data: evaluation }));
    (globalThis as any).chrome = { runtime: { sendMessage, lastError: undefined } };
    await render();

    expect(container.textContent).toContain('The grid problem');
    expect(container.textContent).not.toContain('Article body text here.');

    const button = () => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Mark my summary'))!;
    const textarea = container.querySelector('textarea')!;

    await act(async () => setTextarea(textarea, 'Too short.'));
    expect(button().disabled).toBe(true);

    await act(async () => setTextarea(textarea, SUMMARY));
    expect(button().disabled).toBe(false);
    await act(async () => {
      button().click();
    });

    expect(sendMessage).toHaveBeenCalledWith(
      { type: 'EVALUATE_SUMMARY', payload: { articleText: 'Article body text here.', articleTitle: 'The grid problem', summary: SUMMARY } },
      expect.any(Function)
    );
    expect(container.textContent).toContain('8.5');
    expect(container.textContent).toContain('/ 10');
    expect(container.textContent).toContain('Main idea');
    expect(container.textContent).toContain('Cross-border lines');
    expect(container.textContent).toContain('grids need');
    expect((await SummaryPracticeService.getAttempts())[0].evaluation.totalScore).toBe(8.5);
  });

  it('shows the reason when marking is not possible', async () => {
    await SummaryPracticeService.setDraft({ url: 'https://a.com/grid', title: 'The grid problem', text: 'Body.' });
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: (_m: any, cb: (res: any) => void) => cb({ success: false, error: 'Marking a summary needs an AI provider.' }),
        lastError: undefined
      }
    };
    await render();
    await act(async () => setTextarea(container.querySelector('textarea')!, SUMMARY));
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Mark my summary'))!.click();
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('needs an AI provider');
    expect(await SummaryPracticeService.getAttempts()).toHaveLength(0);
  });
});
