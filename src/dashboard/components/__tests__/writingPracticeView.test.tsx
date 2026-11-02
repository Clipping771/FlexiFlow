import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WritingPracticeView } from '../WritingPracticeView';
import { LearnerProfile } from '../../../types';

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
  delete (globalThis as any).chrome;
});

/** Stands in for the background worker answering EXAM_AI_COMPLETE with the given grading JSON. */
function mockExamAi(reply: Record<string, unknown>) {
  const sendMessage = vi.fn((message: any, callback: (res: any) => void) => {
    callback({ success: true, data: { rawText: JSON.stringify(reply), model: 'test-model' } });
  });
  (globalThis as any).chrome = { runtime: { sendMessage } };
  return sendMessage;
}

const PTE_ESSAY_REPLY = {
  content: 2,
  grammar: 1.5,
  vocabulary: 1.5,
  spelling: 2,
  generalLinguisticRange: 1.5,
  developmentCoherence: 1,
  feedbackSummary: 'Repetitive but on topic.',
  strengths: ['On topic'],
  improvements: ['Develop each view'],
  detectedErrorCodes: []
};

const IELTS_ESSAY_REPLY = {
  taskAchievement: 6,
  coherenceCohesion: 6,
  lexicalResource: 6.5,
  grammaticalAccuracy: 6,
  feedbackSummary: 'Clear position, limited development.',
  strengths: ['Clear position'],
  improvements: ['Add examples'],
  detectedErrorCodes: []
};

async function renderView(profile: LearnerProfile | null = null) {
  await act(async () => {
    createRoot(container).render(<WritingPracticeView learnerProfile={profile} />);
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

describe('WritingPracticeView (Exam Simulator & Editor UI)', () => {
  it('1. Renders PTE Academic tasks by default and shows prompt and mandatory "LexiFlow estimate" label', async () => {
    const pteProfile: LearnerProfile = {
      userId: 'usr_pte',
      targetExam: 'pte_academic',
      targetScore: '79',
      targetExamDate: null,
      motherTongue: 'bn',
      studyHoursWeekly: 10,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    };

    await renderView(pteProfile);

    expect(container.textContent).toContain('Writing Exam Engine');
    expect(container.textContent).toContain('PTE Academic');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('Write Essay');
    expect(container.textContent).toContain('Summarize Written Text');
  });

  it('2. Counts words in real time and enables evaluation button when text is entered', async () => {
    await renderView();

    const textarea = container.querySelector('[data-testid="writing-textarea"]') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    const wordCountDisplay = container.querySelector('[data-testid="live-word-count"]');
    expect(wordCountDisplay?.textContent).toBe('0');

    // Type text into textarea using native setter
    await act(async () => {
      setTextareaValue(textarea, 'In modern higher education, academic focus remains paramount for career readiness.');
    });

    expect(container.querySelector('[data-testid="live-word-count"]')?.textContent).toBe('11');
  });

  it('3. Submits PTE Write Essay, evaluates, and renders overall score with "LexiFlow estimate" disclosure', async () => {
    const sendMessage = mockExamAi(PTE_ESSAY_REPLY);
    await renderView();

    const textarea = container.querySelector('[data-testid="writing-textarea"]') as HTMLTextAreaElement;
    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-writing"]') as HTMLButtonElement;

    // Enter valid 220-word essay
    const essayContent = new Array(220).fill('education').join(' ') + ' argument.';
    await act(async () => {
      setTextareaValue(textarea, essayContent);
    });

    await act(async () => {
      evaluateBtn.click();
    });

    // Verification of evaluation results card
    const resultsCard = container.querySelector('[data-testid="evaluation-results-card"]');
    expect(resultsCard).not.toBeNull();

    const scoreDisplay = container.querySelector('[data-testid="overall-score-display"]');
    expect(scoreDisplay).not.toBeNull();

    const disclosure = container.querySelector('[data-testid="estimate-disclosure-badge"]');
    expect(disclosure?.textContent).toContain('LexiFlow estimate');
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXAM_AI_COMPLETE' }),
      expect.any(Function)
    );
    expect(resultsCard?.textContent).toContain('Marked by test-model');
  });

  it('3b. Without an AI provider it shows no score instead of a made-up one', async () => {
    await renderView();

    const textarea = container.querySelector('[data-testid="writing-textarea"]') as HTMLTextAreaElement;
    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-writing"]') as HTMLButtonElement;

    await act(async () => {
      setTextareaValue(textarea, new Array(220).fill('education').join(' ') + ' argument.');
    });
    await act(async () => {
      evaluateBtn.click();
    });

    const resultsCard = container.querySelector('[data-testid="evaluation-results-card"]');
    expect(resultsCard?.textContent).toContain('No score this time');
    expect(resultsCard?.textContent).toContain('only works inside the LexiFlow extension');
    expect(container.querySelector('[data-testid="overall-score-display"]')).toBeNull();
  });

  it('3c. A too-short essay gets the rule-based Form penalty without calling the AI', async () => {
    const sendMessage = mockExamAi(PTE_ESSAY_REPLY);
    await renderView();

    const textarea = container.querySelector('[data-testid="writing-textarea"]') as HTMLTextAreaElement;
    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-writing"]') as HTMLButtonElement;

    await act(async () => {
      setTextareaValue(textarea, 'Far too short to be an essay.');
    });
    await act(async () => {
      evaluateBtn.click();
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="overall-score-display"]')?.textContent).toBe('10');
    expect(container.textContent).toContain('Rule-based check');
  });

  it('4. Renders IELTS Academic tasks when learner profile is IELTS, and evaluates Task 2 essay', async () => {
    mockExamAi(IELTS_ESSAY_REPLY);
    const ieltsProfile: LearnerProfile = {
      userId: 'usr_ielts',
      targetExam: 'ielts_academic',
      targetScore: '7.5',
      targetExamDate: null,
      motherTongue: 'bn',
      studyHoursWeekly: 15,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z'
    };

    await renderView(ieltsProfile);

    expect(container.textContent).toContain('IELTS Academic');
    expect(container.textContent).toContain('Writing Task 1 (Report)');
    expect(container.textContent).toContain('Writing Task 2 (Discursive Essay)');

    // Enter 260-word essay for Task 2
    const textarea = container.querySelector('[data-testid="writing-textarea"]') as HTMLTextAreaElement;
    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-writing"]') as HTMLButtonElement;

    const essayContent =
      'Taking a gap year before starting higher education has become widely popular.\n\nOn one hand, travelling or working offers invaluable practical maturity.\n\nOn the other hand, pausing studies may lead to academic momentum loss.\n\nIn conclusion, the advantages clearly outweigh the disadvantages.';
    const paddedEssay = new Array(200).fill('additional relevant reasoning').join(' ') + '\n\n' + essayContent;

    await act(async () => {
      setTextareaValue(textarea, paddedEssay);
    });

    await act(async () => {
      evaluateBtn.click();
    });

    const resultsCard = container.querySelector('[data-testid="evaluation-results-card"]');
    expect(resultsCard).not.toBeNull();
    expect(resultsCard?.textContent).toContain('LexiFlow estimate');
    expect(resultsCard?.textContent).toContain('Task Achievement');
    expect(resultsCard?.textContent).toContain('Coherence Cohesion');
  });

  it('5. Toggles countdown timer on and off', async () => {
    await renderView();

    const timerToggleBtn = container.querySelector('[data-testid="btn-timer-toggle"]') as HTMLButtonElement;
    expect(timerToggleBtn?.textContent).toContain('Start Timer');

    await act(async () => {
      timerToggleBtn.click();
    });

    expect(timerToggleBtn?.textContent).toContain('Pause');
  });
});
