/**
 * A small, one-time hint shown when the reader selects text on a site where LexiFlow is off
 * (it is off on every site until the reader turns it on). Shown at most MAX_HINTS times in total,
 * once per page, top frame only, and it disappears by itself.
 * Lives in its own shadow root so page styles cannot change it.
 */

const COUNT_KEY = 'lexiflow_off_hint_count';
export const MAX_HINTS = 3;
const VISIBLE_MS = 6000;

let shownOnThisPage = false;

async function readCount(): Promise<number> {
  try {
    const res = await chrome.storage.local.get(COUNT_KEY);
    return Number(res?.[COUNT_KEY]) || 0;
  } catch {
    return MAX_HINTS; // storage unavailable: stay quiet
  }
}

export async function maybeShowOffHint(): Promise<boolean> {
  if (shownOnThisPage || typeof document === 'undefined' || window !== window.top) return false;
  shownOnThisPage = true;
  const count = await readCount();
  if (count >= MAX_HINTS) return false;
  try {
    await chrome.storage.local.set({ [COUNT_KEY]: count + 1 });
  } catch {
    /* still show this once */
  }

  const host = document.createElement('div');
  host.id = 'lexiflow-off-hint';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .hint {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        display: flex; align-items: flex-start; gap: 10px; max-width: 320px;
        padding: 12px 14px; border-radius: 12px;
        background: #ffffff; color: #15171c;
        box-shadow: 0 0 0 1px rgba(15, 17, 26, 0.08), 0 12px 32px -8px rgba(15, 17, 26, 0.3);
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: in 0.2s ease-out;
      }
      .logo {
        flex: none; width: 22px; height: 22px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        background: #1e3a8a; color: #ffffff; font-weight: 700; font-size: 12px;
      }
      strong { display: block; font-weight: 600; margin-bottom: 2px; }
      span.text { color: #4b5060; }
      button {
        flex: none; margin-left: 4px; border: none; background: none; cursor: pointer;
        color: #6b7080; font-size: 16px; line-height: 1; padding: 0 2px;
      }
      @keyframes in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    </style>
    <div class="hint" role="status">
      <div class="logo">L</div>
      <div>
        <strong>LexiFlow is off on this site</strong>
        <span class="text">Click the LexiFlow icon in your toolbar and switch it on to see meanings here.</span>
      </div>
      <button type="button" aria-label="Close">×</button>
    </div>`;
  const remove = () => host.remove();
  root.querySelector('button')?.addEventListener('click', remove);
  document.documentElement.appendChild(host);
  setTimeout(remove, VISIBLE_MS);
  return true;
}

export function _resetOffHint(): void {
  shownOnThisPage = false;
  document.getElementById('lexiflow-off-hint')?.remove();
}
