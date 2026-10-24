import React, { useEffect, useState } from 'react';
import { AlertCircle, PenLine, BookmarkCheck, BookmarkPlus, BookOpen, Check, ChevronDown, ChevronUp, FileText, Globe, Info, ListChecks, RotateCcw, Sparkles, X } from 'lucide-react';
import { Onboarding, PopupTextSize } from './Onboarding';

/** What the content script reports about highlights on the active page. */
export interface PageHighlightState {
  isSiteDisabled: boolean;
  articleTitle?: string;
  articleWordCount?: number;
  hasMainArticle: boolean;
  count: { total: number; visible: number; words: number; phrases: number; idioms: number };
  currentIndex: number;
  items: Array<{
    id?: string;
    text: string;
    type: 'word' | 'phrase' | 'idiom';
    contextSentence?: string;
    easyEnglish?: string;
    easyBengali?: string;
    contextualMeaning?: string;
    bengaliMeaning?: string;
  }>;
  color: string;
  filters: { words: boolean; phrases: boolean; idioms: boolean };
}

interface ReadingTabProps {
  savedCount: number;
  dueCount: number;
  setPopupTab: (tab: 'reading' | 'lookup' | 'library') => void;
  currentDomain: string;
  /** The active tab's favicon URL, when the browser has one. */
  currentFavicon?: string;
  /** Read Later state for the active page; null on pages that cannot be saved (non-web tabs). */
  readLater: { saved: boolean; unreadCount: number } | null;
  onToggleReadLater: () => void;
  onOpenReadingList: () => void;
  onWriteSummary: () => void;
  textSize: PopupTextSize;
  showOnboarding: boolean;
  dismissOnboarding: () => void;
  chooseTextSize: (size: PopupTextSize) => void;
  highlightState: PageHighlightState | null;
  highlightLoading: boolean;
  showVocabDrawer: boolean;
  setShowVocabDrawer: (show: boolean) => void;
  highlightFeedback: { message: string; type: 'info' | 'error' | 'success' } | null;
  isCurrentSiteEnabled: boolean;
  toggleCurrentSite: (e?: React.MouseEvent) => void;
  handleTriggerHighlight: () => void;
  handleNavigateHighlight: (direction: 'prev' | 'next') => void;
  handleChangeHighlightColor: (color: string) => void;
  handleToggleFilter: (filterKey: 'words' | 'phrases' | 'idioms') => void;
  handleClearHighlights: () => void;
  handleScrollToItem: (itemText: string) => void;
  /** Name of the reader's target language, e.g. "Bengali" or "Hebrew" ("en" reads "Simple English"). */
  meaningLanguageLabel: string;
}

/** The site's own favicon, or a globe when it has none or it fails to load. */
const SiteIcon: React.FC<{ src?: string }> = ({ src }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <Globe size={15} className="site-banner-icon" />;
  return (
    <img
      src={src}
      alt=""
      width={18}
      height={18}
      className="site-banner-favicon"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

/** Reading AI tab: site switch, article scan and highlight controls, and progress at a glance. */
export const ReadingTab: React.FC<ReadingTabProps> = ({
  savedCount,
  dueCount,
  setPopupTab,
  currentDomain,
  currentFavicon,
  readLater,
  onToggleReadLater,
  onOpenReadingList,
  onWriteSummary,
  textSize,
  showOnboarding,
  dismissOnboarding,
  chooseTextSize,
  highlightState,
  highlightLoading,
  showVocabDrawer,
  setShowVocabDrawer,
  highlightFeedback,
  isCurrentSiteEnabled,
  toggleCurrentSite,
  handleTriggerHighlight,
  handleNavigateHighlight,
  handleChangeHighlightColor,
  handleToggleFilter,
  handleClearHighlights,
  handleScrollToItem,
  meaningLanguageLabel
}) => (
  <div className="hub-tab-pane">
    {showOnboarding && (
      <Onboarding textSize={textSize} onChooseSize={chooseTextSize} onDone={dismissOnboarding} />
    )}

    {/* Site status capsule banner */}
    <div className="reading-site-banner">
      <div className="site-banner-left">
        <span className="site-banner-icon-tile">
          <SiteIcon src={currentFavicon} />
        </span>
        <div className="site-banner-info">
          <span className="site-banner-domain">{currentDomain || 'Current web page'}</span>
          <span className={`site-banner-label ${isCurrentSiteEnabled ? 'on' : 'off'}`}>
            <span className={`domain-dot ${isCurrentSiteEnabled ? 'active' : ''}`} />
            {isCurrentSiteEnabled ? 'Active on this site' : 'Paused on this site'}
          </span>
        </div>
      </div>

      <div
        className={`reading-toggle-switch ${isCurrentSiteEnabled ? 'active' : ''}`}
        onClick={toggleCurrentSite}
        role="switch"
        aria-checked={isCurrentSiteEnabled}
        title={`Click to ${isCurrentSiteEnabled ? 'disable' : 'enable'} on this site`}
      >
        <div className="reading-toggle-thumb" />
      </div>
    </div>

    {readLater && (
      <div className="read-later-row">
        <button
          type="button"
          className={`read-later-btn ${readLater.saved ? 'saved' : ''}`}
          onClick={onToggleReadLater}
          aria-pressed={readLater.saved}
          title={readLater.saved ? 'Remove this article from your reading list' : 'Save this article to read later'}
        >
          {readLater.saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
          <span>{readLater.saved ? 'Saved for later' : 'Save for later'}</span>
        </button>
        <button type="button" className="read-later-link" onClick={onWriteSummary} title="Summarize this article and get it marked">
          <PenLine size={13} />
          <span>Write a summary</span>
        </button>
        <button type="button" className="read-later-link" onClick={onOpenReadingList}>
          <ListChecks size={13} />
          <span>Reading list{readLater.unreadCount > 0 ? ` (${readLater.unreadCount})` : ''}</span>
        </button>
      </div>
    )}

    {!isCurrentSiteEnabled ? (
      <div className="reading-paused-card">
        <Info size={16} className="paused-icon" />
        <div className="paused-text-wrap">
          <div className="paused-title">LexiFlow is paused on {currentDomain || 'this site'}</div>
          <div className="paused-desc">Enable to access inline word popups, paragraph explanations, and article vocabulary discovery.</div>
        </div>
        <button type="button" className="btn-enable-site" onClick={toggleCurrentSite}>
          Re-enable on this site
        </button>
      </div>
    ) : highlightLoading ? (
      <div className="reading-scanning-card">
        <div className="reading-scanning-spinner" />
        <div className="reading-scanning-title">Analyzing Article Body...</div>
        <div className="reading-scanning-desc">Filtering page headers, footers & ads to extract high-value vocabulary, idioms & collocations.</div>
      </div>
    ) : !highlightState || highlightState.count.total === 0 ? (
      <div className="reading-ready-hero">
        <div className="hero-article">
          <span className="hero-article-icon">
            <FileText size={16} />
          </span>
          <div className="hero-article-text">
            <span className="hero-article-label">
              {highlightState?.articleTitle ? 'Article on this page' : 'Ready to scan'}
            </span>
            <span className="hero-article-title" title={highlightState?.articleTitle || ''}>
              {highlightState?.articleTitle ? highlightState.articleTitle : 'Main article text (ads & sidebars skipped)'}
            </span>
          </div>
        </div>

        <ul className="hero-feature-list">
          <li>
            <Check size={13} className="check-icon" />
            <span>Finds the hard, high-impact words</span>
          </li>
          <li>
            <Check size={13} className="check-icon" />
            <span>{meaningLanguageLabel} meaning in context</span>
          </li>
          <li>
            <Check size={13} className="check-icon" />
            <span>Skips banners, ads & sidebars</span>
          </li>
        </ul>

        {highlightFeedback && (
          <div className={`studio-feedback-banner ${highlightFeedback.type}`}>
            <span>{highlightFeedback.type === 'error' ? <AlertCircle size={14} /> : highlightFeedback.type === 'success' ? <Sparkles size={14} /> : <Info size={14} />}</span>
            <span>{highlightFeedback.message}</span>
          </div>
        )}

        <button
          type="button"
          className="btn-hero-highlight"
          onClick={handleTriggerHighlight}
        >
          <Sparkles size={15} />
          <span>Scan & Highlight Article</span>
        </button>
      </div>
    ) : (
      /* Active Highlights Control Center */
      <div className="reading-active-center">
        <div className="active-highlight-summary">
          <div className="summary-left">
            <span className="summary-badge">ACTIVE</span>
            <span className="summary-text">
              <strong>{highlightState.count.visible}</strong> of {highlightState.count.total} active highlights
            </span>
          </div>
          <button
            type="button"
            className="btn-clear-highlights"
            onClick={handleClearHighlights}
            title="Clear highlights from page"
          >
            <X size={13} />
            <span>Clear</span>
          </button>
        </div>

        {/* Highlight Navigator */}
        <div className="reading-nav-bar">
          <div className="nav-btn-group">
            <button
              type="button"
              className="nav-step-btn"
              onClick={() => handleNavigateHighlight('prev')}
              title="Previous term (Shift+Tab)"
            >
              <ChevronUp size={14} />
              <span>Prev</span>
            </button>
            <span className="nav-counter-display">
              {(highlightState.currentIndex ?? -1) >= 0 ? highlightState.currentIndex + 1 : 1} / {highlightState.count.visible || highlightState.count.total}
            </span>
            <button
              type="button"
              className="nav-step-btn"
              onClick={() => handleNavigateHighlight('next')}
              title="Next term (Tab)"
            >
              <span>Next</span>
              <ChevronDown size={14} />
            </button>
          </div>

          <button
            type="button"
            className={`btn-vocab-drawer ${showVocabDrawer ? 'active' : ''}`}
            onClick={() => setShowVocabDrawer(!showVocabDrawer)}
          >
            <BookOpen size={12} />
            <span>Terms ({highlightState.items?.length || highlightState.count.total})</span>
          </button>
        </div>

        {/* Palette & Category Filters */}
        <div className="reading-tools-row">
          <div className="color-swatches-group" title="Select highlight tint">
            {(['yellow', 'blue', 'green', 'pink', 'purple'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch-dot ${highlightState.color === c ? 'selected' : ''}`}
                data-color={c}
                onClick={() => handleChangeHighlightColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          <div className="filter-pills-group">
            <button
              type="button"
              className={`filter-tab-pill ${highlightState.filters.words ? 'active' : ''}`}
              onClick={() => handleToggleFilter('words')}
            >
              Words
            </button>
            <button
              type="button"
              className={`filter-tab-pill ${highlightState.filters.phrases ? 'active' : ''}`}
              onClick={() => handleToggleFilter('phrases')}
            >
              Phrases
            </button>
            <button
              type="button"
              className={`filter-tab-pill ${highlightState.filters.idioms ? 'active' : ''}`}
              onClick={() => handleToggleFilter('idioms')}
            >
              Idioms
            </button>
          </div>
        </div>

        {/* Vocabulary Drawer */}
        {showVocabDrawer && highlightState.items && highlightState.items.length > 0 && (
          <div className="reading-vocab-drawer">
            <div className="drawer-header-row">
              <span className="drawer-heading">Discovered Terms in Article</span>
              <span className="drawer-hint">Tap word to jump ↗</span>
            </div>
            <div className="drawer-vocab-list">
              {highlightState.items.map((it, idx) => {
                const meaning = it.easyBengali || it.bengaliMeaning || it.easyEnglish || it.contextualMeaning;
                return (
                  <div
                    key={idx}
                    className="drawer-vocab-card"
                    onClick={() => handleScrollToItem(it.text)}
                    title={`Click to scroll to "${it.text}" in article`}
                  >
                    <div className="card-top-line">
                      <span className="card-word-text">{it.text}</span>
                      <span className={`card-type-tag ${it.type}`}>{it.type}</span>
                    </div>
                    {meaning && (
                      <div className="card-meaning-line">{meaning}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Re-scan button */}
        <div className="reading-rescan-row">
          <button type="button" className="btn-rescan-page" onClick={handleTriggerHighlight}>
            <RotateCcw size={12} />
            <span>Re-scan Article Body</span>
          </button>
        </div>
      </div>
    )}

    {/* Learning progress at a glance */}
    <div className="hub-stats-row">
      <button type="button" className="hub-stat" onClick={() => setPopupTab('library')}>
        <span className="hub-stat-num">{savedCount}</span>
        <span className="hub-stat-label">Words saved</span>
      </button>
      <button
        type="button"
        className={`hub-stat ${dueCount > 0 ? 'due' : ''}`}
        onClick={() => setPopupTab('library')}
      >
        <span className="hub-stat-num">{dueCount}</span>
        <span className="hub-stat-label">Due for review</span>
      </button>
    </div>
  </div>
);
