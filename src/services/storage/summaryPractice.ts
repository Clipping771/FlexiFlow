/**
 * Summary practice storage, in chrome.storage.local (memory where it is unavailable, e.g. tests).
 *
 * - The draft: the article the reader is about to summarize, captured from the page. Its text is kept
 *   only until another article replaces it, since marking needs it.
 * - Attempts: each marked summary with its review. The article text is not kept with them.
 */
import { SummaryAttempt, SummaryEvaluation } from '../../types';
import { normalizeArticleUrl } from './readingList';

export interface SummaryDraft {
  url: string;
  title: string;
  text: string;
  capturedAt: string;
  /** Unsent summary text, so closing the page does not lose it. */
  summary?: string;
}

export const SUMMARY_DRAFT_KEY = 'lexiflow_summary_draft';
export const SUMMARY_ATTEMPTS_KEY = 'lexiflow_summary_attempts';
const MAX_ATTEMPTS = 300;

const memory: Record<string, unknown> = {};

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

async function read<T>(key: string, fallback: T): Promise<T> {
  if (!hasChromeStorage()) return (key in memory ? (memory[key] as T) : fallback);
  const res = await chrome.storage.local.get(key);
  return (res?.[key] as T) ?? fallback;
}

async function write(key: string, value: unknown): Promise<void> {
  if (!hasChromeStorage()) {
    if (value === undefined) delete memory[key];
    else memory[key] = value;
    return;
  }
  if (value === undefined) await chrome.storage.local.remove(key);
  else await chrome.storage.local.set({ [key]: value });
}

export class SummaryPracticeService {
  static getDraft(): Promise<SummaryDraft | null> {
    return read<SummaryDraft | null>(SUMMARY_DRAFT_KEY, null);
  }

  static async setDraft(article: { url: string; title: string; text: string }): Promise<SummaryDraft> {
    const previous = await this.getDraft();
    const sameArticle = previous && normalizeArticleUrl(previous.url) === normalizeArticleUrl(article.url);
    const draft: SummaryDraft = {
      url: article.url,
      title: article.title,
      text: article.text,
      capturedAt: new Date().toISOString(),
      // Keep what the reader had typed if they reopen the same article
      ...(sameArticle && previous?.summary ? { summary: previous.summary } : {})
    };
    await write(SUMMARY_DRAFT_KEY, draft);
    return draft;
  }

  static async saveDraftSummary(summary: string): Promise<void> {
    const draft = await this.getDraft();
    if (!draft) return;
    await write(SUMMARY_DRAFT_KEY, { ...draft, summary });
  }

  /** Newest first. */
  static async getAttempts(): Promise<SummaryAttempt[]> {
    const list = await read<SummaryAttempt[]>(SUMMARY_ATTEMPTS_KEY, []);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static async getAttemptsForUrl(url: string): Promise<SummaryAttempt[]> {
    const key = normalizeArticleUrl(url);
    if (!key) return [];
    return (await this.getAttempts()).filter((a) => normalizeArticleUrl(a.articleUrl) === key);
  }

  static async addAttempt(input: {
    articleUrl: string;
    articleTitle: string;
    summary: string;
    evaluation: SummaryEvaluation;
  }): Promise<SummaryAttempt> {
    const attempt: SummaryAttempt = {
      id: `sum_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...input
    };
    const list = await this.getAttempts();
    await write(SUMMARY_ATTEMPTS_KEY, [attempt, ...list].slice(0, MAX_ATTEMPTS));

    // The summary is marked, so the unsent copy is no longer needed
    const draft = await this.getDraft();
    if (draft && normalizeArticleUrl(draft.url) === normalizeArticleUrl(input.articleUrl)) {
      await write(SUMMARY_DRAFT_KEY, { ...draft, summary: undefined });
    }
    return attempt;
  }

  static async removeAttempt(id: string): Promise<void> {
    const list = await this.getAttempts();
    await write(SUMMARY_ATTEMPTS_KEY, list.filter((a) => a.id !== id));
  }

  /** Test helper. */
  static _resetMemory(): void {
    for (const key of Object.keys(memory)) delete memory[key];
  }
}
