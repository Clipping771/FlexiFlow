import React, { useState, useEffect, useRef } from 'react';
import {
  LinguisticAnalysisResult,
  WordAnalysisResult,
  SentenceAnalysisResult,
  PhraseAnalysisResult,
  StageBDetailedVocabulary,
  VocabularyItem,
  UserSettings,
  SelectionType,
  WritingGoal,
  WrongMeaningReport
} from '../types';
import { PopupView } from '../content/popupView';
import { POPUP_STYLES } from '../content/styles';
import { DictionaryService, dictionaryResultToStageA } from '../services/dictionary';
import { AIService } from '../services/ai';
import { FSRSEngine } from '../services/fsrs/engine';
import { getLanguageConfig } from '../config/languages';
import {
  Search,
  Sparkles,
  Check,
  BookmarkPlus,
  PanelRight,
  ExternalLink,
  Volume2,
  X,
  Send,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Layers,
  Copy,
  ArrowLeft
} from 'lucide-react';
import { playPronunciation } from '../services/audio/voiceService';
import './popup.css';

/**
 * Hosts the exact same PopupView and POPUP_STYLES as in-page web popups.
 * Guarantees 100% visual and functional fidelity across websites, PDFs, and standalone lookup windows.
 */
interface PopupCardHostProps {
  initialWord: string;
}

const PopupCardHost: React.FC<PopupCardHostProps> = ({ initialWord }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const popupViewRef = useRef<PopupView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Inject POPUP_STYLES into document head if not already present
    let styleEl = document.getElementById('lexiflow-popup-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'lexiflow-popup-styles';
      styleEl.textContent = POPUP_STYLES;
      document.head.appendChild(styleEl);
    }

    let currentWord = initialWord;

    // 2. Instantiate the exact same PopupView used in web pages
    const view = new PopupView({
      onClose: () => {
        window.close();
      },
      onSave: async (item: VocabularyItem) => {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item } }, resolve);
        });
      },
      onChangeMode: (mode: SelectionType) => {
        executeLookup(currentWord, mode);
      },
      onWritingAssist: async (goal: WritingGoal) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'ASSIST_WRITING', payload: { text: currentWord, goal } }, (res) => {
            resolve(res?.success ? res.data : null);
          });
        });
      },
      onAskFollowUp: async (question: string) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'ASK_FOLLOW_UP', payload: { text: currentWord, context: '', question } },
            (res) => {
              resolve(res?.success ? res.data : null);
            }
          );
        });
      },
      onFetchStageB: async (lemma: string, pos?: string, senseId?: string) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'ANALYZE_STAGE_B', payload: { lemma, partOfSpeech: pos, contextualSenseId: senseId } },
            (res) => {
              resolve(res?.success ? res.data : null);
            }
          );
        });
      },
      onReportWrongMeaning: async (report: WrongMeaningReport) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'REPORT_WRONG_MEANING', payload: { report } }, (res) => {
            resolve(Boolean(res?.success));
          });
        });
      },
      onSelectWord: (word: string) => {
        executeLookup(word, 'word');
      },
      onResize: () => {},
      onUpdateSettings: async (updates: Partial<UserSettings>) => {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: updates }, resolve);
        });
      }
    });

    popupViewRef.current = view;
    const el = view.getElement();
    el.classList.add('standalone-mode');
    containerRef.current.appendChild(el);

    // Sync theme, size, and language with settings
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        if (res?.success && res.data) {
          const s = res.data as UserSettings;
          if (s.theme) view.setTheme(s.theme);
          if (s.popupSize) view.setSize(s.popupSize);
          if (s.targetLanguage) view.setTargetLanguage(s.targetLanguage);
        }
      });
    }

    const executeLookup = (text: string, selectionType: SelectionType = 'word') => {
      if (!text || !text.trim()) return;
      currentWord = text.trim();

      const words = currentWord.split(/\s+/).filter(Boolean);
      const effectiveType: SelectionType =
        selectionType || (words.length > 3 ? 'sentence' : words.length > 1 ? 'phrase' : 'word');

      const isWordOrPhrase = effectiveType === 'word' || effectiveType === 'phrase';
      let hasLocalDisplay = false;

      // 1. Instant local dictionary lookup (< 1ms)
      if (isWordOrPhrase) {
        const dictHit = DictionaryService.lookupSync(currentWord, '');
        if (dictHit) {
          const localStageA = dictionaryResultToStageA(dictHit, '');
          view.showStageA(localStageA, '', '', false);
          hasLocalDisplay = true;
        }
      }

      if (!hasLocalDisplay) {
        view.showLoading(currentWord, effectiveType);
      }

      // 2. Background contextual AI analysis
      if (isWordOrPhrase) {
        chrome.runtime.sendMessage(
          {
            type: 'ANALYZE_STAGE_A',
            payload: { text: currentWord, contextSentence: '', paragraphContext: '' }
          },
          (res) => {
            if (res?.success && res.data) {
              chrome.runtime.sendMessage(
                { type: 'GET_VOCAB_BY_WORD', payload: { word: currentWord } },
                (savedRes) => {
                  view.showStageA(res.data, '', '', Boolean(savedRes?.data));
                }
              );
              if (res.data.lemma) {
                view.prefetchStageB(res.data.lemma, res.data.partOfSpeech, res.data.contextualSenseId);
              }
            } else if (!hasLocalDisplay) {
              view.showError(res?.error || 'Could not analyze word.');
            }
          }
        );
      } else {
        chrome.runtime.sendMessage(
          {
            type: 'ANALYZE_SELECTION',
            payload: { text: currentWord, selectionType: effectiveType }
          },
          (res) => {
            if (res?.success && res.data) {
              chrome.runtime.sendMessage(
                { type: 'GET_VOCAB_BY_WORD', payload: { word: currentWord } },
                (savedRes) => {
                  view.showAnalysis(res.data, '', '', Boolean(savedRes?.data));
                }
              );
            } else {
              view.showError(res?.error || 'Could not analyze selection.');
            }
          }
        );
      }
    };

    if (initialWord) {
      executeLookup(initialWord);
    }

    return () => {
      el.remove();
    };
  }, [initialWord]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent'
      }}
    />
  );
};

export const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [result, setResult] = useState<LinguisticAnalysisResult | null>(null);
  const [stageB, setStageB] = useState<StageBDetailedVocabulary | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isCardMode, setIsCardMode] = useState(false);
  const [targetLang, setTargetLang] = useState('bn');
  const [customLanguages, setCustomLanguages] = useState<any[]>([]);

  // Site domain & whitelist/blacklist toggle (eJOY-style)
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [disabledSites, setDisabledSites] = useState<string[]>([]);

  // Text size: small, medium, large, xlarge
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Active tabs
  const [wordTab, setWordTab] = useState<'meaning' | 'ask_ai' | 'deep_dive'>('meaning');
  const [sentenceTab, setSentenceTab] = useState<'breakdown' | 'ask_ai' | 'grammar'>('breakdown');

  // AI Coach conversation history
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // History stack for in-popup word lookups
  const [lookupHistory, setLookupHistory] = useState<string[]>([]);

  useEffect(() => {
    // 0. Query active browser tab domain
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]?.url) {
          try {
            const parsed = new URL(tabs[0].url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              const host = parsed.hostname.replace(/^www\./, '');
              setCurrentDomain(host);
            }
          } catch {
            // ignore non-http tabs
          }
        }
      });
    }

    // 1. Check if opened in Card Mode or via ?lookup=...
    try {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('lookup') || params.get('text');
      const mode = params.get('mode');

      if (query && query.trim()) {
        setIsCardMode(true);
        const cleaned = query.trim();
        setSearchTerm(cleaned);
        executeSearch(cleaned);
      } else if (mode === 'card') {
        setIsCardMode(true);
      }
    } catch {
      // ignore
    }

    // 2. Load summary stats and user settings
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        if (res?.success && res.data) {
          const s = res.data as UserSettings;
          if (s.theme) {
            setTheme(s.theme);
            document.documentElement.setAttribute('data-theme', s.theme);
          }
          if (s.targetLanguage) setTargetLang(s.targetLanguage);
          if (s.customLanguages) setCustomLanguages(s.customLanguages);
          if (s.popupSize) setTextSize(s.popupSize);
          if (s.disabledSites && Array.isArray(s.disabledSites)) {
            setDisabledSites(s.disabledSites);
          }
        }
      });

      chrome.runtime.sendMessage({ type: 'GET_ALL_VOCAB' }, (res) => {
        if (res?.success && Array.isArray(res.data)) {
          setSavedCount(res.data.length);
        }
      });

      chrome.runtime.sendMessage({ type: 'GET_DUE_ITEMS' }, (res) => {
        if (res?.success && Array.isArray(res.data)) {
          setDueCount(res.data.length);
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.lexiflow_user_settings?.newValue) {
          const newSettings = changes.lexiflow_user_settings.newValue as UserSettings;
          if (newSettings.theme) {
            setTheme(newSettings.theme);
            document.documentElement.setAttribute('data-theme', newSettings.theme);
          }
          if (newSettings.disabledSites && Array.isArray(newSettings.disabledSites)) {
            setDisabledSites(newSettings.disabledSites);
          }
        }
      });
    }
  }, []);

  const isCurrentSiteEnabled = currentDomain
    ? !disabledSites.some((site) => {
        const s = site.toLowerCase().trim();
        const host = currentDomain.toLowerCase();
        return host === s || host.endsWith('.' + s);
      })
    : true;

  const toggleCurrentSite = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentDomain) return;

    const host = currentDomain.toLowerCase();
    let updatedList: string[];

    if (isCurrentSiteEnabled) {
      updatedList = [...disabledSites.filter((s) => s.toLowerCase() !== host), host];
    } else {
      updatedList = disabledSites.filter((s) => {
        const sLower = s.toLowerCase().trim();
        return sLower !== host && !host.endsWith('.' + sLower);
      });
    }

    setDisabledSites(updatedList);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { disabledSites: updatedList }
      });
    }
  };

  const langConfig = getLanguageConfig(targetLang, customLanguages);

  const cycleTextSize = () => {
    const sizes: Array<'small' | 'medium' | 'large' | 'xlarge'> = ['small', 'medium', 'large', 'xlarge'];
    const next = sizes[(sizes.indexOf(textSize) + 1) % sizes.length];
    setTextSize(next);
  };

  const executeSearch = async (term: string, pushHistory = true) => {
    if (!term.trim()) return;
    const cleanTerm = term.trim();
    setLoading(true);
    setResult(null);
    setStageB(null);
    setIsSaved(false);
    setChatMessages([]);
    setFollowUpQuestion('');
    setWordTab('meaning');
    setSentenceTab('breakdown');

    if (pushHistory && searchTerm && searchTerm !== cleanTerm) {
      setLookupHistory((prev) => [...prev, searchTerm]);
    }
    setSearchTerm(cleanTerm);

    const words = cleanTerm.split(/\s+/).filter(Boolean);
    const hasPunctuation = /[.!?]\s|[.!?]$/.test(cleanTerm);
    const selectionType = (words.length > 3 || hasPunctuation) ? 'sentence' : (words.length > 1 ? 'phrase' : 'word');

    try {
      let analysisResult: LinguisticAnalysisResult | null = null;

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        analysisResult = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'ANALYZE_SELECTION',
              payload: {
                text: cleanTerm,
                selectionType
              }
            },
            (res) => {
              resolve(res?.success ? res.data : null);
            }
          );
        });
      }

      if (!analysisResult) {
        const provider = await AIService.getProvider();
        analysisResult = await provider.analyze(cleanTerm, selectionType);
      }

      setResult(analysisResult);

      // Check if already saved in library
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: 'GET_VOCAB_BY_WORD',
            payload: { word: cleanTerm }
          },
          (savedRes) => {
            setIsSaved(Boolean(savedRes?.data));
          }
        );
      }

      // If word mode, fetch Stage B deep details in background
      if (selectionType === 'word') {
        const wordRes = analysisResult as WordAnalysisResult;
        const lemma = wordRes.selectedText?.toLowerCase() || cleanTerm.toLowerCase();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(
            {
              type: 'ANALYZE_STAGE_B',
              payload: {
                lemma,
                partOfSpeech: wordRes.partOfSpeech
              }
            },
            (bRes) => {
              if (bRes?.success && bRes.data) {
                setStageB(bRes.data);
              }
            }
          );
        } else {
          AIService.analyzeStageB(lemma, wordRes.partOfSpeech).then((bData) => {
            if (bData) setStageB(bData);
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackHistory = () => {
    if (lookupHistory.length === 0) return;
    const prev = lookupHistory[lookupHistory.length - 1];
    setLookupHistory((h) => h.slice(0, -1));
    executeSearch(prev, false);
  };

  const handleCopy = () => {
    if (!result?.selectedText) return;
    navigator.clipboard.writeText(result.selectedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSave = () => {
    if (!result || isSaved) return;
    const wordRes = result as WordAnalysisResult;
    const sentenceRes = result as SentenceAnalysisResult;

    const vocabItem: VocabularyItem = {
      id: `vocab_${Date.now()}`,
      word: result.selectedText,
      selectionType: result.selectionType,
      partOfSpeech: wordRes.partOfSpeech || (result.selectionType === 'sentence' ? 'sentence' : 'phrase'),
      meaning: wordRes.contextualMeaning || sentenceRes.plainEnglishParaphrase || result.bengaliTranslation,
      definition: wordRes.simpleEnglishExplanation || sentenceRes.overallMeaning || wordRes.contextualMeaning,
      bengaliMeaning: result.bengaliTranslation,
      bengaliExplanation: wordRes.whyFitsContext || sentenceRes.plainEnglishParaphrase || '',
      dateAdded: new Date().toISOString(),
      tags: ['popup-lookup'],
      collection: 'Daily Vocabulary',
      difficulty: 'medium',
      fsrs: FSRSEngine.createInitialState(),
      fullAnalysis: result
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_VOCAB',
          payload: { item: vocabItem }
        },
        () => {
          setIsSaved(true);
          setSavedCount((prev) => prev + 1);
        }
      );
    }
  };

  const sendCoachMessage = async (questionText: string) => {
    if (!questionText.trim() || followUpLoading) return;
    const q = questionText.trim();
    setFollowUpLoading(true);
    setChatMessages((prev) => [...prev, { role: 'user', text: q }]);
    setFollowUpQuestion('');

    try {
      let answerText = '';
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'ASK_FOLLOW_UP',
              payload: {
                question: q,
                word: result?.selectedText || searchTerm,
                context: (result as WordAnalysisResult)?.contextualMeaning || (result as SentenceAnalysisResult)?.plainEnglishParaphrase
              }
            },
            resolve
          );
        });
        if (res?.success && res.data) {
          answerText = typeof res.data === 'string' ? res.data : res.data.answer;
        }
      }

      if (!answerText) {
        const provider = await AIService.getProvider();
        const res = await provider.askFollowUp(
          result?.selectedText || searchTerm,
          (result as WordAnalysisResult)?.contextualMeaning || '',
          q
        );
        answerText = res.answer;
      }

      setChatMessages((prev) => [...prev, { role: 'assistant', text: answerText }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Could not connect to LexiFlow AI Coach. Please try again.' }
      ]);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    if (result?.selectionType === 'sentence') {
      setSentenceTab('ask_ai');
    } else {
      setWordTab('ask_ai');
    }
    sendCoachMessage(promptText);
  };

  const openDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('dashboard.html', '_blank');
    }
  };

  const openSidePanel = () => {
    if (typeof chrome !== 'undefined') {
      if ((chrome as any).sidePanel?.open && chrome.windows?.getLastFocused) {
        chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
          const targetWinId = win?.id;
          if (targetWinId) {
            (chrome as any).sidePanel.open({ windowId: targetWinId })
              .then(() => {
                window.close();
              })
              .catch((err: any) => {
                console.warn('Direct sidePanel.open failed, sending runtime message:', err);
                chrome.runtime.sendMessage(
                  { type: 'OPEN_SIDE_PANEL', payload: { windowId: targetWinId } },
                  (res) => {
                    if (res?.success) window.close();
                  }
                );
              });
          } else {
            chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (res) => {
              if (res?.success) window.close();
            });
          }
        });
        return;
      }

      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (res) => {
        if (res?.success) window.close();
      });
    } else {
      window.open('dashboard.html', '_blank');
    }
  };

  const isSentenceMode = result?.selectionType === 'sentence';
  const sentenceResult = result as SentenceAnalysisResult | null;
  const wordResult = result as WordAnalysisResult | null;
  const phraseResult = result as PhraseAnalysisResult | null;

  /* ------------------------------------------------------------- */
  /* STANDALONE POPUP HOST: 100% Identical to Website Popup       */
  /* ------------------------------------------------------------- */
  if (isCardMode) {
    return <PopupCardHost initialWord={searchTerm} />;
  }

  /* ------------------------------------------------------------- */
  /* STANDARD TOOLBAR POPUP VIEW (When clicking extension icon)    */
  /* ------------------------------------------------------------- */
  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="logo-group">
          <img
            src="/assets/icon48.png"
            alt="LexiFlow"
            style={{ width: 28, height: 28, borderRadius: 7, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
          />
          <div>
            <div className="app-title">LexiFlow</div>
            <div className="app-sub">Contextual Reading & Language Mastery</div>
          </div>
        </div>
      </div>

      {/* Inset Stat Counter Pills */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-val">{savedCount}</span>
          <span className="stat-label">Saved Words</span>
        </div>
        <div className="stat-item">
          <span className={`stat-val ${dueCount > 0 ? 'orange' : ''}`}>{dueCount}</span>
          <span className="stat-label">Due for Review</span>
        </div>
      </div>

      {/* Spotlight Search Box */}
      <div className="search-box">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search word or sentence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchTerm)}
          />
        </div>
        <button className="btn-primary" onClick={() => executeSearch(searchTerm)} disabled={loading}>
          {loading ? (
            '...'
          ) : (
            <>
              <Sparkles size={13} />
              <span>Analyze</span>
            </>
          )}
        </button>
      </div>

      {/* Site Active / Paused Slider Toggle (matching eJOY style) */}
      <div
        className="site-toggle-card"
        onClick={toggleCurrentSite}
        title={`Click to ${isCurrentSiteEnabled ? 'disable' : 'enable'} LexiFlow on ${currentDomain || 'web pages'}`}
      >
        <div className="site-toggle-left">
          <div className="site-toggle-text">
            <span className="site-toggle-brand">LexiFlow in </span>
            <span className="site-toggle-domain">{currentDomain || 'web pages'}</span>
          </div>
        </div>

        <div
          className={`site-slider-switch ${isCurrentSiteEnabled ? 'active' : ''}`}
          role="switch"
          aria-checked={isCurrentSiteEnabled}
        >
          <div className="site-slider-thumb" />
        </div>
      </div>

      {/* Guide card when no search is active and not loading */}
      {!result && !loading && (
        <div className="popup-guide-card">
          <div className="popup-guide-icon">
            <Sparkles size={18} />
          </div>
          <div className="popup-guide-title">
            {isCurrentSiteEnabled ? 'Active & Ready on this page' : 'Paused on this website'}
          </div>
          <div className="popup-guide-desc">
            {isCurrentSiteEnabled
              ? 'Select any word or sentence on the page to instantly view definitions, pronunciation & translations.'
              : `LexiFlow reading companion is disabled on ${currentDomain || 'this site'}. Toggle the slider above to re-enable.`}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: '#6e6e73', fontSize: '13px' }}>
          Interpreting with LexiFlow AI...
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="result-card">
          <div className="word-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="word-title">{result.selectedText}</span>
            <button
              type="button"
              title="Pronounce"
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}
              onClick={() => playPronunciation(result.selectedText)}
            >
              🔊
            </button>
            <span className="word-pos">{result.selectionType.toUpperCase()}</span>
          </div>

          {result.bengaliTranslation && (
            <div className="word-bengali">{result.bengaliTranslation}</div>
          )}

          <div className="word-def">
            {(result as WordAnalysisResult).contextualMeaning ||
              (result as WordAnalysisResult).simpleEnglishExplanation ||
              (result as SentenceAnalysisResult).plainEnglishParaphrase}
          </div>

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              style={{
                background: isSaved ? 'rgba(0, 113, 227, 0.12)' : '#0071e3',
                color: isSaved ? '#0071e3' : '#ffffff',
                fontSize: '12px',
                padding: '6px 14px'
              }}
              onClick={handleSave}
            >
              {isSaved ? (
                <>
                  <Check size={13} strokeWidth={2.5} />
                  <span>Saved in Library</span>
                </>
              ) : (
                <>
                  <BookmarkPlus size={13} />
                  <span>Save Word</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Launch Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
        <button
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={openSidePanel}
        >
          <PanelRight size={14} />
          <span>Side Panel</span>
        </button>
        <button
          className="btn-dashboard"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={openDashboard}
        >
          <ExternalLink size={14} />
          <span>Dashboard</span>
        </button>
      </div>
    </div>
  );
};
