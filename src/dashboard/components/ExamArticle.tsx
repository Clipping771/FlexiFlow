import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardPaste, FileText, Loader2, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import {
  ExamArticle,
  EXAM_ARTICLE_MIN_WORDS,
  articleKey,
  getExamArticle,
  onExamArticleChange,
  setExamArticle
} from '../../services/examContent/articleSource';
import { countWords } from '../../services/examContent/textTools';
import { getExamItem } from '../../services/examContent/generate';
import type { ExamItem, ExamItemKind } from '../../services/examContent/aiItems';

// One seed for every exam screen, so "New questions" moves them all to a fresh part of the article
let sharedSeed = 0;

/** The article the questions come from, plus a seed that "New questions" changes. */
export function useExamArticle() {
  const [article, setArticle] = useState<ExamArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState(sharedSeed);

  const load = useCallback(() => {
    getExamArticle()
      .then((a) => setArticle(a && countWords(a.text) >= EXAM_ARTICLE_MIN_WORDS ? a : null))
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    return onExamArticleChange(load);
  }, [load]);

  const key = article ? articleKey(article) : '';
  const newQuestions = () => {
    sharedSeed += 1;
    setSeed(sharedSeed);
  };
  const applyPastedText = async (text: string, title: string) => {
    const saved = await setExamArticle({ url: `pasted:${Date.now()}`, title: title || text.split(/\s+/).slice(0, 8).join(' '), text });
    setArticle(saved);
  };

  /** A stable number per article, seed and item, so each item uses its own part of the text. */
  const seedFor = (salt: number) => (parseInt(key || '0', 36) ^ (seed * 7919 + salt * 104729)) >>> 0;

  return { article, loading, key, seed, seedFor, newQuestions, applyPastedText };
}

/** An AI-written item for the current article; null while there is no article. */
export function useExamItem<K extends ExamItemKind>(kind: K | null, source: string | null, cacheKey: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = kind && source ? `${kind}|${cacheKey}|${attempt}|${source.length}` : '';
  // Results are tagged with the request they answer, so a task switch never sees the previous task's item
  const [state, setState] = useState<{ key: string; data: ExamItem<K> | null; error: string | null }>({ key: '', data: null, error: null });

  useEffect(() => {
    if (!kind || !source) return;
    let live = true;
    getExamItem(kind, source, `${cacheKey}:${attempt}`)
      .then((data) => live && setState({ key: requestKey, data, error: null }))
      .catch((err: Error) => live && setState({ key: requestKey, data: null, error: err.message }));
    return () => {
      live = false;
    };
  }, [requestKey]);

  const current = requestKey !== '' && state.key === requestKey;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: requestKey !== '' && !current,
    retry: () => setAttempt((a) => a + 1)
  };
}

/** Where the questions came from, with "New questions" and a way to switch article. */
export const ExamArticleBar: React.FC<{
  article: ExamArticle;
  onNewQuestions: () => void;
  onUsePastedText: (text: string, title: string) => Promise<void>;
}> = ({ article, onNewQuestions, onUsePastedText }) => {
  const [pasting, setPasting] = useState(false);
  const isLink = /^https?:/.test(article.url);

  return (
    <div className="exam-article-bar" data-testid="exam-article-bar">
      <div className="exam-article-bar-main">
        <FileText size={15} />
        <span className="exam-article-label">Questions from</span>
        {isLink ? (
          <a className="exam-article-title" href={article.url} target="_blank" rel="noreferrer" title={article.title}>
            {article.title}
          </a>
        ) : (
          <span className="exam-article-title" title={article.title}>
            {article.title}
          </span>
        )}
      </div>
      <div className="exam-article-bar-actions">
        <button type="button" className="exam-btn-ghost exam-btn-sm" onClick={onNewQuestions} data-testid="btn-new-questions">
          <RefreshCw size={13} /> New questions
        </button>
        <button type="button" className="exam-btn-ghost exam-btn-sm" onClick={() => setPasting((p) => !p)}>
          <ClipboardPaste size={13} /> Paste another
        </button>
      </div>
      {pasting && (
        <PasteArticle
          onUse={async (t, title) => {
            await onUsePastedText(t, title);
            setPasting(false);
          }}
        />
      )}
    </div>
  );
};

export const PasteArticle: React.FC<{ onUse: (text: string, title: string) => Promise<void> }> = ({ onUse }) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const words = countWords(text);
  const enough = words >= EXAM_ARTICLE_MIN_WORDS;

  return (
    <div className="exam-paste">
      <input
        className="exam-input"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <textarea
        className="exam-textarea"
        data-testid="exam-paste-input"
        rows={6}
        placeholder="Paste the article text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="exam-action-row">
        <span className={`exam-meta ${enough ? '' : 'tone-warn'}`}>
          {words} words{enough ? '' : ` · at least ${EXAM_ARTICLE_MIN_WORDS} needed`}
        </span>
        <button type="button" className="exam-btn-primary" disabled={!enough} onClick={() => onUse(text, title)} data-testid="btn-use-pasted">
          Build questions from this
        </button>
      </div>
    </div>
  );
};

/** Shown instead of an exam screen until there is an article to build questions from. */
export const ExamArticleGate: React.FC<{
  loading: boolean;
  onUsePastedText: (text: string, title: string) => Promise<void>;
}> = ({ loading, onUsePastedText }) => {
  if (loading) {
    return (
      <div className="exam-card mock-scoring">
        <Loader2 size={20} className="spin" /> Loading your article…
      </div>
    );
  }
  return (
    <div className="exam-card exam-gate" data-testid="exam-article-gate">
      <h3 className="exam-card-title">
        <FileText size={18} className="tone-blue" /> Practise with the article you're reading
      </h3>
      <ol className="exam-gate-steps">
        <li>Open any English article in Chrome.</li>
        <li>
          Click the LexiFlow icon and press <strong>Smart practice</strong>.
        </li>
        <li>LexiFlow reads it and writes practice that fits the article and you.</li>
      </ol>
      <p className="exam-desc">Or paste an article below.</p>
      <PasteArticle onUse={onUsePastedText} />
    </div>
  );
};

/** Loading / failure state for an AI-written item. */
export const ExamItemStatus: React.FC<{
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSettings?: () => void;
}> = ({ loading, error, onRetry, onOpenSettings }) => {
  if (loading) {
    return (
      <div className="exam-card mock-scoring" data-testid="exam-item-loading">
        <Loader2 size={20} className="spin" /> Writing questions from your article…
      </div>
    );
  }
  if (!error) return null;
  return (
    <div className="exam-card exam-item-error" data-testid="exam-item-error">
      <div className="exam-inline-error">
        <AlertTriangle size={15} /> {error}
      </div>
      <div className="exam-studio-actions">
        <button type="button" className="exam-btn-secondary" onClick={onRetry}>
          <RefreshCw size={14} /> Try again
        </button>
        {onOpenSettings && /provider|Settings/i.test(error) && (
          <button type="button" className="exam-btn-ghost" onClick={onOpenSettings}>
            <SettingsIcon size={14} /> Open AI settings
          </button>
        )}
      </div>
    </div>
  );
};
