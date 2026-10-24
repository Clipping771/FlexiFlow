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
import { ReadingTab, PageHighlightState } from './components/ReadingTab';
import { LookupTab } from './components/LookupTab';
import { LibraryTab } from './components/LibraryTab';
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
  PanelRight,
  ExternalLink,
  Settings,
  Sun,
  Moon,
  BookMarked
} from 'lucide-react';
import { MONETIZATION_ENABLED } from '../config/features';
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
      if (s.sourceLanguage) view.setSourceLanguage(s.sourceLanguage);
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
      // Normalize soft line breaks and hyphens across lines (typical in PDFs and column selections)
      let normalized = text.trim();
      normalized = normalized.replace(/(\w+)-\r?\n\s*(\w+)/g, '$1$2');
      normalized = normalized.replace(/([^\n])\r?\n([^\n])/g, '$1 $2');
      normalized = normalized.replace(/[ \t]+/g, ' ');
      currentWord = normalized;

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

const ONBOARDING_KEY = 'lexiflow_onboarding_done';

export const App: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [result, setResult] = useState<LinguisticAnalysisResult | null>(null);
  const [stageB, setStageB] = useState<StageBDetailedVocabulary | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [recentVocab, setRecentVocab] = useState<VocabularyItem[]>([]);
  const [popupTab, setPopupTab] = useState<'reading' | 'lookup' | 'library'>('reading');
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

  // First-run welcome guide (dismissed once, remembered in extension storage)
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.get(ONBOARDING_KEY, (res) => {
      if (!res?.[ONBOARDING_KEY]) setShowOnboarding(true);
    });
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [ONBOARDING_KEY]: true });
    }
  };

  const chooseTextSize = (size: 'small' | 'medium' | 'large' | 'xlarge') => {
    setTextSize(size);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { popupSize: size } });
    }
  };

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
  const [highlightState, setHighlightState] = useState<PageHighlightState | null>(null);
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
          setRecentVocab(res.data.slice(-5).reverse());
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
                setRecentVocab(res.data.slice(-5).reverse());
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

  const renderInteractiveWords = (text?: string) => {
    if (!text) return null;
    const tokens = text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+/gu) || [text];
    return tokens.map((token, i) => {
      const isWord = /^[\p{L}\p{N}]+$/u.test(token);
      if (!isWord) return <React.Fragment key={i}>{token}</React.Fragment>;
      const cleanWord = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
      if (!cleanWord) return <React.Fragment key={i}>{token}</React.Fragment>;
      return (
        <span
          key={i}
          className="popup-interactive-word"
          onClick={(e) => {
            e.stopPropagation();
            executeSearch(cleanWord);
          }}
          title={`Inspect "${cleanWord}"`}
        >
          {token}
        </span>
      );
    });
  };

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
      {/* 1. Sleek Modern Header */}
      <div className="hub-header">
        <div className="hub-brand">
          <div className="brand-logo-container">
            <img src="/assets/icon48.png" alt="LexiFlow" className="brand-logo-img" />
          </div>
          <div className="brand-text-block">
            <div className="app-title-row">
              <span className="app-title">LexiFlow</span>
              {MONETIZATION_ENABLED && <span className="app-badge-pro">PRO</span>}
            </div>
            <div className="app-sub">Contextual reading companion</div>
          </div>
        </div>

        <div className="hub-header-actions">
          <button
            type="button"
            className="hub-icon-btn"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            type="button"
            className="hub-icon-btn"
            onClick={openDashboard}
            title="Open LexiFlow Settings"
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 2. Top Segmented Navigation Tabs */}
      <div className="hub-segmented-tabs">
        <button
          type="button"
          className={`hub-tab-item ${popupTab === 'reading' ? 'active' : ''}`}
          onClick={() => setPopupTab('reading')}
        >
          <Sparkles size={13} />
          <span>Reading AI</span>
        </button>

        <button
          type="button"
          className={`hub-tab-item ${popupTab === 'lookup' ? 'active' : ''}`}
          onClick={() => setPopupTab('lookup')}
        >
          <Search size={13} />
          <span>Lookup</span>
        </button>

        <button
          type="button"
          className={`hub-tab-item ${popupTab === 'library' ? 'active' : ''}`}
          onClick={() => setPopupTab('library')}
        >
          <BookMarked size={13} />
          <span>Library</span>
          {dueCount > 0 && <span className="hub-tab-badge">{dueCount}</span>}
        </button>
      </div>

      {/* 3. Tab Contents Area */}
      <div className="hub-content-area">
        {/* ======================================================== */}
        {/* TAB 1: READING AI (Current Tab Article Companion)         */}
        {/* ======================================================== */}
        {popupTab === 'reading' && (
          <ReadingTab
            savedCount={savedCount}
            dueCount={dueCount}
            setPopupTab={setPopupTab}
            currentDomain={currentDomain}
            textSize={textSize}
            showOnboarding={showOnboarding}
            dismissOnboarding={dismissOnboarding}
            chooseTextSize={chooseTextSize}
            highlightState={highlightState}
            highlightLoading={highlightLoading}
            showVocabDrawer={showVocabDrawer}
            setShowVocabDrawer={setShowVocabDrawer}
            highlightFeedback={highlightFeedback}
            isCurrentSiteEnabled={isCurrentSiteEnabled}
            toggleCurrentSite={toggleCurrentSite}
            handleTriggerHighlight={handleTriggerHighlight}
            handleNavigateHighlight={handleNavigateHighlight}
            handleChangeHighlightColor={handleChangeHighlightColor}
            handleToggleFilter={handleToggleFilter}
            handleClearHighlights={handleClearHighlights}
            handleScrollToItem={handleScrollToItem}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUICK LOOKUP (Dictionary & Instant Explainer)     */}
        {/* ======================================================== */}
        {popupTab === 'lookup' && (
          <LookupTab
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            executeSearch={executeSearch}
            setResult={setResult}
            loading={loading}
            result={result}
            isSentenceMode={isSentenceMode}
            sentenceResult={sentenceResult}
            isSaved={isSaved}
            handleSave={handleSave}
            renderInteractiveWords={renderInteractiveWords}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 3: LIBRARY & REVIEW (Spaced Repetition & Saved Words) */}
        {/* ======================================================== */}
        {popupTab === 'library' && (
          <LibraryTab
            savedCount={savedCount}
            dueCount={dueCount}
            recentVocab={recentVocab}
            onOpenDashboard={openDashboard}
            onLookupWord={(word) => {
              setPopupTab('lookup');
              executeSearch(word);
            }}
          />
        )}
      </div>

      {/* 4. Bottom Dock Actions */}
      <div className="hub-bottom-dock">
        <button
          type="button"
          className="hub-dock-btn"
          onClick={openSidePanel}
          title="Open LexiFlow in browser Side Panel"
        >
          <PanelRight size={14} />
          <span>Side Panel</span>
        </button>

        <button
          type="button"
          className="hub-dock-btn primary"
          onClick={openDashboard}
          title="Open full LexiFlow Learning Dashboard"
        >
          <ExternalLink size={14} />
          <span>Dashboard</span>
        </button>
      </div>
    </div>
  );
};
