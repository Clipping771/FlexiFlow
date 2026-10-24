/**
 * Read Later list: articles the reader saved to come back to.
 *
 * Only the link and a little metadata are kept (never the article text), in chrome.storage.local
 * so the popup, dashboard and background all see the same list. Falls back to memory where
 * chrome.storage is unavailable (tests, plain web previews).
 */

export interface ReadingListItem {
  id: string;
  url: string;
  title: string;
  domain: string;
  savedAt: string;
  /** Approximate article length, when the page reported one. */
  wordCount?: number;
  readAt?: string;
}

export const READING_LIST_KEY = 'lexiflow_reading_list';
/** Oldest entries are dropped past this so the list cannot grow without bound. */
const MAX_ITEMS = 500;

/** Query parameters that only track the click and never change the article. */
const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|igshid|ref|ref_src|cmpid|ocid)$/i;

/**
 * Canonical form of a page URL for matching: no fragment, no tracking parameters, no "www.",
 * no trailing slash. Returns '' for anything that is not an http(s) URL.
 */
export function normalizeArticleUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out.replace(/\/\?/, '?');
  } catch {
    return '';
  }
}

let memoryList: ReadingListItem[] = [];

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function readList(): Promise<ReadingListItem[]> {
  if (!hasChromeStorage()) return [...memoryList];
  const res = await chrome.storage.local.get(READING_LIST_KEY);
  const list = res?.[READING_LIST_KEY];
  return Array.isArray(list) ? list : [];
}

async function writeList(list: ReadingListItem[]): Promise<void> {
  if (!hasChromeStorage()) {
    memoryList = [...list];
    return;
  }
  await chrome.storage.local.set({ [READING_LIST_KEY]: list });
}

export class ReadingListService {
  /** Newest first. */
  static async getAll(): Promise<ReadingListItem[]> {
    const list = await readList();
    return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  static async findByUrl(url: string): Promise<ReadingListItem | null> {
    const key = normalizeArticleUrl(url);
    if (!key) return null;
    const list = await readList();
    return list.find((item) => normalizeArticleUrl(item.url) === key) || null;
  }

  /** Saves the article, or refreshes its title/length if it is already on the list. */
  static async save(input: { url: string; title?: string; wordCount?: number }): Promise<ReadingListItem> {
    const key = normalizeArticleUrl(input.url);
    if (!key) throw new Error('Only web pages (http/https) can be saved for later.');

    const list = await readList();
    const existing = list.find((item) => normalizeArticleUrl(item.url) === key);
    const title = (input.title || '').trim();

    if (existing) {
      if (title) existing.title = title;
      if (input.wordCount) existing.wordCount = input.wordCount;
      await writeList(list);
      return existing;
    }

    const domain = new URL(key).hostname;
    const item: ReadingListItem = {
      id: `rl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: input.url,
      title: title || domain,
      domain,
      savedAt: new Date().toISOString(),
      ...(input.wordCount ? { wordCount: input.wordCount } : {})
    };

    const next = [item, ...list]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_ITEMS);
    await writeList(next);
    return item;
  }

  static async setRead(id: string, read: boolean): Promise<void> {
    const list = await readList();
    const item = list.find((i) => i.id === id);
    if (!item) return;
    if (read) item.readAt = new Date().toISOString();
    else delete item.readAt;
    await writeList(list);
  }

  static async remove(id: string): Promise<void> {
    const list = await readList();
    await writeList(list.filter((i) => i.id !== id));
  }

  /** Test helper. */
  static _resetMemory(): void {
    memoryList = [];
  }
}
