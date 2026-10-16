import React, { useState } from 'react';
import { SentenceXRayResult } from '../../types';

export const SentenceXRayView: React.FC = () => {
  const [sentence, setSentence] = useState(
    'Despite growing concerns regarding global supply chain disruptions, the pharmaceutical company maintained its production targets without compromising quality standards.'
  );
  const [result, setResult] = useState<SentenceXRayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    if (!sentence.trim()) return;
    setLoading(true);
    setError(null);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: 'EXPLAIN_SENTENCE',
          payload: { sentence }
        }, (res) => {
          setLoading(false);
          if (chrome.runtime?.lastError) {
            setError(chrome.runtime.lastError.message || 'Failed to connect to background service.');
            return;
          }
          if (res?.success && res.data) {
            setResult(res.data);
          } else {
            setError(res?.error || 'Failed to analyze sentence');
          }
        });
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || 'Failed to send sentence analysis request.');
      }
    } else {
      setLoading(false);
      setError('Extension messaging runtime unavailable.');
    }
  };

  const clauses = Array.isArray(result?.clauses) ? result.clauses : [];
  const rawFeatures = result?.grammaticalFeatures || (result as any)?.grammaticalHighlights || [];
  const features = Array.isArray(rawFeatures) ? rawFeatures : [String(rawFeatures)];
  const phrases = Array.isArray((result as any)?.phraseBreakdown) ? (result as any).phraseBreakdown : [];
  const vocabList = Array.isArray((result as any)?.difficultVocabulary) ? (result as any).difficultVocabulary : [];
  const paraphraseText = result?.paraphrase || (result as any)?.plainEnglishParaphrase || (result as any)?.overallMeaning || '';

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">Sentence X-Ray</h2>
          <p className="view-desc">
            Deconstruct complex English sentences into digestible syntactic clauses with bilingual Bengali explanations
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
          English Sentence to Analyze:
        </label>
        <textarea
          style={{
            width: '100%',
            height: '90px',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            color: 'var(--text-main)',
            padding: '12px',
            fontSize: '14px',
            lineHeight: '1.4',
            resize: 'vertical',
            outline: 'none',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)'
          }}
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Deconstructing Sentence...' : '🔬 Analyze Sentence Structures'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid #ef4444', color: '#b91c1c', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <h4 style={{ color: 'var(--accent)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '6px' }}>
              Natural Bengali Translation:
            </h4>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.5' }}>
              {result.bengaliTranslation || 'অনুবাদের প্রস্তুতি চলছে...'}
            </p>
            {paraphraseText && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Simple English Paraphrase:</span>
                <p style={{ fontSize: '13.5px', color: '#48484a', marginTop: '2px' }}>{paraphraseText}</p>
              </div>
            )}
          </div>

          {phrases.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
                Phrase-by-Phrase Breakdown:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {phrases.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '14px', marginBottom: '2px' }}>
                      "{item.phrase}"
                    </div>
                    {item.easyEnglish && (
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '2px' }}>
                        {item.easyEnglish}
                      </div>
                    )}
                    {item.easyBengali && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {item.easyBengali}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {clauses.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
                Syntactic Clause Breakdown:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {clauses.map((clause, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="tag-badge" style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>
                        {clause.type || 'clause'}
                      </span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{clause.role || 'Clause'}</strong>
                    </div>
                    <div style={{ fontStyle: 'italic', color: '#48484a', fontSize: '13.5px', margin: '4px 0' }}>
                      "{clause.text}"
                    </div>
                    {clause.explanationBengali && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {clause.explanationBengali}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h5 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Grammatical Features
              </h5>
              {features.length > 0 ? (
                <ul style={{ listStyle: 'disc', paddingLeft: '18px', fontSize: '13px', color: '#48484a' }}>
                  {features.map((feat, i) => (
                    <li key={i}>{feat}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Standard complex sentence structure</p>
              )}
            </div>
            <div>
              <h5 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Tone & Register
              </h5>
              <span className="tag-badge" style={{ color: 'var(--warning)', fontSize: '13px', padding: '4px 10px' }}>
                {result.toneAndRegister || 'Standard English'}
              </span>
            </div>
          </div>

          {vocabList.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
                Key Vocabulary in Context:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {vocabList.map((vocab: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '13.5px' }}>{vocab.word}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '2px' }}>{vocab.meaningInContext}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{vocab.bengali}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
