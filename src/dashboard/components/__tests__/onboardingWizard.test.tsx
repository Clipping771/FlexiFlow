import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingWizard } from '../OnboardingWizard';
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
});

async function renderWizard(onComplete = vi.fn(), initialProfile: LearnerProfile | null = null) {
  await act(async () => {
    createRoot(container).render(
      <OnboardingWizard onComplete={onComplete} initialProfile={initialProfile} />
    );
  });
}

function getButtonByText(text: string): HTMLButtonElement | null {
  const buttons = Array.from(container.querySelectorAll('button'));
  return buttons.find((b) => b.textContent?.includes(text)) || null;
}

describe('OnboardingWizard Component', () => {
  it('1. Renders step 1 with PTE Academic and IELTS Academic options', async () => {
    await renderWizard();
    expect(container.textContent).toContain('Set up exam practice');
    expect(container.textContent).toContain('Step 1 of 4');
    expect(container.textContent).toContain('PTE Academic');
    expect(container.textContent).toContain('IELTS Academic');
  });

  it('1b. Can be dismissed with Skip, the close button or Escape', async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      createRoot(container).render(<OnboardingWizard onComplete={vi.fn()} onDismiss={onDismiss} />);
    });

    await act(async () => {
      (container.querySelector('[data-testid="wizard-skip-btn"]') as HTMLElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="wizard-close-btn"]') as HTMLElement).click();
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it('1c. Blocks Continue on an out-of-range custom score', async () => {
    await renderWizard();
    await act(async () => {
      getButtonByText('Continue')?.click();
    });

    const input = container.querySelector('[data-testid="custom-score-input"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '120');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(getButtonByText('Continue')?.disabled).toBe(true);
    expect(container.textContent).toContain('Enter a whole number from 10 to 90.');
  });

  it('2. Navigates through steps 1 -> 2 -> 3 -> 4 and preserves selection', async () => {
    const onComplete = vi.fn();
    await renderWizard(onComplete);

    // Step 1: Select IELTS
    const ieltsCard = container.querySelector('[data-testid="exam-option-ielts"]') as HTMLElement;
    expect(ieltsCard).not.toBeNull();
    await act(async () => {
      ieltsCard.click();
    });

    // Click Continue
    const continueBtn = getButtonByText('Continue');
    expect(continueBtn).not.toBeNull();
    await act(async () => {
      continueBtn?.click();
    });

    // Step 2: Target Score
    expect(container.textContent).toContain('Step 2 of 4');
    expect(container.textContent).toContain('Band 7.5');

    // Click Continue
    await act(async () => {
      getButtonByText('Continue')?.click();
    });

    // Step 3: Test Date
    expect(container.textContent).toContain('Step 3 of 4');
    expect(container.textContent).toContain('When do you plan to take your exam?');

    // Click Continue
    await act(async () => {
      getButtonByText('Continue')?.click();
    });

    // Step 4: Language & Study Rhythm
    expect(container.textContent).toContain('Step 4 of 4');
    expect(container.textContent).toContain('বাংলা (Bengali)');

    // Click Finish
    const finishBtn = getButtonByText('Start Preparation');
    expect(finishBtn).not.toBeNull();
    await act(async () => {
      finishBtn?.click();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    const completedProfile = onComplete.mock.calls[0][0];
    expect(completedProfile.targetExam).toBe('ielts_academic');
    expect(completedProfile.motherTongue).toBe('bn');
    expect(localStorage.getItem('lexiflow_learner_profile')).not.toBeNull();
  });

  it('3. Renders cleanly within mobile viewport constraints (375px)', async () => {
    container.style.width = '375px';
    await renderWizard();
    const card = container.querySelector('.onboarding-card') as HTMLElement;
    expect(card).not.toBeNull();
    expect(container.textContent).toContain('Step 1 of 4');
  });
});
