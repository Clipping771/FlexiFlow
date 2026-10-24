import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, CheckCircle2, Circle, ExternalLink, Loader2, PenLine, Sparkles, Trash2 } from 'lucide-react';
import { SummaryAttempt, VocabularyItem } from '../../types';
import { SummaryPracticeService } from '../../services/storage/summaryPractice';
import {
  ReadingListService,
  ReadingListItem,
  READING_LIST_KEY,
  normalizeArticleUrl
} from '../../services/storage/readingList';

interface ReadingListViewProps {
  /** The vocabulary library, used to show which words were saved from each article. */
  vocabItems: VocabularyItem[];
  /** Switches to Summary Practice once the article's text is captured. */
  onWriteSummary?: () => void;
}

type Filter = 'unread' | 'read' | 'all';

const WORDS_PER_MINUTE = 200;

function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Saved yesterday';
  if (days < 7) return `Saved ${days} days ago`;
  return `Saved ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function openArticle(url: string, highlight: boolean): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'OPEN_SAVED_ARTICLE', payload: { url, highlight } }, () => {
      if (chrome.runtime?.lastError) window.open(url, '_blank', 'noopener');
    });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

/** Articles saved from the popup with "Save for later". */
export const ReadingListView: React.FC<ReadingListViewProps> = ({ vocabItems, onWriteSummary }) => {
  const [list, setList] = useState<ReadingListItem[]>([]);
  const [attempts, setAttempts] = useState<SummaryAttempt[]>([]);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('unread');

  const reload = async () => {
    try {
      const [items, marked] = await Promise.all([ReadingListService.getAll(), SummaryPracticeService.getAttempts()]);
      setList(items);
      setAttempts(marked);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    reload();
    // Stay in sync with saves made from the popup while the dashboard is open
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && READING_LIST_KEY in changes) reload();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const wordsByArticle = useMemo(() => {
    const map = new Map<string, VocabularyItem[]>();
    for (const item of vocabItems) {
      const key = item.pageUrl ? normalizeArticleUrl(item.pageUrl) : '';
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }, [vocabItems]);

  const unreadCount = list.filter((i) => !i.readAt).length;
  const shown = list.filter((i) => (filter === 'all' ? true : filter === 'read' ? Boolean(i.readAt) : !i.readAt));

  const toggleRead = async (item: ReadingListItem) => {
    await ReadingListService.setRead(item.id, !item.readAt);
    await reload();
  };

  const writeSummary = async (item: ReadingListItem) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    setCapturingId(item.id);
    setCaptureError(null);
    // The list keeps only links, so the article is loaded briefly in the background to read its text
    chrome.runtime.sendMessage({ type: 'CAPTURE_ARTICLE_TEXT', payload: { url: item.url } }, async (res) => {
      setCapturingId(null);
      if (chrome.runtime?.lastError || !res?.success || !res.data?.text) {
        setCaptureError(res?.error || 'Could not read this article. Open it and use "Write a summary" from the popup.');
        return;
      }
      await SummaryPracticeService.setDraft({ url: item.url, title: item.title, text: res.data.text });
      onWriteSummary?.();
    });
  };

  const remove = async (item: ReadingListItem) => {
    if (!confirm(`Remove "${item.title}" from your reading list?`)) return;
    await ReadingListService.remove(item.id);
    await reload();
  };

  return (
    <div className="reading-list-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Reading List</h2>
          <p className="view-desc">
            Articles you saved to read later. Open one to keep reading, or open it with Scan &amp; Highlight to
            mark its key words straight away.
          </p>
        </div>
        <select
          className="select-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter articles"
        >
          <option value="unread">To read ({unreadCount})</option>
          <option value="read">Finished ({list.length - unreadCount})</option>
          <option value="all">All ({list.length})</option>
        </select>
      </div>

      {captureError && (
        <div className="card rl-error" role="alert">
          {captureError}
        </div>
      )}

      {loaded && shown.length === 0 ? (
        <div className="card rl-empty">
          <BookmarkPlus size={28} />
          <h3>{list.length === 0 ? 'No saved articles yet' : filter === 'read' ? 'Nothing finished yet' : 'All caught up'}</h3>
          <p>
            {list.length === 0
              ? 'On any article, open the LexiFlow popup and press "Save for later". It will show up here.'
              : 'Change the filter above to see your other articles.'}
          </p>
        </div>
      ) : (
        <div className="rl-list">
          {shown.map((item) => {
            const words = wordsByArticle.get(normalizeArticleUrl(item.url)) || [];
            const minutes = item.wordCount ? Math.max(1, Math.round(item.wordCount / WORDS_PER_MINUTE)) : 0;
            const lastMark = attempts.find((a) => normalizeArticleUrl(a.articleUrl) === normalizeArticleUrl(item.url));
            return (
              <article key={item.id} className={`card rl-card ${item.readAt ? 'is-read' : ''}`}>
                <div className="rl-main">
                  <a
                    className="rl-title"
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      openArticle(item.url, false);
                    }}
                  >
                    {item.title}
                  </a>
                  <div className="rl-meta">
                    <span>{item.domain}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatSavedDate(item.savedAt)}</span>
                    {minutes > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{minutes} min read</span>
                      </>
                    )}
                    {item.readAt && <span className="tag-badge rl-done">Finished</span>}
                    {lastMark && <span className="tag-badge rl-mark">Summary {lastMark.evaluation.totalScore}/10</span>}
                  </div>

                  {words.length > 0 && (
                    <div className="rl-words">
                      <span className="rl-words-label">
                        {words.length} word{words.length === 1 ? '' : 's'} saved from this article:
                      </span>
                      {words.slice(0, 8).map((w) => (
                        <span key={w.id} className="tag-badge" title={w.meaning}>
                          {w.word}
                        </span>
                      ))}
                      {words.length > 8 && <span className="rl-more">+{words.length - 8} more</span>}
                    </div>
                  )}
                </div>

                <div className="rl-actions">
                  <button type="button" className="btn-primary" onClick={() => openArticle(item.url, true)}>
                    <Sparkles size={14} />
                    <span>Open &amp; highlight</span>
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => openArticle(item.url, false)}>
                    <ExternalLink size={14} />
                    <span>Open</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => writeSummary(item)}
                    disabled={capturingId !== null}
                  >
                    {capturingId === item.id ? <Loader2 size={14} className="sp-spin" /> : <PenLine size={14} />}
                    <span>{capturingId === item.id ? 'Loading article…' : 'Write summary'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => toggleRead(item)}
                    aria-pressed={Boolean(item.readAt)}
                  >
                    {item.readAt ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{item.readAt ? 'Mark unread' : 'Mark finished'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary rl-remove"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.title}`}
                    title="Remove from reading list"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
