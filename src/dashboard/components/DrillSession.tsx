import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, X } from 'lucide-react';
import type { TaxonomyError } from '../../services/taxonomy/catalog';
import { MistakeMemoryClient, MistakeMemoryItem, DrillSessionOutcome } from '../../services/mistake/client';
import { buildDrillSession, gradeChoice, gradeFix, Drill, PASS_RATIO } from '../../services/mistake/drills';

interface DrillSessionProps {
  item: MistakeMemoryItem;
  taxError: TaxonomyError;
  onClose: () => void;
  /** Shown on the summary when more mistakes are due today */
  nextDueLabel?: string | null;
  onNextDue?: () => void;
}

interface Answered {
  correct: boolean;
  picked?: number;
}

function formatDay(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** A short, varied practice session for one mistake: a warm-up choice, then rewrites (often of the learner's own sentences). */
export const DrillSession: React.FC<DrillSessionProps> = ({ item, taxError, onClose, nextDueLabel, onNextDue }) => {
  const drills = useMemo<Drill[]>(
    () => buildDrillSession(item, taxError, (item.practiceSessions || 0) + item.totalOccurrences * 31),
    // Built once per opened session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.id]
  );
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [outcome, setOutcome] = useState<DrillSessionOutcome | null>(null);

  const drill = drills[index];
  const answered = answers[index];
  const correctCount = answers.filter((a) => a.correct).length;

  const submitFix = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drill || drill.kind !== 'fix' || answered || !input.trim()) return;
    setAnswers((prev) => [...prev, { correct: gradeFix(drill, input) }]);
  };

  const pick = (i: number) => {
    if (!drill || drill.kind !== 'choose' || answered) return;
    setAnswers((prev) => [...prev, { correct: gradeChoice(drill, i), picked: i }]);
  };

  const next = () => {
    if (index + 1 < drills.length) {
      setIndex(index + 1);
      setInput('');
      return;
    }
    setOutcome(MistakeMemoryClient.recordDrillSession(item.errorCode, correctCount, drills.length));
  };

  if (drills.length === 0) {
    return (
      <div className="drill-summary" data-testid="drill-summary">
        <p>There are no drills for this mistake yet.</p>
        <div className="drill-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (outcome) {
    const { item: updated, passed, counted } = outcome;
    const days = updated.nextReviewDays;
    let message: string;
    if (!passed) {
      message = `You need ${Math.ceil(drills.length * PASS_RATIO)} of ${drills.length} to pass. This mistake comes back tomorrow with new sentences.`;
    } else if (!counted) {
      message = `Good practice. To make it stick, the next check that counts is on ${formatDay(updated.nextReviewAt)}.`;
    } else if (updated.masteryState === 'Mastered') {
      message = `Mastered! We will check it once more in ${days} days to make sure it stays fixed.`;
    } else {
      message = `Fixed once. Pass one more check on ${formatDay(updated.nextReviewAt)} to master it.`;
    }
    return (
      <div className="drill-summary" data-testid="drill-summary">
        <div className={`drill-score ${passed ? 'pass' : 'fail'}`}>
          <strong data-testid="drill-score">
            {correctCount} / {drills.length}
          </strong>
          <span>{passed ? 'Passed' : 'Not yet'}</span>
        </div>
        <p className="drill-summary-msg" data-testid="drill-summary-msg">
          {message}
        </p>
        <div className="drill-actions">
          <button type="button" className="btn-secondary" data-testid="drill-done-btn" onClick={onClose}>
            Done
          </button>
          {nextDueLabel && onNextDue && (
            <button type="button" className="btn-primary" data-testid="drill-next-due-btn" onClick={onNextDue}>
              Next: {nextDueLabel} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="drill-session" data-testid="drill-session">
      <div className="drill-progress" aria-label={`Question ${index + 1} of ${drills.length}`}>
        {drills.map((d, i) => (
          <span
            key={d.id}
            className={`drill-dot ${i === index ? 'current' : ''} ${
              answers[i] ? (answers[i].correct ? 'right' : 'wrong') : ''
            }`}
          />
        ))}
        <span className="drill-count">
          {index + 1} of {drills.length}
        </span>
      </div>

      {drill.source === 'own' && <span className="drill-own-tag">From your own practice</span>}

      {drill.kind === 'choose' ? (
        <div data-testid="drill-choose">
          <p className="drill-prompt">{drill.prompt}</p>
          <div className="drill-options">
            {drill.options.map((opt, i) => {
              const state = answered
                ? i === drill.answer
                  ? 'right'
                  : i === answered.picked
                    ? 'wrong'
                    : ''
                : '';
              return (
                <button
                  key={i}
                  type="button"
                  data-testid={`drill-option-${i}`}
                  className={`drill-option ${state}`}
                  disabled={!!answered}
                  onClick={() => pick(i)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <form onSubmit={submitFix} data-testid="drill-fix">
          <p className="drill-prompt">Fix the mistake and type the whole sentence:</p>
          <div className="drill-wrong">{drill.wrong}</div>
          <textarea
            data-testid="drill-input"
            className="drill-input"
            rows={3}
            placeholder="Type the corrected sentence…"
            value={input}
            disabled={!!answered}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitFix(e);
              }
            }}
          />
          {!answered && (
            <div className="drill-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Stop
              </button>
              <button data-testid="submit-drill-btn" type="submit" className="btn-primary" disabled={!input.trim()}>
                Check
              </button>
            </div>
          )}
        </form>
      )}

      {answered && (
        <div className={`drill-feedback ${answered.correct ? 'right' : 'wrong'}`} data-testid="drill-result-banner">
          {answered.correct ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>
            <strong>{answered.correct ? 'Correct' : 'Not quite'}</strong>
            {drill.kind === 'fix' && !answered.correct && (
              <p>
                Answer: <em>{drill.answers[0]}</em>
              </p>
            )}
            <p>{drill.why}</p>
          </div>
        </div>
      )}

      {answered && (
        <div className="drill-actions">
          <button type="button" className="btn-primary" data-testid="drill-next-btn" onClick={next} autoFocus>
            {index + 1 < drills.length ? 'Next' : 'See result'} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export const DrillCloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button data-testid="close-drill-btn" type="button" className="drill-close" onClick={onClick} aria-label="Close">
    <X size={20} />
  </button>
);
