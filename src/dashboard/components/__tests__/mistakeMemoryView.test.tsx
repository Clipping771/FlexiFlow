import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MistakeMemoryView } from '../MistakeMemoryView';
import { MistakeMemoryClient } from '../../../services/mistake/client';

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

  it('3. Opens Improvement Lab drill modal and successfully advances mastery state upon correct fix', async () => {
    recordLearnerMistakes();
    await renderView();

    const drillBtn = container.querySelector('[data-testid="practice-btn-GRA.SUBJ_VERB_AGR"]') as HTMLButtonElement;
    await act(async () => {
      drillBtn.click();
    });

    expect(container.querySelector('[data-testid="improvement-lab-modal"]')).not.toBeNull();
    expect(container.textContent).toContain('Fix: Subject-Verb Agreement Error');

    const drillInput = container.querySelector('[data-testid="drill-input"]') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(drillInput, 'The list of candidate items was reviewed by the examiner.');
    });

    const submitBtn = container.querySelector('[data-testid="submit-drill-btn"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    const resultBanner = container.querySelector('[data-testid="drill-result-banner"]');
    expect(resultBanner).not.toBeNull();
    expect(resultBanner?.textContent).toContain('Great job!');

    // Close drill
    const closeBtn = container.querySelector('[data-testid="close-drill-btn"]') as HTMLButtonElement;
    await act(async () => {
      closeBtn.click();
    });
    expect(container.querySelector('[data-testid="improvement-lab-modal"]')).toBeNull();

    // Verify localStorage item transitioned to Improving with 3-day FSRS review
    const items = MistakeMemoryClient.getMistakes();
    const item = items.find((i) => i.errorCode === 'GRA.SUBJ_VERB_AGR');
    expect(item?.masteryState).toBe('Improving');
    expect(item?.successfulCorrections).toBe(1);
    expect(item?.nextReviewDays).toBe(3);
  });

  it('3b. Resubmitting the uncorrected sentence is marked wrong', async () => {
    recordLearnerMistakes();
    await renderView();

    await act(async () => {
      (container.querySelector('[data-testid="practice-btn-GRA.SUBJ_VERB_AGR"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      setTextareaValue(
        container.querySelector('[data-testid="drill-input"]') as HTMLTextAreaElement,
        'The list of candidate items were reviewed by the examiner.'
      );
    });
    await act(async () => {
      (container.querySelector('[data-testid="submit-drill-btn"]') as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="drill-result-banner"]')?.textContent).toContain('Not quite');
    const item = MistakeMemoryClient.getMistakes().find((i) => i.errorCode === 'GRA.SUBJ_VERB_AGR');
    expect(item?.successfulCorrections).toBe(0);
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
