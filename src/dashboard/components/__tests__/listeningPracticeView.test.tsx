import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListeningPracticeView } from '../ListeningPracticeView';
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
      <ListeningPracticeView learnerProfile={profile} onNavigateToMistake={onNavigate} />
    );
  });
}

describe('ListeningPracticeView Component', () => {
  it('1. Renders Listening Engine with audio stream control and candidate response area', async () => {
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

    expect(container.textContent).toContain('Listening Engine');
    expect(container.textContent).toContain('Official Audio Prompt Stream');
    expect(container.textContent).toContain('Candidate Response');
    expect(container.textContent).toContain('Play Audio Prompt');
  });

  it('2. Evaluates PTE Write from Dictation and displays mandatory "LexiFlow estimate" badge', async () => {
    await renderView();

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeDefined();

    await act(async () => {
      if (textarea) {
        textarea.value = 'The university library provides extensive digital archives for graduate researchers.';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit Answers')
    );

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('Listening Evaluation Result');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('90');
    expect(container.textContent).toContain('/ 90 PTE Scale');
  });

  it('3. Switches to IELTS Form Completion and calculates band score', async () => {
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

    expect(container.textContent).toContain('IELTS Form / Note Completion');

    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBe(2);

    await act(async () => {
      const input1 = inputs[0] as HTMLInputElement;
      input1.value = 'Henderson';
      input1.dispatchEvent(new Event('input', { bubbles: true }));
      input1.dispatchEvent(new Event('change', { bubbles: true }));

      const input2 = inputs[1] as HTMLInputElement;
      input2.value = 'badminton';
      input2.dispatchEvent(new Event('input', { bubbles: true }));
      input2.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit Answers')
    );

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('9');
    expect(container.textContent).toContain('/ 9.0 IELTS Band');
  });
});
