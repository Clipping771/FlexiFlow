import React, { useState } from 'react';
import { UsageCoachFeedback } from '../../types';
import { getLanguageConfig } from '../../config/languages';

interface CoachViewProps {
  initialWord?: string;
  /** The reader's target language, for labelling the translated feedback. */
  targetLanguage?: string;
}

export const CoachView: React.FC<CoachViewProps> = ({ initialWord, targetLanguage = 'bn' }) => {
  const [targetWord, setTargetWord] = useState(initialWord || 'mitigate');
  const [sentence, setSentence] = useState('We need to take urgent action to mitigate the carbon emissions.');
  const [feedback, setFeedback] = useState<UsageCoachFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedbackLabel = targetLanguage === 'en' ? 'Coaching Feedback' : `${getLanguageConfig(targetLanguage).targetLabel} Coaching Feedback`;

  const handleEvaluate = () => {
    if (!targetWord.trim() || !sentence.trim()) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setError('Checking sentences only works inside the LexiFlow extension.');
      return;
    }
    setLoading(true);
    setError(null);
    setFeedback(null);

    chrome.runtime.sendMessage({
      type: 'EVALUATE_USAGE',
      payload: { targetWord, sentence }
    }, (res) => {
      setLoading(false);
      if (chrome.runtime?.lastError) {
        setError(chrome.runtime.lastError.message || 'Could not reach LexiFlow.');
      } else if (res?.success && res.data) {
        setFeedback(res.data);
      } else {
        // Never show a verdict that was not actually measured
        setError(res?.error || 'Could not check this sentence. Please try again.');
      }
    });
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Active Usage Coach</h2>
          <p className="view-desc">
            Practice writing your own sentences with newly learned vocabulary and receive AI grammatical & naturalness coaching
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Target Vocabulary Word:
          </label>
          <input
            type="text"
            className="input-search"
            style={{ width: '260px' }}
            value={targetWord}
            onChange={(e) => setTargetWord(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Your Sentence:
          </label>
          <textarea
            style={{
              width: '100%',
              height: '80px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              padding: '12px',
              fontSize: '14px',
              outline: 'none',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)'
            }}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="btn-primary" onClick={handleEvaluate} disabled={loading}>
            {loading ? 'Evaluating...' : '✍️ Check My Sentence'}
          </button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(220, 38, 38, 0.08)', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>

      {feedback && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{
            borderLeft: `4px solid ${feedback.isGrammaticallyCorrect ? 'var(--success)' : 'var(--warning)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="tag-badge" style={{
                color: feedback.isGrammaticallyCorrect ? 'var(--success)' : 'var(--warning)',
                fontSize: '13px',
                padding: '4px 8px'
              }}>
                {feedback.isGrammaticallyCorrect ? '✓ Grammatically correct' : '⚠️ Needs correction'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Collocation Score: <strong style={{ color: 'var(--accent)' }}>{feedback.collocationScore} / 100</strong>
              </span>
            </div>

            {feedback.grammarCorrectness && (
              <p style={{ color: 'var(--text-main)', fontSize: '13.5px', marginTop: '4px', lineHeight: 1.5 }}>
                {feedback.grammarCorrectness}
              </p>
            )}

            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>More Natural Alternative:</span>
              <p style={{ color: 'var(--text-main)', fontSize: '14.5px', marginTop: '2px', fontWeight: 600 }}>
                "{feedback.naturalAlternative}"
              </p>
            </div>

            <div style={{ marginTop: '12px', background: 'rgba(0, 113, 227, 0.05)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
              <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>{feedbackLabel}:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '3px', lineHeight: 1.45 }}>
                {feedback.bengaliFeedback}
              </p>
            </div>

            {feedback.alternativeCollocations && feedback.alternativeCollocations.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Other natural ways to use "{feedback.targetWord}":</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {feedback.alternativeCollocations.map((c, i) => (
                    <span key={i} className="tag-badge">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
