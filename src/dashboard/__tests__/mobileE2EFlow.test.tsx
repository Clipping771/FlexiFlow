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
  it('1. First-time learner on mobile (375px) reaches Smart Practice with no exam setup or exam names', async () => {
    await renderDashboard();
    expect(container.querySelector('.onboarding-overlay')).toBeNull();

    await openTabFromDrawer('nav-smart-practice');

    expect(container.querySelector('[data-testid="smart-practice"]')).not.toBeNull();
    expect(container.querySelector('.onboarding-overlay')).toBeNull();
    expect(container.textContent).not.toMatch(/PTE|IELTS|Set up exam practice/);
    // With no article yet, the learner is told how to bring one in
    expect(container.querySelector('[data-testid="exam-article-gate"]')).not.toBeNull();
  });

  it('1b. The popup link (dashboard.html#exam) opens Smart Practice', async () => {
    window.location.hash = '#exam';
    await renderDashboard();
    expect(container.querySelector('[data-testid="smart-practice"]')).not.toBeNull();
    window.location.hash = '';
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

  it('3. Bottom navigation opens Smart Practice in one tap', async () => {
    await renderDashboard();
    const practice = Array.from(container.querySelectorAll('.narrow-bottom-nav button')).find((b) =>
      b.textContent?.includes('Practice')
    ) as HTMLElement;
    expect(practice).toBeDefined();
    await act(async () => {
      practice.click();
    });
    expect(container.querySelector('[data-testid="smart-practice"]')).not.toBeNull();
    expect(practice.className).toContain('active');
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
    expect(bottomNav?.textContent).toContain('Today');
    expect(bottomNav?.textContent).toContain('Review');
    expect(bottomNav?.textContent).toContain('Settings');
    expect(bottomNav?.textContent).toContain('Tools');

    expect(bottomNav?.textContent).toContain('Practice');

    // No exam badge anywhere, even on the practice screen
    await openTabFromDrawer('nav-smart-practice');
    expect(container.querySelector('[data-testid="narrow-exam-badge"]')).toBeNull();
  });
});
