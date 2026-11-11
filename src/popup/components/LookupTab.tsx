import React from 'react';
import { BookmarkPlus, Check, Lightbulb, Search, Sparkles, Volume2, X } from 'lucide-react';
import { LinguisticAnalysisResult, SentenceAnalysisResult, WordAnalysisResult } from '../../types';
import { playPronunciation } from '../../services/audio/voiceService';

interface LookupTabProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  executeSearch: (term: string) => void;
  setResult: (result: LinguisticAnalysisResult | null) => void;
  loading: boolean;
  result: LinguisticAnalysisResult | null;
  isSentenceMode: boolean;
  sentenceResult: SentenceAnalysisResult | null;
  isSaved: boolean;
  handleSave: () => void;
  /** Renders text with every word clickable for a new lookup. */
  renderInteractiveWords: (text?: string) => React.ReactNode;
}

/** Quick Lookup tab: search box, AI result card and starter suggestions. */
export const LookupTab: React.FC<LookupTabProps> = ({
  searchTerm,
  setSearchTerm,
  executeSearch,
  setResult,
  loading,
  result,
  isSentenceMode,
  sentenceResult,
  isSaved,
  handleSave,
  renderInteractiveWords
}) => (
  <div className="hub-tab-pane">
    {/* Modern Search Command Bar */}
    <div className="lookup-search-bar">
      <div className="lookup-input-box">
        <Search size={14} className="lookup-search-icon" />
        <input
          type="text"
          className="lookup-input-field"
          placeholder="Search a word or sentence"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchTerm)}
          autoFocus
        />
        {searchTerm && (
          <button
            type="button"
            className="lookup-clear-btn"
            onClick={() => {
              setSearchTerm('');
              setResult(null);
            }}
            title="Clear"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="btn-lookup-analyze"
        onClick={() => executeSearch(searchTerm)}
        disabled={loading || !searchTerm.trim()}
      >
        {loading ? '...' : <><Sparkles size={13} /><span>Analyze</span></>}
      </button>
    </div>

    {loading && (
      <div className="lookup-loading-box">
        <div className="reading-scanning-spinner" />
        <span>Interpreting with LexiFlow AI...</span>
      </div>
    )}

    {/* Result View */}
    {!loading && result && (
      <div className="lookup-result-box">
        <div className="result-top-row">
          <span className="result-term-title">
            {result.selectionType === 'sentence' || result.selectionType === 'paragraph'
              ? renderInteractiveWords(result.selectedText)
              : result.selectedText}
          </span>
          <button
            type="button"
            className="result-pronounce-btn"
            title="Listen to pronunciation"
            onClick={() => playPronunciation(result.selectedText)}
          >
            <Volume2 size={14} />
          </button>
          <span className="result-type-badge">{result.selectionType.toUpperCase()}</span>
        </div>

        {result.bengaliTranslation && (
          <div className="result-bengali-pill">
            <span className="bengali-accent-mark" />
            <span>{result.bengaliTranslation}</span>
          </div>
        )}

        <div className="result-definition-text">
          {renderInteractiveWords(
            (result as WordAnalysisResult).contextualMeaning ||
            (result as WordAnalysisResult).simpleEnglishExplanation ||
            (result as SentenceAnalysisResult).plainEnglishParaphrase ||
            ''
          )}
        </div>

        {isSentenceMode && sentenceResult?.phraseBreakdown && sentenceResult.phraseBreakdown.length > 0 && (
          <div className="result-phrase-list">
            <div className="result-section-label">Phrase breakdown · tap any word</div>
            {sentenceResult.phraseBreakdown.map((item, idx) => (
              <div key={idx} className="result-phrase-item">
                <div className="result-phrase-text">{renderInteractiveWords(item.phrase)}</div>
                {item.easyEnglish && (
                  <div className="result-phrase-english">{renderInteractiveWords(item.easyEnglish)}</div>
                )}
                {item.easyBengali && <div className="result-phrase-bengali">{item.easyBengali}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="result-action-footer">
          <button
            type="button"
            className={`btn-save-term ${isSaved ? 'saved' : ''}`}
            onClick={handleSave}
          >
            {isSaved ? (
              <><Check size={13} /><span>Saved in Library</span></>
            ) : (
              <><BookmarkPlus size={13} /><span>Save to Library</span></>
            )}
          </button>
        </div>
      </div>
    )}

    {/* Empty state suggestions */}
    {!loading && !result && (
      <div className="lookup-empty-hints">
        <div className="hints-title">Try one of these</div>
        <div className="hints-chips-row">
          {['meticulous', 'break the ice', 'take for granted', 'resilience'].map((w) => (
            <button
              key={w}
              type="button"
              className="hint-word-chip"
              onClick={() => executeSearch(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="hints-tip-box">
          <Lightbulb size={13} className="tip-icon" />
          <span>Enter full sentences to get detailed grammatical breakdowns and natural Bengali translations.</span>
        </div>
      </div>
    )}
  </div>
);
