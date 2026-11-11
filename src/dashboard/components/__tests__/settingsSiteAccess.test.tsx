import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsView } from '../SettingsView';
import { DEFAULT_SETTINGS } from '../../../services/storage/settings';
import type { UserSettings } from '../../../types';

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

async function render(settings: UserSettings, onSave = vi.fn().mockResolvedValue(undefined)) {
  await act(async () => {
    createRoot(container).render(<SettingsView settings={settings} onSaveSettings={onSave} />);
  });
  // The setting lives in the Websites section
  await act(async () => (container.querySelector('[data-testid="settings-nav-websites"]') as HTMLElement).click());
  return onSave;
}

const click = async (sel: string) => {
  const el = container.querySelector(sel) as HTMLElement;
  expect(el, sel).not.toBeNull();
  await act(async () => el.click());
};

describe('Settings: where LexiFlow works on web pages', () => {
  it('shows one section at a time', async () => {
    await act(async () => {
      createRoot(container).render(<SettingsView settings={DEFAULT_SETTINGS} onSaveSettings={vi.fn()} />);
    });
    expect(container.querySelector('[data-testid="site-access-setting"]')).toBeNull();
    expect(container.textContent).toContain('How the word card opens');
    await act(async () => (container.querySelector('[data-testid="settings-nav-ai"]') as HTMLElement).click());
    expect(container.textContent).not.toContain('How the word card opens');
  });

  it('shows "Off by default" for new users', async () => {
    await render(DEFAULT_SETTINGS);
    expect(container.querySelector('[data-testid="site-mode-off"]')?.getAttribute('aria-checked')).toBe('true');
  });

  it('saves "On everywhere" the moment it is clicked, without pressing Save', async () => {
    const onSave = await render(DEFAULT_SETTINGS);
    await click('[data-testid="site-mode-on"]');
    expect(onSave).toHaveBeenCalledWith({ siteMode: 'on' });
    expect(container.querySelector('[data-testid="site-mode-on"]')?.getAttribute('aria-checked')).toBe('true');

    await click('[data-testid="site-mode-off"]');
    expect(onSave).toHaveBeenLastCalledWith({ siteMode: 'off' });
  });

  it('removing a site from the list saves at once', async () => {
    const onSave = await render({ ...DEFAULT_SETTINGS, siteMode: 'off', enabledSites: ['bbc.com', 'thedailystar.net'] });
    expect(container.textContent).toContain('thedailystar.net');
    await click('[aria-label="Remove bbc.com"]');
    expect(onSave).toHaveBeenCalledWith({ enabledSites: ['thedailystar.net'] });
  });
});
