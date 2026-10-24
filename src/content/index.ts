import { calculatePopupPosition, clampPositionToViewport } from './positioning';
import { getSelectionData, isEditableElement, detectSelectionType } from './selection';
import { POPUP_STYLES } from './styles';
import { installBengaliFont, extensionFontUrl } from '../shared/bengaliFont';
import { PopupView } from './popupView';

/** Set once the reader dismisses the first-use tip on the reading card. */
const CARD_TIP_KEY = 'lexiflow_card_tip_done';
import { TriggerView } from './triggerView';
import { DOMHighlighter } from './highlighter';
import { HighlightToolbar } from './highlightToolbar';
import { MainArticleExtractor } from './articleExtractor';
import {
  SelectionType,
  LinguisticAnalysisResult,
  VocabularyItem,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  UserSettings,
  StageAExplanation,
  StageBDetailedVocabulary,
  WrongMeaningReport,
  HighlightExtractionResult
} from '../types';
import { DEFAULT_SETTINGS } from '../services/storage/settings';
import { registerCustomLanguages } from '../config/languages';
import { BengaliService } from '../services/bengali';
import { DictionaryService, dictionaryResultToStageA } from '../services/dictionary';
import { CacheManager } from '../services/cache';

class ContentScriptManager {
  private shadowHost: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private popupView: PopupView | null = null;
  private triggerView: TriggerView | null = null;
  private highlighter: DOMHighlighter | null = null;
  private highlightToolbar: HighlightToolbar | null = null;

  private currentText: string = '';
  private currentSelectionType: SelectionType = 'word';
  private currentContextSentence: string = '';
  private currentNearbyParagraph: string = '';
  private currentAnchorRect: DOMRect | null = null;
  /** Element to refocus when a card that took keyboard focus closes. */
  private focusReturnTarget: HTMLElement | null = null;

  // Concurrency, Cancellation & Debounce controls
  private currentRequestId: number = 0;
  private activeAbortController: AbortController | null = null;
  private inFlightMessages = new Map<string, Promise<unknown>>();
  private lastAnalyzedText: string = '';
  private isMouseDown: boolean = false;
  private isDoubleClicked: boolean = false;
  private isUserDismissed: boolean = false;
  private isPopupPositioned: boolean = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastErrorMessage: string | null = null;
  private lastPointerTarget: EventTarget | null = null;

  private userSettings: UserSettings = DEFAULT_SETTINGS;

  init(): void {
    this.createShadowContainer();
    this.setupHighlighter();
    this.loadSettings();
    this.setupEventListeners();
  }

  private createShadowContainer(): void {
    if (document.getElementById('lexiflow-host')) return;

    this.shadowHost = document.createElement('div');
    this.shadowHost.id = 'lexiflow-host';
    this.shadowHost.style.position = 'fixed';
    this.shadowHost.style.top = '0';
    this.shadowHost.style.left = '0';
    this.shadowHost.style.width = '0';
    this.shadowHost.style.height = '0';
    this.shadowHost.style.zIndex = '2147483647';
    this.shadowHost.style.pointerEvents = 'none';

    this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });

    // Bengali typeface for the card (font faces must be declared on the page document)
    installBengaliFont(document, extensionFontUrl);

    // Inject scoped stylesheet
    const styleEl = document.createElement('style');
    styleEl.textContent = POPUP_STYLES;
    this.shadowRoot.appendChild(styleEl);

    // Mount to documentElement for maximum stability against body transforms
    (document.documentElement || document.body).appendChild(this.shadowHost);
  }

  private setupHighlighter(): void {
    this.highlighter = new DOMHighlighter({
      onHighlightClick: (event) => {
        this.isUserDismissed = false;
        this.lastAnalyzedText = event.item.text;
        const selType: SelectionType = event.item.type === 'word' ? 'word' : 'phrase';
        this.executeAnalysis(
          event.item.text,
          selType,
          event.item.contextSentence,
          '',
          event.rect
        );
      }
    });

    this.highlightToolbar = new HighlightToolbar({
      onAnalyzePage: async () => {
        await this.runPageHighlightAnalysis();
      },
      onClearHighlights: () => {
        this.highlighter?.clearHighlights();
        this.updateHighlightToolbar();
      },
      onNext: () => {
        const res = this.highlighter?.nextHighlight();
        if (res && this.highlightToolbar) {
          this.highlightToolbar.updateState({ currentIndex: res.index });
        }
      },
      onPrev: () => {
        const res = this.highlighter?.prevHighlight();
        if (res && this.highlightToolbar) {
          this.highlightToolbar.updateState({ currentIndex: res.index });
        }
      },
      onColorChange: (color) => {
        this.userSettings.highlightColor = color;
        this.highlighter?.setColor(color);
        this.sendMessage('UPDATE_SETTINGS', { highlightColor: color }).catch(() => {});
      },
      onFilterChange: (filters) => {
        this.userSettings.highlightFilters = filters;
        this.highlighter?.setFilters(filters);
        this.updateHighlightToolbar();
        this.sendMessage('UPDATE_SETTINGS', { highlightFilters: filters }).catch(() => {});
      },
      onSelectSummaryItem: (item) => {
        this.isUserDismissed = false;
        this.lastAnalyzedText = item.text;
        const dummyRect = {
          top: window.innerHeight / 3,
          bottom: window.innerHeight / 3 + 20,
          left: window.innerWidth / 2 - 50,
          right: window.innerWidth / 2 + 50,
          width: 100,
          height: 20
        } as DOMRect;
        this.executeAnalysis(item.text, item.type === 'word' ? 'word' : 'phrase', item.contextSentence, '', dummyRect);
      }
    });

    if (this.shadowRoot) {
      this.shadowRoot.appendChild(this.highlightToolbar.getElement());
      // Keep floating toolbar hidden by default so it does NOT block the reader's article text
      this.highlightToolbar.getElement().style.display = 'none';
    }
  }

  private async runPageHighlightAnalysis(): Promise<HighlightExtractionResult | null> {
    if (this.isSiteDisabled()) return null;
    if (!this.highlighter) return null;

    this.highlightToolbar?.setLoading(true);

    // 1. Isolate the main article body (entire piece, full text)
    const article = MainArticleExtractor.findMainArticle();
    let cleanExcerpt = (article?.cleanText || '').slice(0, 15000);
    const title = article?.title || document.title;
    let targetContainer: HTMLElement | undefined = article?.container;

    // Fallback: If no specialized article container detected, collect substantive paragraphs from body
    if (!cleanExcerpt || cleanExcerpt.trim().length < 30) {
      const substantiveParas = Array.from(document.querySelectorAll('p'))
        .filter((p) => {
          const txt = (p.textContent || '').trim();
          if (txt.length < 25) return false;
          // Ignore inside headers, footers, navs
          if (p.closest('header, footer, nav, aside, [role="navigation"], #lexiflow-host')) return false;
          return true;
        });

      if (substantiveParas.length > 0) {
        cleanExcerpt = substantiveParas.map((p) => p.textContent?.trim()).join('\n\n').slice(0, 15000);
        targetContainer = document.body;
      }
    }

    if (!cleanExcerpt || cleanExcerpt.trim().length < 30) {
      console.warn('[LexiFlow] Page highlighting skipped: No substantive article text found (<30 characters).');
      this.highlightToolbar?.setLoading(false);
      return null;
    }

    try {
      const res = await this.sendMessage<HighlightExtractionResult>('IDENTIFY_PAGE_HIGHLIGHTS', {
        rawText: cleanExcerpt,
        pageTitle: title
      });

      if (res && Array.isArray(res.items) && res.items.length > 0) {
        const color = this.userSettings.highlightColor || 'yellow';
        const filters = this.userSettings.highlightFilters || { words: true, phrases: true, idioms: true };
        // Highlight inside detected article container or body fallback
        this.highlighter.highlightItems(res.items, color, filters, targetContainer);
        this.updateHighlightToolbar();
      }
      return res || null;
    } catch (err) {
      console.warn('[LexiFlow] Page highlighting error:', err);
      return null;
    } finally {
      this.highlightToolbar?.setLoading(false);
    }
  }

  private updateHighlightToolbar(): void {
    if (!this.highlightToolbar || !this.highlighter) return;
    const count = this.highlighter.getCount();
    const items = this.highlighter.getDiscoveredItems();
    this.highlightToolbar.updateState({
      color: this.userSettings.highlightColor || 'yellow',
      filters: this.userSettings.highlightFilters || { words: true, phrases: true, idioms: true },
      count,
      discoveredItems: items
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const s = await this.sendMessage<UserSettings>('GET_SETTINGS');
      if (s) {
        this.userSettings = s;
        this.applyPopupSize();
      }
    } catch {
      // keep default settings
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.lexiflow_user_settings?.newValue) {
          this.userSettings = { ...DEFAULT_SETTINGS, ...changes.lexiflow_user_settings.newValue };
          CacheManager.getInstance().clear();
          this.applyPopupSize();
          if (this.isSiteDisabled()) {
            this.hidePopup();
            this.hideTrigger();
          }
        }
      });
    }
  }

  private applyPopupSize(): void {
    const theme = this.userSettings.theme || 'dark';
    let effective = theme;
    if (effective === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'light';
    }
    if (this.shadowHost) {
      this.shadowHost.setAttribute('data-theme', effective);
    }

    if (!this.popupView) return;
    const size = this.userSettings.popupSize || 'medium';
    this.popupView.setSize(size);
    this.popupView.setTheme(this.userSettings.theme || 'dark');
    if (this.userSettings.customLanguages) {
      registerCustomLanguages(this.userSettings.customLanguages);
    }
    this.popupView.setSourceLanguage(this.userSettings.sourceLanguage || 'en');
    this.popupView.setTargetLanguage(this.userSettings.targetLanguage || 'bn');
    this.popupView.setReadingMode(this.userSettings.readingMode || 'quick');
    if (this.isPopupPositioned) {
      this.updatePosition(false);
    }

    if (this.highlightToolbar) {
      // Keep floating toolbar hidden so it never blocks the reader's article text
      this.highlightToolbar.getElement().style.display = 'none';
      this.highlightToolbar.updateState({
        color: this.userSettings.highlightColor || 'yellow',
        filters: this.userSettings.highlightFilters || { words: true, phrases: true, idioms: true }
      });
    }
  }

  private isSiteDisabled(): boolean {
    if (this.userSettings?.isGloballyPaused) {
      return true;
    }
    if (!this.userSettings?.disabledSites || !Array.isArray(this.userSettings.disabledSites)) {
      return false;
    }
    const host = window.location.hostname.toLowerCase();
    if (!host) return false;
    return this.userSettings.disabledSites.some((site) => {
      const s = site.toLowerCase().trim();
      if (!s) return false;
      return host === s || host.endsWith('.' + s);
    });
  }

  private setupEventListeners(): void {
    // 1. Mouse & Pointer Down Handler (Track dragging state & outside clicks)
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      this.isMouseDown = true;
      this.lastPointerTarget = e.target;
      if (e.detail > 1) return; // Prevent dismissal during double click sequence
      if (this.popupView && this.popupView.isPinnedMode()) return; // Keep pinned popup open

      const target = e.target as Node;
      if (this.shadowHost && !this.shadowHost.contains(target)) {
        this.hidePopup();
        this.hideTrigger();
      }
    };

    // 2. Mouse & Pointer Up Handler (Selection finalized via mouse drag or touch)
    const onPointerUp = (e: MouseEvent | PointerEvent) => {
      this.isMouseDown = false;
      this.lastPointerTarget = e.target;
      const target = e.target as Element;

      // Do not re-trigger selection check if user clicked inside our own popup or trigger
      if (this.shadowHost && (this.shadowHost === target || this.shadowHost.contains(target))) {
        return;
      }

      this.isUserDismissed = false;
      // Small debounce to allow browser selection range to settle
      this.scheduleSelectionCheck(60);
    };

    document.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);

    document.addEventListener('mouseup', onPointerUp, true);
    window.addEventListener('pointerup', onPointerUp, true);

    // 3. Double Click Handler (Instant Single-Word Selection)
    document.addEventListener('dblclick', (e) => {
      if (this.isSiteDisabled()) return;
      this.lastPointerTarget = e.target;
      this.isDoubleClicked = true;
      this.isUserDismissed = false;
      this.lastAnalyzedText = '';
      this.scheduleSelectionCheck(20);
    }, true);

    // 4. Selection Change Handler (Covers Keyboard selections, Shift+Arrows, etc.)
    document.addEventListener('selectionchange', () => {
      // Do not interrupt active mouse drag
      if (this.isMouseDown) return;

      // Debounce keyboard & programmatic selection changes (80ms responsive stabilization)
      this.scheduleSelectionCheck(80);
    });

    // 5. Key Up Handler (Keyboard selection gestures)
    document.addEventListener('keyup', (e) => {
      if (e.key.startsWith('Arrow') || e.key === 'Shift') {
        this.scheduleSelectionCheck(120);
      }
    }, true);

    // 6. Escape Key Handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hidePopup();
        this.hideTrigger();
        this.isUserDismissed = true;
      }
    }, true);

    // 7. Scroll / Resize repositioning
    window.addEventListener('scroll', () => this.updatePosition(), { passive: true });
    window.addEventListener('resize', () => this.updatePosition(), { passive: true });

    // 8. Chrome Runtime Messages (Context Menu / Background triggers)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === 'SETTINGS_UPDATED' && message.payload) {
          this.userSettings = { ...DEFAULT_SETTINGS, ...message.payload };
          CacheManager.getInstance().clear();
          this.applyPopupSize();
          if (this.isSiteDisabled()) {
            this.hidePopup();
            this.hideTrigger();
          }
          sendResponse?.({ success: true });
          return;
        }

        if (message.type === 'TRIGGER_MANUAL_LOOKUP' && message.payload?.text) {
          if (this.isSiteDisabled()) {
            sendResponse?.({ success: false, reason: 'Site disabled' });
            return;
          }
          const text = message.payload.text;
          const dummyRect = {
            top: window.innerHeight / 3,
            bottom: window.innerHeight / 3 + 20,
            left: window.innerWidth / 2 - 50,
            right: window.innerWidth / 2 + 50,
            width: 100,
            height: 20
          } as DOMRect;
          const clean = text.trim();
          const selType = detectSelectionType(clean);
          this.executeAnalysis(clean, selType, clean, '', dummyRect, { focusCard: true });
          sendResponse?.({ success: true });
          return;
        }

        if (message.type === 'GET_PAGE_HIGHLIGHT_STATE') {
          const article = MainArticleExtractor.findMainArticle();
          const count = this.highlighter?.getCount() || { total: 0, words: 0, phrases: 0, idioms: 0, visible: 0 };
          sendResponse?.({
            success: true,
            data: {
              isSiteDisabled: this.isSiteDisabled(),
              articleTitle: article?.title || document.title,
              hasMainArticle: Boolean(article && article.paragraphs.length > 0),
              count,
              currentIndex: (this.highlighter as any)?.currentIndex ?? -1,
              items: this.highlighter?.getDiscoveredItems() || [],
              color: this.userSettings.highlightColor || 'yellow',
              filters: this.userSettings.highlightFilters || { words: true, phrases: true, idioms: true }
            }
          });
          return true;
        }

        if (message.type === 'TRIGGER_HIGHLIGHT_ARTICLE') {
          this.runPageHighlightAnalysis().then((res) => {
            const count = this.highlighter?.getCount() || { total: 0, words: 0, phrases: 0, idioms: 0, visible: 0 };
            const discovered = this.highlighter?.getDiscoveredItems() || [];
            sendResponse?.({
              success: Boolean(res && discovered.length > 0),
              data: {
                count,
                items: discovered,
                sourceMode: res?.sourceMode
              },
              error: !res
                ? 'No editorial article body found on this webpage (requires at least 30 characters).'
                : (discovered.length === 0 ? 'Article analyzed, but 0 terms met the learning value threshold.' : undefined)
            });
          });
          return true;
        }

        if (message.type === 'NAVIGATE_PAGE_HIGHLIGHT') {
          const dir = message.payload?.direction;
          const res = dir === 'prev' ? this.highlighter?.prevHighlight() : this.highlighter?.nextHighlight();
          sendResponse?.({ success: true, data: res });
          return;
        }

        if (message.type === 'UPDATE_PAGE_HIGHLIGHT_SETTINGS') {
          if (message.payload?.color) {
            this.userSettings.highlightColor = message.payload.color;
            this.highlighter?.setColor(message.payload.color);
          }
          if (message.payload?.filters) {
            this.userSettings.highlightFilters = message.payload.filters;
            this.highlighter?.setFilters(message.payload.filters);
          }
          this.updateHighlightToolbar();
          const count = this.highlighter?.getCount();
          sendResponse?.({ success: true, data: { count } });
          return;
        }

        if (message.type === 'CLEAR_PAGE_HIGHLIGHTS') {
          this.highlighter?.clearHighlights();
          this.updateHighlightToolbar();
          sendResponse?.({ success: true });
          return;
        }

        if (message.type === 'SCROLL_TO_HIGHLIGHT_ITEM') {
          const text = (message.payload?.text || '').toLowerCase().trim();
          const visible = this.highlighter?.getVisibleMarks() || [];
          const match = visible.find((m) => (m.textContent || '').toLowerCase().trim() === text);
          if (match) {
            if (typeof match.scrollIntoView === 'function') {
              match.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            (this.highlighter as any)?.setActiveMark(match);
          }
          sendResponse?.({ success: Boolean(match) });
          return;
        }
      });
    }
  }

  private scheduleSelectionCheck(delayMs: number): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.processCurrentSelection();
    }, delayMs);
  }

  private processCurrentSelection(): void {
    if (this.isMouseDown) return;
    if (this.isSiteDisabled()) return;

    const data = getSelectionData(this.lastPointerTarget);
    if (!data || !data.cleanText) return;

    // Disregard massive full-page selections (e.g. Ctrl+A over 5000 chars)
    if (data.cleanText.length > 5000) return;

    // If user explicitly dismissed the popup for this exact text, don't re-trigger
    if (this.isUserDismissed && data.cleanText === this.lastAnalyzedText) return;

    // Prevent duplicate AI calls for the same unchanged selection while popup is already active
    if (data.cleanText === this.lastAnalyzedText && this.popupView && !this.popupView.getElement().classList.contains('lf-hidden')) {
      return;
    }

    const mode = this.userSettings.triggerMode || 'auto_selection';

    if (mode === 'manual_only') {
      return;
    }

    if (mode === 'selection_icon' && !this.userSettings.autoAnalyzeOnSelection) {
      // User explicitly configured floating icon trigger
      this.showTrigger(data.rect, () => {
        this.hideTrigger();
        this.lastAnalyzedText = data.cleanText;
        this.isUserDismissed = false;
        this.executeAnalysis(
          data.cleanText,
          data.selectionType,
          data.contextSentence,
          data.nearbyParagraph,
          data.rect,
          { focusCard: true }
        );
      });
      return;
    }

    // Double click trigger mode: always trigger on double click!
    if (mode === 'double_click') {
      if (this.isDoubleClicked || (this.userSettings.autoAnalyzeOnSelection ?? true)) {
        this.isDoubleClicked = false;
        this.hideTrigger();
        this.lastAnalyzedText = data.cleanText;
        this.isUserDismissed = false;
        this.executeAnalysis(
          data.cleanText,
          data.selectionType,
          data.contextSentence,
          data.nearbyParagraph,
          data.rect
        );
      }
      return;
    }

    // Default 'auto_selection' mode:
    this.hideTrigger();
    this.lastAnalyzedText = data.cleanText;
    this.isUserDismissed = false;
    this.executeAnalysis(
      data.cleanText,
      data.selectionType,
      data.contextSentence,
      data.nearbyParagraph,
      data.rect
    );
  }

  private executeAnalysis(
    text: string,
    selectionType: SelectionType,
    contextSentence: string,
    nearbyParagraph: string,
    anchorRect: DOMRect,
    options: { focusCard?: boolean } = {}
  ): void {
    const requestId = ++this.currentRequestId;
    this.activeAbortController?.abort();
    this.activeAbortController = new AbortController();
    const abortSignal = this.activeAbortController.signal;

    this.currentText = text;
    this.currentSelectionType = selectionType;
    this.currentContextSentence = contextSentence;
    this.currentNearbyParagraph = nearbyParagraph;
    this.currentAnchorRect = anchorRect;
    this.isPopupPositioned = false;

    if (!this.shadowRoot) return;

    if (!this.popupView) {
      this.popupView = new PopupView({
        onClose: () => this.hidePopup(),
        onDismissTip: () => {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({ [CARD_TIP_KEY]: true });
          }
        },
        onRetry: () => {
          if (!this.currentText || !this.currentAnchorRect) return;
          this.executeAnalysis(
            this.currentText,
            this.currentSelectionType,
            this.currentContextSentence,
            this.currentNearbyParagraph,
            this.currentAnchorRect
          );
        },
        onSave: async (item: VocabularyItem) => {
          await this.sendMessage('SAVE_VOCAB', { item });
        },
        onChangeMode: (mode: SelectionType) => {
          if (this.currentAnchorRect) {
            this.executeAnalysis(
              this.currentText,
              mode,
              this.currentContextSentence,
              this.currentNearbyParagraph,
              this.currentAnchorRect
            );
          }
        },
        onWritingAssist: async (goal: WritingGoal): Promise<WritingAssistResult | null> => {
          const res = await this.sendMessage<WritingAssistResult>('ASSIST_WRITING', {
            text: this.currentText,
            goal
          });
          return res || null;
        },
        onAskFollowUp: async (question: string): Promise<FollowUpResponse | null> => {
          const res = await this.sendMessage<FollowUpResponse>('ASK_FOLLOW_UP', {
            text: this.currentText,
            context: this.currentContextSentence || this.currentNearbyParagraph,
            question
          });
          return res || null;
        },
        onFetchStageB: async (lemma: string, pos?: string, senseId?: string): Promise<StageBDetailedVocabulary | null> => {
          const res = await this.sendDeduplicatedMessage<StageBDetailedVocabulary>('ANALYZE_STAGE_B', {
            lemma,
            partOfSpeech: pos,
            contextualSenseId: senseId
          });
          return res || null;
        },
        onReportWrongMeaning: async (report: WrongMeaningReport): Promise<boolean> => {
          const res = await this.sendMessage<{ success: boolean }>('REPORT_WRONG_MEANING', { report });
          return Boolean(res?.success);
        },
        onSelectWord: (word: string, contextSentence?: string) => {
          const anchor = this.currentAnchorRect || this.popupView?.getElement().getBoundingClientRect() || ({
            top: window.innerHeight / 3,
            bottom: window.innerHeight / 3 + 20,
            left: window.innerWidth / 2 - 50,
            right: window.innerWidth / 2 + 50,
            width: 100,
            height: 20
          } as DOMRect);
          this.currentAnchorRect = anchor;
          this.lastAnalyzedText = word;
          this.executeAnalysis(
            word,
            'word',
            contextSentence || this.currentText,
            this.currentNearbyParagraph,
            anchor
          );
        },
        onResize: () => {
          this.updatePosition(false);
        },
        onUpdateSettings: async (updates: Partial<UserSettings>) => {
          this.userSettings = { ...this.userSettings, ...updates };
          await this.sendMessage('UPDATE_SETTINGS', updates);
        }
      });
      this.shadowRoot.appendChild(this.popupView.getElement());
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const view = this.popupView;
        chrome.storage.local.get(CARD_TIP_KEY, (res) => {
          if (!res?.[CARD_TIP_KEY]) view.setFirstUseTip(true);
        });
      }
    }

    const popupEl = this.popupView.getElement();
    this.applyPopupSize();
    popupEl.classList.remove('lf-hidden');
    popupEl.removeAttribute('hidden');
    popupEl.style.setProperty('display', 'flex', 'important');
    popupEl.style.setProperty('visibility', 'visible', 'important');
    popupEl.style.pointerEvents = 'auto';
    if (options.focusCard) {
      const active = document.activeElement;
      this.focusReturnTarget = active instanceof HTMLElement && active !== document.body ? active : null;
      this.popupView.focusCard();
    }

    // Telemetry: Record approved popup_shown lifecycle event (no text, URLs, or personal data)
    this.sendMessage('LOG_EVENT', {
      event: 'popup_shown',
      data: {
        selectionType,
        triggerMode: this.userSettings.triggerMode || 'auto_selection',
        readingMode: this.userSettings.readingMode || 'quick'
      }
    }).catch(() => {});

    // 1. Instant Fast-Path: Dictionary-First Local Lookup (< 1ms)
    const isWordOrPhrase = selectionType === 'word' || selectionType === 'phrase';
    const currentTargetLang = this.userSettings.targetLanguage || 'bn';
    const isBengali = currentTargetLang === 'bn';
    const langPair = `en-${currentTargetLang}`;
    let hasLocalDisplay = false;

    if (isWordOrPhrase) {
      // Step A: Check memory cache for existing contextual AI result
      const aiCacheKey = CacheManager.getInstance().getAIKey(text, contextSentence, langPair);
      const cachedAI = (CacheManager.getInstance() as any).memoryCache?.get(aiCacheKey) as StageAExplanation | null;

      if (cachedAI) {
        this.popupView.showStageA(cachedAI, contextSentence, nearbyParagraph, false);
        this.updatePosition(true);
        hasLocalDisplay = true;
      } else if (isBengali) {
        // Step B: Synchronous local dictionary search (< 0.01ms) - only for Bengali as local dictionary is English-Bengali
        const dictHit = DictionaryService.lookupSync(text, contextSentence);
        if (dictHit) {
          const localStageA = dictionaryResultToStageA(dictHit, contextSentence);
          this.popupView.showStageA(localStageA, contextSentence, nearbyParagraph, false);
          this.updatePosition(true);
          hasLocalDisplay = true;
        }
      }
    }

    if (!hasLocalDisplay) {
      // Show loading indicator only on genuine dictionary misses
      this.popupView.showLoading(text, selectionType);
      this.updatePosition(true);
    }

    (async () => {
      // 2. Fetch AI Analysis in background (Non-blocking contextual interpretation)
      const isWordOrPhrase = selectionType === 'word' || selectionType === 'phrase';

      if (isWordOrPhrase) {
        // Stage A: Immediate Contextual Explanation
        const stageAResult = await this.sendDeduplicatedMessage<StageAExplanation>('ANALYZE_STAGE_A', {
          text,
          contextSentence,
          paragraphContext: nearbyParagraph
        });

        if (requestId !== this.currentRequestId || abortSignal.aborted) return;

        if (!stageAResult) {
          if (!hasLocalDisplay) {
            throw new Error(this.lastErrorMessage || 'Immediate explanation unavailable. Check your AI settings.');
          }
          return;
        }

        // Cache the successful AI explanation
        CacheManager.getInstance().setAIExplanation(text, contextSentence, stageAResult, langPair);

        const savedItem = await this.sendMessage<VocabularyItem>('GET_VOCAB_BY_WORD', { word: text });
        if (requestId !== this.currentRequestId || abortSignal.aborted) return;

        this.popupView?.showStageA(
          stageAResult,
          contextSentence,
          nearbyParagraph,
          Boolean(savedItem)
        );
        this.updatePosition(true);

        // Prefetch Stage B in the background non-blockingly so Deep Dive & Preview are ready instantly
        if (stageAResult.lemma) {
          this.popupView?.prefetchStageB(
            stageAResult.lemma,
            stageAResult.partOfSpeech,
            stageAResult.contextualSenseId
          );
        }
      } else {
        // Generic sentence/paragraph analysis
        const analysisResult = await this.sendDeduplicatedMessage<LinguisticAnalysisResult>('ANALYZE_SELECTION', {
          text,
          selectionType,
          contextSentence,
          paragraphContext: nearbyParagraph
        });

        if (requestId !== this.currentRequestId || abortSignal.aborted) return;

        if (!analysisResult) {
          throw new Error(this.lastErrorMessage || 'Analysis unavailable. Check your AI settings.');
        }

        const savedItem = await this.sendMessage<VocabularyItem>('GET_VOCAB_BY_WORD', { word: text });
        if (requestId !== this.currentRequestId || abortSignal.aborted) return;

        this.popupView?.showAnalysis(
          analysisResult,
          contextSentence,
          nearbyParagraph,
          Boolean(savedItem)
        );
        this.updatePosition(true);
      }
    })().catch((err) => {
      if (requestId !== this.currentRequestId || abortSignal.aborted) return;
      console.warn('[LexiFlow] AI analysis error:', err);
      // If we already rendered a valid local dictionary result, preserve it without showing an error box!
      if (!hasLocalDisplay) {
        this.popupView?.showError(
          (err as Error).message || 'AI quota limit or provider error. Please check your settings.',
          text
        );
        this.updatePosition();
      }
    });
  }

  private showTrigger(rect: DOMRect, onClick: () => void): void {
    if (!this.shadowRoot) return;
    if (!this.triggerView) {
      this.triggerView = new TriggerView(onClick);
      this.shadowRoot.appendChild(this.triggerView.getElement());
    }

    const triggerEl = this.triggerView.getElement();
    triggerEl.style.display = 'flex';
    triggerEl.style.pointerEvents = 'auto';

    this.triggerView.setPosition(rect.right + 6, rect.bottom - 24);
  }

  private hideTrigger(): void {
    if (this.triggerView) {
      this.triggerView.getElement().style.display = 'none';
      this.triggerView.getElement().style.pointerEvents = 'none';
    }
  }

  private hidePopup(): void {
    this.currentRequestId++;
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.isPopupPositioned = false;
    this.isUserDismissed = true;
    if (this.currentText) {
      this.lastAnalyzedText = this.currentText;
    }
    if (this.popupView) {
      this.popupView.stopAudio();
      this.popupView.unpin();
      this.popupView.resetDrag();
      const el = this.popupView.getElement();
      el.classList.add('lf-hidden');
      el.setAttribute('hidden', '');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.pointerEvents = 'none';
      // Give keyboard focus back to where the reader was before the card took it
      if (this.shadowRoot?.activeElement && this.focusReturnTarget?.isConnected) {
        this.focusReturnTarget.focus({ preventScroll: true });
      }
      this.focusReturnTarget = null;
    }
  }

  private updatePosition(forceRecalculate: boolean = false): void {
    if (!this.popupView) return;
    const popupEl = this.popupView.getElement();
    if (popupEl.classList.contains('lf-hidden') || popupEl.style.display === 'none') return;

    const size = this.userSettings.popupSize || 'medium';
    const defaultWidth = size === 'small' ? 370 : size === 'large' ? 520 : size === 'xlarge' ? 610 : 440;
    const defaultMaxHeight = size === 'small' ? 460 : size === 'large' ? 660 : size === 'xlarge' ? 760 : 560;

    // If user has dragged the popup, maintain their chosen position clamped to the viewport
    if (this.popupView.isUserDraggedMode()) {
      const currentLeft = parseFloat(popupEl.style.left) || 0;
      const currentTop = parseFloat(popupEl.style.top) || 0;
      const popupWidth = popupEl.offsetWidth || defaultWidth;
      const popupHeight = popupEl.offsetHeight || 380;
      const clamped = clampPositionToViewport(
        currentLeft,
        currentTop,
        popupWidth,
        popupHeight,
        window.innerWidth,
        window.innerHeight,
        8
      );
      popupEl.style.left = `${clamped.left}px`;
      popupEl.style.top = `${clamped.top}px`;
      const maxAllowedHeight = Math.min(defaultMaxHeight, window.innerHeight - clamped.top - 12);
      popupEl.style.maxHeight = `${Math.max(240, maxAllowedHeight)}px`;
      return;
    }

    if (!this.currentAnchorRect) return;

    // Estimate realistic height of full definition card
    const popupWidth = popupEl.offsetWidth || defaultWidth;
    const popupHeight = Math.max(popupEl.offsetHeight || 0, size === 'small' ? 320 : size === 'large' ? 450 : size === 'xlarge' ? 520 : 380);

    const pos = calculatePopupPosition(
      this.currentAnchorRect,
      popupWidth,
      popupHeight,
      window.innerWidth,
      window.innerHeight
    );

    popupEl.style.top = `${pos.top}px`;
    popupEl.style.left = `${pos.left}px`;

    // Ensure the popup's max-height fits within the screen so footer is NEVER clipped
    const maxAllowedHeight = Math.min(defaultMaxHeight, window.innerHeight - pos.top - 14);
    popupEl.style.maxHeight = `${Math.max(240, maxAllowedHeight)}px`;
    this.isPopupPositioned = true;
  }

  private async sendDeduplicatedMessage<T>(type: string, payload?: any): Promise<T | null> {
    if (type === 'ANALYZE_STAGE_A' || type === 'ANALYZE_SELECTION' || type === 'ANALYZE_STAGE_B') {
      const dedupeKey = `${type}::${payload?.text || payload?.lemma || ''}::${payload?.contextSentence || ''}`;
      const existing = this.inFlightMessages.get(dedupeKey) as Promise<T | null> | undefined;
      if (existing) {
        return existing;
      }

      const promise = (async () => {
        try {
          return await this.sendMessage<T>(type, payload);
        } finally {
          this.inFlightMessages.delete(dedupeKey);
        }
      })();

      this.inFlightMessages.set(dedupeKey, promise);
      return promise;
    }

    return this.sendMessage<T>(type, payload);
  }

  private async sendMessage<T>(type: string, payload?: any): Promise<T | null> {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || !chrome.runtime.id) {
      // Standalone browser / demo environment fallback (dev builds only; stripped from production)
      if (!__LEXIFLOW_DEMO__) return null;
      try {
        const { MockAIProvider } = await import('../services/ai/mockProvider');
        const mock = new MockAIProvider(this.userSettings?.targetLanguage || 'bn');
        if (type === 'ANALYZE_STAGE_A') {
          return (await mock.analyzeStageA(payload.text, payload.contextSentence, payload.paragraphContext)) as unknown as T;
        }
        if (type === 'ANALYZE_STAGE_B') {
          return (await mock.analyzeStageB(payload.lemma, payload.partOfSpeech, payload.contextualSenseId)) as unknown as T;
        }
        if (type === 'ANALYZE_SELECTION') {
          return (await mock.analyze(payload.text, payload.selectionType, payload.contextSentence, payload.paragraphContext)) as unknown as T;
        }
        if (type === 'GET_SETTINGS') {
          return DEFAULT_SETTINGS as unknown as T;
        }
        if (type === 'SAVE_VOCAB') {
          return { success: true } as unknown as T;
        }
        if (type === 'GET_VOCAB_BY_WORD') {
          return null;
        }
      } catch {
        return null;
      }
      return null;
    }

    return new Promise((resolve) => {
      try {
        if (!chrome.runtime.id) {
          resolve(null);
          return;
        }

        chrome.runtime.sendMessage({ type, payload }, (res) => {
          try {
            if (chrome.runtime.lastError) {
              this.lastErrorMessage = chrome.runtime.lastError.message || 'Extension runtime disconnected. Please reload the webpage.';
              resolve(null);
            } else if (!res?.success) {
              this.lastErrorMessage = res?.error || 'AI request failed.';
              resolve(null);
            } else {
              this.lastErrorMessage = null;
              resolve(res.data);
            }
          } catch {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }
}

// Instantiate and initialize
const manager = new ContentScriptManager();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => manager.init());
} else {
  manager.init();
}
