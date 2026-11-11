import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  BrainCircuit,
  Sparkles,
  Search,
  CheckCircle2,
  RotateCw,
  Flame,
  ArrowRight,
  BookOpen,
  Award,
  Layers,
  ChevronRight,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import {
  MistakeMemoryClient,
  MistakeMemoryItem,
  MistakeStats,
  isDue
} from '../../services/mistake/client';
import { DrillSession, DrillCloseButton } from './DrillSession';
import { bengaliHint } from '../../services/mistake/bengaliHints';
import { TaxonomyService, TaxonomyError } from '../../services/taxonomy/catalog';
import { MasteryState } from '../../services/mistake/stateMachine';

interface MistakeMemoryViewProps {
  initialErrorCode?: string | null;
  onClearInitialCode?: () => void;
  /** Bengali explanations are shown when the learner's language is Bengali */
  targetLanguage?: string;
}

export const MistakeMemoryView: React.FC<MistakeMemoryViewProps> = ({
  initialErrorCode,
  onClearInitialCode,
  targetLanguage = 'bn'
}) => {
  const showBn = targetLanguage === 'bn';
  const [items, setItems] = useState<MistakeMemoryItem[]>([]);
  const [stats, setStats] = useState<MistakeStats>({
    total: 0,
    byState: { New: 0, Practising: 0, Improving: 0, Mastered: 0, Reopened: 0 },
    byCategory: {},
    masteredPercentage: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');
  const [activeDrillItem, setActiveDrillItem] = useState<{
    item: MistakeMemoryItem;
    taxError: TaxonomyError;
  } | null>(null);

  // Each opened session gets a fresh key so the drills are rebuilt
  const [sessionKey, setSessionKey] = useState(0);
  const [dueItems, setDueItems] = useState<MistakeMemoryItem[]>([]);

  const loadData = () => {
    const loaded = MistakeMemoryClient.getMistakes();
    setItems(loaded);
    setStats(MistakeMemoryClient.getStats());
    setDueItems(MistakeMemoryClient.getDueMistakes());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('lexiflow_mistakes_updated', handleUpdate);
    return () => window.removeEventListener('lexiflow_mistakes_updated', handleUpdate);
  }, []);

  const handledInitialRef = useRef<string | null>(null);

  // Handle direct navigation to a specific error code
  useEffect(() => {
    if (initialErrorCode && handledInitialRef.current !== initialErrorCode && items.length > 0) {
      handledInitialRef.current = initialErrorCode;
      const match = items.find((i) => i.errorCode === initialErrorCode);
      if (match) {
        const taxError = TaxonomyService.getError(match.errorCode);
        if (taxError) {
          openDrill(match, taxError);
        }
      }
      onClearInitialCode?.();
    }
  }, [initialErrorCode, items]);

  const openDrill = (item: MistakeMemoryItem, taxError: TaxonomyError) => {
    // Opening a drill only moves new or returning mistakes to Practising; progress is kept otherwise
    const opened =
      item.masteryState === 'New' || item.masteryState === 'Reopened'
        ? MistakeMemoryClient.startPractice(item.errorCode)
        : item;
    setActiveDrillItem({ item: opened, taxError });
    setSessionKey((k) => k + 1);
  };

  const closeDrill = () => {
    setActiveDrillItem(null);
    loadData();
  };

  /** The next due mistake after the one being practised, if any */
  const nextDue = (() => {
    if (!activeDrillItem) return null;
    const fresh = MistakeMemoryClient.getDueMistakes();
    const candidate = fresh.find((i) => i.errorCode !== activeDrillItem.item.errorCode);
    const tax = candidate ? TaxonomyService.getError(candidate.errorCode) : undefined;
    return candidate && tax ? { item: candidate, tax } : null;
  })();

  const startDueReview = () => {
    const first = dueItems[0];
    const tax = first ? TaxonomyService.getError(first.errorCode) : undefined;
    if (first && tax) openDrill(first, tax);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const tax = TaxonomyService.getError(item.errorCode);
    const matchesSearch =
      searchQuery === '' ||
      item.errorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tax?.name && tax.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tax?.definition && tax.definition.toLowerCase().includes(searchQuery.toLowerCase()));

    const category = item.errorCode.split('.')[0] || 'OTHER';
    const matchesCat = selectedCategory === 'ALL' || category === selectedCategory;

    const matchesState =
      selectedStateFilter === 'ALL'
        ? true
        : selectedStateFilter === 'ACTIVE'
          ? item.masteryState !== 'Mastered'
          : item.masteryState === selectedStateFilter;

    return matchesSearch && matchesCat && matchesState;
  });

  const CATEGORY_LABELS: Record<string, string> = {
    ALL: 'All',
    GRA: 'Grammar',
    VOC: 'Vocabulary',
    MEC: 'Spelling & punctuation',
    PTE: 'PTE skills',
    IELTS: 'IELTS skills'
  };
  // Exam-skill chips only appear when the learner has such mistakes
  const presentCats = new Set(items.map((i) => i.errorCode.split('.')[0]));
  const categories = Object.keys(CATEGORY_LABELS).filter((c) => !['PTE', 'IELTS'].includes(c) || presentCats.has(c));

  const STATES: { state: MasteryState; label: string; hint: string }[] = [
    { state: 'New', label: 'New', hint: 'Just found in your practice' },
    { state: 'Practising', label: 'Practising', hint: 'You are working on it' },
    { state: 'Improving', label: 'Improving', hint: 'Passed one review' },
    { state: 'Mastered', label: 'Mastered', hint: 'Passed two spaced reviews' },
    { state: 'Reopened', label: 'Came back', hint: 'Showed up again after mastering' }
  ];

  const hasMistakes = stats.total > 0 || items.length > 0;

  return (
    <div className="view-container mm-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Mistakes</h2>
          <p className="view-desc">Errors from your writing and speaking practice. Pass two spaced reviews and it's mastered.</p>
        </div>
        {hasMistakes && (
          <div className="mm-progress" title="Share of your mistakes you have mastered">
            <strong>{stats.masteredPercentage}%</strong>
            <span>
              mastered · {stats.byState.Mastered} of {stats.total}
            </span>
            <span className="mm-estimate" data-testid="mistake-estimate-label">
              LexiFlow estimate
            </span>
          </div>
        )}
      </div>

      {hasMistakes && dueItems.length > 0 && (
        <div className="mm-due" data-testid="mm-due-banner">
          <div>
            <strong>
              {dueItems.length} mistake{dueItems.length === 1 ? '' : 's'} to review today
            </strong>
            <span>Short drills with new sentences each time, including your own.</span>
          </div>
          <button type="button" className="btn-primary" data-testid="mm-start-review" onClick={startDueReview}>
            <Sparkles size={14} /> Start review
          </button>
        </div>
      )}

      {!hasMistakes ? (
        <div className="mm-empty" data-testid="mistake-empty">
          <div className="mm-empty-icon">
            <BrainCircuit size={26} />
          </div>
          <h3>No mistakes yet</h3>
          <p>
            When Smart Practice marks your writing or speaking, the errors it finds are saved here. Each one comes with a short
            drill so you can fix it for good.
          </p>
        </div>
      ) : (
        <>
          <div className="mm-states" role="tablist" aria-label="Filter by progress">
            {STATES.map((s) => (
              <button
                key={s.state}
                type="button"
                role="tab"
                aria-selected={selectedStateFilter === s.state}
                data-testid={`state-card-${s.state}`}
                className={`mm-state state-${s.state.toLowerCase()} ${selectedStateFilter === s.state ? 'active' : ''}`}
                onClick={() => setSelectedStateFilter(selectedStateFilter === s.state ? 'ALL' : s.state)}
                title={s.hint}
              >
                <span className="mm-state-dot" />
                <span className="mm-state-label">{s.label}</span>
                <span className="mm-state-count">{stats.byState[s.state]}</span>
              </button>
            ))}
          </div>

          <div className="mm-toolbar">
            <div className="search-input-wrapper mm-search">
              <Search size={15} className="search-icon" />
              <input
                data-testid="mistake-search-input"
                className="input-search"
                type="text"
                placeholder="Search mistakes or rules…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mm-chips">
              {categories.map((cat) => (
                <button
                  key={cat}
                  data-testid={`cat-pill-${cat}`}
                  type="button"
                  className={`mm-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div className="mm-list">
            {filteredItems.length === 0 ? (
              <div className="mm-empty small">
                <h3>Nothing matches</h3>
                <p>Try another search or filter.</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setSelectedStateFilter('ALL');
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const tax = TaxonomyService.getError(item.errorCode);
                return (
                  <div key={item.id} data-testid={`mistake-card-${item.errorCode}`} className="mm-card">
                    <div className="mm-card-head">
                      <div className="mm-card-title">
                        <h3>{tax?.name || item.errorCode}</h3>
                        <span className={`mm-badge state-${item.masteryState.toLowerCase()}`}>
                          {item.masteryState === 'Reopened' ? 'Came back' : item.masteryState}
                        </span>
                        {isDue(item) && (
                          <span className="mm-badge mm-due-badge" data-testid={`due-badge-${item.errorCode}`}>
                            Due today
                          </span>
                        )}
                      </div>
                      {tax && (
                        <button
                          data-testid={`practice-btn-${item.errorCode}`}
                          type="button"
                          className="btn-primary mm-practice"
                          onClick={() => openDrill(item, tax)}
                        >
                          <Sparkles size={14} /> Practise
                        </button>
                      )}
                    </div>

                    {tax?.definition && <p className="mm-def">{tax.definition}</p>}
                    {showBn && bengaliHint(item.errorCode) && (
                      <p className="mm-bn" lang="bn" data-testid={`bn-hint-${item.errorCode}`}>
                        {bengaliHint(item.errorCode)}
                      </p>
                    )}

                    {tax && (
                      <div className="mm-examples">
                        <div className="mm-example wrong">
                          <X size={14} />
                          <span>{tax.incorrect_example}</span>
                        </div>
                        <div className="mm-example right">
                          <Check size={14} />
                          <span>{tax.correct_example}</span>
                        </div>
                      </div>
                    )}

                    <div className="mm-meta">
                      <span>Seen {item.totalOccurrences}×</span>
                      <span>Fixed {item.successfulCorrections} of 2</span>
                      <span>Review in {item.nextReviewDays} day{item.nextReviewDays === 1 ? '' : 's'}</span>
                      <span className="mm-meta-right">
                        {CATEGORY_LABELS[item.errorCode.split('.')[0]] || item.errorCode.split('.')[0]} · {item.errorCode}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Improvement Lab Drill Modal */}
      {activeDrillItem && (
        <div
          data-testid="improvement-lab-modal"
          className="sheet-backdrop"
          onClick={closeDrill}
        >
          <div
            className="sheet-card"
            style={{ width: '640px', maxWidth: '92vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--purple)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    Practise this mistake
                  </span>
                  <span style={{ fontSize: '11px', background: 'var(--fill)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line)' }}>
                    LexiFlow estimate
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Fix: {activeDrillItem.taxError.name}
                </h3>
              </div>
              <DrillCloseButton onClick={closeDrill} />
            </div>

            <p className="drill-def">{activeDrillItem.taxError.definition}</p>
            {showBn && bengaliHint(activeDrillItem.taxError.code) && (
              <p className="mm-bn drill-bn" lang="bn">
                {bengaliHint(activeDrillItem.taxError.code)}
              </p>
            )}

            <DrillSession
              key={sessionKey}
              item={activeDrillItem.item}
              taxError={activeDrillItem.taxError}
              onClose={closeDrill}
              nextDueLabel={nextDue ? nextDue.tax.name : null}
              onNextDue={nextDue ? () => openDrill(nextDue.item, nextDue.tax) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
};
