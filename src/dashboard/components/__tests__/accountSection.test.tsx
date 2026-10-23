import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountSection } from '../AccountSection';

const account = {
  user: { id: 'usr_1', email: 'reader@example.com', name: 'Test Reader' },
  plan: 'free',
  planExpiresAt: null,
  usage: { used: 12, limit: 30, resetAt: '2026-10-24T00:00:00+06:00' }
};

let container: HTMLDivElement;
let responses: Record<string, any>;
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  responses = {};
  sendMessage = vi.fn((msg: { type: string }, cb: (res: any) => void) => cb(responses[msg.type]));
  (globalThis as any).chrome = { runtime: { sendMessage } };
});

afterEach(() => {
  container.remove();
  delete (globalThis as any).chrome;
});

async function render() {
  await act(async () => {
    createRoot(container).render(<AccountSection />);
  });
}

function button(label: string) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
}

async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}

describe('AccountSection', () => {
  it('offers Google sign-in when signed out', async () => {
    responses.GET_ACCOUNT = { success: true, data: null };
    await render();
    expect(button('Sign in with Google')).toBeTruthy();
    expect(container.textContent).not.toContain('credits used today');
  });

  it('shows the account, plan and usage when signed in', async () => {
    responses.GET_ACCOUNT = { success: true, data: account };
    await render();
    expect(container.textContent).toContain('Test Reader');
    expect(container.textContent).toContain('reader@example.com');
    expect(container.textContent).toContain('Free');
    expect(container.textContent).toContain('12 / 30 credits used today');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('12');
  });

  it('signs in and then shows the account', async () => {
    responses.GET_ACCOUNT = { success: true, data: null };
    responses.AUTH_LOGIN = { success: true, data: account };
    await render();
    await click('Sign in with Google');
    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_LOGIN' }, expect.any(Function));
    expect(container.textContent).toContain('12 / 30 credits used today');
  });

  it('stays quiet when the user cancels sign-in, but reports real failures', async () => {
    responses.GET_ACCOUNT = { success: true, data: null };
    responses.AUTH_LOGIN = { success: false, code: 'CANCELLED', error: 'Sign-in was cancelled.' };
    await render();
    await click('Sign in with Google');
    expect(container.querySelector('[role="alert"]')).toBeNull();

    responses.AUTH_LOGIN = { success: false, code: 'RATE_LIMITED', error: 'Too many new accounts from this network today.' };
    await click('Sign in with Google');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Too many new accounts');
  });

  it('signs out', async () => {
    responses.GET_ACCOUNT = { success: true, data: account };
    responses.AUTH_LOGOUT = { success: true };
    await render();
    await click('Sign out');
    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_LOGOUT' }, expect.any(Function));
    expect(button('Sign in with Google')).toBeTruthy();
  });
});
