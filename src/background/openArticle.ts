import { normalizeArticleUrl } from '../services/storage/readingList';

/**
 * Opens a saved article in a new tab and, when asked, runs Scan & Highlight once the page has loaded.
 * The content script starts at document_idle, a little after the tab reports "complete", so the
 * highlight request is retried briefly until it answers.
 */
export async function openSavedArticle(url: string, highlight: boolean): Promise<void> {
  if (!normalizeArticleUrl(url)) throw new Error('Only web pages (http/https) can be opened.');

  const tab = await chrome.tabs.create({ url });
  if (!highlight || tab.id === undefined) return;
  const tabId = tab.id;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(done, 60000);
    function done() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      resolve();
    }
    function onUpdated(id: number, info: { status?: string }) {
      if (id !== tabId || info.status !== 'complete') return;
      done();
      requestHighlight(tabId, 0);
    }
    function onRemoved(id: number) {
      if (id === tabId) done();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

function requestHighlight(tabId: number, attempt: number): void {
  chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_HIGHLIGHT_ARTICLE' }, () => {
    if (chrome.runtime.lastError && attempt < 5) {
      setTimeout(() => requestHighlight(tabId, attempt + 1), 800);
    }
  });
}

/**
 * Loads a saved article in a background tab just long enough to read its main text (for summary
 * practice from the Reading List), then closes the tab.
 */
export async function captureArticleText(url: string): Promise<{ url: string; title: string; text: string }> {
  if (!normalizeArticleUrl(url)) throw new Error('Only web pages (http/https) can be opened.');

  const tab = await chrome.tabs.create({ url, active: false });
  if (tab.id === undefined) throw new Error('Could not open the article.');
  const tabId = tab.id;

  try {
    await waitForLoad(tabId, 30000);
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_ARTICLE_TEXT' }, (r) => resolve(chrome.runtime.lastError ? null : r));
      });
      if (res?.success && res.data?.text) return { url, title: res.data.title || url, text: res.data.text };
      await new Promise((r) => setTimeout(r, 800));
    }
    throw new Error('Could not read the article text from this page. Open it and use "Write a summary" from the popup instead.');
  } finally {
    chrome.tabs.remove(tabId).catch(() => {});
  }
}

function waitForLoad(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('The article took too long to load.'));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
    function onUpdated(id: number, info: { status?: string }) {
      if (id === tabId && info.status === 'complete') {
        cleanup();
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

