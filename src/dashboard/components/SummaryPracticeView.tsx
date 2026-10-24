import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, PenLine, Trash2 } from 'lucide-react';
import { SummaryAttempt, SummaryEvaluation } from '../../types';
import { SummaryPracticeService, SummaryDraft, SUMMARY_DRAFT_KEY, SUMMARY_ATTEMPTS_KEY } from '../../services/storage/summaryPractice';
import { normalizeArticleUrl } from '../../services/storage/readingList';
import { SUMMARY_MAX_CHARS } from '../../services/ai/prompts/summary';

const MIN_WORDS = 15;

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function scoreTone(score: number, max: number): 'good' | 'ok' | 'low' {
  const ratio = max > 0 ? score / max : 0;
  return ratio >= 0.75 ? 'good' : ratio >= 0.5 ? 'ok' : 'low';
}

function requestMarking(draft: SummaryDraft, summary: string): Promise<SummaryEvaluation> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      reject(new Error('Marking only works inside the LexiFlow extension.'));
      return;
    }
    chrome.runtime.sendMessage(
      { type: 'EVALUATE_SUMMARY', payload: { articleText: draft.text, articleTitle: draft.title, summary } },
      (res) => {
        if (chrome.runtime?.lastError) reject(new Error(chrome.runtime.lastError.message || 'Could not reach LexiFlow.'));
        else if (res?.success && res.data) resolve(res.data);
        else reject(new Error(res?.error || 'Marking failed. Please try again.'));
      }
    );
  });
}

/** The marked result: score, per-criterion marks and the written review. */
const EvaluationReport: React.FC<{ attempt: SummaryAttempt; previous?: SummaryAttempt }> = ({ attempt, previous }) => {
  const e = attempt.evaluation;
  const [showModel, setShowModel] = useState(false);
  const change = previous ? e.totalScore - previous.evaluation.totalScore : null;

  return (
    <div className="sp-report">
      <div className="card sp-score-card">
        <div className={`sp-score sp-tone-${scoreTone(e.totalScore, 10)}`}>
          <span className="sp-score-num">{e.totalScore}</span>
          <span className="sp-score-max">/ 10</span>
        </div>
        <div className="sp-score-text">
          <p>{e.overallFeedback}</p>
          {change !== null && (
            <span className={`tag-badge sp-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
              {change > 0 ? `+${change}` : change} since your last try ({previous!.evaluation.totalScore}/10)
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="sp-section-title">Marks</h3>
        <div className="sp-criteria">
          {e.criteria.map((c) => (
            <div key={c.id} className="sp-criterion">
              <div className="sp-criterion-head">
                <span>{c.label}</span>
                <strong>
                  {c.score} / {c.maxScore}
                </strong>
              </div>
              <div className="sp-bar" role="presentation">
                <div className={`sp-bar-fill sp-tone-${scoreTone(c.score, c.maxScore)}`} style={{ width: `${(c.score / c.maxScore) * 100}%` }} />
              </div>
              {c.comment && <p className="sp-criterion-comment">{c.comment}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="sp-review-grid">
        {e.strengths.length > 0 && (
          <div className="card sp-list sp-list-good">
            <h3 className="sp-section-title">What you did well</h3>
            <ul>{e.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {e.missedPoints.length > 0 && (
          <div className="card sp-list sp-list-missed">
            <h3 className="sp-section-title">Points you missed</h3>
            <ul>{e.missedPoints.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
        {e.misunderstandings.length > 0 && (
          <div className="card sp-list sp-list-wrong">
            <h3 className="sp-section-title">Misunderstandings</h3>
            <ul>{e.misunderstandings.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}
      </div>

      {e.languageFeedback && (
        <div className="card">
          <h3 className="sp-section-title">English review (not part of the score)</h3>
          {e.languageFeedback.comment && <p className="sp-muted">{e.languageFeedback.comment}</p>}
          {e.languageFeedback.corrections.length > 0 && (
            <ul className="sp-corrections">
              {e.languageFeedback.corrections.map((c, i) => (
                <li key={i}>
                  <span className="sp-wrong">{c.original}</span>
                  <span aria-hidden="true">→</span>
                  <span className="sp-right">{c.corrected}</span>
                  {c.explanation && <span className="sp-muted"> — {c.explanation}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <button type="button" className="sp-toggle" onClick={() => setShowModel(!showModel)} aria-expanded={showModel}>
          {showModel ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <span>{showModel ? 'Hide' : 'Show'} a model summary</span>
        </button>
        {showModel && <p className="sp-model">{e.modelSummary}</p>}
      </div>

      <div className="card">
        <h3 className="sp-section-title">Your summary</h3>
        <p className="sp-your-summary">{attempt.summary}</p>
      </div>
    </div>
  );
};

/** Summary practice: summarize an article you read and get it marked out of 10 with a review. */
export const SummaryPracticeView: React.FC = () => {
  const [draft, setDraft] = useState<SummaryDraft | null>(null);
  const [attempts, setAttempts] = useState<SummaryAttempt[]>([]);
  const [summary, setSummary] = useState('');
  const [showArticle, setShowArticle] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SummaryAttempt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = async (resetText: boolean) => {
    const [d, a] = await Promise.all([SummaryPracticeService.getDraft(), SummaryPracticeService.getAttempts()]);
    setDraft(d);
    setAttempts(a);
    if (resetText) setSummary(d?.summary || '');
    setLoaded(true);
  };

  useEffect(() => {
    reload(true);
    // A new article captured from the popup or the Reading List while this page is open
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const onChanged = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => {
      if (area !== 'local') return;
      const d = changes[SUMMARY_DRAFT_KEY];
      const capturedAt = (v: unknown) => (v as SummaryDraft | undefined)?.capturedAt;
      if (d && capturedAt(d.newValue) !== capturedAt(d.oldValue)) {
        setViewing(null);
        reload(true);
      } else if (SUMMARY_ATTEMPTS_KEY in changes) {
        reload(false);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const onType = (text: string) => {
    setSummary(text);
    setError(null);
    // Keep the unsent text so closing the page does not lose it
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => SummaryPracticeService.saveDraftSummary(text), 600);
  };

  const articleAttempts = useMemo(
    () => (draft ? attempts.filter((a) => normalizeArticleUrl(a.articleUrl) === normalizeArticleUrl(draft.url)) : []),
    [attempts, draft]
  );

  const words = countWords(summary);
  const tooLong = summary.length > SUMMARY_MAX_CHARS;
  const canSubmit = Boolean(draft) && words >= MIN_WORDS && !tooLong && !marking;

  const submit = async () => {
    if (!draft || !canSubmit) return;
    setMarking(true);
    setError(null);
    try {
      const evaluation = await requestMarking(draft, summary.trim());
      const attempt = await SummaryPracticeService.addAttempt({
        articleUrl: draft.url,
        articleTitle: draft.title,
        summary: summary.trim(),
        evaluation
      });
      setSummary('');
      await reload(false);
      setViewing(attempt);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMarking(false);
    }
  };

  const removeAttempt = async (attempt: SummaryAttempt) => {
    if (!confirm('Delete this marked summary?')) return;
    await SummaryPracticeService.removeAttempt(attempt.id);
    if (viewing?.id === attempt.id) setViewing(null);
    await reload(false);
  };

  if (viewing) {
    const sameArticle = attempts.filter((a) => normalizeArticleUrl(a.articleUrl) === normalizeArticleUrl(viewing.articleUrl));
    const previous = sameArticle.find((a) => a.createdAt < viewing.createdAt);
    return (
      <div className="summary-practice-view">
        <div className="view-header">
          <div>
            <button type="button" className="sp-back" onClick={() => setViewing(null)}>
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <h2 className="view-title">{viewing.articleTitle}</h2>
            <p className="view-desc">Marked on {formatDate(viewing.createdAt)}</p>
          </div>
        </div>
        <EvaluationReport attempt={viewing} previous={previous} />
      </div>
    );
  }

  return (
    <div className="summary-practice-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Summary Practice</h2>
          <p className="view-desc">
            Finished an article? Summarize it in your own words, in English or your own language, and get it
            marked out of 10 for how well you understood it.
          </p>
        </div>
      </div>

      {loaded && !draft && (
        <div className="card sp-empty">
          <PenLine size={28} />
          <h3>Pick an article to summarize</h3>
          <p>
            On any article, open the LexiFlow popup and press "Write a summary", or use "Write summary" on an article
            in your Reading List.
          </p>
        </div>
      )}

      {draft && (
        <div className="card sp-editor">
          <div className="sp-article-head">
            <FileText size={16} />
            <a href={draft.url} target="_blank" rel="noopener noreferrer" className="sp-article-title">
              {draft.title}
            </a>
            <span className="sp-muted">{countWords(draft.text)} words</span>
          </div>

          <button type="button" className="sp-toggle" onClick={() => setShowArticle(!showArticle)} aria-expanded={showArticle}>
            {showArticle ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span>{showArticle ? 'Hide the article' : 'Show the article'}</span>
            {!showArticle && <span className="sp-muted"> (try writing from memory first)</span>}
          </button>
          {showArticle && <div className="sp-article-text">{draft.text}</div>}

          <label className="sp-label" htmlFor="sp-summary">
            Your summary
          </label>
          <textarea
            id="sp-summary"
            className="sp-textarea"
            value={summary}
            onChange={(e) => onType(e.target.value)}
            placeholder="What is the article's main point, and what are its most important supporting points? 3-6 sentences is plenty."
            disabled={marking}
            rows={8}
          />
          <div className="sp-editor-foot">
            <span className={`sp-muted ${tooLong ? 'sp-error-text' : ''}`}>
              {words} words
              {words < MIN_WORDS ? ` (at least ${MIN_WORDS})` : ''}
              {tooLong ? ` · over the ${SUMMARY_MAX_CHARS}-character limit` : ''}
            </span>
            <button type="button" className="btn-primary" onClick={submit} disabled={!canSubmit}>
              {marking ? <Loader2 size={14} className="sp-spin" /> : <CheckCircle2 size={14} />}
              <span>{marking ? 'Marking…' : 'Mark my summary'}</span>
            </button>
          </div>
          {error && (
            <div className="sp-error" role="alert">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {articleAttempts.length > 0 && (
            <p className="sp-muted sp-prev-line">
              Your previous tries on this article: {articleAttempts.map((a) => `${a.evaluation.totalScore}/10`).join(', ')}
            </p>
          )}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="card">
          <h3 className="sp-section-title">Your marked summaries</h3>
          <ul className="sp-history">
            {attempts.map((a) => (
              <li key={a.id}>
                <button type="button" className="sp-history-item" onClick={() => setViewing(a)}>
                  <span className={`sp-history-score sp-tone-${scoreTone(a.evaluation.totalScore, 10)}`}>
                    {a.evaluation.totalScore}/10
                  </span>
                  <span className="sp-history-title">{a.articleTitle}</span>
                  <span className="sp-muted">{formatDate(a.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className="sp-history-delete"
                  onClick={() => removeAttempt(a)}
                  aria-label={`Delete the summary of ${a.articleTitle}`}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
