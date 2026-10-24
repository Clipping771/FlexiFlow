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
