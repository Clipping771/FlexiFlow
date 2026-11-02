import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FullMockExamView } from '../FullMockExamView';
import { LearnerProfile } from '../../../types';

let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

async function renderView(profile: LearnerProfile | null = null, onNavigate?: (code: string) => void) {
  await act(async () => {
    createRoot(container).render(
      <FullMockExamView learnerProfile={profile} onNavigateToMistake={onNavigate} />
    );
  });
}

describe('FullMockExamView Component', () => {
  it('1. Renders Idle state with test rules, 4-stage outline, and mandatory "LexiFlow estimate" label', async () => {
    await renderView({
      userId: 'u1',
      targetExam: 'pte_academic',
      targetScore: '79',
      targetExamDate: null,
      motherTongue: 'bn',
      studyHoursWeekly: 10,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    });

    expect(container.textContent).toContain('Full Mock Exam');
    expect(container.textContent).toContain('PTE Academic Full Simulation');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('Standard Exam Structure');
    expect(container.textContent).toContain('Begin Full Mock Exam');
  });

  it('2. Begins mock exam, advances stages, and renders final scorecard with 4 skill breakdowns', async () => {
    await renderView();

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Begin Full Mock Exam')
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    // In running state
    expect(container.textContent).toContain('Stage 1 of 4');

    // End test early to jump to scorecard
    const endEarlyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('End Test Early')
    );
    expect(endEarlyBtn).toBeDefined();

    await act(async () => {
      endEarlyBtn?.click();
    });

    // In completed state
    expect(container.textContent).toContain('Scorecard');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('/ 90 Overall');
    expect(container.textContent).toContain('Speaking');
    expect(container.textContent).toContain('Writing');
    expect(container.textContent).toContain('Reading');
    expect(container.textContent).toContain('Listening');
    expect(container.textContent).toContain('Detected Error Patterns Recorded in Mistake Memory');
  });

  it('3. Successfully renders IELTS Academic 4-skill mock with Cambridge rounding band scale', async () => {
    await renderView({
      userId: 'u1',
      targetExam: 'ielts_academic',
      targetScore: '7.5',
      targetExamDate: null,
      motherTongue: 'bn',
      studyHoursWeekly: 10,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    });

    expect(container.textContent).toContain('IELTS Academic Full Simulation');

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Begin Full Mock Exam')
    );

    await act(async () => {
      startBtn?.click();
    });

    const endEarlyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('End Test Early')
    );

    await act(async () => {
      endEarlyBtn?.click();
    });

    expect(container.textContent).toContain('IELTS Academic Scorecard');
    expect(container.textContent).toContain('/ 9.0 Overall Band');
    expect(container.textContent).toContain('Retake Full Simulation');
  });

  it('4. Scores come from the answers: reading and listening are marked, skipped AI sections are not invented', async () => {
    localStorage.clear();
    await renderView();

    const clickByText = async (text: string) => {
      const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
      await act(async () => {
        btn?.click();
      });
    };
    const setValue = async (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
      const proto = Object.getPrototypeOf(el);
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      });
    };

    await clickByText('Begin Full Mock Exam');
    await clickByText('Next Section'); // Speaking: skipped
    await clickByText('Next Section'); // Writing: skipped

    // Reading: all three gaps right
    const selects = container.querySelectorAll('select');
    await setValue(selects[0], 'robust');
    await setValue(selects[1], 'logging');
    await setValue(selects[2], 'endangered');
    await clickByText('Next Section');

    // Listening: exact dictation
    await setValue(container.querySelector('textarea')!, 'Scientific research must adhere to strict ethical guidelines.');
    await clickByText('Submit & Finish Mock Exam');

    const text = container.textContent || '';
    expect(text).toContain('3 of 3 correct');
    expect(text).toContain('Not attempted');
    // Two perfect sections (90) and two unattempted ones at the scale floor (10)
    expect(container.querySelector('.mock-overall .exam-score-big')?.textContent).toBe('50');
    expect(text).toContain('No error patterns found in this attempt.');
    expect(localStorage.getItem('lexiflow_mistake_memories') ?? '[]').not.toContain('PTE.ORAL_HESITATION_LONG');
  });

  it('5. Sends the written answer as an exam task so LexiFlow Cloud can mark it', async () => {
    localStorage.clear();
    const sendMessage = vi.fn((_m: any, cb: (res: any) => void) =>
      cb({ success: true, data: { rawText: JSON.stringify({ content: 2, grammar: 2, vocabulary: 1.5, feedback: 'Good.', errors: [] }), model: 'LexiFlow Cloud' } })
    );
    (globalThis as any).chrome = { runtime: { sendMessage } };
    await renderView();

    const clickByText = async (text: string) => {
      const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
      await act(async () => {
        btn?.click();
      });
    };
    const summary = 'Cities that invest in public transport cut traffic and give residents fairer access to jobs.';

    await clickByText('Begin Full Mock Exam');
    await clickByText('Next Section'); // Speaking: skipped
    const textarea = container.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, summary);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickByText('Next Section');
    await clickByText('Next Section');
    await clickByText('Submit & Finish Mock Exam');

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0].payload.cloud).toEqual({ task: 'pte-swt', passage: expect.any(String), text: summary, taskId: 'pte_writing' });
    delete (globalThis as any).chrome;
  });
});
