import React from 'react';
import { VocabularyItem } from '../../types';
import { WeaknessDetector } from '../../services/weakness/detector';

interface AnalyticsViewProps {
  items: VocabularyItem[];
  dueCount: number;
  onNavigateToTargetedPractice?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  items,
  dueCount,
  onNavigateToTargetedPractice
}) => {
  const total = items.length;
  const learningCount = items.filter((i) => i.fsrs.state === 'learning').length;
  const reviewCount = items.filter((i) => i.fsrs.state === 'review').length;
  const newCount = items.filter((i) => i.fsrs.state === 'new').length;

  const totalReps = items.reduce((acc, curr) => acc + (curr.fsrs?.reps || 0), 0);
  const totalLapses = items.reduce((acc, curr) => acc + (curr.fsrs?.lapses || 0), 0);
  const avgStability = total > 0
    ? (items.reduce((acc, curr) => acc + (curr.fsrs?.stability || 0), 0) / total).toFixed(1)
    : '0';

  // Weakness detection calculations
  const weakItems = items.filter((i) => {
    if (i.dismissedFromWeakness) return false;
    return i.isMarkedDifficult || i.difficulty === 'hard' || WeaknessDetector.calculateWeakness(i).score >= 35;
  });

  const highPriorityWeakness = [...weakItems].sort((a, b) => {
    return WeaknessDetector.calculateWeakness(b).score - WeaknessDetector.calculateWeakness(a).score;
  }).slice(0, 4);

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Learning Analytics & Retention Engine</h2>
          <p className="view-desc">
            Evidence-based retention metrics, Free Spaced Repetition Scheduler (FSRS) stability, and Personal Weakness Diagnostics
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Vocabulary Saved</span>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--accent)', marginTop: '6px' }}>
            {total}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Due for Review Today</span>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: dueCount > 0 ? 'var(--warning)' : 'var(--success)', marginTop: '6px' }}>
            {dueCount}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Review Repetitions</span>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--purple)', marginTop: '6px' }}>
            {totalReps}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Memory Lapses Recorded</span>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: totalLapses > 0 ? 'var(--danger)' : 'var(--success)', marginTop: '6px' }}>
            {totalLapses}
          </div>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Memory Stability ($S$)</span>
          <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--success)', marginTop: '6px' }}>
            {avgStability} days
          </div>
        </div>
      </div>

      {/* Personal Weakness Detector Overview Banner */}
      <div className="card" style={{
        marginBottom: '24px',
        borderLeft: `4px solid ${weakItems.length > 0 ? '#f59e0b' : '#10b981'}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: 600, margin: 0 }}>
              Personal Weakness Detector
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '2px' }}>
              Identifies vocabulary with repeated lapses, low retention stability, or repeated "Again" ratings
            </p>
          </div>

          {onNavigateToTargetedPractice && (
            <button
              className="btn-primary"
              style={{ fontSize: '12.5px', padding: '6px 14px' }}
              onClick={onNavigateToTargetedPractice}
            >
              🎯 Open Targeted Practice ({weakItems.length})
            </button>
          )}
        </div>

        {weakItems.length === 0 ? (
          <p style={{ color: 'var(--success)', fontSize: '13.5px' }}>
            ✓ Excellent retention health! No words currently exceed the vulnerability threshold.
          </p>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: '#d97706', marginBottom: '10px', fontWeight: 500 }}>
              ⚠️ Found {weakItems.length} vulnerable words needing prioritized practice:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {highPriorityWeakness.map((item) => {
                const signal = WeaknessDetector.calculateWeakness(item);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '14px' }}>{item.word}</strong>
                      <span className="tag-badge" style={{ color: signal.score >= 60 ? 'var(--danger)' : 'var(--warning)', fontSize: '10.5px' }}>
                        Score: {signal.score}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '2px', fontWeight: 500 }}>
                      {item.bengaliMeaning}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {signal.reasons[0] || 'Requires retention reinforcement'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Memory State Distribution */}
      <div className="card">
        <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
          Memory State Distribution
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Stable Review ({reviewCount})</span>
              <span>{total > 0 ? Math.round((reviewCount / total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(0, 0, 0, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${total > 0 ? (reviewCount / total) * 100 : 0}%`, background: 'var(--success)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Active Learning ({learningCount})</span>
              <span>{total > 0 ? Math.round((learningCount / total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(0, 0, 0, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${total > 0 ? (learningCount / total) * 100 : 0}%`, background: 'var(--warning)' }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>New / Unreviewed ({newCount})</span>
              <span>{total > 0 ? Math.round((newCount / total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${total > 0 ? (newCount / total) * 100 : 0}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
