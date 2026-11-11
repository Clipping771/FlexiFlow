import React from 'react';
import { ArrowRight, BookOpen, Check, Flame, Volume2 } from 'lucide-react';
import { VocabularyItem } from '../../types';
import { playPronunciation } from '../../services/audio/voiceService';

interface LibraryTabProps {
  savedCount: number;
  dueCount: number;
  recentVocab: VocabularyItem[];
  onOpenDashboard: () => void;
  /** Opens the Lookup tab with this word searched. */
  onLookupWord: (word: string) => void;
}

/** Library tab: progress stats, review prompt and recently saved words. */
export const LibraryTab: React.FC<LibraryTabProps> = ({ savedCount, dueCount, recentVocab, onOpenDashboard, onLookupWord }) => (
  <div className="hub-tab-pane">
    {/* Metric Cards Row */}
    <div className="library-stats-grid">
      <div className="stat-card blue" onClick={onOpenDashboard} role="button" tabIndex={0} title="View all words in Dashboard">
        <div className="stat-card-icon"><BookOpen size={15} /></div>
        <div className="stat-card-content">
          <span className="stat-number">{savedCount}</span>
          <span className="stat-title">Words saved</span>
        </div>
      </div>

      <div className={`stat-card ${dueCount > 0 ? 'orange' : 'neutral'}`} onClick={onOpenDashboard} role="button" tabIndex={0} title="Review words due today">
        <div className="stat-card-icon"><Flame size={15} /></div>
        <div className="stat-card-content">
          <span className="stat-number">{dueCount}</span>
          <span className="stat-title">Due for review</span>
        </div>
      </div>
    </div>

    {/* Flashcard Due Banner */}
    {dueCount > 0 ? (
      <div className="library-due-banner">
        <div className="due-banner-head">
          <span className="due-banner-icon">
            <Flame size={16} />
          </span>
          <div className="due-banner-text">
            <div className="due-banner-title">
              {dueCount} {dueCount === 1 ? 'word' : 'words'} ready to review
            </div>
            <div className="due-banner-sub">A quick flashcard round keeps them in memory.</div>
          </div>
        </div>
        <button type="button" className="btn-start-review" onClick={onOpenDashboard}>
          <span>Start review</span>
          <ArrowRight size={14} />
        </button>
      </div>
    ) : (
      <div className="library-caught-up-banner">
        <Check size={14} className="caught-up-icon" />
        <span>All caught up! No flashcards due today.</span>
      </div>
    )}

    {/* Recent Vocabulary Section */}
    <div className="library-recent-section">
      <div className="recent-section-header">
        <span className="recent-heading">Recently saved</span>
        <button type="button" className="recent-view-all" onClick={onOpenDashboard}>
          <span>View all</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {recentVocab.length > 0 ? (
        <div className="recent-vocab-list">
          {recentVocab.map((item, idx) => (
            <div key={idx} className="recent-vocab-row" onClick={() => {
              onLookupWord(item.word);
            }}>
              <div className="recent-word-info">
                <span className="recent-word-term">{item.word}</span>
                {item.bengaliMeaning && <span className="recent-word-bn">{item.bengaliMeaning}</span>}
              </div>
              <button
                type="button"
                className="recent-word-audio"
                onClick={(e) => {
                  e.stopPropagation();
                  playPronunciation(item.word);
                }}
                title="Pronounce"
              >
                <Volume2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="recent-empty-text">No words saved yet. Highlight or search words to build your library.</div>
      )}
    </div>
  </div>
);
