import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MistakeMemoryView } from '../MistakeMemoryView';
import { MistakeMemoryClient } from '../../../services/mistake/client';
import { buildDrillSession } from '../../../services/mistake/drills';
import { TaxonomyService } from '../../../services/taxonomy/catalog';

let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  localStorage.clear();
});

/** Records mistakes the way the practice screens do, so the list has the learner's own errors. */
function recordLearnerMistakes() {
  MistakeMemoryClient.recordOccurrence('GRA.SUBJ_VERB_AGR', 'pte_write_essay', 'The results of the study shows a clear trend.');
  MistakeMemoryClient.recordOccurrence('VOC.COLLOCATION_UNNATURAL', 'ielts_speaking_part_2', 'I did a big mistake.');
}

afterEach(() => {
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function renderView(initialErrorCode: string | null = null, onClear: () => void = vi.fn()) {
  await act(async () => {
    createRoot(container).render(
      <MistakeMemoryView initialErrorCode={initialErrorCode} onClearInitialCode={onClear} />
    );
  });
}

function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputValue(element: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('TICKET LF-013: Mistake Memory & Improvement Lab View', () => {
  it('1. Renders 5-state lifecycle metrics cards and mandatory "LexiFlow estimate" label', async () => {
    recordLearnerMistakes();
    await renderView();

    const estimateLabel = container.querySelector('[data-testid="mistake-estimate-label"]');
    expect(estimateLabel).not.toBeNull();
    expect(estimateLabel?.textContent).toContain('LexiFlow estimate');

    expect(container.querySelector('[data-testid="state-card-New"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="state-card-Practising"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="state-card-Improving"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="state-card-Mastered"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="state-card-Reopened"]')).not.toBeNull();
  });

  it('1b. A new learner starts with an empty list, not sample mistakes', async () => {
    await renderView();

    expect(MistakeMemoryClient.getMistakes()).toEqual([]);
    expect(container.querySelector('[data-testid^="mistake-card-"]')).toBeNull();
    // No zero-filled stats or filters, just an explanation
    expect(container.querySelector('[data-testid="mistake-empty"]')?.textContent).toContain('No mistakes yet');
    expect(container.querySelector('[data-testid="state-card-New"]')).toBeNull();
    expect(container.textContent).not.toMatch(/PTE|IELTS|Pedagogical/);
  });

  it('2. Category filters and search input narrow down displayed error codes', async () => {
    recordLearnerMistakes();
    await renderView();

    expect(container.querySelector('[data-testid="mistake-card-GRA.SUBJ_VERB_AGR"]')).not.toBeNull();

    // Click VOC filter pill
    const vocPill = container.querySelector('[data-testid="cat-pill-VOC"]') as HTMLButtonElement;
    await act(async () => {
      vocPill.click();
    });

    expect(container.querySelector('[data-testid="mistake-card-GRA.SUBJ_VERB_AGR"]')).toBeNull();
    expect(container.querySelector('[data-testid="mistake-card-VOC.COLLOCATION_UNNATURAL"]')).not.toBeNull();

    // Return to All
    const allPill = container.querySelector('[data-testid="cat-pill-ALL"]') as HTMLButtonElement;
    await act(async () => {
      allPill.click();
    });
    expect(container.querySelector('[data-testid="mistake-card-GRA.SUBJ_VERB_AGR"]')).not.toBeNull();

    // Search query
    const searchInput = container.querySelector('[data-testid="mistake-search-input"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(searchInput, 'Subject-Verb');
    });

    expect(container.querySelector('[data-testid="mistake-card-GRA.SUBJ_VERB_AGR"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mistake-card-VOC.COLLOCATION_UNNATURAL"]')).toBeNull();
  });

  /** Answers every drill in the open session, right or wrong, using the same session the view built */
  async function playSession(code: string, answerCorrectly: (i: number) => boolean) {
    const item = MistakeMemoryClient.getMistakes().find((i) => i.errorCode === code)!;
    const drills = buildDrillSession(item, TaxonomyService.getError(code)!, (item.practiceSessions || 0) + item.totalOccurrences * 31);
    for (let i = 0; i < drills.length; i++) {
      const d = drills[i];
      const good = answerCorrectly(i);
      if (d.kind === 'choose') {
        const idx = good ? d.answer : (d.answer + 1) % d.options.length;
        await act(async () => {
          (container.querySelector(`[data-testid="drill-option-${idx}"]`) as HTMLButtonElement).click();
        });
      } else {
        await act(async () => {
          setTextareaValue(container.querySelector('[data-testid="drill-input"]') as HTMLTextAreaElement, good ? d.answers[0] : d.wrong);
        });
        await act(async () => {
          (container.querySelector('[data-testid="submit-drill-btn"]') as HTMLButtonElement).click();
        });
      }
      expect(container.querySelector('[data-testid="drill-result-banner"]')?.textContent).toContain(good ? 'Correct' : 'Not quite');
      await act(async () => {
        (container.querySelector('[data-testid="drill-next-btn"]') as HTMLButtonElement).click();
      });
    }
    return drills;
  }

  it('3. A drill session mixes a warm-up choice with the learner’s own sentence and advances mastery when passed', async () => {
    MistakeMemoryClient.recordOccurrence(
      'GRA.SUBJ_VERB_AGR',
      'smart_practice_writing',
      'The results of the study shows a clear trend.',
      'The results of the study show a clear trend.'
    );
    await renderView();

    await act(async () => {
      (container.querySelector('[data-testid="practice-btn-GRA.SUBJ_VERB_AGR"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="improvement-lab-modal"]')).not.toBeNull();
    expect(container.textContent).toContain('Fix: Subject-Verb Agreement Error');
    expect(container.querySelector('[data-testid="drill-choose"]')).not.toBeNull();

    const drills = await playSession('GRA.SUBJ_VERB_AGR', () => true);
    expect(drills.length).toBe(4);
    expect(drills.some((d) => d.source === 'own' && d.kind === 'fix' && d.wrong.includes('shows'))).toBe(true);

    expect(container.querySelector('[data-testid="drill-score"]')?.textContent).toContain('4 / 4');
    expect(container.querySelector('[data-testid="drill-summary-msg"]')?.textContent).toContain('Fixed once');

    await act(async () => {
      (container.querySelector('[data-testid="close-drill-btn"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="improvement-lab-modal"]')).toBeNull();

    const item = MistakeMemoryClient.getMistakes().find((i) => i.errorCode === 'GRA.SUBJ_VERB_AGR');
    expect(item?.masteryState).toBe('Improving');
    expect(item?.successfulCorrections).toBe(1);
    expect(item?.nextReviewDays).toBe(3);
    expect(item?.practiceSessions).toBe(1);
  });

  it('3b. Resubmitting the uncorrected sentences fails the session and keeps the mistake in practice', async () => {
    recordLearnerMistakes();
    await renderView();

    await act(async () => {
      (container.querySelector('[data-testid="practice-btn-GRA.SUBJ_VERB_AGR"]') as HTMLButtonElement).click();
    });
    await playSession('GRA.SUBJ_VERB_AGR', (i) => i === 0);

    expect(container.querySelector('[data-testid="drill-score"]')?.textContent).toContain('1 / 4');
    expect(container.querySelector('[data-testid="drill-summary-msg"]')?.textContent).toContain('comes back tomorrow');
    const item = MistakeMemoryClient.getMistakes().find((i) => i.errorCode === 'GRA.SUBJ_VERB_AGR');
    expect(item?.masteryState).toBe('Practising');
    expect(item?.successfulCorrections).toBe(0);
  });

  it('3c. Shows mistakes due today and starts a review from the banner', async () => {
    recordLearnerMistakes();
    // Make both mistakes due today
    const items = MistakeMemoryClient.getMistakes().map((i) => ({ ...i, nextReviewAt: '2000-01-01' }));
    localStorage.setItem('lexiflow_mistake_memories', JSON.stringify(items));
    await renderView();

    expect(container.querySelector('[data-testid="mm-due-banner"]')?.textContent).toContain('2 mistakes to review today');
    expect(container.querySelector('[data-testid="due-badge-GRA.SUBJ_VERB_AGR"]')).not.toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="mm-start-review"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="drill-session"]')).not.toBeNull();
  });

  it('4. Direct navigation with initialErrorCode automatically launches the Improvement Lab drill', async () => {
    recordLearnerMistakes();
    const onClear = vi.fn();
    await renderView('VOC.COLLOCATION_UNNATURAL', onClear);

    expect(container.querySelector('[data-testid="improvement-lab-modal"]')).not.toBeNull();
    expect(container.textContent).toContain('Fix: Unnatural Word Collocation');
    expect(onClear).toHaveBeenCalled();
  });
});
