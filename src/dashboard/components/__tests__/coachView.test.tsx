import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoachView } from '../CoachView';

describe('CoachView', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  const check = async (response: unknown, targetLanguage = 'bn') => {
    (globalThis as any).chrome = {
      runtime: { sendMessage: (_m: unknown, cb: (r: unknown) => void) => cb(response), lastError: undefined }
    };
    const root = createRoot(container);
    await act(async () => {
      root.render(<CoachView initialWord="mitigate" targetLanguage={targetLanguage} />);
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Check My Sentence'))!.click();
    });
  };

  it('shows why a sentence could not be checked, and no score', async () => {
    await check({ success: false, error: 'Checking your sentence needs an AI provider.' });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('needs an AI provider');
    expect(container.textContent).not.toContain('Collocation Score');
  });

  it('shows the model’s verdict with its explanation, collocations and a language-aware label', async () => {
    await check(
      {
        success: true,
        data: {
          targetWord: 'mitigate',
          isGrammaticallyCorrect: false,
          collocationScore: 55,
          grammarCorrectness: 'Use "mitigate" with an object.',
          naturalAlternative: 'We must mitigate the risk.',
          bengaliFeedback: 'Usa un objeto.',
          alternativeCollocations: ['mitigate the risk']
        }
      },
      'es'
    );
    expect(container.textContent).toContain('55 / 100');
    expect(container.textContent).toContain('Needs correction');
    expect(container.textContent).toContain('Use "mitigate" with an object.');
    expect(container.textContent).toContain('Spanish Coaching Feedback');
    expect(container.textContent).toContain('mitigate the risk');
  });
});
