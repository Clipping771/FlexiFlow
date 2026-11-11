import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartPracticeView } from '../SmartPracticeView';
import { installExamBackground, resetExamContent, setSampleArticle, captureSpeech, SAMPLE_ITEMS } from './examTestUtils';
import { MistakeMemoryClient } from '../../../services/mistake/client';

let container: HTMLDivElement;
let sendMessage: ReturnType<typeof installExamBackground>;

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  await setSampleArticle();
  sendMessage = installExamBackground();
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
  resetExamContent();
  localStorage.clear();
});

async function renderView() {
  await act(async () => {
    createRoot(container).render(<SmartPracticeView />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const $ = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const click = async (sel: string) => {
  const el = $(sel);
  expect(el, sel).not.toBeNull();
  await act(async () => {
    el!.click();
    await new Promise((r) => setTimeout(r, 0));
  });
};
const type = async (sel: string, value: string) => {
  const el = $(sel) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('SmartPracticeView', () => {
  it('builds practice from the article with no exam names, and sends the learner brief', async () => {
    await renderView();
    expect(container.textContent).toContain('Smart Practice');
    expect(container.textContent).not.toMatch(/PTE|IELTS/);
    expect($('[data-testid="smart-insight"]')?.textContent).toContain('Urban trees');
    expect($('[data-testid="smart-reader"]')?.textContent).toContain('Level B2');
    // One question at a time
    expect($('[data-testid="smart-deck-count"]')?.textContent).toBe('Question 1 of 4');
    expect($('[data-testid="smart-q-1"]')).toBeNull();
    expect($('[data-testid="exam-article-bar"]')?.textContent).toContain('Why cities are planting trees');

    const kinds = sendMessage.mock.calls.map((c: any[]) => c[0]?.payload?.kind).filter(Boolean);
    expect(kinds).toEqual(expect.arrayContaining(['smart_reading', 'smart_vocab', 'smart_listening', 'smart_tasks']));
    const readingCall = sendMessage.mock.calls.find((c: any[]) => c[0]?.payload?.kind === 'smart_reading');
    expect(readingCall![0].payload.answer).toContain('Difficulty: standard');
  });

  it('marks an answer, explains it, and opens the article at the proof', async () => {
    await renderView();
    await click('[data-testid="smart-deck-next"]');
    expect($('[data-testid="smart-deck-count"]')?.textContent).toBe('Question 2 of 4');
    expect($('[data-testid="smart-reader"]')?.className).not.toContain('open');
    await click('[data-testid="smart-q-1-opt-0"]');
    expect($('[data-testid="smart-q-1"]')?.className).toContain('is-wrong');
    expect($('[data-testid="smart-q-1-explain"]')?.textContent).toContain('Not quite.');

    const show = Array.from(container.querySelectorAll('[data-testid="smart-q-1-explain"] button')).find((b) =>
      b.textContent?.includes('Show in article')
    ) as HTMLElement;
    await act(async () => show.click());
    expect($('[data-testid="smart-evidence"]')?.textContent).toBe('Wealthier districts often receive more trees because residents campaign for them');
    expect($('[data-testid="smart-reader"]')?.className).toContain('open');
  });

  it('adapts: a perfect round moves the next set up to Stretch', async () => {
    captureSpeech();
    await renderView();
    const reading = SAMPLE_ITEMS.smart_reading as any;
    for (let i = 0; i < reading.questions.length; i++) {
      const q = reading.questions[i];
      const idx = q.type === 'choice' ? q.answer : ['true', 'false', 'not_given'].indexOf(q.answer);
      await click(`[data-testid="smart-q-${i}-opt-${idx}"]`);
      await click(i < reading.questions.length - 1 ? '[data-testid="smart-deck-next"]' : '[data-testid="smart-deck-finish"]');
    }
    // Finishing reading moves straight on to vocabulary, then listening
    expect($('[data-testid="smart-tab-vocab"]')?.getAttribute('aria-selected')).toBe('true');
    for (let i = 0; i < 3; i++) {
      await click(`[data-testid="smart-v-${i}-opt-${(SAMPLE_ITEMS.smart_vocab as any).words[i].answer}"]`);
      await click(i < 2 ? '[data-testid="smart-deck-next"]' : '[data-testid="smart-deck-finish"]');
    }
    for (let i = 0; i < 2; i++) {
      await click(`[data-testid="smart-l-${i}-opt-${(SAMPLE_ITEMS.smart_listening as any).questions[i].answer}"]`);
      if (i === 0) await click('[data-testid="smart-deck-next"]');
    }

    const summary = $('[data-testid="smart-round-summary"]');
    expect(summary?.textContent).toContain('9 of 9 correct');
    expect(summary?.textContent).toContain('Stretch');

    await click('[data-testid="smart-next-round"]');
    expect($('[data-testid="smart-difficulty"]')?.textContent).toBe('Stretch');
    const last = sendMessage.mock.calls.filter((c: any[]) => c[0]?.payload?.kind === 'smart_reading').pop();
    expect(last![0].payload.answer).toContain('Difficulty: stretch');
  });

  it('saves verified mistakes from writing feedback to the Mistakes page', async () => {
    await renderView();
    await click('[data-testid="smart-tab-writing"]');
    await type(
      '[data-testid="smart-writing-input"]',
      'I think trees is good for my city because they cool the streets in summer and help when heavy rain falls on the roads every year.'
    );
    await click('[data-testid="smart-writing-submit"]');

    expect($('[data-testid="smart-mistakes-saved"]')?.textContent).toContain('1 mistake saved');
    const saved = MistakeMemoryClient.getMistakes();
    expect(saved.map((m) => m.errorCode)).toEqual(['GRA.SUBJ_VERB_AGR']);
    expect(saved[0].recentOccurrences[0]).toMatchObject({ taskId: 'smart_practice_writing', evidenceText: 'trees is good' });
  });

  it('checks a short answer without AI, then shows AI feedback labelled as a LexiFlow estimate', async () => {
    await renderView();
    await click('[data-testid="smart-tab-writing"]');
    await type('[data-testid="smart-writing-input"]', 'Trees are good.');
    await click('[data-testid="smart-writing-submit"]');
    expect(container.textContent).toContain('at least 20 words');
    expect(sendMessage.mock.calls.some((c: any[]) => c[0]?.payload?.kind === 'smart_feedback')).toBe(false);

    const answer = 'I think my city should plant more trees because they cool the streets in summer and help with floods. It costs money to water young trees, but the benefits for health are worth it in the long run.';
    await type('[data-testid="smart-writing-input"]', answer);
    expect($('[data-testid="smart-word-count"]')?.textContent).toContain('38 words');
    await click('[data-testid="smart-writing-submit"]');

    const fb = $('[data-testid="smart-feedback"]');
    expect(fb?.textContent).toContain('LexiFlow estimate');
    expect(fb?.textContent).toContain('72');
    expect(fb?.textContent).toContain('trees is good');
    expect(fb?.textContent).toContain('trees are good');
    const call = sendMessage.mock.calls.find((c: any[]) => c[0]?.payload?.kind === 'smart_feedback');
    expect(call![0].payload.source).toContain('TASK (written opinion)');
    expect(call![0].payload.answer).toBe(answer);
  });

  it('shows a clear way forward when no AI provider is set up', async () => {
    resetExamContent();
    await setSampleArticle();
    installExamBackground({ items: { smart_reading: false } as any });
    await renderView();
    expect($('[data-testid="smart-error"]')?.textContent).toContain('needs an AI provider');
  });
});
