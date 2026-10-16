import { calculatePopupPosition, clampPositionToViewport } from './positioning';
import { getSelectionData, isEditableElement } from './selection';
import { POPUP_STYLES } from './styles';
import { PopupView } from './popupView';
import { TriggerView } from './triggerView';
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
  WrongMeaningReport
} from '../types';
import { DEFAULT_SETTINGS } from '../services/storage/settings';
import { registerCustomLanguages } from '../config/languages';
import { MockAIProvider } from '../services/ai/mockProvider';
import { BengaliService } from '../services/bengali';
import { DictionaryService, dictionaryResultToStageA } from '../services/dictionary';
import { CacheManager } from '../services/cache';

class ContentScriptManager {
  private shadowHost: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private popupView: PopupView | null = null;
  private triggerView: TriggerView | null = null;

  private currentText: string = '';
  private currentSelectionType: SelectionType = 'word';
  private currentContextSentence: string = '';
  private currentNearbyParagraph: string = '';
  private currentAnchorRect: DOMRect | null = null;

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

  private userSettings: UserSettings = DEFAULT_SETTINGS;

  init(): void {
    this.createShadowContainer();
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

    // Inject scoped stylesheet
    const styleEl = document.createElement('style');
    styleEl.textContent = POPUP_STYLES;
    this.shadowRoot.appendChild(styleEl);

    // Mount to documentElement for maximum stability against body transforms
    (document.documentElement || document.body).appendChild(this.shadowHost);
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
    this.popupView.setTargetLanguage(this.userSettings.targetLanguage || 'bn');
    if (this.isPopupPositioned) {
      this.updatePosition(false);
    }
  }

  private isSiteDisabled(): boolean {
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
    // 1. Mouse Down Handler (Track dragging state & outside clicks)
    document.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      if (e.detail > 1) return; // Prevent dismissal during double click sequence
      if (this.popupView && this.popupView.isPinnedMode()) return; // Keep pinned popup open

      const target = e.target as Node;
      if (this.shadowHost && !this.shadowHost.contains(target)) {
        this.hidePopup();
        this.hideTrigger();
      }
    }, true);

    // 2. Mouse Up Handler (Selection finalized via mouse drag)
    document.addEventListener('mouseup', (e) => {
      this.isMouseDown = false;
      const target = e.target as Element;
      if (isEditableElement(target)) return;

      // Do not re-trigger selection check if user clicked inside our own popup or trigger
      if (this.shadowHost && (this.shadowHost === target || this.shadowHost.contains(target))) {
        return;
      }

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        this.isUserDismissed = false;
      }

      // Small debounce to allow browser selection range to settle
      this.scheduleSelectionCheck(60);
    }, true);

    // 3. Double Click Handler (Instant Single-Word Selection)
    document.addEventListener('dblclick', (e) => {
      if (this.isSiteDisabled()) return;
      const target = e.target as Element;
      if (isEditableElement(target)) return;

      this.isDoubleClicked = true;
      this.isUserDismissed = false;
      this.lastAnalyzedText = '';
      this.scheduleSelectionCheck(20);
    }, true);

    // 4. Selection Change Handler (Covers Keyboard selections, Shift+Arrows, etc.)
    document.addEventListener('selectionchange', () => {
      // Do not interrupt active mouse drag
      if (this.isMouseDown) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        this.lastAnalyzedText = '';
        this.isUserDismissed = false;
        if (!this.popupView?.isPinnedMode()) {
          this.hideTrigger();
        }
        return;
      }

      // Debounce keyboard & programmatic selection changes (120ms responsive stabilization)
      this.scheduleSelectionCheck(120);
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
          this.lastAnalyzedText = text;
          this.isUserDismissed = false;
          this.executeAnalysis(text, 'word', '', '', dummyRect);
          sendResponse?.({ success: true });
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

    // Guard against editable inputs & textareas
    const active = document.activeElement;
    if (isEditableElement(active)) return;

    const data = getSelectionData();
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
          data.rect
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
    anchorRect: DOMRect
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
          if (this.currentAnchorRect) {
            this.lastAnalyzedText = word;
            this.executeAnalysis(
              word,
              'word',
              contextSentence || this.currentText,
              this.currentNearbyParagraph,
              this.currentAnchorRect
            );
          }
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
    }

    const popupEl = this.popupView.getElement();
    this.applyPopupSize();
    popupEl.classList.remove('lf-hidden');
    popupEl.removeAttribute('hidden');
    popupEl.style.setProperty('display', 'flex', 'important');
    popupEl.style.setProperty('visibility', 'visible', 'important');
    popupEl.style.pointerEvents = 'auto';

    // 1. Instant Fast-Path: Dictionary-First Local Lookup (< 1ms)
    const isWordOrPhrase = selectionType === 'word' || selectionType === 'phrase';
    let hasLocalDisplay = false;

    if (isWordOrPhrase) {
      // Step A: Check memory cache for existing contextual AI result
      const aiCacheKey = CacheManager.getInstance().getAIKey(text, contextSentence);
      const cachedAI = (CacheManager.getInstance() as any).memoryCache?.get(aiCacheKey) as StageAExplanation | null;

      if (cachedAI) {
        this.popupView.showStageA(cachedAI, contextSentence, nearbyParagraph, false);
        this.updatePosition(true);
        hasLocalDisplay = true;
      } else {
        // Step B: Synchronous local dictionary search (< 0.01ms)
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
        CacheManager.getInstance().setAIExplanation(text, contextSentence, stageAResult);

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
      this.popupView.unpin();
      this.popupView.resetDrag();
      const el = this.popupView.getElement();
      el.classList.add('lf-hidden');
      el.setAttribute('hidden', '');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.pointerEvents = 'none';
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
      // Standalone browser / demo environment fallback
      try {
        const mock = new MockAIProvider();
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
