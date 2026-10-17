import React, { useState } from 'react';
import { VocabularyItem, FSRSRating } from '../../types';
import { playPronunciation } from '../../services/audio/voiceService';
import { generateCloze, ClozeResult } from '../../services/cloze/generator';

interface ReviewViewProps {
  dueItems: VocabularyItem[];
  onReviewSubmit: (id: string, rating: FSRSRating) => Promise<void>;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  dueItems,
  onReviewSubmit
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [preferredMode, setPreferredMode] = useState<'cloze' | 'meaning'>('cloze');
  const [showHint, setShowHint] = useState(false);

  const currentItem = dueItems[currentIndex];

  // Evaluate cloze for the active vocabulary item
  const clozeOutcome = currentItem
    ? generateCloze(currentItem.word, currentItem.contextSentence, currentItem.partOfSpeech)
    : { success: false };

  const hasValidCloze = Boolean(clozeOutcome.success && clozeOutcome.cloze);
  const activeMode: 'cloze' | 'meaning' = (preferredMode === 'cloze' && hasValidCloze) ? 'cloze' : 'meaning';
  const cloze: ClozeResult | undefined = clozeOutcome.cloze;

  const handleRating = async (rating: FSRSRating) => {
    if (!currentItem) return;
    // Exactly one review event per card per session on the single FSRS schedule
    await onReviewSubmit(currentItem.id, rating);
    setIsFlipped(false);
    setShowHint(false);
    setCompletedCount((prev) => prev + 1);
    setCurrentIndex((prev) => prev + 1);
  };

  const playAudio = (word: string, audioUrl?: string) => {
    playPronunciation(word, { audioUrl });
  };

  if (!currentItem || currentIndex >= dueItems.length) {
    return (
      <div className="review-container">
        <div className="card" style={{ textAlign: 'center', padding: '40px 30px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <h2 style={{ color: 'var(--text-main)', margin: '0 0 8px 0' }}>All Caught Up!</h2>
          <p style={{ color: 'var(--text-muted)', margin: '8px 0 20px 0', fontSize: '14px' }}>
            {completedCount > 0
              ? `You reviewed ${completedCount} items in this active recall session! Your FSRS memory retention state has been updated.`
              : 'You have no words due for review right now. Add more vocabulary while reading!'}
          </p>
          <div style={{ display: 'inline-flex', gap: '10px' }}>
            <span className="tag-badge">FSRS v4.5 Adaptive Active Recall</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-container">
      {/* Top Session Progress Bar */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Card {currentIndex + 1} of {dueItems.length}
        </span>

        {/* Mode Selector Segmented Control */}
        <div style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.05)', padding: '2px', borderRadius: '6px', gap: '2px' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: '3px 9px',
              fontSize: '11.5px',
              fontWeight: activeMode === 'cloze' ? 700 : 500,
              background: activeMode === 'cloze' ? 'var(--blue, #0071e3)' : 'transparent',
              color: activeMode === 'cloze' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '4px',
              cursor: hasValidCloze ? 'pointer' : 'not-allowed',
              opacity: hasValidCloze ? 1 : 0.5
            }}
            disabled={!hasValidCloze}
            title={hasValidCloze ? 'Contextual fill-in-the-blank active recall' : 'Context sentence unavailable for this card'}
            onClick={() => {
              setPreferredMode('cloze');
              setIsFlipped(false);
              setShowHint(false);
            }}
          >
            🎯 Active Recall (Cloze)
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{
              padding: '3px 9px',
              fontSize: '11.5px',
              fontWeight: activeMode === 'meaning' ? 700 : 500,
              background: activeMode === 'meaning' ? 'var(--blue, #0071e3)' : 'transparent',
              color: activeMode === 'meaning' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              setPreferredMode('meaning');
              setIsFlipped(false);
              setShowHint(false);
            }}
          >
            📖 Meaning Recall
          </button>
        </div>

        <span className="tag-badge" style={{ color: 'var(--accent)' }}>
          {currentItem.collection || 'Daily Reading'}
        </span>
      </div>

      <div className="flashcard">
        {/* MODE A: Active Recall (Cloze) */}
        {activeMode === 'cloze' && cloze ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--blue, #0071e3)', fontWeight: 700, marginBottom: '14px' }}>
              🎯 Complete the sentence from memory:
            </div>

            {/* Cloze Sentence with Blank */}
            <div style={{ fontSize: '17px', lineHeight: '1.6', color: 'var(--text-main)', margin: '0 auto 18px', maxWidth: '580px', fontWeight: 500 }}>
              <span>"{cloze.sentence.slice(0, cloze.matchStartIndex)}"</span>
              <span style={{
                display: 'inline-block',
                margin: '0 4px',
                padding: '1px 10px',
                borderBottom: '2.5px solid var(--blue, #0071e3)',
                color: isFlipped ? 'var(--blue, #0071e3)' : 'transparent',
                background: isFlipped ? 'rgba(0, 113, 227, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: isFlipped ? 'normal' : '2px',
                minWidth: '80px'
              }}>
                {isFlipped ? cloze.targetWord : '[ ????? ]'}
              </span>
              <span>"{cloze.sentence.slice(cloze.matchEndIndex)}"</span>
            </div>

            {/* Meaning & Clue */}
            <div style={{ margin: '14px 0', padding: '10px 14px', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '8px', border: '1px dashed rgba(0, 0, 0, 0.1)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '2px' }}>
                Meaning Clue:
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>
                {currentItem.bengaliMeaning ? `${currentItem.bengaliMeaning} — ` : ''}{currentItem.meaning || currentItem.definition}
              </div>
            </div>

            {/* First-letter Hint Toggle */}
            {!isFlipped && (
              <div style={{ marginTop: '10px' }}>
                {!showHint ? (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setShowHint(true)}
                  >
                    💡 Show first-letter hint ({cloze.hint.length} letters)
                  </button>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--blue, #0071e3)', fontWeight: 600 }}>
                    Hint: Starts with <strong>"{cloze.hint.firstLetter}"</strong> ({cloze.hint.length} letters{cloze.hint.partOfSpeech ? `, ${cloze.hint.partOfSpeech}` : ''})
                  </div>
                )}
              </div>
            )}

            {/* Revealed Card Back */}
            {isFlipped ? (
              <div style={{ marginTop: '20px', width: '100%', animation: 'lfFadeIn 0.2s ease', borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="flashcard-word" style={{ color: 'var(--blue, #0071e3)', fontSize: '26px' }}>
                    {cloze.targetWord}
                  </span>
                  <button
                    className="btn-secondary"
                    style={{ borderRadius: '50%', padding: '6px 8px', fontSize: '12px' }}
                    onClick={() => playAudio(cloze.targetWord, currentItem.audioUrl)}
                    title="Pronounce"
                  >
                    🔊
                  </button>
                </div>
                {currentItem.bengaliMeaning && (
                  <div className="vocab-bengali" style={{ fontSize: '19px', textAlign: 'center', marginBottom: '8px' }}>
                    {currentItem.bengaliMeaning}
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-primary"
                style={{ marginTop: '22px', padding: '10px 26px', fontSize: '14px', fontWeight: 600 }}
                onClick={() => setIsFlipped(true)}
              >
                Reveal Answer & Rate Recall
              </button>
            )}
          </div>
        ) : (
          /* MODE B: Meaning Recall (Standard Front) */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="flashcard-word">{currentItem.word}</span>
              <button
                className="btn-secondary"
                style={{ borderRadius: '50%', padding: '6px 8px', fontSize: '12px' }}
                onClick={() => playAudio(currentItem.word, currentItem.audioUrl)}
                title="Pronounce"
              >
                🔊
              </button>
            </div>

            {currentItem.contextSentence && (
              <div className="flashcard-sentence">
                "{currentItem.contextSentence}"
              </div>
            )}

            {isFlipped ? (
              <div style={{ marginTop: '24px', width: '100%', animation: 'lfFadeIn 0.2s ease' }}>
                {currentItem.bengaliMeaning && (
                  <div className="vocab-bengali" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '12px' }}>
                    {currentItem.bengaliMeaning}
                  </div>
                )}
                <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5' }}>
                  {currentItem.meaning || currentItem.definition}
                </div>
                {currentItem.bengaliExplanation && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '8px' }}>
                    {currentItem.bengaliExplanation}
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-primary"
                style={{ marginTop: '28px', padding: '10px 24px', fontSize: '14px' }}
                onClick={() => setIsFlipped(true)}
              >
                Show Meaning & Bengali Nuance
              </button>
            )}
          </>
        )}
      </div>

      {/* FSRS Rating Buttons (Single unified schedule) */}
      {isFlipped && (
        <div className="rating-buttons" style={{ marginTop: '16px' }}>
          <button className="btn-rating again" onClick={() => handleRating(1)}>
            <span>Again (1)</span>
            <span className="rating-interval">&lt; 12 hours</span>
          </button>
          <button className="btn-rating hard" onClick={() => handleRating(2)}>
            <span>Hard (2)</span>
            <span className="rating-interval">~ 1 day</span>
          </button>
          <button className="btn-rating good" onClick={() => handleRating(3)}>
            <span>Good (3)</span>
            <span className="rating-interval">~ 3 days</span>
          </button>
          <button className="btn-rating easy" onClick={() => handleRating(4)}>
            <span>Easy (4)</span>
            <span className="rating-interval">~ 7 days</span>
          </button>
        </div>
      )}
    </div>
  );
};
