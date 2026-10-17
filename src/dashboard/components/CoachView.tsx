import React, { useState } from 'react';
import { UsageCoachFeedback } from '../../types';

interface CoachViewProps {
  initialWord?: string;
}

export const CoachView: React.FC<CoachViewProps> = ({ initialWord }) => {
  const [targetWord, setTargetWord] = useState(initialWord || 'mitigate');
  const [sentence, setSentence] = useState('We need to take urgent action to mitigate the carbon emissions.');
  const [feedback, setFeedback] = useState<UsageCoachFeedback | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEvaluate = () => {
    if (!targetWord.trim() || !sentence.trim()) return;
    setLoading(true);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'EVALUATE_USAGE',
        payload: { targetWord, sentence }
      }, (res) => {
        setLoading(false);
        if (res?.success && res.data) {
          setFeedback(res.data);
        }
      });
    }
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
                {feedback.isGrammaticallyCorrect ? '✓ Grammatically Valid' : '⚠️ Minor Revision Suggested'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Collocation Score: <strong style={{ color: 'var(--accent)' }}>{feedback.collocationScore} / 100</strong>
              </span>
            </div>

            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>More Natural Alternative:</span>
              <p style={{ color: 'var(--text-main)', fontSize: '14.5px', marginTop: '2px', fontWeight: 600 }}>
                "{feedback.naturalAlternative}"
              </p>
            </div>

            <div style={{ marginTop: '12px', background: 'rgba(0, 113, 227, 0.05)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
              <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>Bengali Coaching Feedback:</strong>
              <p style={{ color: '#48484a', fontSize: '13px', marginTop: '3px', lineHeight: 1.45 }}>
                {feedback.bengaliFeedback}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
