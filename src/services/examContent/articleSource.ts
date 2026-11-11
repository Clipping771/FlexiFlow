/**
 * The article the exam screens build their questions from. The popup's "Smart practice" button (or a
 * pasted text) sets it; until then the article last sent to Summary Practice is used.
 * Kept in chrome.storage.local (memory where it is unavailable, e.g. tests).
 */
import { SUMMARY_DRAFT_KEY, SummaryDraft } from '../storage/summaryPractice';
import { hashText } from './textTools';
import { cleanArticleText } from './articleClean';

/** Older saves held the raw page text; clean it on the way out too. */
const cleaned = (a: ExamArticle): ExamArticle => ({ ...a, text: cleanArticleText(a.text, a.title) });

export interface ExamArticle {
  url: string;
  title: string;
  text: string;
  capturedAt: string;
}

export const EXAM_ARTICLE_KEY = 'lexiflow_exam_article';
/** Fewer words than this cannot fill a set of exam questions. */
export const EXAM_ARTICLE_MIN_WORDS = 150;
/** Long pages are cut here; the questions only need a few paragraphs. */
const MAX_CHARS = 30000;

let memory: ExamArticle | null = null;

const hasChromeStorage = () => typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);

export function articleKey(article: ExamArticle): string {
  return hashText(`${article.url}\n${article.text.slice(0, 2000)}`).toString(36);
}

export async function getExamArticle(): Promise<ExamArticle | null> {
  if (!hasChromeStorage()) return memory && cleaned(memory);
  const res = await chrome.storage.local.get([EXAM_ARTICLE_KEY, SUMMARY_DRAFT_KEY]);
  const exam = res?.[EXAM_ARTICLE_KEY] as ExamArticle | undefined;
  const draft = res?.[SUMMARY_DRAFT_KEY] as SummaryDraft | undefined;
  if (exam && (!draft || exam.capturedAt >= draft.capturedAt)) return cleaned(exam);
  if (draft) return cleaned({ url: draft.url, title: draft.title, text: draft.text, capturedAt: draft.capturedAt });
  return exam ? cleaned(exam) : null;
}

export async function setExamArticle(article: { url: string; title: string; text: string }): Promise<ExamArticle> {
  const saved: ExamArticle = {
    url: article.url,
    title: article.title.trim() || 'Article',
    text: cleanArticleText(article.text, article.title).slice(0, MAX_CHARS),
    capturedAt: new Date().toISOString()
  };
  if (hasChromeStorage()) await chrome.storage.local.set({ [EXAM_ARTICLE_KEY]: saved });
  else memory = saved;
  return saved;
}

/** Calls back whenever the popup (or another tab) changes the article. */
export function onExamArticleChange(callback: () => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {};
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && (EXAM_ARTICLE_KEY in changes || SUMMARY_DRAFT_KEY in changes)) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function _resetExamArticle(): void {
  memory = null;
}
