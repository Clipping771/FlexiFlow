import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodayView } from '../TodayView';
import { saveGoals, loadGoals } from '../../../services/learner/goals';
import { recordActivity } from '../../../services/learner/activity';
import { MistakeMemoryClient } from '../../../services/mistake/client';

let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  localStorage.clear();
});

afterEach(() => {
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function render(props: Partial<React.ComponentProps<typeof TodayView>> = {}) {
  const onNavigate = vi.fn();
  const onPractice = vi.fn();
  await act(async () => {
    createRoot(container).render(<TodayView dueVocabCount={0} onNavigate={onNavigate} onPractice={onPractice} {...props} />);
  });
  return { onNavigate, onPractice };
}

describe('Today view', () => {
  it('asks a new learner to set goals, then shows the plan', async () => {
    await render();
    expect(q('goals-form')).not.toBeNull();

    await act(async () => q('goal-level-B2')!.click());
    await act(async () => q('goal-min-20')!.click());
    await act(async () => q('goal-reminder-toggle')!.click()); // turn the reminder off
    await act(async () => q('goals-save')!.click());

    expect(loadGoals()).toMatchObject({ level: 'B2', dailyMinutes: 20, reminderTime: null });
    expect(q('today-view')).not.toBeNull();
    expect(q('today-minutes')?.textContent).toContain('0 / 20 min');
    expect(q('today-streak')?.textContent).toContain('0 days');
  });

  it('builds the plan from due words, due mistakes and the focus skill', async () => {
    saveGoals({ level: 'B1', focus: ['speaking'], dailyMinutes: 15, reminderTime: '20:00' });
    MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 't', 'He go.', 'He goes.');
    const items = MistakeMemoryClient.getMistakes().map((i) => ({ ...i, nextReviewAt: '2000-01-01' }));
    localStorage.setItem('lexiflow_mistake_memories', JSON.stringify(items));

    const { onNavigate, onPractice } = await render({ dueVocabCount: 7 });
    expect(q('today-step-review')?.textContent).toContain('Review 7 words');
    expect(q('today-step-mistakes')?.textContent).toContain('Fix 1 mistake');
    expect(q('today-step-practice')?.textContent).toContain('Speaking practice');

    await act(async () => q('today-step-review')!.click());
    expect(onNavigate).toHaveBeenCalledWith('review');
    await act(async () => q('today-step-practice')!.click());
    expect(onPractice).toHaveBeenCalledWith('speaking');
    expect(container.textContent).toContain('Daily reminder at 20:00');
  });

  it('updates streak and minutes as the learner studies', async () => {
    saveGoals({ level: 'B1', focus: ['reading'], dailyMinutes: 10, reminderTime: null });
    await render();
    await act(async () => {
      recordActivity('drill', 4);
      recordActivity('review', 4);
    });
    expect(q('today-streak')?.textContent).toContain('1 day');
    expect(q('today-minutes')?.textContent).toContain('5 / 10 min');
  });
});
