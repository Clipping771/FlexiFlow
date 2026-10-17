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
import { SettingsService } from '../services/storage/settings';
import { FSRSEngine } from '../services/fsrs/engine';
import { getLanguageConfig } from '../config/languages';
import { detectSelectionType } from '../content/selection';
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
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { playPronunciation } from '../services/audio/voiceService';
import './popup.css';

export const resolveEffectiveTheme = (t?: string): 'light' | 'dark' => {
  if (t === 'system') {
    return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  }
  return t === 'light' ? 'light' : 'dark';
};

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
    const applyHostSettings = (s: Partial<UserSettings>) => {
      if (s.theme) {
        const effective = resolveEffectiveTheme(s.theme);
        document.documentElement.setAttribute('data-theme', effective);
        view.setTheme(s.theme);
      }
      if (s.popupSize) view.setSize(s.popupSize);
      if (s.targetLanguage) view.setTargetLanguage(s.targetLanguage);
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        if (res?.success && res.data) {
          applyHostSettings(res.data as UserSettings);
        }
      });
    }

    const hostStorageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.lexiflow_user_settings?.newValue) {
        applyHostSettings(changes.lexiflow_user_settings.newValue);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(hostStorageListener);
    }

    const executeLookup = (text: string, forcedType?: SelectionType) => {
      if (!text || !text.trim()) return;
      currentWord = text.trim();

      const effectiveType: SelectionType = forcedType || detectSelectionType(currentWord);

      // Single word mode: local dictionary fast-path (< 1ms) + Stage A contextual meaning
      if (effectiveType === 'word') {
        let hasLocalDisplay = false;
        const dictHit = DictionaryService.lookupSync(currentWord, '');
        if (dictHit) {
          const localStageA = dictionaryResultToStageA(dictHit, '');
          view.showStageA(localStageA, '', '', false);
          hasLocalDisplay = true;
        }

        if (!hasLocalDisplay) {
          view.showLoading(currentWord, 'word');
        }

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
              view.showError(res?.error || 'Could not analyze word.', currentWord);
            }
          }
        );
      } else {
        // Sentence, Paragraph, or Phrase Mode: Full contextual analysis with Phrase-by-Phrase Breakdown (100% parity with web popup)
        view.showLoading(currentWord, effectiveType);

        chrome.runtime.sendMessage(
          {
            type: 'ANALYZE_SELECTION',
            payload: { text: currentWord, selectionType: effectiveType, contextSentence: currentWord }
          },
          (res) => {
            if (res?.success && res.data) {
              chrome.runtime.sendMessage(
                { type: 'GET_VOCAB_BY_WORD', payload: { word: currentWord } },
                (savedRes) => {
                  view.showAnalysis(res.data, currentWord, '', Boolean(savedRes?.data));
                }
              );
            } else {
              view.showError(res?.error || 'Could not analyze sentence.', currentWord);
            }
          }
        );
      }
    };

    if (initialWord) {
      executeLookup(initialWord);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(hostStorageListener);
      }
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

  // Page AI Article Highlighting Studio state
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [highlightState, setHighlightState] = useState<{
    isSiteDisabled: boolean;
    articleTitle?: string;
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
  } | null>(null);
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [showVocabDrawer, setShowVocabDrawer] = useState(false);
  const [highlightFeedback, setHighlightFeedback] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  useEffect(() => {
    // 0. Query active browser tab domain and highlight state
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]?.id) {
          const tabId = tabs[0].id;
          setActiveTabId(tabId);
          if (tabs[0].url) {
            try {
              const parsed = new URL(tabs[0].url);
              if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                const host = parsed.hostname.replace(/^www\./, '');
                setCurrentDomain(host);
                // Fetch page highlight state from content script
                chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_HIGHLIGHT_STATE' }, (res) => {
                  if (chrome.runtime?.lastError) {
                    return;
                  }
                  if (res?.success && res.data) {
                    setHighlightState(res.data);
                  }
                });
              }
            } catch {
              // ignore non-http tabs
            }
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
            const effective = resolveEffectiveTheme(s.theme);
            setTheme(effective);
            document.documentElement.setAttribute('data-theme', effective);
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
      const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
        if (changes.lexiflow_user_settings?.newValue) {
          const newSettings = changes.lexiflow_user_settings.newValue as UserSettings;
          if (newSettings.theme) {
            const effective = resolveEffectiveTheme(newSettings.theme);
            setTheme(effective);
            document.documentElement.setAttribute('data-theme', effective);
          }
          if (newSettings.disabledSites && Array.isArray(newSettings.disabledSites)) {
            setDisabledSites(newSettings.disabledSites);
          }
        }
        if (changes.lexiflow_vocab_updated_at) {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
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
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
      return () => chrome.storage.onChanged.removeListener(storageListener);
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

    // Immediately update active tab action badge to 'OFF' or empty
    if (typeof chrome !== 'undefined' && chrome.action && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTabId = tabs[0]?.id;
        if (typeof activeTabId === 'number') {
          if (isCurrentSiteEnabled) {
            // Toggling from enabled -> paused
            chrome.action.setBadgeText({ tabId: activeTabId, text: 'OFF' });
            chrome.action.setBadgeBackgroundColor({ tabId: activeTabId, color: '#EF4444' });
            if ((chrome.action as any).setBadgeTextColor) {
              (chrome.action as any).setBadgeTextColor({ tabId: activeTabId, color: '#FFFFFF' });
            }
          } else {
            // Toggling from paused -> enabled
            chrome.action.setBadgeText({ tabId: activeTabId, text: '' });
          }
        }
      });
    }

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

    const selectionType = detectSelectionType(cleanTerm);

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

  const handleToggleTheme = () => {
    const nextTheme: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { theme: nextTheme }
      });
    } else {
      SettingsService.updateSettings({ theme: nextTheme });
    }
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

  const handleTriggerHighlight = () => {
    setHighlightFeedback(null);
    if (!activeTabId) {
      setHighlightFeedback({
        message: 'No active article tab found. Please open an article or news webpage.',
        type: 'info'
      });
      return;
    }
    setHighlightLoading(true);
    chrome.tabs.sendMessage(activeTabId, { type: 'TRIGGER_HIGHLIGHT_ARTICLE' }, (res) => {
      setHighlightLoading(false);
      if (chrome.runtime?.lastError) {
        setHighlightFeedback({
          message: 'Could not connect to the webpage. Please refresh the page tab and try again.',
          type: 'error'
        });
        return;
      }
      if (res?.success && res.data) {
        const count = res.data.count?.total || res.data.items?.length || 0;
        setHighlightFeedback({
          message: `Highlighted ${count} key vocabulary items across the article!`,
          type: 'success'
        });
        setHighlightState((prev) =>
          prev
            ? {
                ...prev,
                count: res.data.count,
                items: res.data.items,
                currentIndex: res.data.count?.visible > 0 ? 0 : -1
              }
            : {
                isSiteDisabled: false,
                hasMainArticle: true,
                count: res.data.count,
                currentIndex: 0,
                items: res.data.items,
                color: 'yellow',
                filters: { words: true, phrases: true, idioms: true }
              }
        );
      } else {
        setHighlightFeedback({
          message: res?.error || 'No editorial article body found on this page (or text is under 30 characters).',
          type: 'info'
        });
      }
    });
  };

  const handleNavigateHighlight = (direction: 'prev' | 'next') => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'NAVIGATE_PAGE_HIGHLIGHT', payload: { direction } }, (res) => {
      if (res?.success && res.data) {
        setHighlightState((prev) => (prev ? { ...prev, currentIndex: res.data.index } : null));
      }
    });
  };

  const handleChangeHighlightColor = (color: string) => {
    if (!activeTabId) return;
    setHighlightState((prev) => (prev ? { ...prev, color } : null));
    chrome.tabs.sendMessage(activeTabId, { type: 'UPDATE_PAGE_HIGHLIGHT_SETTINGS', payload: { color } });
  };

  const handleToggleFilter = (filterKey: 'words' | 'phrases' | 'idioms') => {
    if (!activeTabId || !highlightState) return;
    const nextFilters = {
      ...highlightState.filters,
      [filterKey]: !highlightState.filters[filterKey]
    };
    setHighlightState({
      ...highlightState,
      filters: nextFilters
    });
    chrome.tabs.sendMessage(
      activeTabId,
      {
        type: 'UPDATE_PAGE_HIGHLIGHT_SETTINGS',
        payload: { filters: nextFilters }
      },
      (res) => {
        if (res?.success && res.data?.count) {
          setHighlightState((prev) => (prev ? { ...prev, count: res.data.count } : null));
        }
      }
    );
  };

  const handleClearHighlights = () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'CLEAR_PAGE_HIGHLIGHTS' }, () => {
      setHighlightState((prev) =>
        prev
          ? {
              ...prev,
              count: { total: 0, words: 0, phrases: 0, idioms: 0, visible: 0 },
              items: [],
              currentIndex: -1
            }
          : null
      );
      setShowVocabDrawer(false);
    });
  };

  const handleScrollToItem = (itemText: string) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, {
      type: 'SCROLL_TO_HIGHLIGHT_ITEM',
      payload: { text: itemText }
    });
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

        <div className="popup-header-actions">
          <button
            type="button"
            className="popup-theme-btn"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            className="popup-theme-btn"
            onClick={openDashboard}
            title="Open LexiFlow Dashboard & Settings"
            aria-label="Settings"
          >
            ⚙️
          </button>
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

      {/* Smart Article Reader & AI Highlights Studio (Replaces static guide card) */}
      {!result && !loading && (
        <div className="popup-studio-card">
          {/* Studio Header */}
          <div className="studio-header">
            <div className="studio-brand">
              <div className="studio-icon-badge">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="studio-title-row">
                  <span className="studio-title">AI Article Highlights</span>
                  {highlightState && highlightState.count.total > 0 && (
                    <span className="studio-badge-pill">
                      {highlightState.count.visible} of {highlightState.count.total} active
                    </span>
                  )}
                </div>
                <div className="studio-subtext">
                  {highlightState?.articleTitle
                    ? `Scope: ${highlightState.articleTitle.slice(0, 32)}${highlightState.articleTitle.length > 32 ? '...' : ''}`
                    : 'Scope: Main article text only (noise-filtered)'}
                </div>
              </div>
            </div>

            {highlightState && highlightState.count.total > 0 && (
              <button
                type="button"
                className="studio-btn-icon-clear"
                title="Clear Highlights"
                onClick={handleClearHighlights}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Content */}
          {!isCurrentSiteEnabled ? (
            <div className="studio-paused-notice">
              LexiFlow reading companion is paused on {currentDomain || 'this site'}. Toggle the slider above to re-enable.
            </div>
          ) : highlightLoading ? (
            <div className="studio-loading-state">
              <div className="studio-spinner" />
              <div className="studio-loading-text">
                <div className="studio-loading-title">Analyzing Main Article Body...</div>
                <div className="studio-loading-desc">Filtering page headers, footers & sidebars to extract key vocabulary</div>
              </div>
            </div>
          ) : !highlightState || highlightState.count.total === 0 ? (
            <div className="studio-ready-body">
              <p className="studio-ready-desc">
                Identifies the <strong>core editorial article</strong> on this page, ignoring navigation, headers, footers, and ads. Automatically extracts and highlights learning-worthy vocabulary, collocations, and idioms with instant explanations.
              </p>
              {highlightFeedback && (
                <div className={`studio-feedback-banner ${highlightFeedback.type}`}>
                  <span>{highlightFeedback.type === 'error' ? '⚠️' : highlightFeedback.type === 'success' ? '✨' : 'ℹ️'}</span>
                  <span>{highlightFeedback.message}</span>
                </div>
              )}
              <button
                type="button"
                className="studio-btn-primary-highlight"
                onClick={handleTriggerHighlight}
              >
                <Sparkles size={15} />
                <span>Highlight Main Article</span>
              </button>
            </div>
          ) : (
            <div className="studio-active-controls">
              {highlightFeedback && (
                <div className={`studio-feedback-banner ${highlightFeedback.type}`} style={{ marginBottom: '8px' }}>
                  <span>{highlightFeedback.type === 'error' ? '⚠️' : highlightFeedback.type === 'success' ? '✨' : 'ℹ️'}</span>
                  <span>{highlightFeedback.message}</span>
                </div>
              )}
              {/* Navigation Bar */}
              <div className="studio-nav-bar">
                <div className="studio-nav-arrows">
                  <button
                    type="button"
                    className="studio-nav-btn"
                    title="Previous Highlight (Shift+Tab)"
                    onClick={() => handleNavigateHighlight('prev')}
                  >
                    <ChevronUp size={14} />
                    <span>Prev</span>
                  </button>
                  <span className="studio-nav-counter">
                    {(highlightState.currentIndex ?? -1) >= 0 ? highlightState.currentIndex + 1 : 1} / {highlightState.count.visible || highlightState.count.total}
                  </span>
                  <button
                    type="button"
                    className="studio-nav-btn"
                    title="Next Highlight (Tab)"
                    onClick={() => handleNavigateHighlight('next')}
                  >
                    <span>Next</span>
                    <ChevronDown size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`studio-drawer-toggle ${showVocabDrawer ? 'active' : ''}`}
                  onClick={() => setShowVocabDrawer(!showVocabDrawer)}
                  title="View discovered terms"
                >
                  <BookOpen size={13} />
                  <span>Vocab ({highlightState.items?.length || highlightState.count.total})</span>
                </button>
              </div>

              {/* Color Swatches & Filter Pills */}
              <div className="studio-settings-row">
                <div className="studio-color-group" title="Select Highlight Color">
                  {(['yellow', 'blue', 'green', 'pink', 'purple'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`studio-color-dot ${highlightState.color === c ? 'selected' : ''}`}
                      data-color={c}
                      onClick={() => handleChangeHighlightColor(c)}
                      aria-label={`Highlight Color ${c}`}
                    />
                  ))}
                </div>

                <div className="studio-filter-group">
                  <button
                    type="button"
                    className={`studio-filter-pill ${highlightState.filters.words ? 'active' : ''}`}
                    onClick={() => handleToggleFilter('words')}
                    title="Toggle Words"
                  >
                    Words
                  </button>
                  <button
                    type="button"
                    className={`studio-filter-pill ${highlightState.filters.phrases ? 'active' : ''}`}
                    onClick={() => handleToggleFilter('phrases')}
                    title="Toggle Phrases"
                  >
                    Phrases
                  </button>
                  <button
                    type="button"
                    className={`studio-filter-pill ${highlightState.filters.idioms ? 'active' : ''}`}
                    onClick={() => handleToggleFilter('idioms')}
                    title="Toggle Idioms"
                  >
                    Idioms
                  </button>
                </div>
              </div>

              {/* Collapsible Vocabulary Drawer */}
              {showVocabDrawer && highlightState.items && highlightState.items.length > 0 && (
                <div className="studio-vocab-drawer">
                  <div className="studio-vocab-header">
                    <div className="studio-vocab-header-left">
                      <span className="studio-vocab-header-title">Vocabulary In Article</span>
                      <span className="studio-vocab-count-badge">{highlightState.items.length}</span>
                    </div>
                    <span className="studio-vocab-header-hint">Tap word to jump ↗</span>
                  </div>
                  <div className="studio-vocab-list">
                    {highlightState.items.map((it, idx) => {
                      const meaning = it.easyBengali || it.bengaliMeaning || it.easyEnglish || it.contextualMeaning;
                      return (
                        <div
                          key={idx}
                          className="studio-vocab-item"
                          onClick={() => handleScrollToItem(it.text)}
                          title={`Click to scroll to "${it.text}" in the article`}
                        >
                          <div className="studio-vocab-item-top">
                            <span className="studio-vocab-item-text">{it.text}</span>
                            <span className={`studio-vocab-tag ${it.type}`}>{it.type}</span>
                          </div>
                          {meaning && (
                            <div className="studio-vocab-item-meaning">
                              {meaning}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Re-scan row */}
              <div className="studio-bottom-actions">
                <button
                  type="button"
                  className="studio-btn-rescan"
                  onClick={handleTriggerHighlight}
                >
                  <RotateCcw size={12} />
                  <span>Re-scan Article Body</span>
                </button>
              </div>
            </div>
          )}
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
