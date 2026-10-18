import React, { useState, useEffect } from 'react';
import { SentenceXRayResult } from '../../types';
import { getLanguageConfig } from '../../config/languages';

export const SentenceXRayView: React.FC = () => {
  const [sentence, setSentence] = useState(
    'Although the research team faced unexpected technical hurdles during data collection, they successfully verified the hypothesis by cross-referencing field observations with historical archives.'
  );
  const [result, setResult] = useState<SentenceXRayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedPractice, setRevealedPractice] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('bn');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        if (res?.targetLanguage) {
          setTargetLanguage(res.targetLanguage);
        }
      });
    }
  }, []);

  const handleAnalyze = () => {
    if (!sentence.trim()) return;
    setLoading(true);
    setError(null);
    setRevealedPractice(false);
    setSelectedOption(null);

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
  const structure = result?.sentenceStructure;
  const structureMap = result?.structureMap;
  const grammarRules = result?.grammarRules || [];
  const connectors = result?.connectors || [];
  const wordLevelGrammar = result?.wordLevelGrammar || [];
  const mistakes = result?.commonMistakesAndAlternatives;
  const practice = result?.practice;
  const phraseConstituents = (result as any)?.phraseConstituents || [];
  const conversationalElements = (result as any)?.conversationalElements || [];
  const patternSummary = (result as any)?.patternSummary;

  const langConfig = getLanguageConfig(targetLanguage);
  const isEnglish = targetLanguage === 'en';
  const explanationLabel = isEnglish ? 'Explanation:' : `${langConfig.targetNativeLabel || langConfig.targetLabel} Explanation:`;
  const translationLabel = isEnglish ? 'Natural English Paraphrase:' : `Natural ${langConfig.targetLabel} Translation:`;

  return (
    <div>
      <div className="view-header">
        <div>
          <h2 className="view-title">🔬 Sentence X-Ray &amp; Grammar Clauses</h2>
          <p className="view-desc">
            Deep 9-layer pedagogical grammar deconstruction with simple explanations in your chosen language
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
          English Sentence to Deconstruct:
        </label>
        <textarea
          style={{
            width: '100%',
            height: '90px',
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            borderRadius: '12px',
            color: 'var(--text-main)',
            padding: '12px',
            fontSize: '14px',
            lineHeight: '1.45',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* LAYER 1: UNDERSTAND THE WHOLE SENTENCE */}
          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h4 style={{ color: 'var(--accent)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, margin: 0 }}>
                Layer 1: Understand The Whole Sentence ({translationLabel})
              </h4>
              {structure && (
                <span className="tag-badge" style={{ color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {structure.type} Sentence
                </span>
              )}
            </div>

            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.5', margin: '4px 0 10px 0' }}>
              {result.bengaliTranslation || (isEnglish ? 'Preparing paraphrase...' : 'অনুবাদের প্রস্তুতি চলছে...')}
            </p>

            {paraphraseText && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(0, 113, 227, 0.04)', borderRadius: '8px', border: '1px solid rgba(0, 113, 227, 0.12)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)' }}>Simple English Paraphrase:</span>
                <p style={{ fontSize: '14px', color: 'var(--text-main)', margin: '4px 0 0 0', lineHeight: '1.45' }}>{paraphraseText}</p>
              </div>
            )}

            {result.mainMessage && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-main)' }}>Main Message:</strong> {result.mainMessage}
              </div>
            )}

            {structure && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Structure Overview: </span>
                {structure.explanation} {structure.explanationBengali && (!isEnglish || structure.explanationBengali !== structure.explanation) && !/[\u0980-\u09FF]/.test(structure.explanationBengali) && <span>({structure.explanationBengali})</span>}
              </div>
            )}
          </div>

          {/* LAYER 4: SENTENCE STRUCTURE MAP */}
          {structureMap && (
            <div className="card" style={{ background: 'linear-gradient(180deg, rgba(0,113,227,0.02) 0%, rgba(255,255,255,0.7) 100%)' }}>
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                🗺️ Layer 4: Sentence Structure Map
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Visual hierarchy showing how the main action connects to subordinate clauses and modifiers:
              </p>
              <div style={{ padding: '12px 14px', background: 'rgba(0, 113, 227, 0.06)', borderRadius: '8px', border: '1px solid rgba(0, 113, 227, 0.2)', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0071e3', textTransform: 'uppercase' }}>⭐ Core Main Clause (Anchor):</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                  "{structureMap.rootMainClause}"
                </div>
              </div>

              {structureMap.branches && structureMap.branches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px', borderLeft: '2px solid rgba(0, 113, 227, 0.3)' }}>
                  {structureMap.branches.map((b, idx) => (
                    <div key={idx} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span className="tag-badge" style={{ color: '#0071e3', fontSize: '11px', textTransform: 'uppercase' }}>
                          ↳ {b.relationType}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {b.roleInSentence}
                        </span>
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-main)' }}>
                        "{b.clauseText}"
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLAUSE RELATIONSHIP */}
          {(result as any)?.clauseRelationship && (
            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <h4 style={{ color: '#059669', fontSize: '14px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                🔗 Clause Relationship
              </h4>
              <div style={{ fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px' }}>
                {(result as any).clauseRelationship.formula}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.45' }}>
                {(result as any).clauseRelationship.explanation}
              </div>
              {(result as any).clauseRelationship.explanationBengali && (
                <div style={{ fontSize: '12.5px', color: '#059669', marginTop: '4px', fontWeight: 500 }}>
                  {(result as any).clauseRelationship.explanationBengali}
                </div>
              )}
            </div>
          )}

          {/* RELEVANT GRAMMAR FEATURES */}
          {(result as any)?.relevantGrammarFeatures && (result as any).relevantGrammarFeatures.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid #6366f1' }}>
              <h4 style={{ color: '#4f46e5', fontSize: '14px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                ✨ Relevant Grammar Features
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(result as any).relevantGrammarFeatures.map((feat: any, fIdx: number) => (
                  <div key={fIdx} style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '13px', color: '#4f46e5' }}>{feat.feature}</strong>
                      {feat.text && <code style={{ fontSize: '12px', color: 'var(--text-main)' }}>"{feat.text}"</code>}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>{feat.explanation}</div>
                    {feat.explanationBengali && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{feat.explanationBengali}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LAYER 3: DEEP CLAUSE ANALYSIS */}
          {clauses.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                🧩 Layer 3: Deep Clause Analysis &amp; Syntactic Clause Breakdown:
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Exact syntactic clauses, subject/verb identification, grammatical dependency, and standalone capacity:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {clauses.map((clause, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="tag-badge" style={{ color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 700 }}>
                          {clause.type || 'clause'}
                        </span>
                        {clause.category && (
                          <span style={{ fontSize: '11px', background: 'rgba(0, 113, 227, 0.08)', color: '#0071e3', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {clause.category}
                          </span>
                        )}
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{clause.role || 'Clause'}</strong>
                      </div>
                      <span style={{ fontSize: '11.5px', padding: '2px 8px', borderRadius: '4px', background: clause.canStandAlone ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.1)', color: clause.canStandAlone ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                        {clause.canStandAlone ? '✓ Can Stand Alone (Complete)' : '↳ Dependent (Cannot Stand Alone)'}
                      </span>
                    </div>

                    <div style={{ fontStyle: 'italic', color: 'var(--text-main)', fontSize: '14.5px', margin: '6px 0', fontWeight: 500 }}>
                      "{clause.text}"
                    </div>

                    {clause.subordinator && (
                      <div style={{ fontSize: '12px', color: '#8b5cf6', marginBottom: '4px' }}>
                        <strong>Subordinator:</strong> <code>"{clause.subordinator}"</code>
                      </div>
                    )}

                    {clause.functionDescription && (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginBottom: '6px' }}>
                        <strong>Function:</strong> {clause.functionDescription}
                      </div>
                    )}

                    {clause.typeExplanation && (
                      <div style={{ fontSize: '12.5px', color: '#0071e3', marginBottom: '6px' }}>
                        💡 <em>{clause.typeExplanation}</em>
                      </div>
                    )}

                    {clause.clausePattern && (
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#0071e3', background: 'rgba(0,113,227,0.1)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                          Clause Pattern: {clause.clausePattern}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', margin: '10px 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      {clause.subject && (
                        <div>
                          <strong style={{ color: '#0071e3' }}>Subject:</strong> {clause.subject}
                          {clause.subjectExplanation && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>↳ {clause.subjectExplanation}</div>}
                          {clause.subjectExplanationBengali && <div style={{ fontSize: '11px', color: '#0071e3' }}>↳ {clause.subjectExplanationBengali}</div>}
                        </div>
                      )}
                      {(clause.verbPhrase || clause.verb) && (
                        <div>
                          <strong style={{ color: '#34c759' }}>Verb Phrase:</strong> {clause.verbPhrase || clause.verb}
                          {clause.tenseAspect && <div style={{ fontSize: '11.5px', color: '#15803d', fontWeight: 600 }}>Tense/Aspect: {clause.tenseAspect}</div>}
                          {clause.coordinatedVerbs && clause.coordinatedVerbs.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: '#15803d' }}>
                              Coordinated verbs: {clause.coordinatedVerbs.join(' & ')}
                            </div>
                          )}
                          {clause.verbExplanation && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>↳ {clause.verbExplanation}</div>}
                          {clause.verbExplanationBengali && <div style={{ fontSize: '11px', color: '#34c759' }}>↳ {clause.verbExplanationBengali}</div>}
                        </div>
                      )}
                      {clause.directObject && (
                        <div>
                          <strong style={{ color: '#ff9500' }}>Direct Object:</strong> {clause.directObject}
                          {clause.directObjectExplanation && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>↳ {clause.directObjectExplanation}</div>}
                          {clause.directObjectExplanationBengali && <div style={{ fontSize: '11px', color: '#d97706' }}>↳ {clause.directObjectExplanationBengali}</div>}
                        </div>
                      )}
                      {clause.indirectObject && (
                        <div>
                          <strong style={{ color: '#af52de' }}>Indirect Object:</strong> {clause.indirectObject}
                        </div>
                      )}
                      {clause.complement && (
                        <div>
                          <strong style={{ color: '#ff2d55' }}>Complement:</strong> {clause.complement}
                        </div>
                      )}
                      {clause.questionAnswered && <div><strong>Answers:</strong> {clause.questionAnswered}</div>}
                      {clause.dependsOn && <div><strong>Depends on:</strong> {clause.dependsOn}</div>}
                    </div>

                    {clause.adverbials && clause.adverbials.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '12px', background: 'rgba(0,0,0,0.02)', padding: '6px 10px', borderRadius: '6px' }}>
                        <strong style={{ color: '#5856d6' }}>Adverbials: </strong>
                        {clause.adverbials.map((a: any, aIdx: number) => (
                          <span key={aIdx} style={{ marginRight: '8px' }}>
                            "{a.text}" ({a.explanation})
                          </span>
                        ))}
                      </div>
                    )}

                    {clause.explanationBengali && (
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                        <strong>{explanationLabel}</strong> {clause.explanationBengali}
                      </div>
                    )}

                    {clause.examplePattern && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                        Pattern Example: "{clause.examplePattern}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONVERSATIONAL LANGUAGE & INTERNAL PHRASE CONSTITUENTS */}
          {(conversationalElements.length > 0 || phraseConstituents.length > 0) && (
            <div className="card" style={{ borderLeft: '4px solid #ff2d55' }}>
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                🗣️ Conversational Language &amp; Detailed Phrase Constituents:
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Recognition of conversational self-corrections, speech repairs, and internal phrase anatomy:
              </p>

              {conversationalElements.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {conversationalElements.map((ce: any, idx: number) => (
                    <div key={idx} style={{ padding: '12px 14px', background: 'rgba(255, 45, 85, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 45, 85, 0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff2d55', textTransform: 'uppercase' }}>
                          {ce.typeLabel}
                        </span>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#ff2d55' }}>
                          "{ce.text}"
                        </span>
                      </div>
                      {ce.targetOriginal && ce.correctedTo && (
                        <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>"{ce.targetOriginal}"</span>
                          <span style={{ color: '#ff2d55', fontWeight: 700 }}> ➔ </span>
                          <span style={{ color: '#15803d', fontWeight: 700 }}>"{ce.correctedTo}"</span>
                        </div>
                      )}
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.45' }}>
                        {ce.explanation}
                      </div>
                      {ce.explanationBengali && (
                        <div style={{ fontSize: '12.5px', color: '#ff2d55', marginTop: '4px', fontWeight: 500 }}>
                          {ce.explanationBengali}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {phraseConstituents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {phraseConstituents.map((pc: any, idx: number) => (
                    <div key={idx} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>"{pc.phrase}"</strong>
                        <span className="tag-badge" style={{ color: '#0071e3', fontSize: '11px' }}>
                          {pc.phraseTypeLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {pc.components.map((comp: any, cIdx: number) => (
                          <div key={cIdx} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                            <span style={{ fontWeight: 700, color: '#0071e3' }}>"{comp.text}"</span>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>{comp.roleLabel}</span>
                            {comp.roleBengali && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10px' }}>{comp.roleBengali}</span>}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {pc.explanation}
                      </div>
                      {pc.explanationBengali && (
                        <div style={{ fontSize: '12px', color: '#0071e3', marginTop: '2px' }}>
                          {pc.explanationBengali}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REUSABLE PATTERN SUMMARY */}
          {patternSummary && (
            <div className="card" style={{ borderLeft: '4px solid #34c759' }}>
              <h4 style={{ color: '#2e7d32', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, margin: '0 0 6px 0' }}>
                📐 Reusable Grammatical Pattern:
              </h4>
              <div style={{ fontSize: '14.5px', fontFamily: 'monospace', fontWeight: 700, color: '#1b5e20', marginBottom: '6px' }}>
                {patternSummary.formula}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 4px 0', lineHeight: '1.45' }}>
                {patternSummary.explanation}
              </p>
              {patternSummary.explanationBengali && (
                <div style={{ fontSize: '12.5px', color: '#2e7d32', fontWeight: 500 }}>
                  {patternSummary.explanationBengali}
                </div>
              )}
            </div>
          )}

          {/* LAYER 2: PHRASE-BY-PHRASE EXPLANATION */}
          {phrases.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                🔍 Layer 2: Phrase-by-Phrase Breakdown:
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Meaningful grammatical chunks preserving sentence flow with Easy English and Easy Bengali:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {phrases.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '14.5px' }}>
                        "{item.phrase}"
                      </span>
                      {item.grammaticalFunction && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
                          {item.grammaticalFunction}
                        </span>
                      )}
                    </div>

                    {item.easyEnglish && (
                      <div style={{ fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '3px' }}>
                        <strong>Simple English:</strong> {item.easyEnglish}
                      </div>
                    )}
                    {item.easyBengali && (!isEnglish || item.easyBengali !== item.easyEnglish) && (!isEnglish || !/[\u0980-\u09FF]/.test(item.easyBengali)) && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <strong>{langConfig.targetLabel}:</strong> {item.easyBengali}
                      </div>
                    )}
                    {item.whyItMatters && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        💡 <em>Why it matters:</em> {item.whyItMatters}
                      </div>
                    )}
                    {item.simplerExample && (
                      <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '2px', fontStyle: 'italic' }}>
                        Simpler Example: "{item.simplerExample}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LAYER 5: IMPORTANT GRAMMAR RULES */}
          {grammarRules.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                📘 Layer 5: Important Grammar Rules
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Grounded rules, why they were chosen, formulas, reusable sentence patterns, and common student confusions:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {grammarRules.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.02)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '14.5px', color: 'var(--accent)' }}>{rule.ruleName}</strong>
                      {rule.targetWords && (
                        <code style={{ fontSize: '11.5px', padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                          "{rule.targetWords}"
                        </code>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                      {rule.whatIsIt}
                    </p>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <strong>Why used here:</strong> {rule.whyUsed}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <strong>How it works:</strong> {rule.howItWorks}
                    </div>
                    {rule.reusablePattern && (
                      <div style={{ padding: '6px 10px', background: 'rgba(0, 113, 227, 0.06)', borderRadius: '6px', fontSize: '12px', color: '#0071e3', margin: '6px 0', fontFamily: 'monospace' }}>
                        Formula: {rule.reusablePattern}
                      </div>
                    )}
                    {rule.example && (
                      <div style={{ fontSize: '12.5px', marginTop: '6px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px' }}>
                        <div><strong>Example:</strong> "{rule.example.english}"</div>
                        {rule.example.easyEnglish && <div style={{ color: 'var(--text-muted)' }}>Easy: {rule.example.easyEnglish}</div>}
                        {rule.example.bengali && (!isEnglish || (!/[\u0980-\u09FF]/.test(rule.example.bengali) && rule.example.bengali !== rule.example.easyEnglish)) && (
                          <div style={{ color: 'var(--text-muted)' }}>{langConfig.targetLabel}: {rule.example.bengali}</div>
                        )}
                      </div>
                    )}
                    {rule.commonConfusion && (
                      <div style={{ fontSize: '12px', color: '#d97706', marginTop: '6px' }}>
                        ⚠️ <strong>Watch out:</strong> {rule.commonConfusion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LAYER 6: CONNECTORS & RELATIONSHIPS */}
          {connectors.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                🔗 Layer 6: Connectors &amp; Logical Relationships
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                {connectors.map((c, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="tag-badge" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {c.connector}
                      </span>
                      <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>Relation: {c.logicalRelation}</strong>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px' }}>{c.meaning}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>Pattern:</strong> <code style={{ fontFamily: 'monospace' }}>{c.pattern}</code>
                    </div>
                    {c.contrastWith && (
                      <div style={{ fontSize: '12px', color: '#0071e3', marginTop: '4px' }}>
                        💡 <strong>Comparison:</strong> {c.contrastWith}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LAYER 7: WORD-LEVEL GRAMMAR IN CONTEXT */}
          {wordLevelGrammar.length > 0 && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
                🔤 Layer 7: Word-Level Grammar in Context
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                {wordLevelGrammar.map((w, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--accent)' }}>{w.word}</strong>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{w.partOfSpeech}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '4px' }}>
                      <strong>Role:</strong> {w.syntacticRole}
                    </div>
                    {w.usageNotes && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {w.usageNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LAYER 8: COMMON MISTAKES & ALTERNATIVES */}
          {mistakes && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <h4 style={{ color: '#d97706', fontSize: '14px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>
                ⚠️ Layer 8: Common Mistakes &amp; Natural Alternatives
              </h4>
              {mistakes.studentMisconception && (
                <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
                  <strong>Common Student Misconception:</strong> {mistakes.studentMisconception}
                </div>
              )}
              {mistakes.commonMistake && (
                <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', fontSize: '13px', color: '#b91c1c', marginBottom: '6px' }}>
                  ❌ <strong>Typical Error:</strong> "{mistakes.commonMistake}"
                </div>
              )}
              {mistakes.correctedSentence && (
                <div style={{ padding: '8px 10px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '6px', fontSize: '13px', color: '#15803d', marginBottom: '8px' }}>
                  ✓ <strong>Corrected:</strong> "{mistakes.correctedSentence}"
                </div>
              )}
              {mistakes.naturalAlternative && (
                <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '6px' }}>
                  <strong>Natural Alternative:</strong> "{mistakes.naturalAlternative}"
                  {mistakes.nuanceDifference && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <em>Nuance: {mistakes.nuanceDifference}</em>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LAYER 9: LEARN AND PRACTISE */}
          {practice && (
            <div className="card" style={{ background: 'var(--card)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              <h4 style={{ color: '#16a34a', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                🎯 Layer 9: Learn &amp; Practise
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '10px' }}>
                {practice.reusablePattern && (
                  <span style={{ display: 'block', marginBottom: '8px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    Pattern to master: <strong>{practice.reusablePattern}</strong>
                  </span>
                )}
                <strong>Quick Quiz:</strong> {practice.question}
              </p>

              {practice.options && practice.options.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {practice.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: selectedOption === idx ? '2px solid #16a34a' : '1px solid var(--border-color)',
                        background: selectedOption === idx ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.7)',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        fontSize: '13.5px'
                      }}
                    >
                      <strong style={{ marginRight: '6px' }}>{String.fromCharCode(65 + idx)}.</strong> {opt}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn-primary"
                  onClick={() => setRevealedPractice(!revealedPractice)}
                  style={{ fontSize: '12.5px', padding: '6px 14px', background: '#16a34a' }}
                >
                  {revealedPractice ? 'Hide Answer' : 'Check / Reveal Answer'}
                </button>
              </div>

              {revealedPractice && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>
                    Correct Answer: {practice.correctAnswer}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px' }}>
                    {practice.whyCorrect}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* KEY VOCABULARY IN CONTEXT */}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '13.5px' }}>{vocab.word}</div>
                      {vocab.grammaticalRole && (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
                          {vocab.grammaticalRole}
                        </span>
                      )}
                    </div>
                    {vocab.partOfSpeech && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{vocab.partOfSpeech}</div>
                    )}
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '2px' }}>{vocab.meaningInContext}</div>
                    {(!isEnglish || !/[\u0980-\u09FF]/.test(vocab.bengali)) && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{vocab.bengali}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GENERAL FEATURES & TONE */}
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
                Tone &amp; Register
              </h5>
              <span className="tag-badge" style={{ color: 'var(--warning)', fontSize: '13px', padding: '4px 10px' }}>
                {result.toneAndRegister || 'Standard English'}
              </span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

