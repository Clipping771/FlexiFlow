import React, { useState } from 'react';
import { VocabularyItem, FSRSRating } from '../../types';
import { playPronunciation } from '../../services/audio/voiceService';

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

  const currentItem = dueItems[currentIndex];

  const handleRating = async (rating: FSRSRating) => {
    if (!currentItem) return;
    await onReviewSubmit(currentItem.id, rating);
    setIsFlipped(false);
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
              ? `You reviewed ${completedCount} words in this session! Your memory retention has been recalibrated.`
              : 'You have no words due for review right now. Add more vocabulary while reading!'}
          </p>
          <div style={{ display: 'inline-flex', gap: '10px' }}>
            <span className="tag-badge">FSRS Scheduling Active</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-container">
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Card {currentIndex + 1} of {dueItems.length}
        </span>
        <span className="tag-badge" style={{ color: 'var(--accent)' }}>
          Collection: {currentItem.collection || 'General'}
        </span>
      </div>

      <div className="flashcard">
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
      </div>

      {isFlipped && (
        <div className="rating-buttons">
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
