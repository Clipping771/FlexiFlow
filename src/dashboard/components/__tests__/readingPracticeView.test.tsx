import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReadingPracticeView } from '../ReadingPracticeView';
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
      <ReadingPracticeView learnerProfile={profile} onNavigateToMistake={onNavigate} />
    );
  });
}

describe('ReadingPracticeView Component', () => {
  it('1. Renders Reading Engine with task selectors and passage text', async () => {
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

    expect(container.textContent).toContain('Reading Engine');
    expect(container.textContent).toContain('PTE Academic');
    expect(container.textContent).toContain('Reading Passage');
    expect(container.textContent).toContain('Question Items');
  });

  it('2. Evaluates PTE Fill in Blanks and renders mandatory "LexiFlow estimate" badge', async () => {
    await renderView();

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit Answers')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('Reading Evaluation Result');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('/ 90 PTE Scale');
  });

  it('3. Switches to IELTS True/False/Not Given and renders band scale score', async () => {
    await renderView({
      userId: 'u1',
      targetExam: 'ielts_academic',
      targetScore: '8.0',
      targetExamDate: null,
      motherTongue: 'bn',
      studyHoursWeekly: 10,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    });

    expect(container.textContent).toContain('IELTS True / False / Not Given');

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Submit Answers')
    );

    await act(async () => {
      submitBtn?.click();
    });

    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('/ 9.0 IELTS Band');
  });
});
