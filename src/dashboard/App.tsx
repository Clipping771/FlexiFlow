import React, { useState, useEffect } from 'react';
import { VocabularyItem, UserSettings, FSRSRating } from '../types';
import { Navbar, DashboardTab } from './components/Navbar';
import { VocabularyView } from './components/VocabularyView';
import { TargetedPracticeView } from './components/TargetedPracticeView';
import { ReviewView } from './components/ReviewView';
import { ArticleReaderView } from './components/ArticleReaderView';
import { SentenceXRayView } from './components/SentenceXRayView';
import { WordDifferenceView } from './components/WordDifferenceView';
import { CoachView } from './components/CoachView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_SETTINGS } from '../services/storage/settings';
import { WeaknessDetector } from '../services/weakness/detector';
import { FSRSEngine } from '../services/fsrs/engine';
import { Menu, X, BookOpen, RotateCw, Newspaper, Settings as SettingsIcon } from 'lucide-react';
import './dashboard.css';

const TAB_TITLES: Record<DashboardTab, string> = {
  overview: 'Overview',
  vocabulary: 'Vocabulary Library',
  targeted_practice: 'Targeted Practice',
  review: 'Spaced Review',
  article_reader: 'Article Reader',
  sentence_xray: 'Sentence X-Ray',
  word_difference: 'Word Difference',
  usage_coach: 'Usage Coach',
  analytics: 'Learning Analytics',
  settings: 'Settings'
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('vocabulary');
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [dueItems, setDueItems] = useState<VocabularyItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [coachWord, setCoachWord] = useState<string>('mitigate');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isNarrowScreen, setIsNarrowScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      const narrow = window.innerWidth <= 768;
      setIsNarrowScreen(narrow);
      if (!narrow) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const STARTER_ITEMS: VocabularyItem[] = [
    {
      id: 'starter_1',
      word: 'scrutiny',
      selectionType: 'word',
      partOfSpeech: 'noun',
      meaning: 'Critical observation or examination; close inspection.',
      definition: 'Critical observation or examination; close inspection.',
      bengaliMeaning: 'পুঙ্খানুপুঙ্খ পরীক্ষা / তীক্ষ্ণ নজরদারি',
      bengaliExplanation: 'গভীর মনোযোগ সহকারে কোনো বিষয় বা তথ্যের চুলচেরা বিশ্লেষণ করা।',
      contextSentence: 'The proposed legislation came under intense scrutiny from regulators.',
      dateAdded: new Date().toISOString(),
      tags: ['academic', 'reading'],
      collection: 'Academic English',
      difficulty: 'medium',
      starred: true,
      fsrs: {
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 'new',
        nextReview: new Date().toISOString()
      }
    },
    {
      id: 'starter_2',
      word: 'mitigate',
      selectionType: 'word',
      partOfSpeech: 'verb',
      meaning: 'Make (something bad) less severe, serious, or painful.',
      definition: 'Make (something bad) less severe, serious, or painful.',
      bengaliMeaning: 'উপশম করা / তীব্রতা কমানো',
      bengaliExplanation: 'কোনো সমস্যা বা যন্ত্রণার তীব্রতা কমিয়ে সহনীয় করে তোলা।',
      contextSentence: 'Policies were introduced to mitigate potential economic risks.',
      dateAdded: new Date().toISOString(),
      tags: ['daily', 'business'],
      collection: 'Daily Vocabulary',
      difficulty: 'hard',
      isMarkedDifficult: true,
      fsrs: {
        stability: 1.2,
        difficulty: 7,
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 2,
        lapses: 1,
        state: 'relearning',
        nextReview: new Date().toISOString()
      }
    },
    {
      id: 'starter_3',
      word: 'ubiquitous',
      selectionType: 'word',
      partOfSpeech: 'adjective',
      meaning: 'Present, appearing, or found everywhere at the same time.',
      definition: 'Present, appearing, or found everywhere at the same time.',
      bengaliMeaning: 'সর্বব্যাপী / সর্বত্র বিদ্যমান',
      bengaliExplanation: 'যা একই সাথে সব জায়গায় দেখতে পাওয়া যায়।',
      contextSentence: 'Smartphones have become ubiquitous in modern metropolitan life.',
      dateAdded: new Date().toISOString(),
      tags: ['academic', 'gre'],
      collection: 'Academic English',
      difficulty: 'hard',
      fsrs: {
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: 'new',
        nextReview: new Date().toISOString()
      }
    }
  ];

  const loadData = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_ALL_VOCAB' }, (res) => {
        if (res?.success && Array.isArray(res.data)) {
          setItems(res.data);
          const now = new Date();
          setDueItems(res.data.filter((item: VocabularyItem) => FSRSEngine.isDue(item.fsrs, now)));
        } else {
          setItems([]);
          setDueItems([]);
        }
      });
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
        if (res?.success && res.data) {
          setSettings(res.data);
          if (res.data.theme === 'light' || res.data.theme === 'dark') {
            setTheme(res.data.theme);
          }
        }
        setLoading(false);
      });
    } else {
      // LocalStorage persistence fallback for browser / dev mode
      try {
        const localSettings = localStorage.getItem('lexiflow_user_settings');
        if (localSettings) {
          const parsed = JSON.parse(localSettings);
          if (parsed.theme === 'light' || parsed.theme === 'dark') {
            setTheme(parsed.theme);
          }
        }
      } catch {}

      try {
        const saved = localStorage.getItem('lexiflow_vocab_items');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed);
            const now = new Date();
            setDueItems(parsed.filter((item: VocabularyItem) => FSRSEngine.isDue(item.fsrs, now)));
          } else {
            setItems([]);
            setDueItems([]);
          }
        } else {
          setItems([]);
          setDueItems([]);
        }
      } catch {
        setItems([]);
        setDueItems([]);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const persistToLocalFallback = (updatedItems: VocabularyItem[]) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      try {
        localStorage.setItem('lexiflow_vocab_items', JSON.stringify(updatedItems));
      } catch {}
    }
  };

  const handleLoadSamples = async () => {
    for (const item of STARTER_ITEMS) {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item } });
      }
    }
    setItems(STARTER_ITEMS);
    const now = new Date();
    setDueItems(STARTER_ITEMS.filter((item: VocabularyItem) => FSRSEngine.isDue(item.fsrs, now)));
    persistToLocalFallback(STARTER_ITEMS);
  };

  const handleDeleteItem = async (id: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      persistToLocalFallback(updated);
      return updated;
    });
    setDueItems((prev) => prev.filter((i) => i.id !== id));

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DELETE_VOCAB', payload: { id } });
    }
  };

  const handleToggleStar = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const updated: VocabularyItem = { ...item, starred: !item.starred };
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? updated : i));
      persistToLocalFallback(next);
      return next;
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item: updated } });
    }
  };

  const handleToggleDifficult = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newDifficult = !item.isMarkedDifficult;
    const updated: VocabularyItem = {
      ...item,
      isMarkedDifficult: newDifficult,
      difficulty: newDifficult ? 'hard' : 'medium'
    };
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? updated : i));
      persistToLocalFallback(next);
      return next;
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item: updated } });
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const updated: VocabularyItem = { ...item, notes };
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? updated : i));
      persistToLocalFallback(next);
      return next;
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item: updated } });
    }
  };

  const handleDismissWeakness = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const updated: VocabularyItem = { ...item, dismissedFromWeakness: true };
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? updated : i));
      persistToLocalFallback(next);
      return next;
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item: updated } });
    }
  };

  const handleSaveVocabulary = async (newItem: VocabularyItem) => {
    // Avoid duplicates
    const norm = newItem.word.toLowerCase().trim();
    const existing = items.find((i) => i.word.toLowerCase().trim() === norm);
    const itemToSave = existing ? { ...existing, ...newItem, id: existing.id } : newItem;

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.word.toLowerCase().trim() === norm);
      let next: VocabularyItem[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = itemToSave;
      } else {
        next = [itemToSave, ...prev];
      }
      persistToLocalFallback(next);
      return next;
    });

    if (FSRSEngine.isDue(itemToSave.fsrs)) {
      setDueItems((prev) => [itemToSave, ...prev.filter((i) => i.id !== itemToSave.id)]);
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SAVE_VOCAB', payload: { item: itemToSave } });
    }
  };

  const handleReviewSubmit = async (id: string, rating: FSRSRating) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'SCHEDULE_REVIEW',
        payload: { id, rating }
      }, (res) => {
        if (res?.success && res.data) {
          setItems((prev) => prev.map((i) => (i.id === id ? res.data : i)));
          setDueItems((prev) => prev.filter((i) => i.id !== id));
        }
      });
    } else {
      const item = items.find((i) => i.id === id);
      if (item) {
        const updatedFSRS = FSRSEngine.scheduleNextReview(item.fsrs, rating);
        const updated = { ...item, fsrs: updatedFSRS };
        setItems((prev) => {
          const next = prev.map((i) => (i.id === id ? updated : i));
          persistToLocalFallback(next);
          return next;
        });
        setDueItems((prev) => prev.filter((i) => i.id !== id));
      }
    }
  };

  const handleExport = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (res) => {
        if (res?.success && res.data) {
          const blob = new Blob([res.data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lexiflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    }
  };

  const handleImport = async (jsonString: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          payload: { jsonString }
        }, (res) => {
          if (res?.success) {
            loadData();
            resolve();
          } else {
            reject(new Error(res?.error || 'Import failed'));
          }
        });
      });
    }
  };

  const handleSaveSettings = async (updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: updates
      }, (res) => {
        if (res?.success && res.data) {
          setSettings(res.data);
        }
      });
    } else {
      try {
        const current = localStorage.getItem('lexiflow_user_settings');
        const parsed = current ? JSON.parse(current) : DEFAULT_SETTINGS;
        localStorage.setItem('lexiflow_user_settings', JSON.stringify({ ...parsed, ...updates }));
      } catch {}
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    handleSaveSettings({ theme: nextTheme });
  };

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined') {
      if ((chrome as any).sidePanel?.open && chrome.windows?.getLastFocused) {
        chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
          const targetWinId = win?.id;
          if (targetWinId) {
            (chrome as any).sidePanel.open({ windowId: targetWinId }).catch(() => {
              chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', payload: { windowId: targetWinId } });
            });
          } else {
            chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          }
        });
        return;
      }

      if (chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      }
    }
  };

  const handleNavigateToCoach = (word: string) => {
    setCoachWord(word);
    setActiveTab('usage_coach');
  };

  // Weakness count for badge
  const weakCount = WeaknessDetector.getTargetedPracticeList(items).length;
  const existingVocabWordSet = new Set(items.map((i) => i.word.toLowerCase().trim()));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8' }}>
        Loading LexiFlow AI...
      </div>
    );
  }

  const handleTabSelect = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (isNarrowScreen) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className={`dashboard-layout ${isNarrowScreen ? 'narrow-layout' : ''}`}>
      {/* On desktop: show Navbar. On narrow screen: show Navbar only when isSidebarOpen is true */}
      {(!isNarrowScreen || isSidebarOpen) && (
        <div className={`sidebar-wrapper ${isNarrowScreen ? 'narrow-drawer' : ''}`}>
          {isNarrowScreen && (
            <div className="narrow-drawer-close-row">
              <span className="drawer-title">LexiFlow Tools</span>
              <button
                type="button"
                className="btn-drawer-close"
                onClick={() => setIsSidebarOpen(false)}
                title="Close Menu"
              >
                <X size={18} />
              </button>
            </div>
          )}
          <Navbar
            activeTab={activeTab}
            onTabChange={handleTabSelect}
            dueCount={dueItems.length}
            totalVocab={items.length}
            weakCount={weakCount}
            onOpenSidePanel={handleOpenSidePanel}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        </div>
      )}

      {/* Main content is shown on desktop always, and on narrow screens when sidebar drawer is closed */}
      {(!isNarrowScreen || !isSidebarOpen) && (
        <main className="main-content">
          {isNarrowScreen && (
            <header className="narrow-top-bar">
              <button
                type="button"
                className="narrow-menu-toggle-btn"
                onClick={() => setIsSidebarOpen(true)}
                title="Open Tools Menu"
              >
                <Menu size={16} />
                <span>Menu</span>
              </button>

              <span className="narrow-bar-title">{TAB_TITLES[activeTab]}</span>

              <button
                type="button"
                className="narrow-theme-toggle-btn"
                onClick={handleToggleTheme}
                title="Toggle Dark/Light Mode"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </header>
          )}

          {activeTab === 'vocabulary' && (
            <VocabularyView
              items={items}
              onDeleteItem={handleDeleteItem}
              onToggleStar={handleToggleStar}
              onToggleDifficult={handleToggleDifficult}
              onUpdateNotes={handleUpdateNotes}
              onExport={handleExport}
              onImport={handleImport}
              onSelectForCoach={handleNavigateToCoach}
              onLoadSamples={handleLoadSamples}
            />
          )}

          {activeTab === 'targeted_practice' && (
            <TargetedPracticeView
              items={items}
              onReviewSubmit={handleReviewSubmit}
              onDismissWeakness={handleDismissWeakness}
              onSelectWordForCoach={handleNavigateToCoach}
            />
          )}

          {activeTab === 'review' && (
            <ReviewView
              dueItems={dueItems}
              onReviewSubmit={handleReviewSubmit}
            />
          )}

          {activeTab === 'article_reader' && (
            <ArticleReaderView
              onSaveVocabulary={handleSaveVocabulary}
              existingVocabWords={existingVocabWordSet}
            />
          )}

          {activeTab === 'sentence_xray' && <SentenceXRayView />}

          {activeTab === 'word_difference' && <WordDifferenceView />}

          {activeTab === 'usage_coach' && <CoachView initialWord={coachWord} />}

          {activeTab === 'analytics' && (
            <AnalyticsView
              items={items}
              dueCount={dueItems.length}
              onNavigateToTargetedPractice={() => setActiveTab('targeted_practice')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {isNarrowScreen && (
            <nav className="narrow-bottom-nav">
              <button
                type="button"
                className={`bottom-nav-item ${activeTab === 'vocabulary' ? 'active' : ''}`}
                onClick={() => handleTabSelect('vocabulary')}
              >
                <BookOpen size={16} />
                <span>Vocab</span>
              </button>
              <button
                type="button"
                className={`bottom-nav-item ${activeTab === 'review' ? 'active' : ''}`}
                onClick={() => handleTabSelect('review')}
              >
                <RotateCw size={16} />
                <span>Review</span>
                {dueItems.length > 0 && <span className="bottom-nav-pill">{dueItems.length}</span>}
              </button>
              <button
                type="button"
                className={`bottom-nav-item ${activeTab === 'article_reader' ? 'active' : ''}`}
                onClick={() => handleTabSelect('article_reader')}
              >
                <Newspaper size={16} />
                <span>Reader</span>
              </button>
              <button
                type="button"
                className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleTabSelect('settings')}
              >
                <SettingsIcon size={16} />
                <span>Settings</span>
              </button>
              <button
                type="button"
                className="bottom-nav-item"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={16} />
                <span>Tools</span>
              </button>
            </nav>
          )}
        </main>
      )}
    </div>
  );
};
