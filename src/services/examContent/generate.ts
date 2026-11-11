/**
 * Client side of AI-written exam items: asks the background worker (which owns the API key) and
 * remembers the result per article, item and seed so switching tabs does not cost another call.
 */
import type { ExamItem, ExamItemKind } from './aiItems';

const cache = new Map<string, Promise<unknown>>();

export function requestExamItem<K extends ExamItemKind>(kind: K, source: string, answer?: string): Promise<ExamItem<K>> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('Writing questions with AI only works inside the LexiFlow extension.'));
      return;
    }
    chrome.runtime.sendMessage({ type: 'EXAM_GENERATE', payload: { kind, source, answer } }, (res) => {
      if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message || 'Could not reach LexiFlow.'));
      else if (res?.success && res.data) resolve(res.data as ExamItem<K>);
      else reject(new Error(res?.error || 'Could not write questions. Please try again.'));
    });
  });
}

/**
 * Cached by `cacheKey` (article + seed); a failed request is forgotten so it can be retried.
 * `context` (e.g. the Smart Practice learner brief) goes to the prompt but not the cache key.
 */
export function getExamItem<K extends ExamItemKind>(kind: K, source: string, cacheKey: string, context?: string): Promise<ExamItem<K>> {
  const key = `${kind}:${cacheKey}:${source.length}:${source.slice(0, 80)}`;
  let pending = cache.get(key) as Promise<ExamItem<K>> | undefined;
  if (!pending) {
    pending = requestExamItem(kind, source, context);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

export function _clearExamItemCache(): void {
  cache.clear();
}
