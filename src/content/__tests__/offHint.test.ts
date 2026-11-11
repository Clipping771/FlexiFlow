import { describe, it, expect, beforeEach, vi } from 'vitest';
import { maybeShowOffHint, _resetOffHint, MAX_HINTS } from '../offHint';

let store: Record<string, unknown>;

beforeEach(() => {
  store = {};
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(store, obj))
      }
    }
  };
  _resetOffHint();
});

describe('Hint when LexiFlow is off on a site', () => {
  it('explains how to turn LexiFlow on, once per page', async () => {
    expect(await maybeShowOffHint()).toBe(true);
    const host = document.getElementById('lexiflow-off-hint');
    expect(host?.shadowRoot?.textContent).toContain('LexiFlow is off on this site');
    expect(host?.shadowRoot?.textContent).toContain('LexiFlow icon');
    expect(await maybeShowOffHint()).toBe(false);
  });

  it('stops after a few pages so it never nags', async () => {
    for (let i = 0; i < MAX_HINTS; i++) {
      _resetOffHint();
      expect(await maybeShowOffHint()).toBe(true);
    }
    _resetOffHint();
    expect(await maybeShowOffHint()).toBe(false);
  });

  it('can be closed', async () => {
    await maybeShowOffHint();
    const host = document.getElementById('lexiflow-off-hint')!;
    (host.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(document.getElementById('lexiflow-off-hint')).toBeNull();
  });
});
