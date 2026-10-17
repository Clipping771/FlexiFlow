import React, { useState } from 'react';
import { VocabularyItem } from '../../types';
import { FSRSEngine } from '../../services/fsrs/engine';
import { WeaknessDetector } from '../../services/weakness/detector';
import { playPronunciation } from '../../services/audio/voiceService';

interface VocabularyViewProps {
  items: VocabularyItem[];
  onDeleteItem: (id: string) => Promise<void>;
  onToggleStar: (id: string) => Promise<void>;
  onToggleDifficult: (id: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (jsonString: string) => Promise<void>;
  onSelectForCoach?: (word: string) => void;
  onLoadSamples?: () => void;
}

type LibraryFilter = 'all' | 'starred' | 'due' | 'difficult';
type SortOption = 'recent' | 'alphabetical' | 'next_review';

export const VocabularyView: React.FC<VocabularyViewProps> = ({
  items,
  onDeleteItem,
  onToggleStar,
  onToggleDifficult,
  onUpdateNotes,
  onExport,
  onImport,
  onSelectForCoach,
  onLoadSamples
}) => {
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [modalItem, setModalItem] = useState<VocabularyItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Collections list
  const collections = ['all', ...Array.from(new Set(items.map((i) => i.collection || 'General')))];

  // Filter calculations & counts
  const now = new Date();
  const starredCount = items.filter((i) => Boolean(i.starred)).length;
  const dueCount = items.filter((i) => FSRSEngine.isDue(i.fsrs, now)).length;
  const difficultCount = items.filter((i) => i.isMarkedDifficult || i.difficulty === 'hard' || WeaknessDetector.calculateWeakness(i).score >= 35).length;

  // Multi-field search and filter
  const filteredItems = items.filter((item) => {
    // 1. Status Filter
    if (activeFilter === 'starred' && !item.starred) return false;
    if (activeFilter === 'due' && !FSRSEngine.isDue(item.fsrs, now)) return false;
    if (activeFilter === 'difficult') {
      const isWeak = item.isMarkedDifficult || item.difficulty === 'hard' || WeaknessDetector.calculateWeakness(item).score >= 35;
      if (!isWeak) return false;
    }

    // 2. Collection Filter
    if (collectionFilter !== 'all' && item.collection !== collectionFilter) {
      return false;
    }

    // 3. Search query across word, definitions, bengali, notes, and context
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const wordMatch = item.word.toLowerCase().includes(q);
      const defMatch = (item.meaning || item.definition || '').toLowerCase().includes(q);
      const bengaliMatch = (item.bengaliMeaning || '').includes(q) || (item.bengaliExplanation || '').includes(q);
      const notesMatch = (item.notes || '').toLowerCase().includes(q);
      const contextMatch = (item.contextSentence || '').toLowerCase().includes(q);

      if (!wordMatch && !defMatch && !bengaliMatch && !notesMatch && !contextMatch) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOption === 'alphabetical') {
      return a.word.localeCompare(b.word);
    }
    if (sortOption === 'next_review') {
      const aTime = a.fsrs?.nextReview ? new Date(a.fsrs.nextReview).getTime() : 0;
      const bTime = b.fsrs?.nextReview ? new Date(b.fsrs.nextReview).getTime() : 0;
      return aTime - bTime;
    }
    // Default 'recent'
    const aDate = new Date(a.dateAdded || 0).getTime();
    const bDate = new Date(b.dateAdded || 0).getTime();
    return bDate - aDate;
  });

  const playAudio = (word: string, audioUrl?: string) => {
    playPronunciation(word, { audioUrl });
  };

  const handleClearFilters = () => {
    setActiveFilter('all');
    setCollectionFilter('all');
    setSearch('');
  };

  const handleSaveNotes = async (id: string) => {
    await onUpdateNotes(id, notesInput);
    setEditingNotesId(null);
    setNotesInput('');
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    try {
      await onImport(importText);
      setImportStatus('Successfully imported vocabulary!');
      setTimeout(() => {
        setImportModalOpen(false);
        setImportStatus(null);
        setImportText('');
      }, 1200);
    } catch (err) {
      setImportStatus(`Import error: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Advanced Vocabulary Library</h2>
          <p className="view-desc">
            Search, sort, filter, star, and manage all captured words with persistent FSRS memory states
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => setImportModalOpen(true)}>
            📥 Import JSON
          </button>
          <button className="btn-secondary" onClick={onExport}>
            📤 Export Backup
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--line)',
        paddingBottom: '12px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          className={`btn-secondary ${activeFilter === 'all' ? 'btn-primary' : ''}`}
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={() => setActiveFilter('all')}
        >
          All ({items.length})
        </button>
        <button
          className={`btn-secondary ${activeFilter === 'starred' ? 'btn-primary' : ''}`}
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={() => setActiveFilter('starred')}
        >
          ⭐ Starred ({starredCount})
        </button>
        <button
          className={`btn-secondary ${activeFilter === 'due' ? 'btn-primary' : ''}`}
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={() => setActiveFilter('due')}
        >
          🔄 Due for Review ({dueCount})
        </button>
        <button
          className={`btn-secondary ${activeFilter === 'difficult' ? 'btn-primary' : ''}`}
          style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={() => setActiveFilter('difficult')}
        >
          ⚠️ Difficult / Weak ({difficultCount})
        </button>

        {(activeFilter !== 'all' || collectionFilter !== 'all' || search.trim()) && (
          <button
            className="btn-secondary"
            style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}
            onClick={handleClearFilters}
          >
            ✕ Reset Filters
          </button>
        )}
      </div>

      {/* Search and Sort Toolbar */}
      <div className="toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          type="text"
          className="input-search"
          placeholder="Search across words, definitions, translations, context, or notes..."
          style={{ flex: 1, minWidth: '260px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="select-filter"
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          {collections.map((col) => (
            <option key={col} value={col}>
              {col === 'all' ? 'All Collections' : col}
            </option>
          ))}
        </select>

        <select
          className="select-filter"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          style={{ minWidth: '160px' }}
        >
          <option value="recent">Sort: Recently Added</option>
          <option value="alphabetical">Sort: Alphabetical (A-Z)</option>
          <option value="next_review">Sort: Next Review Date</option>
        </select>
      </div>

      {/* Empty States */}
      {sortedItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            {activeFilter === 'starred'
              ? '⭐'
              : activeFilter === 'due'
              ? '🎉'
              : activeFilter === 'difficult'
              ? '🛡️'
              : items.length === 0
              ? '📚'
              : '🔍'}
          </div>
          <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 700 }}>
            {activeFilter === 'starred'
              ? 'No Starred Words'
              : activeFilter === 'due'
              ? 'No Words Due for Review'
              : activeFilter === 'difficult'
              ? 'No Difficult Words Found'
              : items.length === 0
              ? 'Vocabulary Library is Empty'
              : 'No Vocabulary Found'}
          </h3>
          <p style={{ marginTop: '8px', fontSize: '13.5px', maxWidth: '440px', margin: '8px auto 16px auto', lineHeight: '1.5', color: 'var(--text-muted)' }}>
            {activeFilter === 'starred'
              ? 'Click the star icon on any vocabulary card to bookmark words for quick access.'
              : activeFilter === 'due'
              ? 'All caught up! Your memory retention schedules are optimized.'
              : activeFilter === 'difficult'
              ? 'Words with repeated lapses or manual difficulty flags will be listed here.'
              : items.length === 0
              ? 'You have not added any vocabulary words yet. Select text on any webpage to analyze and save words.'
              : 'Try clearing your search query or collection filter to see more items.'}
          </p>
          {items.length === 0 && activeFilter === 'all' && !search.trim() && onLoadSamples && (
            <button
              className="btn-primary"
              style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={onLoadSamples}
            >
              ✨ Load Sample Vocabulary
            </button>
          )}
          {(activeFilter !== 'all' || collectionFilter !== 'all' || search.trim()) && (
            <button className="btn-secondary" onClick={handleClearFilters}>
              Clear Active Filters
            </button>
          )}
        </div>
      ) : (
        <div className="vocab-grid">
          {sortedItems.map((item) => {
            const isDue = FSRSEngine.isDue(item.fsrs, now);
            const weakness = WeaknessDetector.calculateWeakness(item);
            const isHard = item.isMarkedDifficult || weakness.score >= 35;

            return (
              <div
                key={item.id}
                className={`vocab-card ${item.starred ? 'is-starred' : ''} ${isHard ? 'is-difficult' : ''}`}
              >
                <div>
                  <div className="vocab-header">
                    <div className="vocab-word-group">
                      <span className="vocab-word">{item.word}</span>
                      {item.partOfSpeech && (
                        <span className="vocab-pos-pill">{item.partOfSpeech}</span>
                      )}
                      <button
                        className={`vocab-icon-btn ${item.starred ? 'active-star' : ''}`}
                        onClick={() => onToggleStar(item.id)}
                        title={item.starred ? 'Unstar word' : 'Star word'}
                        aria-label="Star word"
                      >
                        {item.starred ? '★' : '☆'}
                      </button>
                      <button
                        className={`vocab-icon-btn ${isHard ? 'active-flag' : ''}`}
                        onClick={() => onToggleDifficult(item.id)}
                        title={item.isMarkedDifficult ? 'Marked difficult (click to unmark)' : 'Mark word as difficult'}
                        aria-label="Mark difficulty"
                      >
                        {isHard ? '🚩' : '⚐'}
                      </button>
                    </div>

                    <div className="vocab-actions-row">
                      <button
                        className="vocab-icon-btn"
                        onClick={() => playAudio(item.word, item.audioUrl)}
                        title="Pronounce"
                        aria-label="Pronounce"
                      >
                        🔊
                      </button>
                      <button
                        className="vocab-icon-btn"
                        onClick={() => setModalItem(item)}
                        title="View Full Details"
                        aria-label="View Details"
                      >
                        👁️
                      </button>
                      {deleteConfirmId === item.id ? (
                        <div className="delete-confirm-box">
                          <button
                            className="delete-confirm-btn"
                            onClick={() => {
                              onDeleteItem(item.id);
                              setDeleteConfirmId(null);
                            }}
                            title="Confirm deletion"
                          >
                            Delete
                          </button>
                          <button
                            className="delete-cancel-btn"
                            onClick={() => setDeleteConfirmId(null)}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="vocab-icon-btn delete-trigger"
                          onClick={() => setDeleteConfirmId(item.id)}
                          title="Delete from library"
                          aria-label="Delete word"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {item.bengaliMeaning && (
                    <div className="vocab-bengali">{item.bengaliMeaning}</div>
                  )}

                  <div className="vocab-def">{item.meaning || item.definition}</div>

                  {item.contextSentence && (
                    <div className="vocab-context">
                      "{item.contextSentence}"
                    </div>
                  )}

                  {/* Personal Notes */}
                  {item.notes ? (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      background: 'var(--fill)',
                      border: '1px solid var(--line)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--text-main)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        <span>📝 Note:</span>
                        <span
                          style={{ cursor: 'pointer', color: 'var(--blue)', textDecoration: 'underline' }}
                          onClick={() => {
                            setEditingNotesId(item.id);
                            setNotesInput(item.notes || '');
                          }}
                        >
                          Edit
                        </span>
                      </div>
                      <div style={{ marginTop: '4px', lineHeight: 1.4 }}>{item.notes}</div>
                    </div>
                  ) : editingNotesId === item.id ? (
                    <div style={{ marginTop: '10px' }}>
                      <textarea
                        style={{
                          width: '100%',
                          height: '56px',
                          background: 'var(--input-bg)',
                          border: '1px solid var(--input-border)',
                          borderRadius: '8px',
                          color: 'var(--text-main)',
                          fontSize: '12px',
                          padding: '8px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit'
                        }}
                        placeholder="Add personal mnemonic or note..."
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setEditingNotesId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '11px', padding: '3px 10px' }}
                          onClick={() => handleSaveNotes(item.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        padding: '4px 0',
                        marginTop: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500
                      }}
                      onClick={() => {
                        setEditingNotesId(item.id);
                        setNotesInput('');
                      }}
                    >
                      + Add personal note
                    </button>
                  )}
                </div>

                <div className="vocab-meta">
                  <span className="tag-badge">{item.collection || 'General'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isDue ? (
                      <span className="fsrs-badge due">⏰ Due</span>
                    ) : (
                      <span className="fsrs-badge ok">✓ Learned</span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontWeight: 500 }}>
                      Reps: {item.fsrs?.reps || 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Full Detail Modal */}
      {modalItem && (
        <div className="sheet-backdrop" onClick={() => setModalItem(null)}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.025em' }}>{modalItem.word}</h2>
                <button
                  className="btn-secondary"
                  style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                  onClick={() => playAudio(modalItem.word, modalItem.audioUrl)}
                >
                  🔊
                </button>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
                onClick={() => setModalItem(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '17px', color: 'var(--blue)', fontWeight: 600, marginBottom: '8px' }}>
              {modalItem.bengaliMeaning}
            </div>

            <p style={{ color: 'var(--text-main)', fontSize: '14.5px', lineHeight: '1.5', marginBottom: '14px' }}>
              {modalItem.meaning || modalItem.definition}
            </p>

            {modalItem.bengaliExplanation && (
              <div style={{ padding: '10px 14px', background: 'rgba(0, 113, 227, 0.08)', borderRadius: '10px', borderLeft: '3px solid var(--blue)', marginBottom: '14px' }}>
                <strong style={{ fontSize: '12px', color: 'var(--blue)' }}>Contextual Nuance & Analysis:</strong>
                <p style={{ color: 'var(--text-main)', fontSize: '13px', marginTop: '3px' }}>
                  {modalItem.bengaliExplanation}
                </p>
              </div>
            )}

            {modalItem.contextSentence && (
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Original Reading Context:</span>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px', padding: '8px 12px', background: 'var(--fill)', borderRadius: '8px' }}>
                  "{modalItem.contextSentence}"
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'var(--fill)', padding: '12px', borderRadius: '12px', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>FSRS State</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase', marginTop: '2px' }}>
                  {modalItem.fsrs?.state || 'new'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Memory Stability</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--blue)', marginTop: '2px' }}>
                  {modalItem.fsrs?.stability?.toFixed(1) || '0'} days
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>Total Repetitions</span>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {modalItem.fsrs?.reps || 0}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                style={{ color: '#ef4444', padding: '6px 12px', fontSize: '12px' }}
                onClick={() => {
                  onDeleteItem(modalItem.id);
                  setModalItem(null);
                }}
                title="Delete this word from library"
              >
                🗑️ Delete
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={() => setModalItem(null)}>
                  Close
                </button>
                {onSelectForCoach && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      onSelectForCoach(modalItem.word);
                      setModalItem(null);
                    }}
                  >
                    ✍️ Practice in Coach
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {importModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}>
            <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 600 }}>Import Vocabulary JSON</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 14px 0' }}>
              Paste valid LexiFlow export JSON to merge into your library safely without creating duplicate items.
            </p>
            <textarea
              style={{
                width: '100%',
                height: '160px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '10px',
                color: 'var(--text-main)',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
              placeholder='{"vocabulary": [...]}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importStatus && (
              <p style={{ marginTop: '8px', fontSize: '12px', color: importStatus.includes('error') ? '#ef4444' : '#10b981' }}>
                {importStatus}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="btn-secondary" onClick={() => setImportModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleImportSubmit}>
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
