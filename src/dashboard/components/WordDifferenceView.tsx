import React, { useState } from 'react';
import { WordComparisonResult } from '../../types';

export const WordDifferenceView: React.FC = () => {
  const [wordA, setWordA] = useState('scrutiny');
  const [wordB, setWordB] = useState('examination');
  const [result, setResult] = useState<WordComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCompare = () => {
    if (!wordA.trim() || !wordB.trim()) return;
    setLoading(true);

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'COMPARE_WORDS',
        payload: { wordA, wordB }
      }, (res) => {
        setLoading(false);
        if (res?.success && res.data) {
          setResult(res.data);
        }
      });
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Word Difference Engine</h2>
          <p className="view-desc">
            Master nuanced distinctions between confusing or closely related English words
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Word 1:
            </label>
            <input
              type="text"
              className="input-search"
              style={{ width: '100%' }}
              value={wordA}
              onChange={(e) => setWordA(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Word 2:
            </label>
            <input
              type="text"
              className="input-search"
              style={{ width: '100%' }}
              value={wordB}
              onChange={(e) => setWordB(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={handleCompare} disabled={loading} style={{ height: '38px' }}>
            {loading ? 'Comparing...' : '⚖️ Compare Nuance'}
          </button>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', alignSelf: 'center' }}>Presets:</span>
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => { setWordA('mitigate'); setWordB('alleviate'); }}>
            mitigate vs alleviate
          </button>
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => { setWordA('scrutiny'); setWordB('examination'); }}>
            scrutiny vs examination
          </button>
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => { setWordA('affect'); setWordB('effect'); }}>
            affect vs effect
          </button>
          <button className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }} onClick={() => { setWordA('economic'); setWordB('economical'); }}>
            economic vs economical
          </button>
        </div>
      </div>

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <h4 style={{ color: '#d97706', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '6px' }}>
              Core Semantic Difference:
            </h4>
            <p style={{ fontSize: '15px', color: 'var(--text-main)', lineHeight: '1.5', fontWeight: 600 }}>
              {result.coreDifference}
            </p>
            <div style={{ marginTop: '10px', color: '#48484a', fontSize: '14px', lineHeight: '1.5' }}>
              {result.bengaliDifference}
            </div>
          </div>

          <div className="card">
            <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
              Minimal-Pair Example Comparisons:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {result.minimalPairs.map((pair, i) => (
                <div key={i} style={{ background: 'rgba(0, 0, 0, 0.02)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '8px' }}>
                      <strong style={{ color: 'var(--accent)', fontSize: '12px' }}>{result.wordA}:</strong>
                      <p style={{ color: 'var(--text-main)', fontSize: '13.5px', marginTop: '2px' }}>"{pair.sentenceA}"</p>
                    </div>
                    <div style={{ borderLeft: '2px solid var(--success)', paddingLeft: '8px' }}>
                      <strong style={{ color: 'var(--success)', fontSize: '12px' }}>{result.wordB}:</strong>
                      <p style={{ color: 'var(--text-main)', fontSize: '13.5px', marginTop: '2px' }}>"{pair.sentenceB}"</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    💡 {pair.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h5 style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Collocations with "{result.wordA}":
              </h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {result.commonCollocationsA.map((c, i) => (
                  <span key={i} className="tag-badge" style={{ color: 'var(--text-main)' }}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <h5 style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Collocations with "{result.wordB}":
              </h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {result.commonCollocationsB.map((c, i) => (
                  <span key={i} className="tag-badge" style={{ color: 'var(--text-main)' }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
