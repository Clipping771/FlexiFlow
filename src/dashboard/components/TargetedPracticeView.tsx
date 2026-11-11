import React, { useState } from 'react';
import { VocabularyItem, TargetedPracticeItem, FSRSRating } from '../../types';
import { WeaknessDetector } from '../../services/weakness/detector';
import { playPronunciation } from '../../services/audio/voiceService';

interface TargetedPracticeViewProps {
  items: VocabularyItem[];
  onReviewSubmit: (id: string, rating: FSRSRating) => Promise<void>;
  onDismissWeakness: (id: string) => Promise<void>;
  onSelectWordForCoach?: (word: string) => void;
}

export const TargetedPracticeView: React.FC<TargetedPracticeViewProps> = ({
  items,
  onReviewSubmit,
  onDismissWeakness,
  onSelectWordForCoach
}) => {
  const [selectedItemForModal, setSelectedItemForModal] = useState<VocabularyItem | null>(null);
  const [activePracticeItem, setActivePracticeItem] = useState<VocabularyItem | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const practiceList = WeaknessDetector.getTargetedPracticeList(items);

  const handleRating = async (rating: FSRSRating) => {
    if (!activePracticeItem) return;
    await onReviewSubmit(activePracticeItem.id, rating);
    setIsFlipped(false);
    setActivePracticeItem(null);
  };

  const playAudio = (word: string, audioUrl?: string) => {
    playPronunciation(word, { audioUrl });
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Targeted Practice (Personal Weakness Detector)</h2>
          <p className="view-desc">
            Evidence-based intervention identifying words with repeated lapses, low memory stability, or failed reviews
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="tag-badge" style={{ color: practiceList.length > 0 ? 'var(--warning)' : 'var(--success)', fontSize: '13px' }}>
            {practiceList.length} Attention Required
          </span>
        </div>
      </div>

      {practiceList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🛡️</div>
          <h3 style={{ color: 'var(--text-main)' }}>No Critical Weaknesses Detected</h3>
          <p style={{ marginTop: '8px', fontSize: '14px', maxWidth: '500px', margin: '8px auto 0 auto', lineHeight: '1.5' }}>
            Your retention is in good standing! When review lapses, repeated "Again" ratings, or user difficulty flags occur, prioritized practice cards will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {practiceList.map((practice) => {
            const item = practice.vocabularyItem;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${practice.weaknessScore >= 60 ? 'var(--danger)' : 'var(--warning)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {item.word}
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '50%' }}
                      onClick={() => playAudio(item.word, item.audioUrl)}
                      title="Pronounce"
                    >
                      🔊
                    </button>
                    <span className="tag-badge" style={{
                      color: practice.weaknessScore >= 60 ? 'var(--danger)' : 'var(--warning)',
                      fontSize: '11px'
                    }}>
                      Weakness Score: {practice.weaknessScore}/100
                    </span>
                    <span className="tag-badge" style={{
                      color: practice.reviewStatus === 'due' ? 'var(--warning)' : 'var(--accent)',
                      textTransform: 'uppercase',
                      fontSize: '11px'
                    }}>
                      Status: {practice.reviewStatus}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-primary"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => {
                        setActivePracticeItem(item);
                        setIsFlipped(false);
                      }}
                    >
                      ⚡ Quick Practice
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '12px' }}
                      onClick={() => setSelectedItemForModal(item)}
                    >
                      📖 Explanation
                    </button>
                    {onSelectWordForCoach && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => onSelectWordForCoach(item.word)}
                      >
                        ✍️ Coach
                      </button>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--text-muted)' }}
                      onClick={() => onDismissWeakness(item.id)}
                      title="Remove from weakness list without deleting vocab"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 600 }}>
                      {item.bengaliMeaning}
                    </div>
                    <div style={{ color: 'var(--text-main)', fontSize: '13.5px', marginTop: '2px' }}>
                      {item.meaning || item.definition}
                    </div>
                    {item.contextSentence && (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>
                        "{item.contextSentence}"
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--fill)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Evidence Signals:
                    </span>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', fontSize: '12.5px', color: 'var(--danger)' }}>
                      {practice.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      FSRS Reps: {item.fsrs?.reps || 0} | Lapses: {item.fsrs?.lapses || 0} | Stability: {item.fsrs?.stability?.toFixed(1) || '0'} days
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Practice Flashcard Modal */}
      {activePracticeItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--scrim)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '480px', maxWidth: '90vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="tag-badge" style={{ color: 'var(--warning)' }}>
                Targeted Weakness Recall
              </span>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setActivePracticeItem(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <h2 style={{ fontSize: '32px', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 800 }}>
                {activePracticeItem.word}
              </h2>
              {activePracticeItem.contextSentence && (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '13.5px' }}>
                  "{activePracticeItem.contextSentence}"
                </p>
              )}
            </div>

            {!isFlipped ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '10px' }}
                  onClick={() => setIsFlipped(true)}
                >
                  Reveal Explanation & Meaning
                </button>
              </div>
            ) : (
              <div>
                <div style={{ padding: '14px', background: 'var(--fill)', border: '1px solid var(--line)', borderRadius: '10px', marginBottom: '20px' }}>
                  <div style={{ color: 'var(--success)', fontSize: '18px', fontWeight: 700, textAlign: 'center' }}>
                    {activePracticeItem.bengaliMeaning}
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '14px', marginTop: '6px', textAlign: 'center', lineHeight: 1.5 }}>
                    {activePracticeItem.meaning || activePracticeItem.definition}
                  </p>
                  {activePracticeItem.bengaliExplanation && (
                    <div style={{ fontSize: '12.5px', color: 'var(--blue)', marginTop: '6px', textAlign: 'center' }}>
                      {activePracticeItem.bengaliExplanation}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <button
                    className="btn-rating again"
                    onClick={() => handleRating(1)}
                  >
                    Again (1)
                  </button>
                  <button
                    className="btn-rating hard"
                    onClick={() => handleRating(2)}
                  >
                    Hard (2)
                  </button>
                  <button
                    className="btn-rating good"
                    onClick={() => handleRating(3)}
                  >
                    Good (3)
                  </button>
                  <button
                    className="btn-rating easy"
                    onClick={() => handleRating(4)}
                  >
                    Easy (4)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explanation Modal */}
      {selectedItemForModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--scrim)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '560px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', padding: '24px', boxShadow: 'var(--shadow-sheet)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {selectedItemForModal.word}
              </h3>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setSelectedItemForModal(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ color: 'var(--success)', fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>
              {selectedItemForModal.bengaliMeaning}
            </div>

            <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5', marginBottom: '14px' }}>
              {selectedItemForModal.meaning || selectedItemForModal.definition}
            </p>

            {selectedItemForModal.bengaliExplanation && (
              <div style={{ padding: '10px 14px', background: 'var(--bengali-bg)', borderRadius: '8px', borderLeft: '3px solid var(--bengali-border)', marginBottom: '14px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>Contextual Explanation:</strong>
                <p style={{ color: 'var(--text-main)', fontSize: '13px', marginTop: '3px' }}>
                  {selectedItemForModal.bengaliExplanation}
                </p>
              </div>
            )}

            {selectedItemForModal.contextSentence && (
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Saved In Context:</span>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px', background: 'var(--context-bg)', padding: '8px 12px', borderRadius: '8px' }}>
                  "{selectedItemForModal.contextSentence}"
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setSelectedItemForModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
