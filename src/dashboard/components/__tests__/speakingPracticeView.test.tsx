import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeakingPracticeView } from '../SpeakingPracticeView';
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
  delete (window as any).webkitSpeechRecognition;
});

/** Stands in for the background worker answering EXAM_AI_COMPLETE with the given grading JSON. */
function mockExamAi(reply: Record<string, unknown>) {
  const sendMessage = vi.fn((message: any, callback: (res: any) => void) => {
    callback({ success: true, data: { rawText: JSON.stringify(reply), model: 'test-model' } });
  });
  (globalThis as any).chrome = { runtime: { sendMessage } };
  return sendMessage;
}

/** A fake browser speech recogniser the test can drive. */
function mockSpeechRecognition() {
  const instances: any[] = [];
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    onresult: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    constructor() {
      instances.push(this);
    }
  }
  (window as any).webkitSpeechRecognition = FakeRecognition;
  return instances;
}

async function renderView(profile: LearnerProfile | null = null) {
  await act(async () => {
    createRoot(container).render(<SpeakingPracticeView learnerProfile={profile} />);
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

describe('SpeakingPracticeView (Exam Simulator & Studio UI)', () => {
  it('1. Renders PTE Speaking tasks by default and shows prompt and mandatory "LexiFlow estimate" label', async () => {
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

    expect(container.textContent).toContain('Speaking Exam Engine');
    expect(container.textContent).toContain('PTE Academic');
    expect(container.textContent).toContain('LexiFlow estimate');
    expect(container.textContent).toContain('Read Aloud');
    expect(container.textContent).toContain('Repeat Sentence');
    expect(container.textContent).toContain('Answer Short Question');
  });

  it('2. Starts prep timer when clicking "Start Prep Timer"', async () => {
    await renderView();

    const startPrepBtn = container.querySelector('[data-testid="btn-start-prep"]') as HTMLButtonElement;
    expect(startPrepBtn).not.toBeNull();

    await act(async () => {
      startPrepBtn.click();
    });

    expect(container.textContent).toContain('Preparing (Reviewing prompt)...');
    expect(container.querySelector('[data-testid="btn-skip-prep-record"]')).not.toBeNull();
  });

  it('3. Skips prep to record, stops recording, and evaluates PTE Read Aloud', async () => {
    mockExamAi({ pronunciation: 4, oralFluency: 3.5, contentAnalysis: 'Accurate reading.', strengths: [], weaknesses: [], detectedErrorCodes: [] });
    await renderView();

    // Start prep
    const startPrepBtn = container.querySelector('[data-testid="btn-start-prep"]') as HTMLButtonElement;
    await act(async () => {
      startPrepBtn.click();
    });

    // Skip to speak
    const skipBtn = container.querySelector('[data-testid="btn-skip-prep-record"]') as HTMLButtonElement;
    await act(async () => {
      skipBtn.click();
    });

    expect(container.textContent).toContain('Recording Audio');

    // Stop recording
    const stopBtn = container.querySelector('[data-testid="btn-stop-recording"]') as HTMLButtonElement;
    await act(async () => {
      stopBtn.click();
    });

    expect(container.textContent).toContain('Recording Completed');

    // Enter transcript
    const transcriptInput = container.querySelector('[data-testid="speaking-transcript-input"]') as HTMLTextAreaElement;
    await act(async () => {
      setTextareaValue(
        transcriptInput,
        'The rapid development of renewable energy technology has significantly reduced carbon emissions across developed economies.'
      );
    });

    // Evaluate
    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-speaking"]') as HTMLButtonElement;
    await act(async () => {
      evaluateBtn.click();
    });

    const resultsCard = container.querySelector('[data-testid="speaking-evaluation-results-card"]');
    expect(resultsCard).not.toBeNull();

    const disclosure = container.querySelector('[data-testid="speaking-estimate-disclosure-badge"]');
    expect(disclosure?.textContent).toContain('LexiFlow estimate');

    const score = container.querySelector('[data-testid="speaking-overall-score-display"]');
    expect(score).not.toBeNull();
  });

  it('3b. Recording fills the transcript live from the speech recogniser', async () => {
    const recognisers = mockSpeechRecognition();
    await renderView();

    await act(async () => {
      (container.querySelector('[data-testid="btn-start-prep"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="btn-skip-prep-record"]') as HTMLButtonElement).click();
    });

    expect(recognisers).toHaveLength(1);
    expect(recognisers[0].start).toHaveBeenCalled();

    await act(async () => {
      recognisers[0].onresult({
        resultIndex: 0,
        results: [Object.assign([{ transcript: 'The rapid development' }], { isFinal: true })]
      });
    });

    const transcript = container.querySelector('[data-testid="speaking-transcript-input"]') as HTMLTextAreaElement;
    expect(transcript.value).toBe('The rapid development');

    await act(async () => {
      (container.querySelector('[data-testid="btn-stop-recording"]') as HTMLButtonElement).click();
    });
    expect(recognisers[0].stop).toHaveBeenCalled();
  });

  it('3c. Repeat Sentence keeps the sentence hidden until the attempt is done', async () => {
    await renderView();

    await act(async () => {
      (container.querySelector('[data-testid="speaking-tab-pte_repeat_sentence"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).not.toContain('laboratory research proposals');
    expect(container.querySelector('[data-testid="btn-play-prompt"]')).not.toBeNull();
  });

  it('4. Renders IELTS Speaking tasks when learner profile is IELTS, and evaluates Part 2 Cue Card', async () => {
    mockExamAi({
      fluencyCoherence: 6.5,
      lexicalResource: 6,
      grammaticalAccuracy: 6,
      pronunciation: 6.5,
      feedbackSummary: 'Fluent but repetitive.',
      strengths: [],
      weaknesses: [],
      detectedErrorCodes: []
    });
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
    expect(container.textContent).toContain('Part 1 (Interview)');
    expect(container.textContent).toContain('Part 2 (Cue Card)');
    expect(container.textContent).toContain('Part 3 (Discussion)');

    // Enter transcript for Part 2
    const transcriptInput = container.querySelector('[data-testid="speaking-transcript-input"]') as HTMLTextAreaElement;
    const spokenSpeech =
      'I would like to describe my high school mathematics teacher who had a transformative impact on my perspective.\n\nShe introduced problem solving with extraordinary enthusiasm.\n\nHer mentorship inspired me to pursue computational science.';
    const extendedSpeech = new Array(120).fill('fluent detailed storytelling').join(' ') + '\n\n' + spokenSpeech;

    await act(async () => {
      setTextareaValue(transcriptInput, extendedSpeech);
    });

    const evaluateBtn = container.querySelector('[data-testid="btn-evaluate-speaking"]') as HTMLButtonElement;
    await act(async () => {
      evaluateBtn.click();
    });

    const resultsCard = container.querySelector('[data-testid="speaking-evaluation-results-card"]');
    expect(resultsCard).not.toBeNull();
    expect(resultsCard?.textContent).toContain('LexiFlow estimate');
    expect(resultsCard?.textContent).toContain('Fluency Coherence');
    expect(resultsCard?.textContent).toContain('Pronunciation');
  });
});
