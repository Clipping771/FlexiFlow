import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App } from '../App';

let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  localStorage.clear();

  // Emulate mobile viewport dimensions (375px x 667px default)
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });

  // Chrome API mock
  (globalThis as any).chrome = {
    storage: {
      sync: {
        get: vi.fn((_keys, cb) => cb({})),
        set: vi.fn((_data, cb) => cb && cb())
      },
      local: {
        get: vi.fn((_keys, cb) => cb({})),
        set: vi.fn((_data, cb) => cb && cb())
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn((msg, cb) => {
        if (msg?.type === 'GET_ALL_VOCAB') {
          cb && cb({ success: true, data: [] });
        } else if (msg?.type === 'GET_SETTINGS') {
          cb && cb({
            success: true,
            data: {
              theme: 'dark',
              targetLanguage: 'bn',
              aiProvider: 'lexiflow',
              targetExam: 'pte_academic'
            }
          });
        } else {
          cb && cb({ success: true });
        }
      }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn()
      }
    }
  };
});

afterEach(() => {
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function renderDashboard() {
  await act(async () => {
    createRoot(container).render(<App />);
  });
}

/** Opens a tab through the mobile Tools drawer. */
async function openTabFromDrawer(navTestId: string) {
  await act(async () => {
    (container.querySelector('[data-testid="narrow-menu-btn"]') as HTMLElement).click();
  });
  await act(async () => {
    (container.querySelector(`[data-testid="${navTestId}"]`) as HTMLElement).click();
  });
}

describe('Mobile End-to-End Flow & Responsive Verification (LF-004)', () => {
  it('1. First-time learner on mobile (375px) is not interrupted on the dashboard, gets exam setup on the first exam screen, and completes PTE 79', async () => {
    await renderDashboard();

    // The reading companion opens straight away; exam setup is not forced
    expect(container.querySelector('.onboarding-overlay')).toBeNull();

    await openTabFromDrawer('nav-writing-practice');

    expect(container.textContent).toContain('Set up exam practice');
    expect(container.textContent).toContain('Step 1 of 4');

    // Step 1: Select PTE Academic
    const pteCard = container.querySelector('[data-testid="exam-option-pte"]') as HTMLElement;
    expect(pteCard).not.toBeNull();
    await act(async () => {
      pteCard.click();
    });

    const step1Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    expect(step1Continue).not.toBeNull();
    await act(async () => {
      step1Continue.click();
    });

    // Step 2: Target Score (Select 79)
    expect(container.textContent).toContain('Step 2 of 4');
    const score79Btn = container.querySelector('[data-testid="score-btn-79"]') as HTMLElement;
    expect(score79Btn).not.toBeNull();
    await act(async () => {
      score79Btn.click();
    });

    const step2Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    await act(async () => {
      step2Continue.click();
    });

    // Step 3: Exam Date
    expect(container.textContent).toContain('Step 3 of 4');
    const dateInput = container.querySelector('[data-testid="target-date-input"]') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    await act(async () => {
      dateInput.value = '2026-12-15';
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const step3Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    await act(async () => {
      step3Continue.click();
    });

    // Step 4: Mother tongue and Study Hours
    expect(container.textContent).toContain('Step 4 of 4');
    const langSelect = container.querySelector('[data-testid="mother-tongue-select"]') as HTMLSelectElement;
    expect(langSelect).not.toBeNull();
    expect(langSelect.value).toBe('bn'); // default Bengali

    const finishBtn = container.querySelector('[data-testid="wizard-finish-btn"]') as HTMLElement;
    expect(finishBtn).not.toBeNull();
    await act(async () => {
      finishBtn.click();
    });

    // Verify Wizard closed
    expect(container.querySelector('.onboarding-overlay')).toBeNull();

    // Verify Profile saved in localStorage
    const savedProfile = JSON.parse(localStorage.getItem('lexiflow_learner_profile') || '{}');
    expect(savedProfile.targetExam).toBe('pte_academic');
    expect(savedProfile.targetScore).toBe('79');
    expect(savedProfile.motherTongue).toBe('bn');

    // Mobile top bar reflects PTE 79; the exam screen itself carries the "LexiFlow estimate" label
    const mobileExamBadge = container.querySelector('[data-testid="narrow-exam-badge"]');
    expect(mobileExamBadge).not.toBeNull();
    expect(mobileExamBadge?.textContent).toContain('PTE 79');
    expect(container.querySelector('[data-testid="writing-estimate-label"]')?.textContent).toContain('LexiFlow estimate');
  });

  it('1b. Skipping exam setup is remembered', async () => {
    await renderDashboard();
    await openTabFromDrawer('nav-writing-practice');

    await act(async () => {
      (container.querySelector('[data-testid="wizard-skip-btn"]') as HTMLElement).click();
    });
    expect(container.querySelector('.onboarding-overlay')).toBeNull();
    expect(localStorage.getItem('lexiflow_exam_setup_dismissed')).toBe('1');

    await openTabFromDrawer('nav-speaking-practice');
    expect(container.querySelector('.onboarding-overlay')).toBeNull();
    expect(container.querySelector('[data-testid="narrow-exam-badge"]')?.textContent).toContain('Set target');
  });

  it('2. Mobile navigation drawer opens via Menu button and closes via close button', async () => {
    // Pre-populate profile so wizard doesn't pop up
    localStorage.setItem(
      'lexiflow_learner_profile',
      JSON.stringify({
        userId: 'usr_mobile_test',
        targetExam: 'pte_academic',
        targetScore: '79',
        targetExamDate: '2026-12-15',
        motherTongue: 'bn',
        studyHoursWeekly: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );

    await renderDashboard();

    // Drawer should initially be closed
    expect(container.querySelector('.narrow-drawer')).toBeNull();

    // Click Menu button in mobile header
    const menuBtn = container.querySelector('[data-testid="narrow-menu-btn"]') as HTMLElement;
    expect(menuBtn).not.toBeNull();
    await act(async () => {
      menuBtn.click();
    });

    // Drawer is now open
    const drawer = container.querySelector('.narrow-drawer');
    expect(drawer).not.toBeNull();
    expect(container.textContent).toContain('LexiFlow Tools');

    // Click close button in drawer
    const closeBtn = container.querySelector('[data-testid="btn-drawer-close"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn.click();
    });

    // Drawer is closed
    expect(container.querySelector('.narrow-drawer')).toBeNull();
  });

  it('3. Learner re-opens onboarding wizard by tapping mobile exam badge and switches to IELTS Academic Band 7.5', async () => {
    localStorage.setItem(
      'lexiflow_learner_profile',
      JSON.stringify({
        userId: 'usr_mobile_test',
        targetExam: 'pte_academic',
        targetScore: '79',
        targetExamDate: null,
        motherTongue: 'bn',
        studyHoursWeekly: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );

    await renderDashboard();
    await openTabFromDrawer('nav-speaking-practice');

    const mobileExamBadge = container.querySelector('[data-testid="narrow-exam-badge"]') as HTMLElement;
    expect(mobileExamBadge?.textContent).toContain('PTE 79');

    // Tap mobile exam badge to configure
    await act(async () => {
      mobileExamBadge.click();
    });

    // Onboarding wizard opens
    expect(container.querySelector('.onboarding-overlay')).not.toBeNull();

    // Step 1: Switch to IELTS
    const ieltsCard = container.querySelector('[data-testid="exam-option-ielts"]') as HTMLElement;
    await act(async () => {
      ieltsCard.click();
    });

    const step1Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    await act(async () => {
      step1Continue.click();
    });

    // Step 2: Band 7.5 is auto-selected or clicked
    const band75Btn = container.querySelector('[data-testid="score-btn-7.5"]') as HTMLElement;
    expect(band75Btn).not.toBeNull();
    await act(async () => {
      band75Btn.click();
    });

    const step2Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    await act(async () => {
      step2Continue.click();
    });

    // Step 3: Date
    const step3Continue = container.querySelector('[data-testid="wizard-continue-btn"]') as HTMLElement;
    await act(async () => {
      step3Continue.click();
    });

    // Step 4: Finish
    const finishBtn = container.querySelector('[data-testid="wizard-finish-btn"]') as HTMLElement;
    await act(async () => {
      finishBtn.click();
    });

    // Verify updated mobile header
    const updatedBadge = container.querySelector('[data-testid="narrow-exam-badge"]');
    expect(updatedBadge?.textContent).toContain('IELTS 7.5');
    expect(container.textContent).toContain('Part 2 (Cue Card)');

    const updatedProfile = JSON.parse(localStorage.getItem('lexiflow_learner_profile') || '{}');
    expect(updatedProfile.targetExam).toBe('ielts_academic');
    expect(updatedProfile.targetScore).toBe('7.5');
  });

  it('4. Renders responsive layout on iPhone 12/13/14 dimensions (390px width) with bottom navigation', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 844 });

    localStorage.setItem(
      'lexiflow_learner_profile',
      JSON.stringify({
        userId: 'usr_iphone14',
        targetExam: 'pte_academic',
        targetScore: '85',
        targetExamDate: '2026-11-30',
        motherTongue: 'bn',
        studyHoursWeekly: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );

    await renderDashboard();

    // Verify narrow layout active
    const layout = container.querySelector('.dashboard-layout');
    expect(layout?.classList.contains('narrow-layout')).toBe(true);

    // Verify bottom nav is present
    const bottomNav = container.querySelector('.narrow-bottom-nav');
    expect(bottomNav).not.toBeNull();
    expect(bottomNav?.textContent).toContain('Vocab');
    expect(bottomNav?.textContent).toContain('Review');
    expect(bottomNav?.textContent).toContain('Settings');
    expect(bottomNav?.textContent).toContain('Tools');

    // The exam badge only appears on exam screens
    expect(container.querySelector('[data-testid="narrow-exam-badge"]')).toBeNull();
    await openTabFromDrawer('nav-full-mock-exam');
    const badge = container.querySelector('[data-testid="narrow-exam-badge"]');
    expect(badge?.textContent).toContain('PTE 85');
  });
});
