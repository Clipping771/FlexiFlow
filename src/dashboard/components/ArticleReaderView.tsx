import React, { useState, useEffect, useRef } from 'react';
import { ArticleAnalysisResult, ArticleDraft, VocabularyItem } from '../../types';
import { ArticleAnalyzer, AnalysisProgress } from '../../services/article/analyzer';
import { FSRSEngine } from '../../services/fsrs/engine';
import { PDFService } from '../../services/pdf/pdfService';

interface ArticleReaderViewProps {
  onSaveVocabulary: (item: VocabularyItem) => Promise<void>;
  existingVocabWords: Set<string>;
}

export const ArticleReaderView: React.FC<ArticleReaderViewProps> = ({
  onSaveVocabulary,
  existingVocabWords
}) => {
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<'comprehensive' | 'summary' | 'structural' | 'vocabulary'>('comprehensive');
  
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleAnalysisResult | null>(null);
  
  const [activeTab, setActiveTab] = useState<'summary' | 'paragraphs' | 'connectors' | 'claims' | 'argument' | 'vocabulary'>('summary');
  const [savedVocabIds, setSavedVocabIds] = useState<Set<string>>(new Set());
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{ fileName: string; numPages: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const SAMPLE_ARTICLE = `The rapid transition toward renewable energy systems represents one of the most significant industrial transformations of the twenty-first century. However, despite substantial reductions in photovoltaic manufacturing costs, integrating intermittent renewable sources into legacy power grids introduces unprecedented structural hurdles.

Consequently, modern electrical infrastructure requires robust energy storage architectures and sophisticated demand-response protocols. For instance, grid operators across northern Europe have documented frequent supply fluctuations during seasonal wind surges, necessitating rapid-cycling gas peaker plants or massive battery storage facilities. Although decentralized battery arrays mitigate short-term frequency anomalies, their deployment remains constrained by supply chain bottlenecks in critical raw materials such as lithium and cobalt.

Therefore, achieving true grid reliability without fossil-fuel backup requires a multi-tiered technological approach. Policymakers must foster continuous investment in next-generation solid-state batteries, cross-border high-voltage transmission lines, and green hydrogen synthesis. Ultimately, while economic momentum strongly favors decarbonization, overcoming systemic engineering limits is essential to prevent widespread grid instability.`;

  // Estimate text stats
  const stats = ArticleAnalyzer.estimateStats(rawText);

  // Restore draft from local storage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('lexiflow_article_draft');
      if (savedDraft) {
        const parsed: ArticleDraft = JSON.parse(savedDraft);
        if (parsed.rawText && !rawText) {
          setTitle(parsed.title || '');
          setSourceUrl(parsed.sourceUrl || '');
          setRawText(parsed.rawText || '');
          setMode(parsed.analysisMode || 'comprehensive');
          if (parsed.analysisResult) {
            setResult(parsed.analysisResult);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save draft whenever inputs change
  useEffect(() => {
    if (rawText.trim()) {
      try {
        const draft: ArticleDraft = {
          id: 'draft_active',
          title,
          sourceUrl,
          rawText,
          analysisMode: mode,
          lastModified: new Date().toISOString(),
          analysisResult: result || undefined
        };
        localStorage.setItem('lexiflow_article_draft', JSON.stringify(draft));
      } catch {
        // ignore
      }
    }
  }, [title, sourceUrl, rawText, mode, result]);

  const handleStartAnalysis = async () => {
    if (!rawText.trim()) {
      setError('Please enter or paste article text to analyze.');
      return;
    }

    setError(null);
    setAnalyzing(true);
    setProgress({ step: 'Initializing reading intelligence pipeline...', percent: 5 });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await ArticleAnalyzer.analyze(
        rawText,
        title || 'Untitled Article',
        sourceUrl || undefined,
        mode,
        (p) => setProgress(p),
        abortController.signal
      );
      setResult(res);
      setActiveTab('summary');
    } catch (err) {
      if (abortController.signal.aborted) {
        setError('Analysis was successfully cancelled.');
      } else {
        setError((err as Error).message || 'Failed to analyze article.');
      }
    } finally {
      setAnalyzing(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleLoadSample = () => {
    setTitle('The Renewable Grid Transition: Engineering Hurdles & Reliability');
    setSourceUrl('https://example.org/energy-transitions');
    setRawText(SAMPLE_ARTICLE);
    setError(null);
  };

  const handleClear = () => {
    if (rawText.trim() && !confirm('Clear current article and analysis?')) return;
    setTitle('');
    setSourceUrl('');
    setRawText('');
    setResult(null);
    setError(null);
    setPdfInfo(null);
    localStorage.removeItem('lexiflow_article_draft');
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoadingPdf(true);

    try {
      const buffer = await file.arrayBuffer();
      const extracted = await PDFService.extractText(buffer, file.name);

      if (!extracted.fullText || extracted.fullText.trim().length === 0) {
        throw new Error('No readable text could be extracted from this PDF. It may be a scanned image or protected.');
      }

      setTitle(extracted.title || file.name.replace(/\.[^/.]+$/, ''));
      setRawText(extracted.fullText);
      setPdfInfo({ fileName: file.name, numPages: extracted.numPages });
      setResult(null);
    } catch (err: any) {
      setError(`Failed to read PDF: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingPdf(false);
      e.target.value = '';
    }
  };

  const handleSaveExtractedWord = async (item: ArticleAnalysisResult['extractedVocabulary'][0]) => {
    const vocabItem: VocabularyItem = {
      id: `vocab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      word: item.word,
      selectionType: 'word',
      partOfSpeech: item.partOfSpeech,
      meaning: item.contextualMeaning,
      definition: item.contextualMeaning,
      bengaliMeaning: item.bengaliMeaning,
      contextSentence: item.contextSentence,
      pageTitle: title || 'Article Reader',
      pageUrl: sourceUrl || undefined,
      dateAdded: new Date().toISOString(),
      tags: ['article_reader'],
      collection: 'Reading Mastery',
      difficulty: 'medium',
      fsrs: FSRSEngine.createInitialState()
    };

    await onSaveVocabulary(vocabItem);
    setSavedVocabIds((prev) => new Set(prev).add(item.word.toLowerCase()));
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <div className="view-header">
        <div>
          <h2 className="view-title">Article Reader & Reading Intelligence</h2>
          <p className="view-desc">
            Deconstruct complex texts with AI: executive summaries, syntactic breakdowns, connector logic, claim grounding, and vocabulary capture
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            className="btn-primary"
            style={{
              cursor: loadingPdf ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              padding: '7px 15px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{loadingPdf ? '⏳ Reading PDF...' : '📄 Open / Upload PDF'}</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
              disabled={analyzing || loadingPdf}
            />
          </label>
          <button className="btn-secondary" onClick={handleLoadSample} disabled={analyzing || loadingPdf}>
            💡 Load Sample
          </button>
          <button className="btn-secondary" onClick={handleClear} disabled={analyzing || loadingPdf} style={{ color: '#ef4444' }}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {pdfInfo && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          padding: '6px 12px',
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '8px',
          fontSize: '12.5px',
          color: 'var(--blue)',
          fontWeight: 600
        }}>
          <span>📄 Active PDF: {pdfInfo.fileName} ({pdfInfo.numPages} pages extracted)</span>
        </div>
      )}

      {/* Input Form Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Article Title:
            </label>
            <input
              type="text"
              className="input-search"
              placeholder="e.g. Geopolitics of Semiconductor Supply Chains"
              style={{ width: '100%' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={analyzing}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Source URL (optional):
            </label>
            <input
              type="url"
              className="input-search"
              placeholder="https://..."
              style={{ width: '100%' }}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              disabled={analyzing}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Analysis Scope:
            </label>
            <select
              className="select-filter"
              style={{ width: '100%' }}
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              disabled={analyzing}
            >
              <option value="comprehensive">Comprehensive (All)</option>
              <option value="summary">Summary & Claims</option>
              <option value="structural">Structural & Connectors</option>
              <option value="vocabulary">Vocabulary Extraction</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Paste Article Content (Multiple Paragraphs):
          </label>
          <textarea
            style={{
              width: '100%',
              minHeight: '160px',
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: '12px',
              color: 'var(--text-main)',
              padding: '14px',
              fontSize: '14px',
              lineHeight: '1.5',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)'
            }}
            placeholder="Paste raw text, news articles, academic essays, or editorials here..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={analyzing}
          />
        </div>

        {/* Live Input Stats */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '10px',
          padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.03)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>Words: <strong style={{ color: 'var(--text-main)' }}>{stats.wordCount}</strong></span>
            <span>Characters: <strong style={{ color: 'var(--text-main)' }}>{stats.characterCount}</strong></span>
            <span>Paragraphs: <strong style={{ color: 'var(--text-main)' }}>{stats.paragraphCount}</strong></span>
            <span>Est. AI Tokens: <strong style={{ color: 'var(--accent)' }}>~{stats.estimatedTokens}</strong></span>
            {stats.needsChunking && (
              <span className="tag-badge" style={{ color: 'var(--warning)', fontSize: '11px' }}>
                ⚡ Auto-chunking & Ordered Synthesis Active
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {analyzing ? (
              <button
                className="btn-secondary"
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                onClick={handleCancel}
              >
                ⏹️ Cancel
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={handleStartAnalysis}
                disabled={!rawText.trim()}
              >
                🚀 Analyze Article
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0, 113, 227, 0.06)', borderRadius: '10px', border: '1px solid rgba(0, 113, 227, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--accent)' }}>{progress.step}</span>
              <span style={{ color: 'var(--text-muted)' }}>{progress.percent}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(0, 0, 0, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress.percent}%`,
                  background: 'linear-gradient(90deg, #0071e3, #5e5ce6)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '4px solid #ef4444', color: '#b91c1c', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>

      {/* Results View */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Result Navigation Bar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            overflowX: 'auto'
          }}>
            <button
              className={`btn-secondary ${activeTab === 'summary' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('summary')}
            >
              📄 Executive Summary
            </button>
            <button
              className={`btn-secondary ${activeTab === 'paragraphs' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('paragraphs')}
            >
              🔍 Paragraph Explorer ({result.paragraphs.length})
            </button>
            <button
              className={`btn-secondary ${activeTab === 'connectors' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('connectors')}
            >
              🔗 Connectors & Logic ({result.connectors.length})
            </button>
            <button
              className={`btn-secondary ${activeTab === 'claims' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('claims')}
            >
              ⚖️ Claims & Evidence ({result.claims.length})
            </button>
            <button
              className={`btn-secondary ${activeTab === 'argument' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('argument')}
            >
              🏛️ Rhetorical Structure
            </button>
            <button
              className={`btn-secondary ${activeTab === 'vocabulary' ? 'btn-primary' : ''}`}
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => setActiveTab('vocabulary')}
            >
              📚 Key Vocabulary ({result.extractedVocabulary.length})
            </button>
          </div>

          {/* Section A: Executive Summary */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Primary Thesis / Central Idea:
                </span>
                <h3 style={{ marginTop: '6px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {result.summary.mainIdea}
                </h3>
                <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: '1.6' }}>
                  {result.summary.conciseSummary}
                </p>
              </div>

              <div className="card">
                <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '12px' }}>
                  Key Analytical Takeaways:
                </h4>
                <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.6' }}>
                  {result.summary.keyTakeaways.map((point, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{point}</li>
                  ))}
                </ul>
              </div>

              <div className="card" style={{ background: 'rgba(0, 113, 227, 0.05)', border: '1px solid rgba(0, 113, 227, 0.15)' }}>
                <h4 style={{ color: 'var(--accent)', fontSize: '14px', marginBottom: '6px' }}>
                  Author's Central Argument:
                </h4>
                <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5', fontStyle: 'italic' }}>
                  "{result.summary.centralArgument}"
                </p>
              </div>
            </div>
          )}

          {/* Section B: Paragraph Explorer */}
          {activeTab === 'paragraphs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {result.paragraphs.map((p) => (
                <div key={p.paragraphIndex} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="tag-badge" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      Paragraph {p.paragraphIndex}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {p.originalText.split(/\s+/).length} words
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-main)', fontSize: '14.5px', lineHeight: '1.6', background: 'var(--bg-primary)', padding: '12px 14px', borderRadius: '10px', borderLeft: '3px solid var(--border-color)' }}>
                    {p.originalText}
                  </p>

                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Structural Function:</span>
                    <p style={{ color: 'var(--text-main)', fontSize: '13.5px', marginTop: '2px' }}>{p.explanation}</p>
                  </div>

                  {p.bengaliExplanation && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0, 113, 227, 0.06)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--accent)' }}>Contextual Explanation:</span>
                      <p style={{ color: 'var(--text-main)', fontSize: '13px', marginTop: '2px' }}>{p.bengaliExplanation}</p>
                    </div>
                  )}

                  {p.difficultVocabulary.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Notable Vocabulary in this Paragraph:</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {p.difficultVocabulary.map((v, i) => (
                          <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px' }}>
                            <strong style={{ color: 'var(--accent)' }}>{v.word}</strong>: <span style={{ color: 'var(--text-main)' }}>{v.meaningInContext}</span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({v.bengali})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Section C: Connectors and Transitions */}
          {activeTab === 'connectors' && (
            <div className="card">
              <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '14px' }}>
                Discourse Connectors & Logical Transitions
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Connectors demonstrate the logical progression of the argument, highlighting concessions, causality, additions, and counter-arguments.
              </p>

              {result.connectors.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No explicit formal discourse connectors identified.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {result.connectors.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '160px 140px 1fr',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--accent)', textTransform: 'capitalize', fontSize: '14px' }}>
                          "{c.expression}"
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Paragraph {c.paragraphIndex}</div>
                      </div>

                      <div>
                        <span className="tag-badge" style={{
                          color: c.type === 'contrast' ? '#d97706' : c.type === 'cause_effect' ? '#059669' : '#7c3aed',
                          textTransform: 'uppercase'
                        }}>
                          {c.type.replace('_', ' ')}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                        {c.functionInContext}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section D: Claims and Supporting Evidence */}
          {activeTab === 'claims' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="card" style={{ background: 'rgba(0, 113, 227, 0.05)', border: '1px solid rgba(0, 113, 227, 0.15)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  LexiFlow separates substantiated empirical evidence from unverified assertions, ensuring honest, grounded comprehension.
                </p>
              </div>

              {result.claims.map((claim, idx) => (
                <div
                  key={idx}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${claim.isAssertedWithoutEvidence ? '#d97706' : '#059669'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Claim from Paragraph {claim.paragraphIndex}:
                    </span>
                    <span className="tag-badge" style={{
                      color: claim.isAssertedWithoutEvidence ? '#d97706' : '#059669',
                      fontSize: '12px'
                    }}>
                      {claim.isAssertedWithoutEvidence ? '⚠️ Assertion without explicit citation' : '✓ Evidence substantiated'}
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-main)', fontSize: '14.5px', fontWeight: 600 }}>
                    "{claim.claim}"
                  </p>

                  {claim.evidenceProvided ? (
                    <div style={{ marginTop: '10px', fontSize: '13px', color: '#059669' }}>
                      <strong>Supporting Evidence in Text:</strong> {claim.evidenceProvided}
                    </div>
                  ) : (
                    <div style={{ marginTop: '10px', fontSize: '13px', color: '#d97706' }}>
                      <strong>Linguistic Observation:</strong> {claim.aiInference}
                    </div>
                  )}

                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Source excerpt: "{claim.excerpt}..."
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section E: Argument & Structure */}
          {activeTab === 'argument' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card">
                <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '8px' }}>
                  Structural Development Flow:
                </h4>
                <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.6' }}>
                  {result.argumentStructure.developmentFlow}
                </p>
              </div>

              <div className="card">
                <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '10px' }}>
                  Paragraph Interrelationships:
                </h4>
                <ul style={{ listStyle: 'circle', paddingLeft: '20px', color: 'var(--text-main)', fontSize: '13.5px', lineHeight: '1.6' }}>
                  {result.argumentStructure.paragraphRelationships.map((rel, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{rel}</li>
                  ))}
                </ul>
              </div>

              <div className="card" style={{ borderLeft: '4px solid #059669' }}>
                <h4 style={{ color: '#059669', fontSize: '14px', marginBottom: '6px' }}>
                  Role of Conclusion:
                </h4>
                <p style={{ color: 'var(--text-main)', fontSize: '14px' }}>
                  {result.argumentStructure.conclusionRole}
                </p>
              </div>
            </div>
          )}

          {/* Section F: Vocabulary Extraction */}
          {activeTab === 'vocabulary' && (
            <div>
              <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Extracted specialized vocabulary directly from the article. Click save to capture them into your FSRS spaced repetition library.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {result.extractedVocabulary.map((vocab) => {
                  const norm = vocab.word.toLowerCase();
                  const isAlreadySaved = savedVocabIds.has(norm) || existingVocabWords.has(norm);

                  return (
                    <div key={vocab.word} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.015em' }}>
                            {vocab.word}
                          </span>
                          {vocab.partOfSpeech && (
                            <span className="tag-badge" style={{ fontSize: '11px' }}>{vocab.partOfSpeech}</span>
                          )}
                        </div>

                        <div style={{ fontSize: '14px', color: '#059669', fontWeight: 600, marginBottom: '6px' }}>
                          {vocab.bengaliMeaning}
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4', marginBottom: '8px' }}>
                          {vocab.contextualMeaning}
                        </p>

                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: '4px' }}>
                          "{vocab.contextSentence}"
                        </div>
                      </div>

                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className={isAlreadySaved ? 'btn-secondary' : 'btn-primary'}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          onClick={() => handleSaveExtractedWord(vocab)}
                          disabled={isAlreadySaved}
                        >
                          {isAlreadySaved ? '✓ Saved in Library' : '➕ Save to Vocab'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
