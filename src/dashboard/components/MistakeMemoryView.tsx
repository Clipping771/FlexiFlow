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
  MistakeStats
} from '../../services/mistake/client';
import { TaxonomyService, TaxonomyError } from '../../services/taxonomy/catalog';
import { MasteryState } from '../../services/mistake/stateMachine';

interface MistakeMemoryViewProps {
  initialErrorCode?: string | null;
  onClearInitialCode?: () => void;
}

export const MistakeMemoryView: React.FC<MistakeMemoryViewProps> = ({
  initialErrorCode,
  onClearInitialCode
}) => {
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

  // Drill state
  const [drillInput, setDrillInput] = useState('');
  const [drillResult, setDrillResult] = useState<{
    submitted: boolean;
    isCorrect: boolean;
    feedback: string;
  } | null>(null);

  const loadData = () => {
    const loaded = MistakeMemoryClient.getMistakes();
    setItems(loaded);
    setStats(MistakeMemoryClient.getStats());
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
    MistakeMemoryClient.startPractice(item.errorCode);
    setActiveDrillItem({ item, taxError });
    setDrillInput('');
    setDrillResult(null);
  };

  const closeDrill = () => {
    setActiveDrillItem(null);
    setDrillInput('');
    setDrillResult(null);
    loadData();
  };

  const handleDrillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrillItem) return;

    // The learner rewrites the incorrect example; it counts when it matches the corrected sentence,
    // ignoring case, punctuation and spacing
    const normalise = (text: string) =>
      text
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^\w\s']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const isCorrect =
      normalise(drillInput).length > 0 && normalise(drillInput) === normalise(activeDrillItem.taxError.correct_example);

    const updated = MistakeMemoryClient.recordPracticeAttempt(
      activeDrillItem.item.errorCode,
      isCorrect
    );

    setDrillResult({
      submitted: true,
      isCorrect,
      feedback: isCorrect
        ? `Great job! Error state progressed to ${updated.masteryState}. Next FSRS spaced review scheduled in ${updated.nextReviewDays} day(s).`
        : `Not quite. Expected: "${activeDrillItem.taxError.correct_example}". Keep practicing to build permanent muscle memory!`
    });

    setActiveDrillItem((prev) => (prev ? { ...prev, item: updated } : null));
    loadData();
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

  const categories = ['ALL', 'GRA', 'VOC', 'MEC', 'PTE', 'IELTS'];

  const getBadgeStyle = (state: MasteryState) => {
    switch (state) {
      case 'New':
        return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' };
      case 'Practising':
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'Improving':
        return { background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
      case 'Mastered':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'Reopened':
        return { background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)' };
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
      case 'high':
        return { background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' };
      case 'medium':
        return { background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' };
      default:
        return { background: 'var(--fill)', color: 'var(--text-muted)' };
    }
  };

  return (
    <div className="mistake-memory-view" style={{ maxWidth: '1100px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--purple)', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              Pedagogical Core
            </span>
            <span
              data-testid="mistake-estimate-label"
              style={{ fontSize: '11px', background: 'var(--fill)', border: '1px solid var(--line)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px' }}
            >
              LexiFlow estimate
            </span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrainCircuit size={26} style={{ color: 'var(--purple)' }} />
            Mistake Memory &amp; Improvement Lab
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
            Track recurring errors, practice targeted retrieval drills, and graduate mistakes to Mastered.
          </p>
        </div>

        {/* Overall Mastery Pill */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', padding: '12px 18px', borderRadius: '12px', textAlign: 'right', boxShadow: 'var(--shadow-card)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            Mastery Progress
          </span>
          <span style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)' }}>
            {stats.masteredPercentage}%
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-subtle)', marginLeft: '6px' }}>
            ({stats.byState.Mastered} / {stats.total} Mastered)
          </span>
        </div>
      </div>

      {/* 5-State Life-Cycle Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { state: 'New', count: stats.byState.New, color: '#3b82f6', desc: 'Detected in tasks' },
          { state: 'Practising', count: stats.byState.Practising, color: '#f59e0b', desc: 'In active drills' },
          { state: 'Improving', count: stats.byState.Improving, color: '#a855f7', desc: '1 correction verified' },
          { state: 'Mastered', count: stats.byState.Mastered, color: '#10b981', desc: 'Streak 2+ & FSRS' },
          { state: 'Reopened', count: stats.byState.Reopened, color: '#f43f5e', desc: 'Relapsed in task' }
        ].map((s) => (
          <div
            key={s.state}
            data-testid={`state-card-${s.state}`}
            onClick={() => setSelectedStateFilter(s.state)}
            style={{
              background: 'var(--card)',
              border: selectedStateFilter === s.state ? `2px solid ${s.color}` : '1px solid var(--card-border)',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: s.color }}>{s.state}</span>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>{s.count}</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px', marginBottom: '24px', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
            <input
              data-testid="mistake-search-input"
              type="text"
              placeholder="Search error codes or grammar rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: '8px',
                padding: '9px 12px 9px 36px',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                data-testid={`cat-pill-${cat}`}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedCategory === cat ? 'var(--blue-grad)' : 'var(--fill)',
                  color: selectedCategory === cat ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          {/* State Filter */}
          <div style={{ display: 'flex', background: 'var(--fill)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line)' }}>
            {['ALL', 'ACTIVE', 'Mastered'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedStateFilter(f)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedStateFilter === f ? 'var(--card)' : 'transparent',
                  color: selectedStateFilter === f ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: selectedStateFilter === f ? 'var(--shadow-card)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {f === 'ACTIVE' ? 'Active In-Progress' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mistake Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredItems.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', boxShadow: 'var(--shadow-card)' }}>
            <Sparkles size={36} style={{ margin: '0 auto 12px auto', color: 'var(--blue)', opacity: 0.8 }} />
            <h3 style={{ fontSize: '16px', color: 'var(--text-main)', margin: '0 0 6px 0' }}>No mistakes match your filter</h3>
            <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-muted)' }}>
              Try clearing your search query or practice more Writing and Speaking tasks!
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const tax = TaxonomyService.getError(item.errorCode);
            const stateStyle = getBadgeStyle(item.masteryState);
            const sevStyle = getSeverityStyle(tax?.severity || 'medium');

            return (
              <div
                key={item.id}
                data-testid={`mistake-card-${item.errorCode}`}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative',
                  boxShadow: 'var(--shadow-card)'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'monospace', background: 'var(--fill)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--line)' }}>
                      {item.errorCode}
                    </span>
                    <span style={{ ...sevStyle, fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>
                      {tax?.severity || 'medium'}
                    </span>
                    <span style={{ ...stateStyle, fontSize: '11px', padding: '2px 10px', borderRadius: '12px', fontWeight: 700 }}>
                      {item.masteryState}
                    </span>
                  </div>

                  {/* Action button */}
                  {tax && (
                    <button
                      data-testid={`practice-btn-${item.errorCode}`}
                      type="button"
                      onClick={() => openDrill(item, tax)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--blue-grad)',
                        border: 'none',
                        color: '#ffffff',
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease'
                      }}
                    >
                      <Sparkles size={14} />
                      Improvement Lab Drill
                    </button>
                  )}
                </div>

                {/* Name & Definition */}
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {tax?.name || item.errorCode}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                  {tax?.definition}
                </p>

                {/* Examples */}
                {tax && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                        ❌ Common Mistake:
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                        {tax.incorrect_example}
                      </span>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                        ✓ Corrected Pattern:
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                        {tax.correct_example}
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer metadata */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-subtle)', borderTop: '1px solid var(--line)', paddingTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <span>Occurrences: <strong style={{ color: 'var(--text-main)' }}>{item.totalOccurrences}</strong></span>
                    <span>Correction Streak: <strong style={{ color: 'var(--green)' }}>{item.successfulCorrections}/2</strong></span>
                    <span>Next Spaced Review: <strong style={{ color: 'var(--text-main)' }}>In {item.nextReviewDays}d</strong></span>
                  </div>
                  <span>Last Seen: {new Date(item.lastSeenAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

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
                    Improvement Lab Drill
                  </span>
                  <span style={{ fontSize: '11px', background: 'var(--fill)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--line)' }}>
                    LexiFlow estimate
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Fix: {activeDrillItem.taxError.name}
                </h3>
              </div>
              <button
                data-testid="close-drill-btn"
                type="button"
                onClick={closeDrill}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drill Instructions */}
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {activeDrillItem.taxError.definition}
            </p>

            {/* The Incorrect Challenge Sentence */}
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Sentence with error:
              </span>
              <p style={{ fontSize: '14px', color: 'var(--text-main)', margin: 0, fontWeight: 500 }}>
                "{activeDrillItem.taxError.incorrect_example}"
              </p>
            </div>

            {/* Active Drill Form */}
            <form onSubmit={handleDrillSubmit}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Type the fully corrected sentence:
              </label>
              <textarea
                data-testid="drill-input"
                rows={3}
                placeholder="Rewrite the sentence with the error fixed..."
                value={drillInput}
                onChange={(e) => setDrillInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '10px',
                  padding: '12px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '14px'
                }}
              />

              {drillResult && (
                <div
                  data-testid="drill-result-banner"
                  style={{
                    background: drillResult.isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: drillResult.isCorrect ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  {drillResult.isCorrect ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                    {drillResult.feedback}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={closeDrill}
                  className="btn-secondary"
                >
                  Done
                </button>
                <button
                  data-testid="submit-drill-btn"
                  type="submit"
                  disabled={!drillInput.trim()}
                  className="btn-primary"
                >
                  Submit Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
