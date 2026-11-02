import React from 'react';
import { AlertTriangle, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import { isPlaceholderScore } from '../../services/ai/examCaller';

/** The fields every writing and speaking evaluator result shares. */
export interface ExamEvaluation {
  overallScore: string;
  scoreLabel: string;
  traitScores: object;
  feedbackMarkdown: string;
  errorCodes: string[];
  rubricVersion: string;
  modelUsed: string;
  wordCount?: number;
}

interface ExamResultCardProps {
  evaluation: ExamEvaluation;
  scale: 'pte' | 'ielts';
  /** Why the AI mark could not be produced (only shown when the score is a placeholder). */
  aiError?: string | null;
  note?: string;
  testIdPrefix?: string;
  onNavigateToMistake?: (errorCode: string) => void;
  onOpenSettings?: () => void;
}

const humanise = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** Renders the evaluator's markdown-ish feedback: "### " headings, "**bold**" and "- " bullets. */
const FeedbackText: React.FC<{ text: string }> = ({ text }) => {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`ul${blocks.length}`}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (line.startsWith('- ')) return void bullets.push(line.slice(2));
    flush();
    if (!line) return;
    if (line.startsWith('#')) blocks.push(<h5 key={blocks.length}>{inline(line.replace(/^#+\s*/, ''))}</h5>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  });
  flush();
  return <div className="exam-feedback">{blocks}</div>;
};

export const ExamResultCard: React.FC<ExamResultCardProps> = ({
  evaluation,
  scale,
  aiError,
  note,
  testIdPrefix = '',
  onNavigateToMistake,
  onOpenSettings
}) => {
  const placeholder = isPlaceholderScore(evaluation.modelUsed);

  if (placeholder) {
    return (
      <div data-testid={`${testIdPrefix}evaluation-results-card`} className="exam-score-panel exam-no-score">
        <div className="exam-no-score-head">
          <AlertTriangle size={18} />
          <strong>No score this time</strong>
        </div>
        <p>
          Your answer passed the format checks
          {evaluation.wordCount ? ` (${evaluation.wordCount} words)` : ''}, but marking the content needs an AI model, and it
          could not be reached. LexiFlow won't show a made-up score.
        </p>
        {aiError && <p className="exam-no-score-reason">{aiError}</p>}
        {onOpenSettings && (
          <button type="button" className="exam-btn-secondary" onClick={onOpenSettings}>
            <SettingsIcon size={14} /> Open AI settings
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid={`${testIdPrefix}evaluation-results-card`} className="exam-score-panel">
      <div className="exam-score-hero">
        <div className="exam-score-tile">
          <span data-testid={`${testIdPrefix}overall-score-display`}>{evaluation.overallScore}</span>
        </div>
        <div className="exam-score-meta">
          <div className="exam-score-title-row">
            <span className="exam-score-title">
              {scale === 'ielts' ? `Band ${evaluation.overallScore}` : `${evaluation.overallScore} / 90`}
            </span>
            <span data-testid={`${testIdPrefix}estimate-disclosure-badge`} className="exam-pill exam-pill-estimate">
              {evaluation.scoreLabel}
            </span>
          </div>
          <span className="exam-score-sub">
            {evaluation.wordCount !== undefined ? `${evaluation.wordCount} words · ` : ''}
            {evaluation.modelUsed.startsWith('deterministic') ? 'Rule-based check' : `Marked by ${evaluation.modelUsed}`}
          </span>
        </div>
      </div>

      <div className="exam-trait-grid">
        {Object.entries(evaluation.traitScores).map(([trait, score]) => (
          <div key={trait} className="exam-trait">
            <span className="exam-trait-name">{humanise(trait)}</span>
            <span className="exam-trait-val">{String(score)}</span>
          </div>
        ))}
      </div>

      <FeedbackText text={evaluation.feedbackMarkdown} />

      {note && <p className="exam-result-note">{note}</p>}

      {evaluation.errorCodes.length > 0 && (
        <div className="exam-error-row">
          <span className="exam-error-label">
            <ShieldAlert size={14} /> Mistakes to drill:
          </span>
          {evaluation.errorCodes.map((code) => (
            <button
              key={code}
              data-testid={`${testIdPrefix}error-badge-${code}`}
              type="button"
              onClick={() => onNavigateToMistake?.(code)}
              title="Practise this in Mistake Memory"
              className="exam-pill exam-pill-purple exam-pill-button"
            >
              {code} →
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
