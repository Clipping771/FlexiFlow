import {
  SelectionType,
  LinguisticAnalysisResult,
  WordAnalysisResult,
  PhraseAnalysisResult,
  SentenceAnalysisResult,
  ParagraphAnalysisResult,
  ParagraphSentenceItem,
  ParagraphBlockItem,
  PhraseExplanation,
  VocabularyItem,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary,
  WrongMeaningReport,
  UserSettings,
  createInitialFSRSState
} from '../types';
import { getLanguageConfig, getAllLanguages } from '../config/languages';
import { clampPositionToViewport } from './positioning';
import { splitIntoParagraphs, splitIntoSentences } from './selection';
import { playPronunciation } from '../services/audio/voiceService';
import { getValidatedWhyThisMatters, findDiscourseConnectors, MatchedConnector } from '../services/connectors/matcher';
import { generateCloze } from '../services/cloze/generator';
import { getSentenceOverviewTeaching, buildBeginnerBreakdownSections } from '../services/grammar/grammarL10n';

export interface PopupCallbacks {
  onClose: () => void;
  onSave: (item: VocabularyItem) => Promise<void>;
  onChangeMode: (mode: SelectionType) => void;
  onSelectWord?: (word: string, contextSentence?: string) => void;
  onWritingAssist: (goal: WritingGoal) => Promise<WritingAssistResult | null>;
  onAskFollowUp: (question: string) => Promise<FollowUpResponse | null>;
  onFetchStageB?: (lemma: string, pos?: string, senseId?: string) => Promise<StageBDetailedVocabulary | null>;
  onReportWrongMeaning?: (report: WrongMeaningReport) => Promise<boolean>;
  onResize?: () => void;
  onUpdateSettings?: (updates: Partial<UserSettings>) => Promise<void>;
}

export class PopupView {
  private element: HTMLElement;
  private currentStageA: StageAExplanation | null = null;
  private currentStageB: StageBDetailedVocabulary | null = null;
  private currentSentenceAnalysis: SentenceAnalysisResult | null = null;
  private currentParagraphAnalysis: ParagraphAnalysisResult | null = null;
  private parentSentenceAnalysis: SentenceAnalysisResult | null = null;
  private currentAnalysis: LinguisticAnalysisResult | null = null;
  private currentContextSentence: string = '';
  private currentNearbyParagraph: string = '';
  private isSaved: boolean = false;
  private isExpanded: boolean = false;
  private isSentenceExpanded: boolean = false;
  private isSentenceAnalysisExpanded: boolean = false;
  private isPinned: boolean = false;
  private isStageBLoading: boolean = false;
  private stageBError: string | null = null;
  private showingAllSenses: boolean = false;
  private showFeedbackModal: boolean = false;
  private feedbackSuccess: boolean = false;
  private showAskAI: boolean = false;
  private activeTab: 'meaning' | 'ask-ai' | 'details' = 'meaning';
  private activeSentenceTab: 'breakdown' | 'grammar' | 'clauses' | 'ask-ai' = 'breakdown';
  private activeParaIndex: number = 0;
  private activeParaSentenceIndex: number = 0;
  private writingAssistResult: WritingAssistResult | null = null;
  private followUpList: FollowUpResponse[] = [];
  private isFollowUpLoading: boolean = false;
  private callbacks: PopupCallbacks;

  // Header drag movement state
  private isDragging: boolean = false;
  private isUserDragged: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragInitialLeft: number = 0;
  private dragInitialTop: number = 0;
  private activePointerId: number | null = null;
  private currentHeaderEl: HTMLElement | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundPointerCancel: ((e: PointerEvent) => void) | null = null;

  // 8-Directional Resizing state
  private isResizing: boolean = false;
  private isUserResized: boolean = false;
  private resizeDirection: string = '';
  private resizeStartX: number = 0;
  private resizeStartY: number = 0;
  private resizeInitialRect: DOMRect | null = null;
  private activeResizePointerId: number | null = null;
  private activeResizeHandle: HTMLElement | null = null;
  private boundResizeMove: ((e: PointerEvent) => void) | null = null;
  private boundResizeUp: ((e: PointerEvent) => void) | null = null;
  private boundResizeCancel: ((e: PointerEvent) => void) | null = null;
  private userResizedWidth: number | null = null;
  private userResizedHeight: number | null = null;

  private currentSize: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
  private sourceLanguage: string = 'en';
  private targetLanguage: string = 'bn';
  private currentTheme: 'light' | 'dark' | 'system' = 'dark';
  private readingMode: 'quick' | 'learn' = 'quick';

  constructor(callbacks: PopupCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'lexiflow-popup size-medium theme-dark';
    this.element.setAttribute('data-theme', 'dark');
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', 'LexiFlow Definition');
    this.element.tabIndex = -1;
    this.setupListeners();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    let effective = theme || 'dark';
    if (effective === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'light';
    }
    this.currentTheme = theme;
    this.element.setAttribute('data-theme', effective);
    if (effective === 'dark') {
      this.element.classList.add('theme-dark');
      this.element.classList.remove('theme-light');
    } else {
      this.element.classList.add('theme-light');
      this.element.classList.remove('theme-dark');
    }
  }

  getTheme(): 'light' | 'dark' | 'system' {
    return this.currentTheme;
  }

  setReadingMode(mode: 'quick' | 'learn'): void {
    const nextMode = mode === 'learn' ? 'learn' : 'quick';
    if (this.readingMode !== nextMode) {
      this.readingMode = nextMode;
      if (this.currentStageA || this.currentSentenceAnalysis || this.currentParagraphAnalysis || this.currentAnalysis) {
        this.render({ preserveScroll: true });
      }
    }
  }

  getReadingMode(): 'quick' | 'learn' {
    return this.readingMode;
  }

  toggleReadingMode(): void {
    const nextMode: 'quick' | 'learn' = this.readingMode === 'learn' ? 'quick' : 'learn';
    this.readingMode = nextMode;
    if (this.callbacks.onUpdateSettings) {
      this.callbacks.onUpdateSettings({ readingMode: nextMode });
    }
    this.render({ preserveScroll: true });
  }

  private renderModeToggleHtml(): string {
    const isLearn = this.readingMode === 'learn';
    return `
      <button type="button" class="lf-btn-icon lf-reading-mode-btn ${isLearn ? 'learn-mode' : ''}" title="Reading Mode: ${isLearn ? 'Learn Mode (Click for Quick Mode)' : 'Quick Mode (Click for Learn Mode)'}" aria-label="Toggle Reading Mode">
        ${isLearn ? `${lfIcon('brain')} <span class="lf-mode-text">Learn</span>` : `${lfIcon('bolt')} <span class="lf-mode-text">Quick</span>`}
      </button>
    `;
  }

  setSize(size: 'small' | 'medium' | 'large' | 'xlarge'): void {
    this.currentSize = size || 'medium';
    this.element.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');
    this.element.classList.add(`size-${this.currentSize}`);
    this.element.setAttribute('data-size', this.currentSize);
  }

  getSize(): 'small' | 'medium' | 'large' | 'xlarge' {
    return this.currentSize;
  }

  cycleSize(): void {
    const sizes: Array<'small' | 'medium' | 'large' | 'xlarge'> = ['small', 'medium', 'large', 'xlarge'];
    const curIdx = sizes.indexOf(this.currentSize);
    const nextSize = sizes[(curIdx + 1) % sizes.length];
    this.setSize(nextSize);
    this.callbacks.onResize?.();
    if (this.callbacks.onUpdateSettings) {
      this.callbacks.onUpdateSettings({ popupSize: nextSize });
    }
  }

  setSourceLanguage(lang: string): void {
    const newLang = lang || 'en';
    if (this.sourceLanguage !== newLang) {
      this.sourceLanguage = newLang;
      if (this.currentStageA || this.currentSentenceAnalysis || this.currentParagraphAnalysis || this.currentAnalysis) {
        this.render({ preserveScroll: true });
      }
    }
  }

  getSourceLanguage(): string {
    return this.sourceLanguage;
  }

  setTargetLanguage(lang: string): void {
    const newLang = lang || 'bn';
    if (this.targetLanguage !== newLang) {
      this.targetLanguage = newLang;
      if (this.currentStageA || this.currentSentenceAnalysis || this.currentParagraphAnalysis || this.currentAnalysis) {
        this.render({ preserveScroll: true });
      }
    }
  }

  getTargetLanguage(): string {
    return this.targetLanguage;
  }

  isPinnedMode(): boolean {
    return this.isPinned;
  }

  unpin(): void {
    this.isPinned = false;
  }

  isUserDraggedMode(): boolean {
    return this.isUserDragged;
  }

  resetDrag(): void {
    this.finishDrag();
    this.finishResize();
    this.isUserDragged = false;
  }

  setParentSentence(parent: SentenceAnalysisResult | null): void {
    this.parentSentenceAnalysis = parent;
  }

  async prefetchStageB(lemma: string, pos?: string, senseId?: string): Promise<void> {
    if (this.currentStageB || this.isStageBLoading) return;
    if (!this.callbacks.onFetchStageB) return;
    try {
      const data = await this.callbacks.onFetchStageB(lemma, pos, senseId);
      if (data && this.currentStageA && this.currentStageA.lemma.toLowerCase() === lemma.toLowerCase()) {
        this.currentStageB = data;
        if (this.activeTab === 'meaning' && !this.isFollowUpLoading && !this.showAskAI && !this.showFeedbackModal) {
          this.render({ preserveScroll: true });
        }
      }
    } catch {
      // Non-blocking prefetch failure is ignored
    }
  }

  private setupListeners(): void {
    this.element.addEventListener('mousedown', (e) => e.stopPropagation());
    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const closeBtn = target?.closest('.lf-close-btn');
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.unpin();
        this.callbacks.onClose();
        return;
      }
      e.stopPropagation();
    });
    this.element.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    // Delegated click handler for all interactive source words across entire popup
    this.element.addEventListener('click', (e: MouseEvent) => {
      const wordEl = (e.target as HTMLElement | null)?.closest('.lf-sentence-word') as HTMLElement | null;
      if (!wordEl || !this.element.contains(wordEl)) return;
      e.preventDefault();
      e.stopPropagation();
      const word = wordEl.getAttribute('data-word');
      const customContext = wordEl.getAttribute('data-context');
      if (word && this.callbacks.onSelectWord) {
        if (this.currentSentenceAnalysis) {
          this.parentSentenceAnalysis = this.currentSentenceAnalysis;
        }
        const ctx = customContext || this.currentContextSentence || this.currentSentenceAnalysis?.selectedText || this.currentStageA?.selectedText;
        this.callbacks.onSelectWord(word, ctx);
      }
    });

    // Keyboard navigation & accessible Escape behavior
    this.element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        if (this.showFeedbackModal) {
          this.showFeedbackModal = false;
          this.render();
        } else if (this.showAskAI) {
          this.showAskAI = false;
          this.render();
        } else if (this.isSentenceAnalysisExpanded) {
          this.isSentenceAnalysisExpanded = false;
          this.render();
          const toggle = (this.element.querySelector('#lf-sentence-expand-toggle') || this.element.querySelector('#lf-para-expand-toggle')) as HTMLElement;
          toggle?.focus();
        } else if (this.isExpanded) {
          this.isExpanded = false;
          this.render();
          const toggle = this.element.querySelector('#lf-expand-toggle') as HTMLElement;
          toggle?.focus();
        } else {
          this.callbacks.onClose();
        }
      }
    });
  }

  private isolateInteractiveElements(): void {
    const interactives = this.element.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a, .lf-btn-icon, .lf-tab, .lf-sentence-word, .lf-quick-chip, .lf-vocab-chip-btn, [role="button"]'
    );
    interactives.forEach((btn) => {
      if (btn.classList.contains('lf-close-btn')) {
        return;
      }
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('pointerup', (e) => e.stopPropagation());
      btn.addEventListener('mousedown', (e) => e.stopPropagation());
      btn.addEventListener('mouseup', (e) => e.stopPropagation());
    });
  }

  private setupDragHandler(): void {
    const header = this.element.querySelector('.lf-header') as HTMLElement | null;
    if (!header) return;

    this.currentHeaderEl = header;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      // Allow only primary button (0 for mouse) or touch/pen (0)
      if (e.button !== 0) return;

      // Do not initiate drag when user clicks interactive buttons, tabs, input controls, or interactive words
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('button, input, select, textarea, a, .lf-btn-icon, .lf-tab, .lf-sentence-word, .lf-back-sentence-btn, [role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = true;
      this.isUserDragged = true;
      this.activePointerId = e.pointerId;

      document.documentElement.style.setProperty('cursor', 'move', 'important');
      document.documentElement.style.setProperty('user-select', 'none', 'important');

      try {
        header.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if setPointerCapture is unsupported in environment
      }

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const currentRect = this.element.getBoundingClientRect();
      this.dragInitialLeft = currentRect.left;
      this.dragInitialTop = currentRect.top;

      header.classList.add('dragging');
      this.element.classList.add('dragging');

      this.removeDragWindowListeners();

      this.boundPointerMove = (moveEv: PointerEvent) => {
        if (!this.isDragging) return;
        if (this.activePointerId !== null && moveEv.pointerId !== this.activePointerId) return;
        moveEv.preventDefault();

        const deltaX = moveEv.clientX - this.dragStartX;
        const deltaY = moveEv.clientY - this.dragStartY;

        const rawLeft = this.dragInitialLeft + deltaX;
        const rawTop = this.dragInitialTop + deltaY;

        const popupWidth = this.element.offsetWidth || currentRect.width || 410;
        const popupHeight = this.element.offsetHeight || currentRect.height || 380;

        const clamped = clampPositionToViewport(
          rawLeft,
          rawTop,
          popupWidth,
          popupHeight,
          window.innerWidth,
          window.innerHeight,
          8
        );

        this.element.style.left = `${clamped.left}px`;
        this.element.style.top = `${clamped.top}px`;
      };

      this.boundPointerUp = (upEv: PointerEvent) => {
        if (this.activePointerId !== null && upEv.pointerId !== this.activePointerId) return;
        this.finishDrag();
      };

      this.boundPointerCancel = (cancelEv: PointerEvent) => {
        if (this.activePointerId !== null && cancelEv.pointerId !== this.activePointerId) return;
        this.finishDrag();
      };

      window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
      window.addEventListener('pointerup', this.boundPointerUp);
      window.addEventListener('pointercancel', this.boundPointerCancel);
    });
  }

  private finishDrag(): void {
    if (!this.isDragging && this.activePointerId === null) return;
    this.isDragging = false;

    if (this.currentHeaderEl && this.activePointerId !== null) {
      try {
        if (this.currentHeaderEl.hasPointerCapture(this.activePointerId)) {
          this.currentHeaderEl.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Fallback for mock environments
      }
    }
    this.activePointerId = null;

    document.documentElement.style.removeProperty('cursor');
    document.documentElement.style.removeProperty('user-select');

    if (this.currentHeaderEl) {
      this.currentHeaderEl.classList.remove('dragging');
    }
    this.element.classList.remove('dragging');
    this.removeDragWindowListeners();
  }

  private removeDragWindowListeners(): void {
    if (this.boundPointerMove) {
      window.removeEventListener('pointermove', this.boundPointerMove);
      this.boundPointerMove = null;
    }
    if (this.boundPointerUp) {
      window.removeEventListener('pointerup', this.boundPointerUp);
      this.boundPointerUp = null;
    }
    if (this.boundPointerCancel) {
      window.removeEventListener('pointercancel', this.boundPointerCancel);
      this.boundPointerCancel = null;
    }
  }

  private setupResizeHandlers(): void {
    const directions = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
    directions.forEach((dir) => {
      let handle = this.element.querySelector(`.lf-resize-${dir}`) as HTMLElement | null;
      if (!handle) {
        handle = document.createElement('div');
        handle.className = `lf-resize-handle lf-resize-${dir}`;
        handle.setAttribute('data-direction', dir);
        if (dir === 'se') {
          handle.setAttribute('title', 'Drag corner to resize diagonally');
          handle.innerHTML = `
            <svg class="lf-resize-grip-icon" width="10" height="10" viewBox="0 0 10 10">
              <line x1="8" y1="2" x2="2" y2="8" stroke="#0071e3" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="5" x2="5" y2="8" stroke="#0071e3" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="8" y1="8" x2="8" y2="8" stroke="#0071e3" stroke-width="2" stroke-linecap="round"/>
            </svg>
          `;
        }
        this.element.appendChild(handle);
      }

      // Fresh listener
      const newHandle = handle.cloneNode(true) as HTMLElement;
      handle.replaceWith(newHandle);

      newHandle.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.isUserResized = true;
        this.isUserDragged = true;
        this.resizeDirection = dir;
        this.activeResizePointerId = e.pointerId;
        this.activeResizeHandle = newHandle;

        try {
          newHandle.setPointerCapture(e.pointerId);
        } catch {
          // Fallback
        }

        this.resizeStartX = e.clientX;
        this.resizeStartY = e.clientY;
        this.resizeInitialRect = this.element.getBoundingClientRect();

        const cursorMap: Record<string, string> = {
          n: 'ns-resize',
          s: 'ns-resize',
          w: 'ew-resize',
          e: 'ew-resize',
          nw: 'nwse-resize',
          se: 'nwse-resize',
          ne: 'nesw-resize',
          sw: 'nesw-resize'
        };
        const activeCursor = cursorMap[dir] || 'nwse-resize';
        document.documentElement.style.setProperty('cursor', activeCursor, 'important');
        document.documentElement.style.setProperty('user-select', 'none', 'important');

        this.element.classList.add('resizing', 'is-resized');
        this.removeResizeWindowListeners();

        this.boundResizeMove = (moveEv: PointerEvent) => {
          if (!this.isResizing || !this.resizeInitialRect) return;
          if (this.activeResizePointerId !== null && moveEv.pointerId !== this.activeResizePointerId) return;
          moveEv.preventDefault();

          const deltaX = moveEv.clientX - this.resizeStartX;
          const deltaY = moveEv.clientY - this.resizeStartY;
          const init = this.resizeInitialRect;

          let newWidth = init.width;
          let newHeight = init.height;
          let newLeft = init.left;
          let newTop = init.top;

          const minW = 310;
          const minH = 220;
          const maxW = Math.max(minW, window.innerWidth - 16);
          const maxH = Math.max(minH, window.innerHeight - 16);

          // Horizontal adjustment
          if (dir.includes('e')) {
            newWidth = Math.max(minW, Math.min(maxW - newLeft, init.width + deltaX));
          } else if (dir.includes('w')) {
            const clampedDeltaX = Math.min(deltaX, init.width - minW);
            const targetLeft = Math.max(8, init.left + clampedDeltaX);
            newWidth = Math.max(minW, init.width - (targetLeft - init.left));
            newLeft = targetLeft;
          }

          // Vertical adjustment
          if (dir.includes('s')) {
            newHeight = Math.max(minH, Math.min(maxH - newTop, init.height + deltaY));
          } else if (dir.includes('n')) {
            const clampedDeltaY = Math.min(deltaY, init.height - minH);
            const targetTop = Math.max(8, init.top + clampedDeltaY);
            newHeight = Math.max(minH, init.height - (targetTop - init.top));
            newTop = targetTop;
          }

          this.userResizedWidth = newWidth;
          this.userResizedHeight = newHeight;
          this.element.style.left = `${newLeft}px`;
          this.element.style.top = `${newTop}px`;
          this.element.style.width = `${newWidth}px`;
          this.element.style.height = `${newHeight}px`;
        };

        this.boundResizeUp = (upEv: PointerEvent) => {
          if (this.activeResizePointerId !== null && upEv.pointerId !== this.activeResizePointerId) return;
          this.finishResize();
        };

        this.boundResizeCancel = (cancelEv: PointerEvent) => {
          if (this.activeResizePointerId !== null && cancelEv.pointerId !== this.activeResizePointerId) return;
          this.finishResize();
        };

        window.addEventListener('pointermove', this.boundResizeMove, { passive: false });
        window.addEventListener('pointerup', this.boundResizeUp);
        window.addEventListener('pointercancel', this.boundResizeCancel);
      });
    });

    // If user previously resized, re-apply their custom width and height
    if (this.isUserResized && this.userResizedWidth && this.userResizedHeight) {
      this.element.classList.add('is-resized');
      this.element.style.width = `${this.userResizedWidth}px`;
      this.element.style.height = `${this.userResizedHeight}px`;
    }
  }

  private finishResize(): void {
    if (!this.isResizing && this.activeResizePointerId === null) return;
    this.isResizing = false;

    if (this.activeResizeHandle && this.activeResizePointerId !== null) {
      try {
        if (this.activeResizeHandle.hasPointerCapture(this.activeResizePointerId)) {
          this.activeResizeHandle.releasePointerCapture(this.activeResizePointerId);
        }
      } catch {
        // Fallback
      }
    }
    this.activeResizePointerId = null;
    this.activeResizeHandle = null;

    document.documentElement.style.removeProperty('cursor');
    document.documentElement.style.removeProperty('user-select');

    this.element.classList.remove('resizing');
    this.removeResizeWindowListeners();
    this.callbacks.onResize?.();
  }

  private removeResizeWindowListeners(): void {
    if (this.boundResizeMove) {
      window.removeEventListener('pointermove', this.boundResizeMove);
      this.boundResizeMove = null;
    }
    if (this.boundResizeUp) {
      window.removeEventListener('pointerup', this.boundResizeUp);
      this.boundResizeUp = null;
    }
    if (this.boundResizeCancel) {
      window.removeEventListener('pointercancel', this.boundResizeCancel);
      this.boundResizeCancel = null;
    }
  }

  showLoading(text: string, type: SelectionType): void {
    const isSentence = type === 'sentence';
    const isSentenceOrPara = type === 'sentence' || type === 'paragraph';
    const clean = text.trim();

    if (isSentence) {
      const connectors = findDiscourseConnectors(clean);
      const isLongSentence = clean.length > 130;
      const langConfig = getLanguageConfig(this.targetLanguage);
      const targetLabel = langConfig?.targetLabel || 'Bengali';
      const flag = langConfig?.flagEmoji || '🇧🇩';
      const connectorRoleText = langConfig?.targetLang === 'bn'
        ? connectors[0]?.defaultBengaliRole
        : connectors[0]?.discourseRole;

      this.element.innerHTML = `
        <div class="lf-header">
          <div class="lf-title-row">
            <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
            <span class="lf-heading-sentence">Sentence Analysis</span>
            <span class="lf-pos">SENTENCE</span>
          </div>
          <div class="lf-actions-top">
            ${this.renderModeToggleHtml()}
            <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
          </div>
        </div>

        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">Sentence</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Ask AI</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Grammar</button>
        </div>

        <div class="lf-content lf-skeleton-content" id="lf-main-content" role="status" aria-live="polite">
          <!-- A. Selected Sentence displayed immediately with rule-based connector marks -->
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>Selected Sentence:</span>
            </div>
            <div class="lf-sentence-text ${!this.isSentenceExpanded && isLongSentence ? 'truncated' : ''}">
              ${this.renderSentenceWithConnectors(clean, connectors)}
            </div>
            <div class="lf-sentence-hint">
              Click any word in the text to inspect its dictionary meaning
            </div>

            ${connectors.length > 0 ? `
              <div class="lf-connector-detected-card" style="margin-top: 8px; padding: 7px 10px; background: rgba(147, 51, 234, 0.08); border-left: 3px solid #9333ea; border-radius: 6px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9333ea; margin-bottom: 2px;">
                  Discourse Connector: "${escapeHtml(connectors[0].text)}" (${escapeHtml(connectors[0].categoryLabel)})
                </div>
                <div style="font-size: 12px; color: var(--text-main, #1d1d1f); line-height: 1.4;">
                  ${escapeHtml(connectors[0].discourseRole)}
                  <div style="font-size: 11px; color: var(--text-muted, #6e6e73); margin-top: 2px;">
                    ${flag} ${escapeHtml(connectorRoleText || '')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Honest live AI loading indicator with luxury shimmering effect -->
          <div class="lf-ai-shimmer-card">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; overflow: hidden;">
                <div class="lf-skeleton-pulse-dot" style="flex-shrink: 0;"></div>
                <span style="font-size: 12px; font-weight: 700; color: #0071e3; letter-spacing: -0.01em; line-height: 1.35; overflow: hidden; text-overflow: ellipsis;">
                  Analyzing phrase breakdown & ${escapeHtml(targetLabel)} translation with AI...
                </span>
              </div>
              <span class="lf-ai-live-badge" style="flex-shrink: 0; white-space: nowrap;">${lfIcon('sparkles')} Live AI</span>
            </div>

            <!-- Shimmering placeholder breakdown lines -->
            <div style="display: flex; gap: 6px; margin: 10px 0 8px 0; flex-wrap: wrap;">
              <span class="lf-skeleton-chip lf-shimmer" style="width: 75px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 110px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 82px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 95px; height: 22px;"></span>
            </div>

            <!-- Shimmering target translation bar -->
            <div style="padding: 8px 10px; background: rgba(0, 113, 227, 0.05); border-radius: 6px; margin-bottom: 9px; border-left: 2px solid #0071e3;">
              <div class="lf-shimmer-accent" style="height: 13px; width: 85%; margin-bottom: 5px;"></div>
              <div class="lf-shimmer-accent" style="height: 11px; width: 50%; opacity: 0.7;"></div>
            </div>

            <div style="font-size: 11px; color: var(--text-muted, #86868b); line-height: 1.4;">
              Connecting to live AI provider. Real-time contextual analysis will appear here. No fabricated offline breakdown.
            </div>
          </div>
        </div>
      `;

      this.element.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.unpin();
        this.callbacks.onClose();
      });

      this.bindSentenceWordListeners(clean);

      this.isolateInteractiveElements();
      this.setupDragHandler();
      this.setupResizeHandlers();
      this.callbacks.onResize?.();
      return;
    }

    const headingHtml = isSentenceOrPara
      ? `<span class="lf-heading-sentence">${type === 'paragraph' ? 'Paragraph Intelligence' : 'Sentence Analysis'}</span>`
      : `<span class="lf-heading-word" title="${escapeHtml(clean)}">${escapeHtml(clean)}</span>`;

    const langConfig = getLanguageConfig(this.targetLanguage);
    const nativeHeader = langConfig?.targetNativeHeader || 'সহজ বাংলা';
    const nativeLabel = langConfig?.targetNativeLabel || 'বাংলা';

    const tabsHtml = isSentenceOrPara
      ? `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">Breakdown</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Ask AI</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Grammar</button>
        </div>
      `
      : `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">Meaning</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Ask AI</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">Deep Dive</button>
        </div>
      `;

    const contentHtml = isSentenceOrPara
      ? `
        <div class="lf-content lf-skeleton-content" role="status" aria-live="polite">
          <div style="margin-bottom: 12px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; color: #86868b; font-weight: 700; margin-bottom: 7px;">
              Interactive Breakdown:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
              <span class="lf-skeleton-chip lf-shimmer" style="width: 52px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 78px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 44px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 92px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 64px; height: 22px;"></span>
              <span class="lf-skeleton-chip lf-shimmer" style="width: 48px; height: 22px;"></span>
            </div>
          </div>

          <div class="lf-bengali-box lf-skeleton-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(0, 113, 227, 0.06); border-left: 3px solid #0071e3; border-radius: 8px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; color: #0071e3; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span style="background: rgba(0, 113, 227, 0.15); color: #0071e3; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">
                ${escapeHtml(nativeLabel)}
              </span>
              <span>${escapeHtml(nativeHeader)}:</span>
            </div>
            <div class="lf-skeleton-line lf-shimmer-accent" style="width: 90%; height: 16px; margin-bottom: 6px;"></div>
            <div class="lf-skeleton-line lf-shimmer-accent" style="width: 62%; height: 16px;"></div>
          </div>

          <div class="lf-skeleton-status">
            <div class="lf-skeleton-pulse-dot"></div>
            <span class="lf-skeleton-status-text">${type === 'paragraph' ? 'Analyzing paragraph intelligence...' : 'Analyzing text & phrase-by-phrase meaning...'}</span>
          </div>
        </div>
      `
      : `
        <div class="lf-content lf-skeleton-content" role="status" aria-live="polite">
          <div class="lf-def-item" style="margin-bottom: 10px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; color: #86868b; font-weight: 700; margin-bottom: 6px;">
              Easy English:
            </div>
            <div class="lf-skeleton-line lf-shimmer" style="width: 94%; height: 14px; margin-bottom: 6px;"></div>
            <div class="lf-skeleton-line lf-shimmer" style="width: 66%; height: 14px;"></div>
          </div>

          <div class="lf-bengali-box lf-skeleton-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(0, 113, 227, 0.06); border-left: 3px solid #0071e3; border-radius: 8px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; color: #0071e3; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span style="background: rgba(0, 113, 227, 0.15); color: #0071e3; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">
                ${escapeHtml(nativeLabel)}
              </span>
              <span>${escapeHtml(nativeHeader)}:</span>
            </div>
            <div class="lf-skeleton-line lf-shimmer-accent" style="width: 88%; height: 16px; margin-bottom: 6px;"></div>
            <div class="lf-skeleton-line lf-shimmer-accent" style="width: 48%; height: 16px;"></div>
          </div>

          <div class="lf-skeleton-status">
            <div class="lf-skeleton-pulse-dot"></div>
            <span class="lf-skeleton-status-text">AI interpreting in context...</span>
          </div>
        </div>
      `;

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          ${headingHtml}
          <span class="lf-pos">${type.toUpperCase()}</span>
        </div>
        <div class="lf-actions-top">
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
        </div>
      </div>
      ${tabsHtml}
      ${contentHtml}
    `;

    this.element.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });
    this.isolateInteractiveElements();
    this.setupDragHandler();
    this.setupResizeHandlers();
    this.callbacks.onResize?.();
  }

  showError(errorMessage: string, text: string): void {
    const clean = text.trim();
    const isSentence = clean.split(/\s+/).length >= 4;

    if (isSentence) {
      const connectors = findDiscourseConnectors(clean);
      this.element.innerHTML = `
        <div class="lf-header">
          <div class="lf-title-row">
            <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
            <span class="lf-heading-sentence">Sentence Analysis</span>
            <span class="lf-pos" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">OFFLINE</span>
          </div>
          <div class="lf-actions-top">
            <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
          </div>
        </div>
        <div class="lf-content" id="lf-main-content">
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>Selected Sentence:</span>
            </div>
            <div class="lf-sentence-text">
              ${this.renderSentenceWithConnectors(clean, connectors)}
            </div>
            <div class="lf-sentence-hint">
              Click any word in the text to inspect its dictionary meaning
            </div>

            ${connectors.length > 0 ? `
              <div class="lf-connector-detected-card" style="margin-top: 8px; padding: 7px 10px; background: rgba(147, 51, 234, 0.08); border-left: 3px solid #9333ea; border-radius: 6px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9333ea; margin-bottom: 2px;">
                  Discourse Connector: "${escapeHtml(connectors[0].text)}" (${escapeHtml(connectors[0].categoryLabel)})
                </div>
                <div style="font-size: 12px; color: var(--text-main, #1d1d1f); line-height: 1.4;">
                  ${escapeHtml(connectors[0].discourseRole)}
                  <div style="font-size: 11px; color: var(--text-muted, #6e6e73); margin-top: 2px;">
                    ${getLanguageConfig(this.targetLanguage)?.flagEmoji || '🇧🇩'} ${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetLang === 'bn' ? connectors[0].defaultBengaliRole : connectors[0].discourseRole)}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <div style="margin-top: 10px; padding: 12px 14px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px;">
            <div style="font-size: 12.5px; font-weight: 700; color: #dc2626; margin-bottom: 4px;">
              AI Interpretation Unavailable / AI বিশ্লেষণ অনুপলব্ধ
            </div>
            <div style="font-size: 12px; color: var(--text-main, #1e293b); margin-bottom: 6px; line-height: 1.45;">
              ${escapeHtml(errorMessage || 'AI provider unavailable or offline.')}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted, #64748b); line-height: 1.4;">
              Deep phrase breakdown and contextual translation require an active AI provider.
            </div>
          </div>

          <!-- Inline Quick Setup Card -->
          <div class="lf-quick-api-setup" style="margin-top: 10px; padding: 12px; border-radius: 8px; background: rgba(37,99,235,0.04); border: 1px solid rgba(37,99,235,0.2);">
            <div style="font-size: 12px; font-weight: 700; color: #2563eb; margin-bottom: 4px;">
              ${lfIcon('bolt')} Connect AI for Live Analysis
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted, #64748b); margin-bottom: 8px;">
              Enter your Gemini API key (Free from Google AI Studio) to unlock real-time syntactic and clause breakdowns:
            </div>
            <div style="display: flex; gap: 6px;">
              <input type="password" class="lf-quick-api-input" placeholder="Paste Gemini API Key..." style="flex: 1; padding: 6px 8px; font-size: 12px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.15); background: var(--bg-surface, #ffffff); color: var(--text-main, #0f172a);" />
              <button type="button" class="lf-quick-api-save-btn" style="padding: 6px 12px; font-size: 11.5px; font-weight: 600; border-radius: 6px; background: #2563eb; color: #ffffff; border: none; cursor: pointer; white-space: nowrap;">
                Save &amp; Analyze
              </button>
            </div>
          </div>
        </div>
      `;

      this.element.querySelector('.lf-quick-api-save-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const input = this.element.querySelector('.lf-quick-api-input') as HTMLInputElement | null;
        const key = input?.value?.trim();
        if (key && this.callbacks.onUpdateSettings) {
          await this.callbacks.onUpdateSettings({ apiKey: key, aiProvider: 'gemini' });
          if (this.callbacks.onChangeMode) {
            this.callbacks.onChangeMode('sentence');
          }
        }
      });

      this.element.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.unpin();
        this.callbacks.onClose();
      });

      this.bindSentenceWordListeners(clean);

      this.isolateInteractiveElements();
      this.setupDragHandler();
      this.setupResizeHandlers();
      this.callbacks.onResize?.();
      return;
    }

    const headingHtml = clean.length > 35
      ? `${escapeHtml(clean.slice(0, 32))}...`
      : escapeHtml(clean);

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-heading-word" title="${escapeHtml(clean)}">${headingHtml}</span>
          <span class="lf-pos" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">ERROR</span>
        </div>
        <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
      </div>
      <div style="padding: 16px; font-size: 13px; color: #fca5a5; line-height: 1.5;">
        <strong style="display: block; margin-bottom: 6px; color: #ef4444;">AI Interpretation Unavailable</strong>
        <span>${escapeHtml(errorMessage)}</span>
        <div style="margin-top: 10px; font-size: 11.5px; color: #94a3b8;">
          Check your AI provider settings in the LexiFlow dashboard.
        </div>
      </div>
    `;

    this.element.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });
    this.isolateInteractiveElements();
    this.setupDragHandler();
    this.setupResizeHandlers();
    this.callbacks.onResize?.();
  }

  showStageA(
    stageA: StageAExplanation,
    contextSentence: string,
    nearbyParagraph: string,
    isAlreadySaved: boolean = false,
    parentSentence?: SentenceAnalysisResult | null
  ): void {
    // If popup is currently showing Stage A for the same word/phrase, update progressively without full rerender!
    if (
      this.currentStageA &&
      this.currentStageA.selectedText.toLowerCase().trim() === stageA.selectedText.toLowerCase().trim() &&
      !this.showAskAI &&
      !this.showFeedbackModal
    ) {
      if (this.updateStageAProgressive(stageA, isAlreadySaved)) {
        return;
      }
    }

    this.currentStageA = stageA;
    this.activeTab = 'meaning';
    this.currentStageB = null;
    this.currentSentenceAnalysis = null;
    this.currentParagraphAnalysis = null;
    this.currentAnalysis = null;
    if (parentSentence !== undefined) {
      this.parentSentenceAnalysis = parentSentence;
    }
    this.currentContextSentence = contextSentence;
    this.currentNearbyParagraph = nearbyParagraph;
    this.isSaved = isAlreadySaved;
    this.isExpanded = false;
    this.isStageBLoading = false;
    this.stageBError = null;
    this.showingAllSenses = false;
    this.showFeedbackModal = false;
    this.feedbackSuccess = false;
    this.showAskAI = false;
    this.writingAssistResult = null;
    this.followUpList = [];
    this.render();
  }

  /**
   * Smoothly updates contextual AI interpretation into an existing Stage A view
   * without destroying or re-rendering the full popup container.
   */
  updateStageAProgressive(aiResult: StageAExplanation, isAlreadySaved?: boolean): boolean {
    if (!this.currentStageA) return false;
    const contextEl = this.element.querySelector('.lf-context-text') as HTMLElement | null;
    if (!contextEl) return false;

    // Update internal state
    this.currentStageA.contextMeaning = aiResult.contextMeaning;
    this.currentStageA.confidence = aiResult.confidence;
    this.currentStageA.uncertaintyReason = aiResult.uncertaintyReason;
    if (aiResult.easyBengali && aiResult.easyBengali.trim() !== (this.currentStageA.easyBengali || '').trim()) {
      this.currentStageA.easyBengali = aiResult.easyBengali;
      const easyBengaliEl = this.element.querySelector('.lf-easy-bengali-text') as HTMLElement | null;
      if (easyBengaliEl) {
        easyBengaliEl.textContent = aiResult.easyBengali;
      }
    }
    if (aiResult.example) {
      this.currentStageA.example = aiResult.example;
      this.currentStageA.exampleBengali = aiResult.exampleBengali;
    }

    // Update contextual text smoothly without popup reload
    contextEl.textContent = aiResult.contextMeaning;

    const exampleBox = this.element.querySelector('.lf-example-box') as HTMLElement | null;
    const exampleText = this.element.querySelector('.lf-example-text') as HTMLElement | null;
    const exampleBengali = this.element.querySelector('.lf-example-bengali') as HTMLElement | null;

    if (aiResult.example && exampleBox && exampleText) {
      exampleText.textContent = `"${aiResult.example}"`;
      exampleBox.style.display = 'block';
      if (aiResult.exampleBengali && exampleBengali) {
        exampleBengali.textContent = `(${aiResult.exampleBengali})`;
        exampleBengali.style.display = 'block';
      }
    }

    const badgeEl = this.element.querySelector('.lf-ai-badge') as HTMLElement | null;
    if (badgeEl) {
      badgeEl.innerHTML = `${lfIcon('sparkles')} AI-generated`;
    }

    const confidenceEl = this.element.querySelector('.lf-confidence-pill') as HTMLElement | null;
    if (confidenceEl) {
      confidenceEl.textContent = `Confidence: ${aiResult.confidence}`;
      confidenceEl.className = `lf-confidence-pill ${aiResult.confidence}`;
    }

    if (isAlreadySaved !== undefined) {
      this.isSaved = isAlreadySaved;
      const saveBtn = this.element.querySelector('.lf-save-btn') as HTMLElement | null;
      if (saveBtn) {
        saveBtn.className = `lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}`;
        saveBtn.textContent = this.isSaved ? '✓ Saved' : '+ Save';
      }
    }

    this.callbacks.onResize?.();
    return true;
  }

  showSentence(
    sentenceAnalysis: SentenceAnalysisResult,
    contextSentence: string,
    nearbyParagraph: string,
    isAlreadySaved: boolean = false
  ): void {
    this.currentSentenceAnalysis = sentenceAnalysis;
    this.activeSentenceTab = 'breakdown';
    this.currentParagraphAnalysis = null;
    this.currentStageA = null;
    this.currentStageB = null;
    this.parentSentenceAnalysis = null;
    this.currentAnalysis = null;
    this.currentContextSentence = contextSentence || sentenceAnalysis.selectedText;
    this.currentNearbyParagraph = nearbyParagraph;
    this.isSaved = isAlreadySaved;
    this.isExpanded = false;
    this.isSentenceExpanded = false;
    this.isSentenceAnalysisExpanded = false;
    this.showFeedbackModal = false;
    this.feedbackSuccess = false;
    this.showAskAI = false;
    this.writingAssistResult = null;
    this.followUpList = [];
    this.render();
  }

  showParagraph(
    paragraphAnalysis: ParagraphAnalysisResult,
    contextSentence: string,
    nearbyParagraph: string,
    isAlreadySaved: boolean = false
  ): void {
    this.currentParagraphAnalysis = paragraphAnalysis;
    this.currentSentenceAnalysis = null;
    this.currentStageA = null;
    this.currentStageB = null;
    this.parentSentenceAnalysis = null;
    this.currentAnalysis = null;
    this.currentContextSentence = contextSentence || paragraphAnalysis.selectedText;
    this.currentNearbyParagraph = nearbyParagraph;
    this.isSaved = isAlreadySaved;
    this.isExpanded = false;
    this.isSentenceExpanded = false;
    this.isSentenceAnalysisExpanded = false;
    this.showFeedbackModal = false;
    this.feedbackSuccess = false;
    this.showAskAI = false;
    this.activeParaIndex = 0;
    this.activeParaSentenceIndex = 0;
    this.writingAssistResult = null;
    this.followUpList = [];
    this.render();
  }

  showAnalysis(
    analysis: LinguisticAnalysisResult,
    contextSentence: string,
    nearbyParagraph: string,
    isAlreadySaved: boolean = false
  ): void {
    if (analysis.selectionType === 'sentence') {
      this.showSentence(
        analysis as SentenceAnalysisResult,
        contextSentence,
        nearbyParagraph,
        isAlreadySaved
      );
      return;
    }

    if (analysis.selectionType === 'paragraph') {
      this.showParagraph(
        analysis as ParagraphAnalysisResult,
        contextSentence,
        nearbyParagraph,
        isAlreadySaved
      );
      return;
    }

    if (analysis.selectionType === 'word') {
      const w = analysis as WordAnalysisResult;
      this.showStageA(
        {
          selectedText: w.selectedText,
          lemma: w.selectedText.toLowerCase(),
          partOfSpeech: w.partOfSpeech || 'word',
          easyEnglish: w.simpleEnglishExplanation || w.contextualMeaning || 'Meaning in context',
          easyBengali: w.bengaliTranslation || 'বাংলা অর্থ',
          contextMeaning: w.whyFitsContext || w.contextualMeaning || 'Meaning in this sentence.',
          example: w.examples?.[0],
          confidence: 'high',
          contextualSenseId: 'sense_1',
          grammaticalRole: w.grammaticalRole,
          grammaticalNote: w.grammaticalNote,
          transitivityOrPattern: w.transitivityOrPattern,
          wordForms: w.wordForms
        },
        contextSentence,
        nearbyParagraph,
        isAlreadySaved
      );
      return;
    }

    if (analysis.selectionType === 'phrase') {
      const p = analysis as PhraseAnalysisResult;
      this.showStageA(
        {
          selectedText: p.selectedText,
          lemma: p.selectedText.toLowerCase(),
          partOfSpeech: p.phraseType || 'phrase',
          easyEnglish: p.simpleEnglishExplanation || p.overallMeaning || 'Phrase meaning',
          easyBengali: p.bengaliTranslation || 'বাংলা অর্থ',
          contextMeaning: p.whyFitsContext || p.overallMeaning || 'Meaning in this sentence.',
          example: p.examples?.[0],
          confidence: 'high',
          contextualSenseId: 'sense_1',
          grammaticalRole: p.grammaticalStructure,
          literalVsFigurative: p.literalVsFigurative,
          grammaticalNote: p.componentsBreakdown
        },
        contextSentence,
        nearbyParagraph,
        isAlreadySaved
      );
      return;
    }

    // Generic fallback
    this.currentStageA = null;
    this.currentSentenceAnalysis = null;
    this.currentParagraphAnalysis = null;
    this.currentAnalysis = analysis;
    this.currentContextSentence = contextSentence;
    this.currentNearbyParagraph = nearbyParagraph;
    this.isSaved = isAlreadySaved;
    this.isExpanded = false;
    this.showFeedbackModal = false;
    this.writingAssistResult = null;
    this.followUpList = [];
    this.render();
  }

  private render(options?: { preserveScroll?: boolean; scrollToAskAI?: boolean; scrollToExpanded?: boolean }): void {
    const contentEl = this.element.querySelector('.lf-content');
    const prevScrollTop = contentEl ? contentEl.scrollTop : 0;

    if (this.currentStageA) {
      this.renderStageAView(this.currentStageA);
    } else if (this.currentSentenceAnalysis) {
      this.renderSentenceView(this.currentSentenceAnalysis);
    } else if (this.currentParagraphAnalysis) {
      this.renderParagraphView(this.currentParagraphAnalysis);
    } else if (this.currentAnalysis) {
      this.renderLegacyView(this.currentAnalysis);
    }

    const newContentEl = this.element.querySelector('.lf-content') as HTMLElement | null;
    if (newContentEl) {
      if (options?.scrollToAskAI) {
        setTimeout(() => {
          const askPanel = this.element.querySelector('.lf-ask-ai-panel') as HTMLElement;
          if (askPanel && typeof askPanel.scrollIntoView === 'function') {
            askPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 40);
      } else if (options?.scrollToExpanded) {
        setTimeout(() => {
          const target = (this.element.querySelector('#lf-sentence-expanded-section') ||
            this.element.querySelector('#lf-para-expanded-section') ||
            this.element.querySelector('.lf-gb-container')) as HTMLElement | null;
          if (target && newContentEl) {
            if (typeof target.scrollIntoView === 'function') {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            const offset = target.offsetTop - (newContentEl.offsetTop || 0);
            if (offset > 0) {
              if (typeof newContentEl.scrollTo === 'function') {
                newContentEl.scrollTo({ top: offset - 8, behavior: 'smooth' });
              } else {
                newContentEl.scrollTop = offset - 8;
              }
            }
          }
        }, 50);
      } else if ((options?.preserveScroll || prevScrollTop > 0) && prevScrollTop > 0) {
        newContentEl.scrollTop = prevScrollTop;
      }
    }

    this.isolateInteractiveElements();
    this.setupDragHandler();
    this.setupResizeHandlers();
    this.callbacks.onResize?.();
  }

  private renderStageAView(a: StageAExplanation): void {
    const isVerifiedDict = a.contextualSenseId === 'sense_dict_1';
    const langConfig = getLanguageConfig(this.targetLanguage);

    // Clean, compact POS label (prevents long badges like "VERB PHRASE AND NOUN PHRASE" from crushing the title)
    const rawPos = (a.partOfSpeech || 'word').trim().toUpperCase();
    let displayPos = rawPos;
    if (rawPos.includes('PHRASE') || rawPos.length > 12) {
      if (rawPos.includes('VERB')) displayPos = 'VERB PHRASE';
      else if (rawPos.includes('NOUN')) displayPos = 'NOUN PHRASE';
      else if (rawPos.includes('ADJ')) displayPos = 'ADJ PHRASE';
      else displayPos = 'PHRASE';
    }

    const bCount = this.currentStageB?.senses?.length;
    const whyMatters = getValidatedWhyThisMatters(this.currentContextSentence || a.selectedText, a.whyItMatters);

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          ${this.parentSentenceAnalysis ? `
            <button class="lf-back-sentence-btn" id="lf-back-sentence-btn" title="Back to sentence analysis" aria-label="Back to sentence">
              ← Sentence
            </button>
          ` : ''}
          <span class="lf-heading-word" title="${escapeHtml(a.selectedText)}">${escapeHtml(a.selectedText)}</span>
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Pronounce word / উচ্চারণ শুনুন" aria-label="Listen pronunciation" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; margin: 0 2px;">${lfIcon('volume')}</button>
          <span class="lf-pos" title="${escapeHtml(rawPos)}">${escapeHtml(displayPos)}</span>
        </div>
        <div class="lf-actions-top">
          ${this.renderModeToggleHtml()}
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">${lfIcon('pin')}</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy text" aria-label="Copy text">${lfIcon('copy')}</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
        </div>
      </div>

      <!-- Native Segmented Control -->
      <div class="lf-tabs" role="tablist">
        <button type="button" class="lf-tab ${this.activeTab === 'meaning' ? 'active' : ''}" data-tab="meaning">
          Meaning
        </button>
        <button type="button" class="lf-tab ${this.activeTab === 'ask-ai' ? 'active' : ''}" data-tab="ask-ai">
          Ask AI
        </button>
        <button type="button" class="lf-tab ${this.activeTab === 'details' ? 'active' : ''}" data-tab="details">
          Deep Dive ${bCount ? `(${bCount})` : ''}
        </button>
      </div>

      <div class="lf-content" id="lf-main-content">
        ${this.activeTab === 'meaning' ? `
          <!-- 1. Easy English First -->
          <div class="lf-def-item" style="margin-bottom: 8px;">
            <div class="lf-section-sublabel" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">
              Easy English:
            </div>
            <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 16px); line-height: 1.45; font-weight: 500;">
              ${this.renderInteractiveSentence(a.easyEnglish, this.currentContextSentence || a.selectedText)}
            </div>
          </div>

          <!-- 2. Easy Target Language Second -->
          <div class="lf-bengali-box" style="margin-bottom: 10px; padding: 10px 12px; border-radius: 8px;">
            <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              <span class="lf-target-badge" style="padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${escapeHtml(langConfig.targetNativeLabel)}</span>
              <span class="lf-target-header">${escapeHtml(langConfig.targetNativeHeader)}:</span>
            </div>
            <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 600; line-height: 1.45;">
              ${escapeHtml(a.easyBengali)}
            </div>
          </div>

          <!-- 3. In this sentence -->
          <div class="lf-context-box" style="margin-bottom: 8px; padding: 8px 10px; border-radius: 8px;">
            <div class="lf-context-label" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">
              In this sentence:
            </div>
            <div class="lf-context-text" style="font-size: var(--lf-font-context, 15px); line-height: 1.45;">
              ${this.renderInteractiveSentence(a.contextMeaning, this.currentContextSentence || a.selectedText)}
            </div>
          </div>

          <!-- 3.5 Why This Matters (Discourse Connector Analysis) - Learn Mode Only -->
          ${(this.readingMode === 'learn' && whyMatters) ? `
            <div class="lf-why-matters-box" style="margin-bottom: 10px; padding: 10px 12px; background: rgba(147, 51, 234, 0.08); border-left: 3px solid #9333ea; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9333ea; display: flex; align-items: center; gap: 4px;">
                  Why This Matters (${escapeHtml(whyMatters.connector.categoryLabel)}):
                </span>
                <button type="button" class="lf-looks-wrong-btn" title="Report inaccurate connector or why it matters analysis" style="background: none; border: none; font-size: 10.5px; color: var(--text-muted, #6e6e73); cursor: pointer; text-decoration: underline;">
                  Looks wrong?
                </button>
              </div>
              <div style="font-size: 12.5px; color: var(--lf-text, #1d1d1f); line-height: 1.45;">
                <strong style="color: #9333ea;">"${this.renderInteractiveSentence(whyMatters.connector.text, this.currentContextSentence || a.selectedText)}"</strong>: ${this.renderInteractiveSentence(whyMatters.explanation, this.currentContextSentence || a.selectedText)}
              </div>
            </div>
          ` : ''}

          <!-- 3.6 Active Recall Challenge - Learn Mode Only -->
          ${(() => {
            const clozeOutcome = (this.readingMode === 'learn' && (this.currentContextSentence || a.example))
              ? generateCloze(a.selectedText, this.currentContextSentence || a.example || '', a.partOfSpeech)
              : null;
            const cloze = clozeOutcome?.success && clozeOutcome.cloze ? clozeOutcome.cloze : null;
            if (!cloze) return '';
            return `
              <div class="lf-active-recall-box" style="margin-bottom: 10px; padding: 10px 12px; background: rgba(147, 51, 234, 0.06); border: 1px dashed rgba(147, 51, 234, 0.35); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9333ea; display: flex; align-items: center; gap: 4px;">
                    Active Recall Challenge:
                  </span>
                  <span style="font-size: 10.5px; color: var(--text-muted, #6e6e73); font-weight: 600;">
                    Hint: ${escapeHtml(cloze.hint.firstLetter)}... (${cloze.hint.length} letters)
                  </span>
                </div>
                <div class="lf-cloze-text" style="font-size: 13px; line-height: 1.45; color: var(--lf-text, #1d1d1f); font-style: italic; margin-bottom: 6px;">
                  "${this.renderInteractiveSentence(cloze.clozeSentence, this.currentContextSentence || a.example || '')}"
                </div>
                <div style="display: flex; justify-content: flex-end;">
                  <button type="button" class="lf-reveal-cloze-btn" style="background: none; border: none; font-size: 11px; font-weight: 600; color: #9333ea; cursor: pointer; text-decoration: underline; padding: 0;">
                    Test memory: click to reveal answer
                  </button>
                </div>
                <div class="lf-cloze-answer" hidden style="display: none; margin-top: 6px; padding: 5px 8px; background: rgba(147, 51, 234, 0.12); border-radius: 5px; font-size: 12px; font-weight: 700; color: #9333ea;">
                  Word: <strong>${escapeHtml(cloze.targetWord)}</strong> ${a.easyBengali ? `(${escapeHtml(a.easyBengali)})` : ''}
                </div>
              </div>
            `;
          })()}

          <!-- 4. Natural Example -->
          <div class="lf-example-box" style="margin-bottom: 8px; padding-left: 8px; border-left: 2px solid rgba(0, 113, 227, 0.4); font-size: var(--lf-font-example, 14px); font-style: italic; display: ${a.example ? 'block' : 'none'};">
            <span class="lf-example-text">"${this.renderInteractiveSentence(a.example || '', a.example)}"</span>
            <div class="lf-example-bengali" style="font-style: normal; font-size: var(--lf-font-context, 13px); margin-top: 2px; display: ${a.exampleBengali ? 'block' : 'none'};">(${escapeHtml(a.exampleBengali || '')})</div>
          </div>

          <!-- 4.5. Grammar Breakdown (Streamlined in Quick Mode, In-depth in Learn Mode) -->
          <div class="lf-word-grammar-card" style="margin-bottom: 10px; padding: 10px 12px; background: rgba(0, 113, 227, 0.05); border: 1px solid rgba(0, 113, 227, 0.18); border-radius: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: #0071e3; letter-spacing: 0.04em;">
                Grammar Breakdown:
              </span>
              <span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(0, 113, 227, 0.12); color: #0071e3; font-weight: 600;">
                ${escapeHtml(a.partOfSpeech || 'Word')}
              </span>
            </div>
            ${a.grammaticalRole ? `
              <div style="font-size: 13px; color: var(--lf-text, #1d1d1f); margin-bottom: 4px; line-height: 1.4;">
                <strong style="color: #0071e3;">Role in Sentence:</strong> ${this.renderInteractiveSentence(a.grammaticalRole, this.currentContextSentence || a.selectedText)}
              </div>
            ` : `
              <div style="font-size: 12.5px; color: var(--lf-text, #1d1d1f); margin-bottom: 4px; line-height: 1.4;">
                <strong style="color: #0071e3;">Grammatical Role:</strong> Functions as a <strong>${this.renderInteractiveSentence(a.partOfSpeech || 'lexical item', this.currentContextSentence || a.selectedText)}</strong> in this context.
              </div>
            `}
            ${this.readingMode === 'learn' && a.transitivityOrPattern ? `
              <div style="font-size: 12.5px; color: var(--lf-text-muted, #6e6e73); margin-bottom: 4px; line-height: 1.4;">
                <strong>Pattern:</strong> <code style="background: rgba(0,0,0,0.04); padding: 1px 4px; border-radius: 3px;">${this.renderInteractiveSentence(a.transitivityOrPattern, this.currentContextSentence || a.selectedText)}</code>
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.literalVsFigurative ? `
              <div style="font-size: 12.5px; color: #d97706; margin-bottom: 4px; line-height: 1.4;">
                <strong>Literal vs Figurative:</strong> ${this.renderInteractiveSentence(a.literalVsFigurative, this.currentContextSentence || a.selectedText)}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.grammaticalNote ? `
              <div style="font-size: 12px; color: var(--lf-text-muted, #6e6e73); line-height: 1.4;">
                ${this.renderInteractiveSentence(a.grammaticalNote, this.currentContextSentence || a.selectedText)}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.wordForms && a.wordForms.length > 0 ? `
              <div style="font-size: 11.5px; color: var(--lf-text-muted, #6e6e73); margin-top: 5px;">
                <strong>Word Forms:</strong> ${a.wordForms.map(wf => `<span class="lf-sentence-word" data-word="${escapeHtml(wf.trim())}" title="Inspect &quot;${escapeHtml(wf.trim())}&quot;">${escapeHtml(wf.trim())}</span>`).join(' • ')}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && this.parentSentenceAnalysis ? `
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(0, 113, 227, 0.2); display: flex; justify-content: flex-end;">
                <button type="button" class="lf-sentence-link-btn" id="lf-view-parent-sentence-btn" style="background: none; border: none; color: #0071e3; font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 2px 4px; text-decoration: underline;">
                  View Full Sentence Grammar X-Ray →
                </button>
              </div>
            ` : ''}
          </div>

          <!-- 5. Quick AI Instant Actions -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>Ask AI Quick Actions:</span>
            </div>
            <div class="lf-quick-ai-chips">
              <button type="button" class="lf-quick-chip" data-prompt="Explain this word in super simple terms like I'm 5 years old">
                ${lfIcon('lightbulb')}<span>Like I'm 5</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="What is the subtle difference between this word and its common synonyms?">
                ${lfIcon('search')}<span>Nuance vs Synonyms</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="How do native English speakers naturally use this in everyday conversation?">
                ${lfIcon('message')}<span>Daily Native Usage</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="Explain this word in ${escapeHtml(langConfig.targetLabel)} with detailed context and nuances">
                <span style="font-size: 10px; font-weight: 700; color: #0071e3;">${escapeHtml(langConfig.targetNativeLabel)}</span><span>${escapeHtml(langConfig.targetNativeHeader)}</span>
              </button>
            </div>
          </div>

          <!-- 6. Quick Intelligence Preview (Synonyms & Collocations) -->
          ${this.renderStageBPreview(this.currentStageB)}

          <!-- 7. Honesty Bar: AI-generated + Confidence + Machine voice -->
          <div class="lf-honesty-bar" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 0, 0, 0.08);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="lf-ai-badge">${isVerifiedDict ? `${lfIcon('book')} Verified Lexicon` : `${lfIcon('sparkles')} AI-generated`}</span>
              <span class="lf-confidence-pill ${a.confidence}">Confidence: ${escapeHtml(a.confidence)}</span>
            </div>
            <button class="lf-machine-voice-btn" title="Machine-synthesized text-to-speech" aria-label="Listen with machine speech synthesis">
              Machine voice ${lfIcon('volume')}
            </button>
          </div>

          ${a.confidence === 'low' ? `
            <div style="font-size: 11px; color: #dc2626; margin-top: 4px; padding: 4px 8px; background: rgba(239, 68, 68, 0.08); border-radius: 4px;">
              ⚠️ ${escapeHtml(a.uncertaintyReason || 'Context is limited. This is one possible meaning.')}
            </div>
          ` : ''}

          <!-- Legacy Inline Ask AI Panel (when toggled via footer button) -->
          ${this.showAskAI ? this.renderAskAIPanel('word', a.selectedText) : ''}

          <!-- Compatibility Container for Stage B -->
          <div id="lf-expanded-section" role="region" aria-label="Detailed Vocabulary" style="display: ${this.isExpanded ? 'block' : 'none'};">
            ${this.renderStageBContent()}
          </div>
        ` : ''}

        ${this.activeTab === 'ask-ai' ? `
          ${this.renderAskAIPanel('word', a.selectedText)}
          <div id="lf-expanded-section" style="display: none;"></div>
        ` : ''}

        ${this.activeTab === 'details' ? `
          <div id="lf-expanded-section" role="region" aria-label="Detailed Vocabulary" style="display: block;">
            ${this.renderStageBContent()}
          </div>
        ` : ''}

        <!-- Inline Report Form across all tabs -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(a.selectedText, this.currentContextSentence) : ''}
      </div>

      <div class="lf-footer">
        <div class="lf-footer-left">
          <button
            class="lf-btn-action secondary lf-expand-btn"
            id="lf-expand-toggle"
            aria-expanded="${this.activeTab === 'details' || this.isExpanded}"
            aria-controls="lf-expanded-section"
            title="Toggle full dictionary definitions and examples"
          >
            ${(this.activeTab === 'details' || this.isExpanded) ? 'Overview' : `${lfIcon('book')} Meanings`}
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI follow-up" aria-label="Ask AI">
            ${lfIcon('message')} Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            ${lfIcon('flag')} Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}" title="${this.readingMode === 'learn' ? 'Save with context sentence and Active Recall for spaced review' : 'Quick save vocabulary'}">
            ${this.isSaved ? (this.readingMode === 'learn' ? '✓ Saved<span class="lf-label-extra"> with Context</span>' : '✓ Saved') : (this.readingMode === 'learn' ? 'Save<span class="lf-label-extra"> with Context</span>' : '+ Save')}
          </button>
        </div>
      </div>
    `;

    this.bindEventsStageA();
  }

  private renderSentenceView(s: SentenceAnalysisResult): void {
    const isLongSentence = s.selectedText.length > 160;
    const langConfig = getLanguageConfig(this.targetLanguage);
    const phrases = this.ensurePhraseBreakdown(
      s.selectedText,
      s.phraseBreakdown,
      s.clauses,
      s.bengaliTranslation
    );
    const sentenceWhyMatters = getValidatedWhyThisMatters(
      s.selectedText,
      s.clauses?.find((c) => Boolean(c.whyItMatters))?.whyItMatters || (s as any).whyItMatters
    );

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          <span class="lf-heading-sentence">Sentence Analysis</span>
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Listen to sentence / বাক্যটি শুনুন" aria-label="Listen to sentence" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; margin: 0 2px;">${lfIcon('volume')}</button>
          <span class="lf-pos">SENTENCE</span>
        </div>
        <div class="lf-actions-top">
          ${this.renderModeToggleHtml()}
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">${lfIcon('pin')}</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy sentence text" aria-label="Copy sentence text">${lfIcon('copy')}</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
        </div>
      </div>

      <!-- Native Segmented Control -->
      <div class="lf-tabs" role="tablist">
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'breakdown' ? 'active' : ''}" data-tab="breakdown">
          Sentence
        </button>
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'grammar' ? 'active' : ''}" data-tab="grammar">
          Grammar
        </button>
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'clauses' ? 'active' : ''}" data-tab="clauses">
          Clauses
        </button>
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'ask-ai' ? 'active' : ''}" data-tab="ask-ai">
          Ask AI
        </button>
      </div>

      <div class="lf-content" id="lf-main-content">
        ${this.activeSentenceTab === 'breakdown' ? `
          <!-- A. Original Text -->
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>Original Text:</span>
              ${isLongSentence ? `
                <button class="lf-text-toggle-btn" id="lf-sentence-text-toggle">
                  ${this.isSentenceExpanded ? 'Show less' : 'Show full'}
                </button>
              ` : ''}
            </div>
            <div class="lf-sentence-text ${!this.isSentenceExpanded && isLongSentence ? 'truncated' : ''}">
              ${this.renderSentenceWithConnectors(s.selectedText, findDiscourseConnectors(s.selectedText))}
            </div>
            <div class="lf-sentence-hint">
              Click any word in the text to inspect its contextual meaning
            </div>
          </div>

          <!-- B. Phrase-by-Phrase Explanation -->
          ${this.renderPhraseBreakdownHtml(phrases, s.selectedText)}

          <!-- Why This Matters for Sentence - Learn Mode Only -->
          ${(this.readingMode === 'learn' && sentenceWhyMatters) ? `
            <div class="lf-why-matters-box" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(147, 51, 234, 0.08); border-left: 3px solid #9333ea; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9333ea; display: flex; align-items: center; gap: 4px;">
                  Why This Matters (${escapeHtml(sentenceWhyMatters.connector.categoryLabel)}):
                </span>
                <button type="button" class="lf-looks-wrong-btn" title="Report inaccurate connector or why it matters analysis" style="background: none; border: none; font-size: 10.5px; color: var(--text-muted, #6e6e73); cursor: pointer; text-decoration: underline;">
                  Looks wrong?
                </button>
              </div>
              <div style="font-size: 12.5px; color: var(--lf-text, #1d1d1f); line-height: 1.45;">
                <strong style="color: #9333ea;">"${this.renderInteractiveSentence(sentenceWhyMatters.connector.text, s.selectedText)}"</strong>: ${this.renderInteractiveSentence(sentenceWhyMatters.explanation, s.selectedText)}
              </div>
            </div>
          ` : ''}

          <!-- C. Full Target Language -->
          <div class="lf-bengali-box" style="margin-bottom: 12px; padding: 10px 12px; border-radius: 8px;">
            <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 6px;">
              <span class="lf-target-badge" style="padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${escapeHtml(langConfig.targetNativeLabel)}</span>
              <span class="lf-target-header">${escapeHtml(langConfig.targetLang === 'bn' ? 'সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${langConfig.targetNativeHeader} (${langConfig.targetLabel}):`)}</span>
            </div>
            <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 700; line-height: 1.45;">
              ${escapeHtml(s.bengaliTranslation || `${langConfig.targetNativeHeader}...`)}
            </div>
          </div>

          <!-- Optional English Paraphrase / Overall Meaning -->
          ${(s.plainEnglishParaphrase || s.overallMeaning) ? `
            <div class="lf-def-item" style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px;">
              <div class="lf-section-sublabel" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
                English Summary &amp; Core Proposition:
              </div>
              <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 15px); line-height: 1.45; font-weight: 500;">
                ${this.renderInteractiveSentence(s.plainEnglishParaphrase || s.overallMeaning || '', s.selectedText)}
              </div>
            </div>
          ` : ''}

          <!-- Difficult Words & Vocabulary (Moved out of Grammar & Clauses into Sentence Analysis) -->
          ${this.renderDifficultVocabulary(s.difficultVocabulary || [], s.selectedText)}

          <!-- Summary Highlights (Moved out of Grammar & Clauses into Sentence Analysis) -->
          ${this.renderSummaryHighlights(s.grammaticalHighlights || [], s.selectedText)}

          <!-- Quick AI Prompt Chips for Sentence -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>Ask AI Quick Actions:</span>
            </div>
            <div class="lf-quick-ai-chips">
              <button type="button" class="lf-quick-chip" data-prompt="Break down the core message in super easy everyday English">
                ${lfIcon('lightbulb')}<span>Explain simply</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="Explain the grammatical structure and rhetorical tone used here">
                ${lfIcon('puzzle')}<span>Grammar & Tone</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="How would a native speaker rephrase this in casual speech or friendly email?">
                ${lfIcon('message')}<span>Conversational</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="Explain the deeper meaning of this statement in ${escapeHtml(langConfig.targetLabel)}">
                <span style="font-size: 10px; font-weight: 700; color: #0071e3;">${escapeHtml(langConfig.targetNativeLabel)}</span><span>${escapeHtml(langConfig.targetNativeHeader)}</span>
              </button>
            </div>
          </div>

          <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 0, 0, 0.08);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="lf-ai-badge">${lfIcon('sparkles')} AI-generated</span>
              ${s.toneAndRegister ? `
                <span class="lf-confidence-pill high" style="background: rgba(0, 113, 227, 0.12); color: #0071e3;">${escapeHtml(s.toneAndRegister)}</span>
              ` : ''}
            </div>
            <button class="lf-machine-voice-btn" title="Read sentence aloud with speech synthesis" aria-label="Listen to sentence">
              Machine voice ${lfIcon('volume')}
            </button>
          </div>

          <!-- Inline Ask AI Follow-Up Panel (legacy toggle) -->
          ${this.showAskAI ? this.renderAskAIPanel('sentence', s.selectedText) : ''}

          <!-- Compatibility Container for Detailed Sentence Breakdown -->
          <div id="lf-sentence-expanded-section" role="region" aria-label="Detailed Sentence Breakdown" style="display: ${this.isSentenceAnalysisExpanded ? 'block' : 'none'};">
            ${this.renderSentenceGrammarTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'grammar' ? `
          <div id="lf-sentence-expanded-section" role="region" aria-label="Grammar Analysis" style="display: block;">
            ${this.renderSentenceGrammarTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'clauses' ? `
          <div id="lf-sentence-expanded-section" role="region" aria-label="Clauses Breakdown" style="display: block;">
            ${this.renderSentenceClausesTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'ask-ai' ? `
          ${this.renderAskAIPanel('sentence', s.selectedText)}
          <div id="lf-sentence-expanded-section" style="display: none;"></div>
        ` : ''}

        <!-- Inline Report Form across all sentence tabs -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(s.selectedText, s.selectedText) : ''}
      </div>

      <div class="lf-footer">
        <div class="lf-footer-left">
          <button
            class="lf-btn-action secondary lf-sentence-expand-btn"
            id="lf-sentence-expand-toggle"
            aria-expanded="${this.isSentenceAnalysisExpanded}"
            aria-controls="lf-sentence-expanded-section"
            title="Expand Grammar and Clause analysis"
          >
            ${lfIcon('puzzle')} Grammar<span class="lf-label-extra"> &amp; Clauses</span>
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI about this sentence" aria-label="Ask AI">
            ${lfIcon('message')} Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            ${lfIcon('flag')} Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">
            ${this.isSaved ? (this.readingMode === 'learn' ? '✓ Saved<span class="lf-label-extra"> with Context</span>' : '✓ Saved') : (this.readingMode === 'learn' ? 'Save<span class="lf-label-extra"> with Context</span>' : '+ Save')}
          </button>
        </div>
      </div>
    `;

    this.bindEventsSentence(s);
  }

  private renderParagraphView(p: ParagraphAnalysisResult): void {
    const langConfig = getLanguageConfig(this.targetLanguage);
    const isBn = langConfig.targetLang === 'bn';
    const toBnNum = (n: number | string) => {
      const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
      return isBn ? String(n).replace(/\d/g, (d) => bnDigits[Number(d)] || d) : String(n);
    };

    const hierarchical = this.ensureHierarchicalParagraph(p);
    const hasMultipleParagraphs = hierarchical.paragraphs.length > 1;

    if (this.activeParaIndex >= hierarchical.paragraphs.length) {
      this.activeParaIndex = 0;
    }
    const currentPara = hierarchical.paragraphs[this.activeParaIndex] || hierarchical.paragraphs[0];
    if (this.activeParaSentenceIndex >= currentPara.sentences.length) {
      this.activeParaSentenceIndex = 0;
    }

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          <span class="lf-heading-sentence">Paragraph Intelligence</span>
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Listen to paragraph / প্যারাগ্রাফটি শুনুন" aria-label="Listen to paragraph" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; margin: 0 2px;">${lfIcon('volume')}</button>
          <span class="lf-pos">PARAGRAPH</span>
        </div>
        <div class="lf-actions-top">
          ${this.renderModeToggleHtml()}
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">${lfIcon('pin')}</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy paragraph text" aria-label="Copy paragraph text">${lfIcon('copy')}</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
        </div>
      </div>

      <!-- Multiple Paragraph Selector Tabs (if > 1 paragraph) -->
      ${hasMultipleParagraphs ? `
        <div class="lf-para-tabs-compact lf-para-tabs" role="tablist">
          ${hierarchical.paragraphs.map((para, pIdx) => `
            <button type="button" class="lf-tab ${this.activeParaIndex === pIdx ? 'active' : ''}" data-para-idx="${pIdx}">
              ${isBn ? `প্যারাগ্রাফ ${toBnNum(para.paragraphIndex)}` : `Paragraph ${para.paragraphIndex}`}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <!-- Sentence Stepper Slider: [<] বাক্য ১ / ৪ [>] with interactive mini dots slider -->
      <div class="lf-sentence-stepper-container">
        <div class="lf-sentence-stepper">
          <button
            type="button"
            class="lf-stepper-nav-btn lf-stepper-prev"
            data-action="prev-sentence"
            ${this.activeParaSentenceIndex === 0 ? 'disabled' : ''}
            title="${isBn ? 'পূর্ববর্তী বাক্য' : 'Previous sentence'}"
            aria-label="Previous sentence"
          >
            ${lfIcon('chevronLeft')}
          </button>

          <div class="lf-stepper-center">
            <div class="lf-stepper-counter">
              <span class="lf-stepper-label">${isBn ? 'বাক্য' : 'Sentence'}</span>
              <span class="lf-stepper-num">${toBnNum(this.activeParaSentenceIndex + 1)}</span>
              <span class="lf-stepper-sep">/</span>
              <span class="lf-stepper-total">${toBnNum(currentPara.sentences.length)}</span>
            </div>
            <div class="lf-slider-dots-track lf-sentence-switcher" role="tablist" aria-label="Sentence switcher dots">
              ${currentPara.sentences.map((sent, sIdx) => `
                <button
                  type="button"
                  class="lf-tab lf-slider-dot ${this.activeParaSentenceIndex === sIdx ? 'active' : ''}"
                  data-sent-idx="${sIdx}"
                  title="${isBn ? `বাক্য ${toBnNum(sent.sentenceIndex)}` : `Sentence ${sent.sentenceIndex}`}"
                  aria-label="${isBn ? `বাক্য ${toBnNum(sent.sentenceIndex)}` : `Sentence ${sent.sentenceIndex}`}"
                ></button>
              `).join('')}
            </div>
          </div>

          <button
            type="button"
            class="lf-stepper-nav-btn lf-stepper-next"
            data-action="next-sentence"
            ${this.activeParaSentenceIndex >= currentPara.sentences.length - 1 ? 'disabled' : ''}
            title="${isBn ? 'পরবর্তী বাক্য' : 'Next sentence'}"
            aria-label="Next sentence"
          >
            ${lfIcon('chevronRight')}
          </button>
        </div>
      </div>

      <div class="lf-content" id="lf-main-content">
        <!-- Render Sentence Panels (Using exact same structure as normal Sentence Mode!) -->
        ${hierarchical.paragraphs.map((para, pIdx) => `
          <div class="lf-para-panel" data-para-panel-idx="${pIdx}" style="display: ${this.activeParaIndex === pIdx ? 'block' : 'none'};">
            ${para.sentences.map((sent, sIdx) => {
              const isSentenceVisible = (this.activeParaIndex === pIdx && this.activeParaSentenceIndex === sIdx);
              return `
                <div class="lf-sentence-panel" data-panel-idx="${sIdx}" style="display: ${isSentenceVisible ? 'block' : 'none'};">
                  <!-- A. Original Sentence Text (Exact Sentence Mode Pattern!) -->
                  <div class="lf-sentence-card">
                    <div class="lf-section-label">
                      <span>${isBn ? `বাক্য ${toBnNum(sent.sentenceIndex)} (মূল বাক্য):` : `Sentence ${sent.sentenceIndex}:`}</span>
                      <button type="button" class="lf-btn-icon lf-voice-mini-btn" data-speak="${escapeHtml(sent.sentenceText)}" title="Listen to this sentence" aria-label="Listen to sentence" style="width: 22px; height: 22px; min-width: 22px; min-height: 22px; margin: 0 4px;">
                        ${lfIcon('volume')}
                      </button>
                    </div>
                    <div class="lf-sentence-text">
                      ${this.renderInteractiveSentence(sent.sentenceText)}
                    </div>
                    <div class="lf-sentence-hint">
                      Click any word in the text to inspect its contextual meaning
                    </div>
                  </div>

                  <!-- B. Phrase-by-Phrase Explanation (Exact Sentence Mode Pattern!) -->
                  <div class="lf-phrase-breakdown-section">
                    <div class="lf-section-label" style="color: #0a84ff; margin-bottom: 6px;">
                      <span>Phrase-by-Phrase Explanation (${sent.phraseBreakdown.length}):</span>
                    </div>
                    <div class="lf-phrases-list">
                      ${sent.phraseBreakdown.map((item, phIdx) => `
                        <div class="lf-phrase-item">
                          <div class="lf-phrase-orig">
                            <span class="lf-phrase-num">#${phIdx + 1}</span>
                            <strong>"${this.renderInteractiveSentence(item.phrase, sent.sentenceText)}"</strong>
                          </div>
                          <div class="lf-phrase-field lf-phrase-english">
                            <span class="lf-field-label">Easy English:</span>
                            <span>${this.renderInteractiveSentence(item.easyEnglish, sent.sentenceText || item.phrase)}</span>
                          </div>
                          ${(this.targetLanguage !== 'en' || (item.easyBengali && item.easyBengali !== item.easyEnglish && !/[\u0980-\u09FF]/.test(item.easyBengali))) ? `
                            <div class="lf-phrase-field lf-phrase-bengali">
                              <span class="lf-field-label">${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)}:</span>
                              <span>${escapeHtml(item.easyBengali)}</span>
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- C. Full Bengali for Sentence (Exact Sentence Mode Pattern!) -->
                  <div class="lf-bengali-box" style="margin-bottom: 12px; padding: 10px 12px; border-radius: 8px;">
                    <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; margin-bottom: 3px;">
                      ${langConfig.targetLang === 'bn' ? '🇧🇩 সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)} (${escapeHtml(langConfig.targetLabel)}):`}
                    </div>
                    <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 700; line-height: 1.45;">
                      ${escapeHtml(sent.bengaliTranslation || p.bengaliTranslation || `${langConfig.targetNativeHeader}...`)}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}

        <!-- Toggle for Complete Full Paragraph Text & Translation -->
        <div style="margin-top: 10px; margin-bottom: 8px;">
          <button type="button" class="lf-text-toggle-btn" id="lf-para-text-toggle" style="background: none; border: none; font-size: 11.5px; font-weight: 600; color: #0071e3; cursor: pointer; padding: 2px 0;">
            ${this.isSentenceExpanded ? '▲ Hide Full Paragraph Overview' : '▼ Show Full Paragraph Overview'}
          </button>
        </div>

        ${this.isSentenceExpanded ? `
          <div style="padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06); margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Full Paragraph:</div>
            <div style="font-size: 13.5px; color: var(--text-main, #1d1d1f); line-height: 1.45; margin-bottom: 8px;">
              ${this.renderInteractiveSentence(p.selectedText)}
            </div>
            ${p.bengaliTranslation ? `
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-bottom: 4px;">Full Translation:</div>
              <div style="font-size: 14px; color: #0f172a; line-height: 1.45; font-weight: 500;">
                ${escapeHtml(p.bengaliTranslation)}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Optional Main Idea & Summary -->
        ${(p.mainIdea || p.conciseSummary) ? `
          <div class="lf-def-item" style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px;">
            <div class="lf-section-sublabel" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
              Main Idea:
            </div>
            <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 15px); line-height: 1.45; font-weight: 500;">
              ${escapeHtml(p.mainIdea || p.conciseSummary)}
            </div>
          </div>
        ` : ''}

        <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 0, 0, 0.08);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="lf-ai-badge">${lfIcon('sparkles')} AI-generated</span>
            ${p.toneAndRegister ? `
              <span class="lf-confidence-pill high" style="background: rgba(10, 132, 255, 0.14); color: #0a84ff;">${escapeHtml(p.toneAndRegister)}</span>
            ` : ''}
          </div>
          <button class="lf-machine-voice-btn" title="Read paragraph aloud with speech synthesis" aria-label="Listen to paragraph">
            Machine voice ${lfIcon('volume')}
          </button>
        </div>

        <!-- Inline Ask AI Follow-Up Panel -->
        ${this.showAskAI ? this.renderAskAIPanel('paragraph', p.selectedText) : ''}

        <!-- Inline Report Form -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(p.selectedText, p.selectedText) : ''}

        <!-- Expandable Paragraph Details -->
        <div id="lf-para-expanded-section" role="region" aria-label="Paragraph Details" style="display: ${this.isSentenceAnalysisExpanded ? 'block' : 'none'};">
          ${this.renderParagraphAnalysisDetails(p)}
        </div>
      </div>

      <div class="lf-footer">
        <div class="lf-footer-left">
          <button
            class="lf-btn-action secondary lf-sentence-expand-btn"
            id="lf-para-expand-toggle"
            aria-expanded="${this.isSentenceAnalysisExpanded}"
            aria-controls="lf-para-expanded-section"
            title="Toggle key vocabulary and paragraph flow insights"
          >
            ${this.isSentenceAnalysisExpanded ? 'Summary' : `${lfIcon('book')} Key Terms`}
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI about this paragraph" aria-label="Ask AI">
            ${lfIcon('message')} Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            ${lfIcon('flag')} Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">
            ${this.isSaved ? '✓ Saved' : '+ Save'}
          </button>
        </div>
      </div>
    `;

    this.bindEventsParagraph(p);
  }

  private ensureHierarchicalParagraph(p: ParagraphAnalysisResult): {
    paragraphs: ParagraphBlockItem[];
    sentences: ParagraphSentenceItem[];
  } {
    if (p.paragraphs && p.paragraphs.length > 0) {
      const sentences = p.paragraphs.flatMap((pb) => pb.sentences);
      return { paragraphs: p.paragraphs, sentences };
    }

    if (p.sentences && p.sentences.length > 0) {
      const paragraphs: ParagraphBlockItem[] = [
        {
          paragraphIndex: 1,
          paragraphText: p.selectedText,
          mainIdea: p.mainIdea,
          bengaliTranslation: p.bengaliTranslation,
          sentences: p.sentences
        }
      ];
      return { paragraphs, sentences: p.sentences };
    }

    // Dynamic Hierarchical Segmentation Fallback:
    const paraTexts = splitIntoParagraphs(p.selectedText);
    const existingPhrases = Array.isArray(p.phraseBreakdown) ? [...p.phraseBreakdown] : [];
    const paragraphs: ParagraphBlockItem[] = [];
    const allSentences: ParagraphSentenceItem[] = [];
    let sentenceCounter = 1;

    // Sentence translation splitter for Bengali full stops (dari / question / exclamation)
    const bengaliSentences = (p.bengaliTranslation || '')
      .split(/(?<=[।!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let phraseCursor = 0;

    paraTexts.forEach((paraText, pIdx) => {
      const sentTexts = splitIntoSentences(paraText);
      const paraSentences: ParagraphSentenceItem[] = [];

      sentTexts.forEach((sentText) => {
        const normSent = sentText.toLowerCase().replace(/[^\w\s]/g, '');

        // Match existing phrases that overlap with this sentence
        const matchedPhrases: PhraseExplanation[] = [];
        for (let i = 0; i < existingPhrases.length; i++) {
          const ph = existingPhrases[i];
          const normPhrase = (ph.phrase || '').toLowerCase().replace(/[^\w\s]/g, '');
          if (normPhrase && (normSent.includes(normPhrase) || normPhrase.includes(normSent))) {
            matchedPhrases.push(ph);
          }
        }

        let finalPhrases = matchedPhrases;
        if (finalPhrases.length === 0) {
          if (sentTexts.length === 1 && existingPhrases.length > 0) {
            finalPhrases = existingPhrases;
          } else if (phraseCursor < existingPhrases.length) {
            const phrasesPerSentence = Math.max(1, Math.ceil(existingPhrases.length / sentTexts.length));
            finalPhrases = existingPhrases.slice(phraseCursor, phraseCursor + phrasesPerSentence);
            phraseCursor += phrasesPerSentence;
          } else {
            finalPhrases = this.ensurePhraseBreakdown(sentText, undefined, undefined, p.bengaliTranslation);
          }
        }

        // Approximate or assign Bengali sentence translation
        let sentBengali = bengaliSentences[allSentences.length] || p.bengaliTranslation;
        if (!sentBengali && finalPhrases.length > 0) {
          sentBengali = finalPhrases.map((ph) => ph.easyBengali).filter(Boolean).join(' ');
        }

        const sentenceItem: ParagraphSentenceItem = {
          sentenceIndex: sentenceCounter++,
          sentenceText: sentText,
          bengaliTranslation: sentBengali || p.bengaliTranslation,
          phraseBreakdown: finalPhrases
        };

        paraSentences.push(sentenceItem);
        allSentences.push(sentenceItem);
      });

      paragraphs.push({
        paragraphIndex: pIdx + 1,
        paragraphText: paraText,
        mainIdea: p.mainIdea,
        bengaliTranslation: pIdx === 0 ? p.bengaliTranslation : undefined,
        sentences: paraSentences
      });
    });

    return { paragraphs, sentences: allSentences };
  }



  private renderPhraseBreakdownHtml(phrases: PhraseExplanation[], contextSentence?: string): string {
    const langConfig = getLanguageConfig(this.targetLanguage);
    return `
      <!-- B. Phrase-by-Phrase Explanation -->
      <div class="lf-phrase-breakdown-section">
        <div class="lf-section-label" style="color: #0a84ff; margin-bottom: 6px;">
          <span>Phrase-by-Phrase Explanation (${phrases.length}):</span>
        </div>
        <div class="lf-phrases-list">
          ${phrases.map((item, idx) => `
            <div class="lf-phrase-item">
              <div class="lf-phrase-orig">
                <span class="lf-phrase-num">#${idx + 1}</span>
                <strong>"${this.renderInteractiveSentence(item.phrase, contextSentence)}"</strong>
              </div>
              <div class="lf-phrase-field lf-phrase-english">
                <span class="lf-field-label">Easy English:</span>
                <span>${this.renderInteractiveSentence(item.easyEnglish, contextSentence || item.phrase)}</span>
              </div>
              ${(this.targetLanguage !== 'en' || (item.easyBengali && item.easyBengali !== item.easyEnglish && !/[\u0980-\u09FF]/.test(item.easyBengali))) ? `
                <div class="lf-phrase-field lf-phrase-bengali">
                  <span class="lf-field-label">${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)}:</span>
                  <span>${escapeHtml(item.easyBengali)}</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private ensurePhraseBreakdown(
    text: string,
    existingBreakdown?: PhraseExplanation[],
    clauses?: Array<{ text: string; role?: string; explanationBengali?: string }>,
    defaultBengali?: string
  ): PhraseExplanation[] {
    if (existingBreakdown && existingBreakdown.length > 0) {
      return existingBreakdown;
    }

    const isEn = this.targetLanguage === 'en';

    if (clauses && clauses.length > 0) {
      return clauses.map((c) => ({
        phrase: c.text,
        easyEnglish: c.role ? `Acts as the ${c.role.toLowerCase()} of the statement.` : 'Key clause conveying a central thought.',
        easyBengali: c.explanationBengali || defaultBengali || (isEn ? 'Main clause expressing a complete idea.' : 'বাক্যের প্রধান অর্থবহ খণ্ডবাক্য।')
      }));
    }

    // Heuristic phrase splitting on punctuation and clause markers
    const rawParts = text.trim().split(/(?:,\s*|;\s*|:\s*|\.\s+|\n+|—|–)/).map((p) => p.trim()).filter(Boolean);
    const phrases: PhraseExplanation[] = [];

    for (const part of rawParts) {
      const words = part.split(/\s+/).filter(Boolean);
      if (words.length > 10) {
        const mid = Math.ceil(words.length / 2);
        const chunk1 = words.slice(0, mid).join(' ');
        const chunk2 = words.slice(mid).join(' ');
        if (chunk1) {
          phrases.push({
            phrase: chunk1,
            easyEnglish: `Part stating: "${chunk1}".`,
            easyBengali: isEn ? `Contextual meaning for "${chunk1}".` : 'প্রাসঙ্গিক অর্থবহ ভাব ও বক্তব্য।'
          });
        }
        if (chunk2) {
          phrases.push({
            phrase: chunk2,
            easyEnglish: `Part stating: "${chunk2}".`,
            easyBengali: isEn ? `Contextual meaning for "${chunk2}".` : 'প্রাসঙ্গিক ভাবার্থ ও মূল বক্তব্য।'
          });
        }
      } else {
        phrases.push({
          phrase: part,
          easyEnglish: `Phrase conveying: "${part}".`,
          easyBengali: isEn ? `Contextual meaning for "${part}".` : 'প্রাসঙ্গিক ভাবার্থ ও মূল অর্থ।'
        });
      }
    }

    if (phrases.length === 0) {
      phrases.push({
        phrase: text.trim(),
        easyEnglish: 'This statement conveys a complete idea clearly.',
        easyBengali: defaultBengali || (isEn ? 'Complete thought and core meaning.' : 'সম্পূর্ণ বক্তব্য বা ভাবার্থ।')
      });
    }

    return phrases;
  }

  private renderInteractiveSentence(sentence: string, contextSentence?: string): string {
    if (!sentence) return '';
    const tokens = sentence.split(/(\s+|[.,;:"'!?()[\]{}«»“”‘’—–…]+)/g);
    return tokens.map((token) => {
      if (/^\s+$/.test(token) || /^[.,;:"'!?()[\]{}«»“”‘’—–…]+$/.test(token)) {
        return escapeHtml(token);
      }
      const cleanWord = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!cleanWord || !/\p{L}/u.test(cleanWord)) return escapeHtml(token);
      const ctxAttr = contextSentence ? ` data-context="${escapeHtml(contextSentence)}"` : '';
      return `<span class="lf-sentence-word" data-word="${escapeHtml(cleanWord)}"${ctxAttr} title="Inspect &quot;${escapeHtml(cleanWord)}&quot;">${escapeHtml(token)}</span>`;
    }).join('');
  }

  private renderSentenceWithConnectors(sentence: string, connectors: MatchedConnector[] = []): string {
    if (!connectors || connectors.length === 0) {
      return this.renderInteractiveSentence(sentence, sentence);
    }

    const tokens = sentence.split(/(\s+|[.,;:"'!?()[\]{}«»“”‘’—–…]+)/g);
    let currentOffset = 0;

    return tokens.map((token) => {
      const tokenStart = currentOffset;
      const tokenEnd = currentOffset + token.length;
      currentOffset = tokenEnd;

      if (/^\s+$/.test(token) || /^[.,;:"'!?()[\]{}«»“”‘’—–…]+$/.test(token)) {
        return escapeHtml(token);
      }
      const cleanWord = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!cleanWord || !/\p{L}/u.test(cleanWord)) return escapeHtml(token);

      const matched = connectors.find(
        (c) => tokenStart >= c.startIndex && tokenEnd <= c.endIndex
      );

      const ctxAttr = ` data-context="${escapeHtml(sentence)}"`;

      if (matched) {
        return `<span class="lf-sentence-word lf-connector-word" data-word="${escapeHtml(cleanWord)}"${ctxAttr} style="background: rgba(147, 51, 234, 0.15); color: #9333ea; font-weight: 700; border-radius: 3px; padding: 1px 3px;" title="Discourse Connector: ${escapeHtml(matched.categoryLabel)}">${escapeHtml(token)}</span>`;
      }

      return `<span class="lf-sentence-word" data-word="${escapeHtml(cleanWord)}"${ctxAttr} title="Inspect &quot;${escapeHtml(cleanWord)}&quot;">${escapeHtml(token)}</span>`;
    }).join('');
  }

  private renderDifficultVocabulary(vocab: Array<{ word: string; meaningInContext: string; bengali: string; grammaticalRole?: string }>, contextSentence?: string): string {
    if (!vocab || vocab.length === 0) return '';
    return `
      <div style="margin-bottom: 12px;">
        <div class="lf-section-label" style="color: #0071e3; margin-bottom: 6px;">
          <span>🔍 Difficult Words &amp; Key Terms (${vocab.length}):</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${vocab.map((item) => `
            <div class="lf-vocab-item" style="padding: 8px 10px; border-radius: 6px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                <button class="lf-vocab-chip-btn" data-word="${escapeHtml(item.word)}" title="Analyze &quot;${escapeHtml(item.word)}&quot; in context">
                  ${escapeHtml(item.word)} ↗
                </button>
                <div style="display: flex; align-items: center; gap: 6px;">
                  ${item.grammaticalRole ? `
                    <span style="font-size: 10px; color: #86868b; background: rgba(0,0,0,0.04); padding: 1px 5px; border-radius: 3px;">
                      ${escapeHtml(item.grammaticalRole)}
                    </span>
                  ` : ''}
                  ${(item.bengali && (this.targetLanguage !== 'en' || !/[\u0980-\u09FF]/.test(item.bengali))) ? `
                    <span class="lf-vocab-bengali" style="font-size: 11.5px; font-weight: 600; color: #0071e3;">${escapeHtml(item.bengali)}</span>
                  ` : ''}
                </div>
              </div>
              <div class="lf-vocab-meaning" style="font-size: 12px; line-height: 1.4; color: var(--text-main, #1d1d1f);">
                ${this.renderInteractiveSentence(item.meaningInContext || 'Contextual meaning in this sentence.', contextSentence)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderSummaryHighlights(highlights: string[], contextSentence?: string): string {
    if (!highlights || highlights.length === 0) return '';
    return `
      <div style="margin-bottom: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06);">
        <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--text-main, #1d1d1f); margin-bottom: 6px;">
          📌 Summary Highlights:
        </div>
        <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-main, #1d1d1f);">
          ${highlights.map(h => `<li>${this.renderInteractiveSentence(h, contextSentence)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  public renderSentenceGrammarTab(s: SentenceAnalysisResult): string {
    const structure = s.sentenceStructure;
    const clauses = Array.isArray(s.clauses) ? s.clauses : [];
    const mainClause = clauses.find(c => c.type === 'main') || clauses[0] || { text: s.selectedText || '', type: 'main', role: 'Main Clause' };
    const overview = getSentenceOverviewTeaching(structure?.type || 'complex', this.targetLanguage);
    const sections = buildBeginnerBreakdownSections(mainClause, s.selectedText, this.targetLanguage);
    const patternFormula = s.patternSummary?.formula || (sections.length > 0 ? sections.map(sec => sec.badgeLetter).join(' + ') : 'S + V + DO');
    const grammarRules = Array.isArray(s.grammarRules) ? s.grammarRules : [];
    const connectors = Array.isArray(s.connectors) ? s.connectors : [];
    const wordGrammar = Array.isArray(s.wordLevelGrammar) ? s.wordLevelGrammar : [];
    const mistakes = s.commonMistakesAndAlternatives;
    const practice = s.practice;

    const allLangs = getAllLanguages();

    return `
      <div class="lf-gb-container">
        <!-- 1. Header Row -->
        <div class="lf-gb-header-card">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="lf-section-tag" style="font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #2563eb;">GRAMMAR INTELLIGENCE</span>
            </div>
            <div class="lf-gb-lang-picker" style="display: flex; align-items: center; gap: 5px;">
              <span class="lf-source-pill" style="font-size: 10.5px; font-weight: 600; color: #64748b; background: rgba(120,120,128,0.1); padding: 2px 5px; border-radius: 4px;">Source: ${this.sourceLanguage ? this.sourceLanguage.toUpperCase() : 'EN'}</span>
              <span style="font-size: 10px; color: #94a3b8;">➔</span>
              <label for="lf-explanation-lang-select" class="lf-gb-lang-label" style="font-size: 11px; color: #64748b; font-weight: 600;">Target:</label>
              <select id="lf-explanation-lang-select" class="lf-explanation-lang-select" style="font-size: 11.5px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.15); background: var(--bg-surface, #ffffff); color: var(--text-main, #0f172a); max-width: 140px;">
                ${allLangs.map((l) => `
                  <option value="${l.targetLang}" ${this.targetLanguage === l.targetLang ? 'selected' : ''}>
                    ${l.flagEmoji} ${escapeHtml(l.targetNativeLabel || l.targetLabel)}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- 2. Sentence Overview & Syntactic Pattern -->
        <div class="lf-gb-overview-card" style="margin-top: 10px; padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div class="lf-gb-section-title" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b);">Syntactic Structure</div>
            <div class="lf-gb-type-pill" style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; background: rgba(37,99,235,0.08); color: #2563eb; border: 1px solid rgba(37,99,235,0.2);">${escapeHtml(overview.badgeLabel)}</div>
          </div>
          <div class="lf-gb-overview-text" style="font-size: 13px; color: var(--text-main, #0f172a); line-height: 1.45;">${this.renderInteractiveSentence(structure?.explanation || overview.explanation, s.selectedText)}</div>
          ${(structure?.explanationBengali && this.targetLanguage !== 'en') ? `
            <div class="lf-gb-overview-target" style="margin-top: 6px; font-size: 13px; font-weight: 500; color: #2563eb; line-height: 1.45;">
              ${escapeHtml(structure.explanationBengali)}
            </div>
          ` : ''}
          <div class="lf-gb-pattern-formula" style="margin-top: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.06); font-weight: 600; color: var(--text-main, #0f172a);">
            ${escapeHtml(patternFormula)}
          </div>
          ${s.patternSummary?.explanation ? `
            <div style="font-size: 12px; color: var(--text-muted, #64748b); margin-top: 6px; line-height: 1.4;">
              ${this.renderInteractiveSentence(s.patternSummary.explanation, s.selectedText)}
            </div>
          ` : ''}
        </div>

        <!-- 3. Key Grammar Rules (Deep Real AI Explanations) -->
        ${grammarRules.length > 0 ? `
          <div class="lf-gb-rules-section" style="margin-top: 12px;">
            <div class="lf-gb-section-title" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b); margin-bottom: 8px;">Key Grammar Rules (${grammarRules.length})</div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${grammarRules.map(r => `
                <div class="lf-gb-rule-card" style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
                  <div style="font-size: 13px; font-weight: 700; color: var(--text-main, #0f172a); margin-bottom: 4px;">
                    ${escapeHtml(r.ruleName)}
                  </div>
                  ${r.whereIsIt ? `
                    <div style="font-size: 11.5px; font-style: italic; color: #2563eb; margin-bottom: 6px;">
                      In sentence: “${this.renderInteractiveSentence(r.whereIsIt, s.selectedText)}”
                    </div>
                  ` : ''}
                  <div style="font-size: 12.5px; color: var(--text-main, #1e293b); line-height: 1.45; margin-bottom: 6px;">
                    ${this.renderInteractiveSentence(r.whatIsIt || r.howItWorks, s.selectedText)}
                  </div>
                  ${r.whyUsed ? `
                    <div style="font-size: 12px; color: var(--text-muted, #64748b); margin-bottom: 6px;">
                      <strong>Purpose:</strong> ${this.renderInteractiveSentence(r.whyUsed, s.selectedText)}
                    </div>
                  ` : ''}
                  ${r.reusablePattern ? `
                    <div style="font-size: 11.5px; font-family: ui-monospace, monospace; padding: 4px 8px; border-radius: 4px; background: rgba(0,0,0,0.04); margin-bottom: 6px; color: #0f172a;">
                      Pattern: ${escapeHtml(r.reusablePattern)}
                    </div>
                  ` : ''}
                  ${r.example?.english ? `
                    <div style="font-size: 12px; padding: 6px 10px; border-left: 2px solid #2563eb; background: rgba(37,99,235,0.03); border-radius: 0 6px 6px 0; margin-bottom: 4px;">
                      <div style="font-weight: 600;">Example: ${this.renderInteractiveSentence(r.example.english, r.example.english)}</div>
                      ${r.example.bengali && this.targetLanguage !== 'en' ? `
                        <div style="color: #2563eb; font-size: 11.5px; margin-top: 2px;">${escapeHtml(r.example.bengali)}</div>
                      ` : ''}
                    </div>
                  ` : ''}
                  ${r.commonConfusion ? `
                    <div style="font-size: 11.5px; color: #dc2626; margin-top: 4px;">
                      ⚠️ <strong>Watch out:</strong> ${this.renderInteractiveSentence(r.commonConfusion, s.selectedText)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 4. Dynamic Syntactic Constituents (Subject, Verb, Object, Adverbials) -->
        <div class="lf-gb-explore-section" style="margin-top: 12px;">
          <div class="lf-gb-section-title" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b); margin-bottom: 4px;">Syntactic Constituents</div>
          <div class="lf-gb-section-subtitle" style="font-size: 11.5px; color: var(--text-muted, #64748b); margin-bottom: 8px;">Explore how each component functions in the main clause.</div>

          <div class="lf-gb-accordion-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${sections.map((sec, idx) => `
              <details class="lf-gb-accordion" ${idx === 0 ? 'open' : ''} style="border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); background: rgba(0,0,0,0.015); overflow: hidden;">
                <summary class="lf-gb-summary" style="padding: 10px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="lf-constituent-tag" style="font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(37,99,235,0.08); color: #2563eb;">${escapeHtml(sec.badgeLetter)}</span>
                    <div>
                      <span style="font-size: 12.5px; font-weight: 700; color: var(--text-main, #0f172a); margin-right: 6px;">${escapeHtml(sec.title)}:</span>
                      <span style="font-size: 12.5px; font-weight: 500; color: var(--text-muted, #475569);">“${this.renderInteractiveSentence(sec.phrase, s.selectedText)}”</span>
                    </div>
                  </div>
                  <span class="lf-gb-acc-chevron" style="font-size: 10px; color: #94a3b8;">▼</span>
                </summary>
                <div class="lf-gb-body" style="padding: 10px 12px 12px 12px; border-top: 1px solid rgba(0,0,0,0.06); font-size: 12px; line-height: 1.45;">
                  <div style="color: var(--text-main, #1e293b); margin-bottom: 6px;">${this.renderInteractiveSentence(sec.simpleText, s.selectedText)}</div>
                  ${sec.guidingQuestion ? `
                    <div style="font-size: 11.5px; color: #2563eb; font-weight: 500; margin-bottom: 4px;">${this.renderInteractiveSentence(sec.guidingQuestion, s.selectedText)}</div>
                  ` : ''}
                  ${sec.tipText ? `
                    <div style="font-size: 11px; color: var(--text-muted, #64748b); background: rgba(0,0,0,0.03); padding: 6px 8px; border-radius: 6px; margin-top: 6px;">
                      💡 ${this.renderInteractiveSentence(sec.tipText, s.selectedText)}
                    </div>
                  ` : ''}
                </div>
              </details>
            `).join('')}
          </div>
        </div>

        <!-- 5. Discourse Connectors (if present) -->
        ${connectors.length > 0 ? `
          <div class="lf-gb-connectors-section" style="margin-top: 12px;">
            <div class="lf-gb-section-title" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b); margin-bottom: 8px;">Discourse &amp; Connectors</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${connectors.map(conn => `
                <div style="padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <strong style="color: #2563eb; font-size: 13px;">“${this.renderInteractiveSentence(conn.connector, s.selectedText)}”</strong>
                    <span style="font-size: 10.5px; padding: 1px 6px; border-radius: 4px; background: rgba(37,99,235,0.08); color: #2563eb; font-weight: 600;">
                      ${escapeHtml(conn.logicalRelationship || 'Transition')}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-main, #1e293b); margin-bottom: 4px;">${this.renderInteractiveSentence(conn.meaning, s.selectedText)}</div>
                  ${conn.grammaticalPattern ? `
                    <div style="font-size: 11.5px; font-family: ui-monospace, monospace; color: #475569; margin-bottom: 4px;">
                      Pattern: ${escapeHtml(conn.grammaticalPattern)}
                    </div>
                  ` : ''}
                  ${conn.contrastWithSimilar ? `
                    <div style="font-size: 11.5px; color: var(--text-muted, #64748b);">
                      Contrast: ${this.renderInteractiveSentence(conn.contrastWithSimilar, s.selectedText)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 6. Word-Level Grammar in Context (if present) -->
        ${wordGrammar.length > 0 ? `
          <div class="lf-gb-words-section" style="margin-top: 12px;">
            <div class="lf-gb-section-title" style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #64748b); margin-bottom: 8px;">Word-Level Grammar</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${wordGrammar.map(wg => `
                <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 8px 10px; border-radius: 6px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06); font-size: 12px;">
                  <div>
                    <span class="lf-sentence-word" data-word="${escapeHtml(wg.word.trim())}" data-context="${escapeHtml(s.selectedText)}" style="cursor: pointer; font-weight: 700; color: var(--text-main, #0f172a);" title="Inspect &quot;${escapeHtml(wg.word.trim())}&quot;">${escapeHtml(wg.word)}</span>
                    <span style="color: var(--text-muted, #64748b); font-size: 11px; margin-left: 6px;">(${escapeHtml(wg.partOfSpeech)})</span>
                    ${wg.usageNotes ? `<div style="font-size: 11.5px; color: #475569; margin-top: 2px;">${this.renderInteractiveSentence(wg.usageNotes, s.selectedText)}</div>` : ''}
                  </div>
                  <span style="font-size: 11px; font-weight: 600; color: #2563eb; background: rgba(37,99,235,0.06); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                    ${escapeHtml(wg.syntacticRole)}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 7. Common Pitfalls & Natural Alternative (if present) -->
        ${(mistakes?.commonMistake || mistakes?.naturalAlternative) ? `
          <div style="margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; margin-bottom: 6px;">
              Learner Pitfall &amp; Alternative
            </div>
            ${mistakes.commonMistake ? `
              <div style="font-size: 12px; color: #dc2626; margin-bottom: 4px;">
                ❌ <strong>Common mistake:</strong> ${this.renderInteractiveSentence(mistakes.commonMistake, s.selectedText)}
              </div>
            ` : ''}
            ${mistakes.correctedExample ? `
              <div style="font-size: 12px; color: #16a34a; margin-bottom: 4px;">
                ✓ <strong>Corrected:</strong> ${this.renderInteractiveSentence(mistakes.correctedExample, mistakes.correctedExample)}
              </div>
            ` : ''}
            ${mistakes.naturalAlternative ? `
              <div style="font-size: 12px; color: var(--text-main, #0f172a); margin-bottom: 2px;">
                ✨ <strong>Natural alternative:</strong> “${this.renderInteractiveSentence(mistakes.naturalAlternative, mistakes.naturalAlternative)}”
              </div>
            ` : ''}
            ${mistakes.nuanceDifference ? `
              <div style="font-size: 11.5px; color: var(--text-muted, #64748b); margin-top: 4px;">
                ${this.renderInteractiveSentence(mistakes.nuanceDifference, s.selectedText)}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- 8. Interactive Practice Question (if present) -->
        ${practice?.practiceQuestion ? `
          <div style="margin-top: 12px; padding: 12px; border-radius: 10px; background: rgba(37,99,235,0.04); border: 1px solid rgba(37,99,235,0.18);">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-bottom: 6px;">
              🎯 Practice &amp; Quick Check
            </div>
            <div style="font-size: 12.5px; font-weight: 600; color: var(--text-main, #0f172a); margin-bottom: 8px; line-height: 1.4;">
              ${this.renderInteractiveSentence(practice.practiceQuestion, s.selectedText)}
            </div>
            ${(practice.options && practice.options.length > 0) ? `
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                ${practice.options.map(opt => `
                  <div style="font-size: 12px; color: #334155; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.05);">
                    ${escapeHtml(opt)}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            <details style="margin-top: 6px;">
              <summary style="font-size: 11.5px; font-weight: 600; color: #2563eb; cursor: pointer; user-select: none;">
                Reveal Answer &amp; Explanation
              </summary>
              <div style="margin-top: 6px; font-size: 12px; color: var(--text-main, #1e293b); padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.8);">
                <div style="font-weight: 700; color: #16a34a; margin-bottom: 2px;">Answer: ${escapeHtml(practice.answer)}</div>
                ${practice.explanation ? `<div style="font-size: 11.5px; color: #475569;">${this.renderInteractiveSentence(practice.explanation, s.selectedText)}</div>` : ''}
              </div>
            </details>
          </div>
        ` : ''}
      </div>
    `;
  }

  public renderSentenceClausesTab(s: SentenceAnalysisResult): string {
    const clauses = Array.isArray(s.clauses) ? s.clauses : [];
    const clauseRel = s.clauseRelationship;
    const structureMap = s.structureMap;
    const phraseConstituents = Array.isArray(s.phraseConstituents) ? s.phraseConstituents : [];
    const conversational = Array.isArray(s.conversationalElements) ? s.conversationalElements : [];

    return `
      <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 12px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="lf-section-tag" style="font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #2563eb;">
            CLAUSE ARCHITECTURE (${clauses.length} CLAUSE${clauses.length === 1 ? '' : 'S'})
          </span>
        </div>

        <!-- 1. Visual Clause Relationship & Hierarchy Map -->
        ${(clauseRel || (structureMap && structureMap.nodes && structureMap.nodes.length > 0)) ? `
          <div style="padding: 12px; border-radius: 10px; background: rgba(0, 0, 0, 0.02); border: 1px solid rgba(0, 0, 0, 0.08);">
            <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">
              Clause Relationship Map
            </div>
            ${clauseRel?.formula ? `
              <div style="font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #0f172a; padding: 4px 8px; background: rgba(0,0,0,0.03); border-radius: 4px; margin-bottom: 6px;">
                ${escapeHtml(clauseRel.formula)}
              </div>
            ` : ''}
            ${clauseRel?.explanation ? `
              <div style="font-size: 12px; color: var(--text-main, #1e293b); line-height: 1.45; margin-bottom: 4px;">
                ${escapeHtml(clauseRel.explanation)}
              </div>
            ` : ''}
            ${clauseRel?.explanationBengali && this.targetLanguage !== 'en' ? `
              <div style="font-size: 12px; color: #2563eb; font-weight: 500; margin-top: 2px;">
                ${escapeHtml(clauseRel.explanationBengali)}
              </div>
            ` : ''}

            <!-- Node Hierarchy Map if present -->
            ${(structureMap?.nodes && structureMap.nodes.length > 0) ? `
              <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                ${structureMap.nodes.map(node => `
                  <div style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.06); font-size: 11.5px;">
                    <span style="font-weight: 700; text-transform: uppercase; font-size: 10px; padding: 1px 5px; border-radius: 3px; background: rgba(37,99,235,0.08); color: #2563eb; flex-shrink: 0;">
                      ${escapeHtml(node.relationType || 'clause')}
                    </span>
                    <div>
                      <span style="font-weight: 600; color: #0f172a;">“${this.renderInteractiveSentence(node.clauseOrElement, s.selectedText)}”</span>
                      ${node.connectsTo ? `<span style="color: #64748b;"> ➔ connects to ${escapeHtml(node.connectsTo)}</span>` : ''}
                      ${node.explanation ? `<div style="color: #475569; margin-top: 2px;">${this.renderInteractiveSentence(node.explanation, s.selectedText)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- 2. Detailed Clause Cards -->
        ${clauses.map((c, idx) => {
          const isMain = c.type === 'main';
          const clauseNum = idx + 1;
          const badgeLabel = isMain ? 'INDEPENDENT' : 'DEPENDENT';
          const badgeBg = isMain ? 'rgba(37, 99, 235, 0.08)' : 'rgba(100, 116, 139, 0.08)';
          const badgeColor = isMain ? '#2563eb' : '#475569';
          const badgeBorder = isMain ? 'rgba(37, 99, 235, 0.2)' : 'rgba(100, 116, 139, 0.2)';
          const title = isMain ? `Clause ${clauseNum} — Main / Independent Clause` : `Clause ${clauseNum} — ${c.category || c.role || 'Dependent Clause'}`;

          return `
            <div class="lf-clause-card" style="padding: 12px; border-radius: 10px; background: rgba(0, 0, 0, 0.02); border: 1px solid rgba(0, 0, 0, 0.08);">
              <!-- Top Row: Badge, Title, Standalone -->
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="lf-clause-badge" style="font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.03em; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
                    ${escapeHtml(badgeLabel)}
                  </span>
                  <strong style="font-size: 12.5px; color: var(--text-main, #0f172a);">${escapeHtml(title)}</strong>
                </div>
                ${c.standalone !== undefined ? `
                  <span style="font-size: 10.5px; color: #64748b; background: rgba(0,0,0,0.04); padding: 1px 6px; border-radius: 4px;">
                    Standalone: ${escapeHtml(String(c.standalone))}
                  </span>
                ` : ''}
              </div>

              <!-- Clause Exact Text -->
              <div style="font-size: 13px; font-style: italic; color: #0f172a; margin-bottom: 8px; padding: 8px 10px; background: rgba(0,0,0,0.03); border-radius: 6px; line-height: 1.45;">
                “${this.renderInteractiveSentence(c.text, s.selectedText)}”
              </div>

              <!-- Clause Explanation & Target Translation -->
              ${c.typeExplanation ? `
                <div style="font-size: 12px; color: var(--text-muted, #475569); line-height: 1.4; margin-bottom: 6px;">
                  <strong>Classification:</strong> ${this.renderInteractiveSentence(c.typeExplanation, s.selectedText)}
                </div>
              ` : ''}
              ${(c.explanationBengali && this.targetLanguage !== 'en') ? `
                <div style="font-size: 12.5px; color: #2563eb; font-weight: 500; line-height: 1.4; margin-bottom: 8px; padding-left: 8px; border-left: 2px solid #2563eb;">
                  ${escapeHtml(c.explanationBengali)}
                </div>
              ` : ''}

              <!-- Syntactic Breakdown within Clause -->
              <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px;">
                ${c.clausePattern ? `
                  <div style="margin-bottom: 2px;">
                    <strong style="color: #64748b; font-size: 11px; text-transform: uppercase;">Pattern:</strong>
                    <span style="font-family: ui-monospace, monospace; font-size: 11.5px; font-weight: 600; color: #0f172a; margin-left: 4px;">${escapeHtml(c.clausePattern)}</span>
                  </div>
                ` : ''}
                ${(!isMain && c.subordinator) ? `
                  <div><strong style="color: #2563eb;">Subordinator:</strong> “${escapeHtml(c.subordinator)}”</div>
                ` : ''}
                ${c.subject ? `
                  <div>
                    <strong style="color: #2563eb;">Subject:</strong> “${escapeHtml(c.subject)}”
                    ${c.subjectExplanation ? `<span style="color: #64748b; font-size: 11.5px;"> — ${escapeHtml(c.subjectExplanation)}</span>` : ''}
                  </div>
                ` : ''}
                ${(c.verbPhrase || c.verb) ? `
                  <div>
                    <strong style="color: #2563eb;">Verb Phrase:</strong> “${escapeHtml(c.verbPhrase || c.verb || '')}”
                    ${c.tenseAspect ? `<span style="font-size: 11px; font-weight: 600; color: #64748b; background: rgba(0,0,0,0.04); padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${escapeHtml(c.tenseAspect)}</span>` : ''}
                    ${c.verbExplanation ? `<span style="color: #64748b; font-size: 11.5px;"> — ${escapeHtml(c.verbExplanation)}</span>` : ''}
                  </div>
                ` : ''}
                ${c.directObject ? `
                  <div>
                    <strong style="color: #2563eb;">Direct Object:</strong> “${escapeHtml(c.directObject)}”
                    ${c.directObjectExplanation ? `<span style="color: #64748b; font-size: 11.5px;"> — ${escapeHtml(c.directObjectExplanation)}</span>` : ''}
                  </div>
                ` : ''}
                ${c.indirectObject ? `
                  <div><strong style="color: #2563eb;">Indirect Object:</strong> “${escapeHtml(c.indirectObject)}”</div>
                ` : ''}
                ${c.complement ? `
                  <div><strong style="color: #2563eb;">Complement:</strong> “${escapeHtml(c.complement)}”</div>
                ` : ''}
                ${(c.adverbials && c.adverbials.length > 0) ? `
                  <div>
                    <strong style="color: #0f766e;">Adverbials:</strong>
                    ${c.adverbials.map(a => `“${escapeHtml(a.text)}”${a.type ? ` (${escapeHtml(a.type)})` : ''}`).join(', ')}
                  </div>
                ` : ''}
                ${c.questionAnswered ? `
                  <div style="font-size: 11.5px; color: #475569; margin-top: 2px;">
                    <strong>Answers question:</strong> ${escapeHtml(c.questionAnswered)}
                  </div>
                ` : ''}
                ${c.dependsOn ? `
                  <div style="font-size: 11.5px; color: #475569;">
                    <strong>Depends on:</strong> ${escapeHtml(c.dependsOn)}
                  </div>
                ` : ''}
                ${c.example ? `
                  <div style="font-size: 11.5px; color: #2563eb; background: rgba(37,99,235,0.03); padding: 4px 8px; border-radius: 4px; margin-top: 4px;">
                    <strong>Parallel example:</strong> ${escapeHtml(c.example)}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}

        <!-- 3. Complex Phrase Constituents (if present) -->
        ${phraseConstituents.length > 0 ? `
          <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 8px;">
              Internal Phrase Constituents
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${phraseConstituents.map(pc => `
                <div style="font-size: 12px; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.06);">
                  <div style="font-weight: 700; color: #2563eb;">“${escapeHtml(pc.phrase)}” <span style="font-weight: 400; color: #64748b; font-size: 11px;">(${escapeHtml(pc.phraseTypeLabel)})</span></div>
                  ${pc.headWord ? `<div style="font-size: 11.5px; color: #334155; margin-top: 2px;">Head word: <strong>${escapeHtml(pc.headWord)}</strong> | Role: ${escapeHtml(pc.roleInClause || 'Constituent')}</div>` : ''}
                  ${pc.explanation ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${escapeHtml(pc.explanation)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 4. Conversational Elements (if present) -->
        ${conversational.length > 0 ? `
          <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.08);">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-bottom: 6px;">
              Conversational Repairs &amp; Speech Markers
            </div>
            ${conversational.map(ce => `
              <div style="font-size: 12px; line-height: 1.45;">
                <strong style="color: #2563eb;">“${escapeHtml(ce.text)}”</strong> — <span style="color: #64748b;">${escapeHtml(ce.typeLabel)}</span>
                <div style="margin-top: 2px; color: #334155;">${escapeHtml(ce.explanation)}</div>
                ${ce.explanationBengali && this.targetLanguage !== 'en' ? `
                  <div style="color: #2563eb; font-size: 11.5px; margin-top: 2px;">${escapeHtml(ce.explanationBengali)}</div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderSentenceAnalysisDetails(s: SentenceAnalysisResult): string {
    return this.renderSentenceGrammarTab(s);
  }

  private renderParagraphAnalysisDetails(p: ParagraphAnalysisResult): string {
    const vocab = p.keyVocabulary || [];
    const sentences = p.sentenceBreakdown || [];

    return `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 0.5px solid rgba(0, 0, 0, 0.08);">
        ${sentences.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 11.5px; color: #0071e3; text-transform: uppercase; display: block; margin-bottom: 6px;">
              📑 Sentence Flow:
            </strong>
            <ul style="padding-left: 16px; margin: 0; font-size: 12px; color: #424245; line-height: 1.5;">
              ${sentences.map((s) => `<li>${this.renderInteractiveSentence(s, s)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${vocab.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 11.5px; color: #0071e3; text-transform: uppercase; display: block; margin-bottom: 6px;">
              🔍 Key Vocabulary (${vocab.length}):
            </strong>
            ${vocab.map((item) => `
              <div class="lf-vocab-item">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <button class="lf-vocab-chip-btn" data-word="${escapeHtml(item.term)}" title="Analyze &quot;${escapeHtml(item.term)}&quot; in context">
                    ${escapeHtml(item.term)} ↗
                  </button>
                  <span style="font-size: 11.5px; color: #0071e3; font-weight: 600;">${escapeHtml(item.bengali || '')}</span>
                </div>
                <div style="font-size: 12.5px; color: #424245; line-height: 1.4;">
                  ${this.renderInteractiveSentence(item.meaning || 'Meaning in paragraph context.', p.selectedText)}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${p.argumentStructure ? `
          <div style="margin-bottom: 10px;">
            <strong style="font-size: 11.5px; color: #6e6e73; text-transform: uppercase; display: block; margin-bottom: 4px;">
              🏛️ Argument Structure:
            </strong>
            <div style="font-size: 12px; color: #424245; line-height: 1.45;">
              ${this.renderInteractiveSentence(p.argumentStructure, p.selectedText)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderAskAIPanel(targetMode: 'word' | 'sentence' | 'paragraph', focusText?: string): string {
    const isWord = targetMode === 'word';
    const displayFocus = focusText ? (focusText.length > 32 ? focusText.slice(0, 29) + '...' : focusText) : '';

    const langConfig = getLanguageConfig(this.targetLanguage);
    const targetFlag = langConfig?.flagEmoji || '🇧🇩';
    const targetLabel = langConfig?.targetLabel || 'Bengali';
    const nativeLabel = langConfig?.targetNativeLabel || 'বাংলা';

    const wordChips = [
      { icon: 'lightbulb', label: "Explain like I'm 5", prompt: "Explain this word in super simple terms like I'm 5 years old" },
      { icon: 'search', label: "Nuance vs Synonyms", prompt: "What is the subtle difference between this word and its common synonyms?" },
      { icon: 'message', label: "Native Daily Usage", prompt: "How do native English speakers naturally use this in everyday conversation?" },
      { icon: 'pen', label: "2 Real Examples", prompt: `Give me 2 practical, everyday example sentences with ${targetLabel} translation` },
      {
        icon: 'languages',
        label: langConfig?.targetLang === 'bn' ? "সহজ বাংলায় বিশদ" : `${nativeLabel} Detail`,
        prompt: langConfig?.targetLang === 'bn'
          ? "এই শব্দের সূক্ষ্ম অর্থ ও ব্যবহার সহজ বাংলায় বিস্তারিত বুঝিয়ে দাও"
          : `Explain the subtle nuance and usage of this word clearly in ${targetLabel} (${nativeLabel})`
      },
      { icon: 'alert', label: "Common Pitfalls", prompt: "What are the most common mistakes learners make with this word?" }
    ];

    const sentenceChips = [
      { icon: 'lightbulb', label: "Explain simply", prompt: "Break down the core message in super easy everyday English" },
      { icon: 'puzzle', label: "Grammar & Tone", prompt: "Explain the grammatical structure and rhetorical tone used here" },
      { icon: 'message', label: "Conversational Rewrite", prompt: "How would a native speaker rephrase this in casual speech or friendly email?" },
      {
        icon: 'languages',
        label: langConfig?.targetLang === 'bn' ? "সহজ বাংলা ভাবার্থ" : `${nativeLabel} Meaning`,
        prompt: langConfig?.targetLang === 'bn'
          ? "এই বক্তব্যটির অন্তর্নিহিত ভাব ও তাৎপর্য সহজ বাংলায় বুঝিয়ে দাও"
          : `Explain the underlying nuance and message of this statement clearly in ${targetLabel} (${nativeLabel})`
      },
      { icon: 'pen', label: "Practice Variation", prompt: "Give me a similar sentence with this same structure to practice with" },
      { icon: 'help', label: "Why this phrasing?", prompt: "Why did the author use this specific phrasing instead of simpler words?" }
    ];

    const activeChips = isWord ? wordChips : sentenceChips;
    const placeholder = isWord
      ? "Ask LexiFlow AI anything about this word... (Enter to send)"
      : "Ask LexiFlow AI anything about this text... (Enter to send)";

    return `
      <div class="lf-ask-ai-panel" role="region" aria-label="LexiFlow AI Language Coach">
        <!-- LexiFlow Coach Header -->
        <div class="lf-qa-header">
          <div class="lf-qa-brand">
            <span class="lf-qa-avatar-icon">${lfIcon('sparkles')}</span>
            <span class="lf-qa-title">LexiFlow AI Coach</span>
            ${displayFocus ? `<span class="lf-qa-focus-tag" title="${escapeHtml(focusText || '')}">Focus: "${escapeHtml(displayFocus)}"</span>` : ''}
          </div>
          <div class="lf-qa-controls">
            ${this.followUpList.length > 0 ? `
              <button type="button" class="lf-qa-mini-btn lf-qa-clear-btn" title="Clear conversation history">
                ${lfIcon('trash')}
                <span>Clear</span>
              </button>
            ` : ''}
            <button type="button" class="lf-btn-icon lf-qa-close-panel-btn" title="Close Ask AI panel" aria-label="Close Ask AI">${lfIcon('close')}</button>
          </div>
        </div>

        <!-- Quick Prompt Chips -->
        <div class="lf-qa-chips-row">
          ${activeChips.map((c) => `
            <button type="button" class="lf-qa-chip" data-prompt="${escapeHtml(c.prompt)}" title="${escapeHtml(c.prompt)}">
              <span class="lf-qa-chip-icon">${lfIcon(c.icon)}</span>
              <span class="lf-qa-chip-label">${escapeHtml(c.label)}</span>
            </button>
          `).join('')}
        </div>

        <!-- Conversation Thread -->
        ${this.renderFollowUps()}

        <!-- Thinking State -->
        ${this.isFollowUpLoading ? `
          <div class="lf-thinking-box" role="status" aria-live="polite">
            <div class="lf-thinking-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>LexiFlow AI is crafting an engaging answer...</span>
          </div>
        ` : ''}

        <!-- Input Bar with Send Button & Enter support -->
        <div class="lf-qa-input-bar">
          <input
            type="text"
            class="lf-qa-input"
            placeholder="${placeholder}"
            ${this.isFollowUpLoading ? 'disabled' : ''}
            aria-label="Ask LexiFlow AI a question"
          />
          <button
            type="button"
            class="lf-qa-submit-btn"
            ${this.isFollowUpLoading ? 'disabled' : ''}
            title="Send question (Enter)"
            aria-label="Send question"
          >
            <span>Ask</span>
            ${lfIcon('send')}
          </button>
        </div>
      </div>
    `;
  }

  private renderStageBPreview(b: StageBDetailedVocabulary | null): string {
    if (!b) return '';
    const firstSense = b.senses?.[0];
    const synonyms = firstSense?.synonyms || [];
    const collocations = b.collocations || [];
    if (synonyms.length === 0 && collocations.length === 0) return '';

    return `
      <div class="lf-quick-preview-row">
        ${synonyms.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            <span class="lf-preview-label">Synonyms:</span>
            ${synonyms.slice(0, 3).map((s) => `<span class="lf-synonym-tag lf-sentence-word" data-word="${escapeHtml(s.word.trim())}" style="cursor: pointer;" title="${escapeHtml(s.easyEnglish)}">${escapeHtml(s.word)}</span>`).join('')}
          </div>
        ` : ''}
        ${collocations.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-left: 4px;">
            <span class="lf-preview-label">Collocations:</span>
            ${collocations.slice(0, 2).map((c) => `<span class="lf-synonym-tag">${this.renderInteractiveSentence(c.english, c.english)}</span>`).join('')}
          </div>
        ` : ''}
        <button type="button" class="lf-see-all-btn" title="Explore all detailed senses and examples">See details (${b.senses?.length || 1}) →</button>
      </div>
    `;
  }

  private renderStageBContent(): string {
    if (this.isStageBLoading) {
      return `
        <div class="lf-stage-b-skeleton" role="status" aria-live="polite" style="padding: 10px 0;">
          <div class="lf-skeleton-line lf-shimmer" style="width: 92%; height: 14px; margin-bottom: 8px;"></div>
          <div class="lf-skeleton-line lf-shimmer" style="width: 70%; height: 14px; margin-bottom: 12px;"></div>
          <div style="padding: 10px 12px; background: rgba(120, 120, 128, 0.06); border-radius: 8px; margin-bottom: 10px;">
            <div class="lf-skeleton-pill lf-shimmer" style="width: 60px; height: 11px; margin-bottom: 6px;"></div>
            <div class="lf-skeleton-line lf-shimmer" style="width: 85%; height: 13px;"></div>
          </div>
          <div class="lf-skeleton-status" style="justify-content: center; margin-top: 10px;">
            <div class="lf-skeleton-pulse-dot"></div>
            <span class="lf-skeleton-status-text" style="font-size: 11.5px;">Exploring all meanings & examples...</span>
          </div>
        </div>
      `;
    }

    if (this.stageBError) {
      return `
        <div style="padding: 12px; background: rgba(239, 68, 68, 0.08); border-radius: 8px; margin-top: 10px;">
          <span style="font-size: 12px; color: #dc2626;">${escapeHtml(this.stageBError)}</span>
          <button class="lf-btn-action secondary lf-retry-stage-b-btn" style="margin-top: 6px; padding: 4px 8px; font-size: 11px;">
            Retry detailed meanings
          </button>
        </div>
      `;
    }

    if (!this.currentStageB) return '';

    const b = this.currentStageB;
    const senses = b.senses || [];
    const visibleSenses = this.showingAllSenses ? senses : senses.slice(0, 5);

    return `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 0.5px solid rgba(0, 0, 0, 0.08);">
        <strong style="font-size: var(--lf-font-sublabel, 13px); color: #0071e3; text-transform: uppercase; display: block; margin-bottom: 8px;">
          📚 Senses & Meanings (${senses.length}):
        </strong>

        ${visibleSenses.map((s, idx) => `
          <div class="lf-sense-item ${s.isContextual ? 'contextual' : ''}">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
              <div>
                <span class="lf-pos" style="font-size: 10.5px;">${escapeHtml(s.partOfSpeech)}</span>
                ${s.isContextual ? `<span class="lf-badge-contextual">In this sentence</span>` : ''}
              </div>
              <span style="font-size: var(--lf-font-sublabel, 11.5px); color: #6e6e73;">Sense #${idx + 1}</span>
            </div>

            <!-- Sense Easy English & Bengali -->
            <div class="lf-def-text" style="font-size: var(--lf-font-english, 15.5px); font-weight: 500; line-height: 1.5; margin-top: 3px;">
              ${this.renderInteractiveSentence(s.easyEnglish, this.currentContextSentence || b.lemma)}
            </div>
            <div class="lf-bengali-meaning" style="font-size: var(--lf-font-bengali, 17.5px); color: #0071e3; font-weight: 600; line-height: 1.5; margin-top: 3px;">
              ${escapeHtml(s.easyBengali)}
            </div>

            <!-- Sense Examples -->
            ${(s.examples || []).map((ex) => `
              <div class="lf-sense-example" style="margin-top: 5px; padding-left: 8px; border-left: 2px solid rgba(0, 113, 227, 0.35); font-size: var(--lf-font-example, 14px); color: #6e6e73; font-style: italic; line-height: 1.45;">
                "${this.renderInteractiveSentence(ex.english, ex.english)}"
                ${ex.bengali ? `<span style="font-style: normal; color: #86868b; margin-left: 4px;">(${escapeHtml(ex.bengali)})</span>` : ''}
              </div>
            `).join('')}

            <!-- Synonyms -->
            ${s.synonyms && s.synonyms.length > 0 ? `
              <div class="lf-synonyms-row" style="margin-top: 7px; font-size: var(--lf-font-base, 13.5px);">
                <span style="color: #6e6e73; font-weight: 600;">Synonyms:</span>
                ${s.synonyms.map((syn) => `<span class="lf-synonym-tag lf-sentence-word" data-word="${escapeHtml(syn.word.trim())}" style="font-size: var(--lf-font-chip, 12.5px); cursor: pointer;" title="${escapeHtml(syn.easyEnglish)} (${escapeHtml(syn.easyBengali)})">${escapeHtml(syn.word)}</span>`).join(' ')}
              </div>
            ` : ''}

            <!-- Antonyms -->
            ${s.antonyms && s.antonyms.length > 0 ? `
              <div class="lf-antonyms-row" style="margin-top: 5px; font-size: var(--lf-font-base, 13.5px);">
                <span style="color: #6e6e73; font-weight: 600;">Opposites:</span>
                ${s.antonyms.map((ant) => `<span class="lf-synonym-tag lf-sentence-word" data-word="${escapeHtml(ant.word.trim())}" style="background: rgba(239, 68, 68, 0.08); color: #dc2626; font-size: var(--lf-font-chip, 12.5px); cursor: pointer;" title="${escapeHtml(ant.easyEnglish)}">${escapeHtml(ant.word)}</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `).join('')}

        ${senses.length > 5 && !this.showingAllSenses ? `
          <button class="lf-btn-action secondary lf-show-more-senses-btn" style="width: 100%; justify-content: center; margin-bottom: 10px;">
            Show ${senses.length - 5} more meanings
          </button>
        ` : ''}

        <!-- Collocations -->
        ${b.collocations && b.collocations.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong class="lf-collocations-title" style="font-size: var(--lf-font-sublabel, 12.5px); text-transform: uppercase;">Common Collocations:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
              ${b.collocations.map((c) => `<span class="lf-synonym-tag" style="font-size: var(--lf-font-chip, 12.5px);">${this.renderInteractiveSentence(c.english, c.english)}${c.bengali ? ` (${escapeHtml(c.bengali)})` : ''}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Idioms & Phrases -->
        ${b.idiomsAndPhrases && b.idiomsAndPhrases.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong class="lf-idioms-title" style="font-size: var(--lf-font-sublabel, 12.5px); text-transform: uppercase;">Idioms & Phrases:</strong>
            <div style="margin-top: 5px;">
              ${b.idiomsAndPhrases.map((ip) => `
                <div class="lf-idiom-text" style="font-size: var(--lf-font-base, 14px); margin-bottom: 5px; line-height: 1.45;">
                  <span style="color: #0071e3; font-weight: 600;">${this.renderInteractiveSentence(ip.phrase, ip.phrase)}</span> &mdash; ${this.renderInteractiveSentence(ip.easyEnglish, ip.phrase)} <em>(${escapeHtml(ip.easyBengali)})</em>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Confusing Words -->
        ${b.confusingWords && b.confusingWords.length > 0 ? `
          <div style="margin-top: 10px;">
            <strong class="lf-confusing-title" style="font-size: var(--lf-font-sublabel, 12.5px); text-transform: uppercase;">Don't Confuse With:</strong>
            ${b.confusingWords.map((cw) => `
              <div class="lf-confusing-text" style="font-size: var(--lf-font-base, 14px); margin-top: 5px; line-height: 1.45;">
                <span style="color: #e8890c; font-weight: 600;">${this.renderInteractiveSentence(cw.word, this.currentContextSentence || b.lemma)}</span>: ${this.renderInteractiveSentence(cw.difference, this.currentContextSentence || b.lemma)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderFeedbackForm(selectedText: string, contextSentence?: string): string {
    if (this.feedbackSuccess) {
      return `
        <div class="lf-feedback-box" style="background: rgba(16, 185, 129, 0.15); border-color: #10b981;">
          <div style="font-size: 12.5px; color: #34d399; font-weight: 600;">
            ✓ Report saved locally. Thank you for your feedback!
          </div>
        </div>
      `;
    }

    const effectiveContext = contextSentence || this.currentContextSentence;

    return `
      <div class="lf-feedback-box">
        <div style="font-size: 12px; font-weight: 700; color: #f87171; margin-bottom: 6px;">
          Report Issue / রিপোর্ট বা পরামর্শ
        </div>
        <select class="lf-feedback-reason" style="width: 100%; border: 0.5px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 4px; font-size: 12px; margin-bottom: 6px;">
          <option value="wrong_context_meaning">Wrong meaning for this context</option>
          <option value="incorrect_bengali">Incorrect Bengali translation</option>
          <option value="complicated_english">English explanation is too complicated</option>
          <option value="fabricated_antonym">Invalid or inaccurate antonym</option>
          <option value="other">Other issue</option>
        </select>
        <textarea class="lf-feedback-note" placeholder="Optional details..." rows="2" style="width: 100%; border: 0.5px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 4px; font-size: 11.5px; margin-bottom: 6px; resize: none;"></textarea>

        <!-- Privacy Opt-In Checkbox -->
        <div class="lf-feedback-optin" style="margin-bottom: 6px; padding: 6px 8px; background: rgba(0,0,0,0.03); border-radius: 6px; font-size: 11px;">
          <label style="display: flex; align-items: flex-start; gap: 6px; cursor: pointer; color: var(--lf-text, #1d1d1f);">
            <input type="checkbox" class="lf-feedback-optin-checkbox" style="margin-top: 2px;" />
            <span>Include selected text and sentence context to help diagnose and fix this issue</span>
          </label>
        </div>

        <!-- Diagnostic Preview (only visible when opted in) -->
        <div class="lf-feedback-preview" style="display: none; margin-bottom: 8px; padding: 6px 8px; background: rgba(0, 113, 227, 0.08); border: 1px dashed rgba(0, 113, 227, 0.35); border-radius: 6px; font-size: 11px; line-height: 1.35;">
          <strong style="display: block; margin-bottom: 3px; color: #0071e3;">Preview of diagnostic data to be included:</strong>
          <div><strong>Text:</strong> "${escapeHtml(selectedText)}"</div>
          ${effectiveContext ? `<div><strong>Context:</strong> "${escapeHtml(effectiveContext)}"</div>` : ''}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 6px;">
          <button class="lf-btn-action secondary lf-feedback-cancel-btn" style="padding: 3px 8px; font-size: 11px;">Cancel</button>
          <button class="lf-btn-action lf-feedback-submit-btn" style="padding: 3px 10px; font-size: 11px;">Submit Report</button>
        </div>
      </div>
    `;
  }

  private renderFollowUps(): string {
    if (this.followUpList.length === 0) return '';

    return `
      <div class="lf-qa-thread">
        ${this.followUpList.map((f) => `
          <!-- User Question Bubble -->
          <div class="lf-chat-user">
            ${this.renderInteractiveSentence(f.question, f.question)}
          </div>

          <!-- LexiFlow AI Response Bubble -->
          <div class="lf-chat-ai">
            <div class="lf-ai-header-pill">
              <span class="lf-qa-avatar-icon lf-qa-avatar-small">${lfIcon('sparkles')}</span>
              <span>LexiFlow AI Tutor</span>
            </div>

            <!-- Key Takeaway Pill if present -->
            ${f.keyTakeaway ? `
              <div class="lf-qa-takeaway-box">
                <span class="lf-qa-takeaway-label">${lfIcon('lightbulb')} Key Takeaway:</span>
                <span>${this.renderInteractiveSentence(f.keyTakeaway, f.question || f.answer)}</span>
              </div>
            ` : ''}

            <!-- Main Answer with formatted markdown and interactive words -->
            <div class="lf-qa-body-text">
              ${this.formatClaudeMessage(f.answer, f.question || this.currentContextSentence)}
            </div>

            <!-- Warm Target Language Insight Card -->
            ${f.bengaliSummary ? `
              <div class="lf-qa-bengali-card">
                <div class="lf-qa-bengali-label">
                  ${lfIcon('languages')}
                  <span>${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetLang === 'bn' ? 'সহজ বাংলা সারসংক্ষেপ:' : `${getLanguageConfig(this.targetLanguage)?.targetNativeHeader || 'Summary'}:`)}</span>
                </div>
                <div class="lf-qa-bengali-text">${escapeHtml(f.bengaliSummary)}</div>
              </div>
            ` : ''}

            <!-- Practical Examples if present -->
            ${f.examples && f.examples.length > 0 ? `
              <div class="lf-qa-examples-box">
                <div class="lf-qa-examples-header">
                  ${lfIcon('pen')}
                  <span>Practical Usage:</span>
                </div>
                ${f.examples.map((ex) => `
                  <div class="lf-qa-example-item">
                    <div class="lf-qa-example-english">"${this.renderInteractiveSentence(ex.english, ex.english)}"</div>
                    ${ex.bengali ? `<div class="lf-qa-example-bengali">↳ ${escapeHtml(ex.bengali)}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Actions Row (Copy, Listen) -->
            <div class="lf-qa-actions-row">
              <button
                type="button"
                class="lf-qa-mini-btn lf-qa-copy-btn"
                data-copy="${escapeHtml(f.answer + (f.bengaliSummary ? '\n\n' + f.bengaliSummary : ''))}"
                title="Copy answer"
              >
                ${lfIcon('copy')}
                <span>Copy</span>
              </button>
              <button
                type="button"
                class="lf-qa-mini-btn lf-qa-speak-btn"
                data-speak="${escapeHtml(f.answer)}"
                title="Listen to explanation"
              >
                ${lfIcon('volume')}
                <span>Listen</span>
              </button>
            </div>

            <!-- Suggested Next Questions (Dynamic Chips) -->
            ${f.suggestedFollowUps && f.suggestedFollowUps.length > 0 ? `
              <div class="lf-qa-suggested-box">
                <div class="lf-qa-suggested-title">
                  ${lfIcon('compass')}
                  <span>Explore further with LexiFlow AI:</span>
                </div>
                <div class="lf-qa-suggested-chips">
                  ${f.suggestedFollowUps.map((sug) => `
                    <button type="button" class="lf-qa-suggested-chip" data-prompt="${escapeHtml(sug)}" title="${escapeHtml(sug)}">
                      ${lfIcon('message')}
                      <span>${escapeHtml(sug)}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private formatClaudeMessage(rawText: string, contextSentence?: string): string {
    if (!rawText) return '';
    let formatted = escapeHtml(rawText);

    // Convert **bold** to <strong>bold</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>italic</em>
    formatted = formatted.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

    // Convert `code` to <code>code</code>
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 11.5px; color: #c084fc;">$1</code>');

    // Convert newlines
    formatted = formatted.replace(/\n\n+/g, '<br/><br/>');
    formatted = formatted.replace(/\n/g, '<br/>');

    // Tokenize plain text segments outside HTML tags so all source language words become interactive .lf-sentence-word
    const parts = formatted.split(/(<[^>]+>)/g);
    const interactiveParts = parts.map((part) => {
      if (part.startsWith('<')) return part;
      return this.renderInteractiveSentence(part, contextSentence || rawText);
    });

    return interactiveParts.join('');
  }

  private async submitAskAI(questionText: string): Promise<void> {
    const q = questionText.trim();
    if (!q || this.isFollowUpLoading) return;

    this.isFollowUpLoading = true;
    this.render({ preserveScroll: true });

    setTimeout(() => {
      const thinkingBox = this.element.querySelector('.lf-thinking-box') as HTMLElement;
      if (thinkingBox && typeof thinkingBox.scrollIntoView === 'function') {
        thinkingBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);

    try {
      const res = await this.callbacks.onAskFollowUp(q);
      if (res) {
        this.followUpList.push(res);
      }
    } catch (err) {
      console.error('Claude Ask AI error:', err);
    } finally {
      this.isFollowUpLoading = false;
      this.render({ preserveScroll: true });
      setTimeout(() => {
        const thread = this.element.querySelector('.lf-qa-thread');
        if (thread) {
          thread.scrollTop = thread.scrollHeight;
        }
        const askPanel = this.element.querySelector('.lf-ask-ai-panel') as HTMLElement;
        if (askPanel && typeof askPanel.scrollIntoView === 'function') {
          askPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  }

  private bindSentenceWordListeners(defaultContext?: string, parentSentence?: SentenceAnalysisResult): void {
    this.element.querySelectorAll('.lf-sentence-word').forEach((wordEl) => {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = (wordEl as HTMLElement).getAttribute('data-word');
        const customContext = (wordEl as HTMLElement).getAttribute('data-context');
        if (word && this.callbacks.onSelectWord) {
          if (parentSentence) {
            this.parentSentenceAnalysis = parentSentence;
          }
          this.callbacks.onSelectWord(word, customContext || defaultContext);
        }
      });
    });
  }

  private bindEventsAskAI(): void {
    const el = this.element;

    el.querySelector('.lf-qa-toggle-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showAskAI = !this.showAskAI;
      if (this.currentSentenceAnalysis) {
        this.activeSentenceTab = this.showAskAI ? 'ask-ai' : 'breakdown';
      } else {
        this.activeTab = this.showAskAI ? 'ask-ai' : 'meaning';
      }
      this.render({ scrollToAskAI: this.showAskAI, preserveScroll: true });
      if (this.showAskAI) {
        setTimeout(() => {
          const askPanel = el.querySelector('.lf-ask-ai-panel') as HTMLElement;
          if (askPanel && typeof askPanel.scrollIntoView === 'function') {
            askPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          const inputEl = el.querySelector('.lf-qa-input') as HTMLInputElement;
          if (inputEl) {
            inputEl.focus({ preventScroll: true });
          }
        }, 80);
      }
    });

    el.querySelector('.lf-qa-close-panel-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showAskAI = false;
      this.activeTab = 'meaning';
      this.activeSentenceTab = 'breakdown';
      this.render({ preserveScroll: true });
    });

    el.querySelector('.lf-qa-clear-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.followUpList = [];
      this.render({ preserveScroll: true });
    });

    el.querySelector('.lf-qa-submit-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = el.querySelector('.lf-qa-input') as HTMLInputElement;
      const q = input?.value?.trim();
      if (q) {
        this.submitAskAI(q);
      }
    });

    const inputEl = el.querySelector('.lf-qa-input') as HTMLInputElement;
    if (inputEl) {
      inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const q = inputEl.value?.trim();
          if (q) {
            this.submitAskAI(q);
          }
        }
      });
    }

    el.querySelectorAll('.lf-qa-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          this.submitAskAI(prompt);
        }
      });
    });

    el.querySelectorAll('.lf-qa-suggested-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          this.submitAskAI(prompt);
        }
      });
    });

    el.querySelectorAll('.lf-qa-copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToCopy = btn.getAttribute('data-copy') || '';
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy);
          const orig = btn.textContent;
          btn.textContent = '✓ Copied';
          setTimeout(() => {
            btn.textContent = orig;
          }, 1500);
        }
      });
    });

    el.querySelectorAll('.lf-qa-speak-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToSpeak = btn.getAttribute('data-speak') || '';
        if (textToSpeak) {
          this.speakText(textToSpeak);
        }
      });
    });
  }

  private renderLegacyView(a: LinguisticAnalysisResult): void {
    const isParagraph = a.selectionType === 'paragraph';
    const para = a as ParagraphAnalysisResult;

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-heading-sentence">${isParagraph ? 'Paragraph Intelligence' : 'Text Analysis'}</span>
          <span class="lf-pos">${a.selectionType.toUpperCase()}</span>
        </div>
        <div class="lf-actions-top">
          ${this.renderModeToggleHtml()}
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}">${lfIcon('pin')}</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy text">${lfIcon('copy')}</button>
          <button class="lf-btn-icon lf-close-btn" title="Close">${lfIcon('close')}</button>
        </div>
      </div>
      <div class="lf-content">
        ${isParagraph && para.mainIdea ? `
          <div style="margin-bottom: 8px; padding: 8px 10px; background: rgba(255,255,255,0.04); border-radius: 6px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; color: #0a84ff; font-weight: 700; margin-bottom: 2px;">
              Main Idea:
            </div>
            <div style="font-size: var(--lf-font-english, 15px); color: #f1f5f9; line-height: 1.45;">
              ${this.renderInteractiveSentence(para.mainIdea, a.selectedText)}
            </div>
          </div>
        ` : ''}

        <div class="lf-bengali-box" style="margin-bottom: 8px; padding: 10px 12px; border-radius: 8px;">
          <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
            ${getLanguageConfig(this.targetLanguage)?.targetLang === 'bn' ? 'সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${getLanguageConfig(this.targetLanguage)?.flagEmoji || '🌐'} ${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetNativeHeader || 'Translation')} (${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetLabel || 'Target')}):`}
          </div>
          <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 600; line-height: 1.45;">
            ${escapeHtml(a.bengaliTranslation)}
          </div>
        </div>
      </div>
      <div class="lf-footer">
        <div></div>
        <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">${this.isSaved ? (this.readingMode === 'learn' ? '✓ Saved with Context' : '✓ Saved') : (this.readingMode === 'learn' ? 'Save with Context' : '+ Save')}</button>
      </div>
    `;

    this.element.querySelector('.lf-reading-mode-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleReadingMode();
    });

    this.element.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });
    this.element.querySelector('.lf-pin-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isPinned = !this.isPinned;
      this.render();
    });
    this.element.querySelector('.lf-copy-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(a.selectedText);
      const btn = this.element.querySelector('.lf-copy-btn') as HTMLElement;
      if (btn) btn.innerHTML = lfIcon('check');
      setTimeout(() => { if (btn) btn.innerHTML = lfIcon('copy'); }, 1200);
    });
    this.element.querySelector('.lf-save-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item: VocabularyItem = {
        id: `legacy_${Date.now()}`,
        word: a.selectedText,
        selectionType: a.selectionType,
        meaning: a.bengaliTranslation || 'Meaning',
        definition: a.bengaliTranslation || 'Definition',
        bengaliMeaning: a.bengaliTranslation,
        contextSentence: this.currentContextSentence,
        dateAdded: new Date().toISOString(),
        tags: ['legacy-vocab'],
        collection: 'General',
        difficulty: 'medium',
        fsrs: createInitialFSRSState()
      };
      await this.callbacks.onSave(item);
      this.isSaved = true;
      this.render();
    });

    this.bindSentenceWordListeners(a.selectedText);
    this.bindEventsAskAI();
  }

  private bindEventsStageA(): void {
    const el = this.element;

    el.querySelector('.lf-reading-mode-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleReadingMode();
    });

    el.querySelector('.lf-reveal-cloze-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ans = el.querySelector('.lf-cloze-answer') as HTMLElement | null;
      const btn = el.querySelector('.lf-reveal-cloze-btn') as HTMLElement | null;
      if (ans) {
        const isHidden = ans.hasAttribute('hidden') || ans.style.display === 'none' || !ans.style.display;
        if (isHidden) {
          ans.removeAttribute('hidden');
          ans.style.display = 'block';
          if (btn) btn.textContent = 'Hide answer';
        } else {
          ans.setAttribute('hidden', '');
          ans.style.display = 'none';
          if (btn) btn.textContent = 'Test memory: click to reveal answer';
        }
      }
    });

    el.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });

    el.querySelector('#lf-back-sentence-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.parentSentenceAnalysis) {
        this.showSentence(
          this.parentSentenceAnalysis,
          this.currentContextSentence,
          this.currentNearbyParagraph,
          this.isSaved
        );
      }
    });

    el.querySelector('#lf-view-parent-sentence-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.parentSentenceAnalysis) {
        this.showSentence(
          this.parentSentenceAnalysis,
          this.currentContextSentence,
          this.currentNearbyParagraph,
          this.isSaved
        );
      }
    });

    el.querySelector('.lf-pin-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isPinned = !this.isPinned;
      this.render();
    });

    el.querySelector('.lf-copy-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.currentStageA) {
        navigator.clipboard.writeText(this.currentStageA.selectedText);
        const btn = el.querySelector('.lf-copy-btn') as HTMLElement;
        if (btn) btn.innerHTML = lfIcon('check');
        setTimeout(() => { if (btn) btn.innerHTML = lfIcon('copy'); }, 1200);
      }
    });

    el.querySelectorAll('.lf-voice-btn, .lf-machine-voice-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.currentStageA) {
          this.speakText(this.currentStageA.selectedText, this.currentStageA.lemma);
        }
      });
    });

    // Native Segmented Tab listeners
    el.querySelectorAll('.lf-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = (tabBtn as HTMLElement).getAttribute('data-tab') as 'meaning' | 'ask-ai' | 'details';
        if (tab) {
          this.activeTab = tab;
          if (tab === 'ask-ai') {
            this.showAskAI = true;
          } else if (tab === 'details') {
            this.isExpanded = true;
            if (!this.currentStageB && !this.isStageBLoading) {
              this.loadStageB();
              return;
            }
          }
          this.render();
        }
      });
    });

    // Quick AI prompt chips directly in Meaning view
    el.querySelectorAll('.lf-quick-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prompt = (chip as HTMLElement).getAttribute('data-prompt');
        if (prompt) {
          this.activeTab = 'ask-ai';
          this.showAskAI = true;
          this.submitAskAI(prompt);
        }
      });
    });

    // See details button on preview row
    el.querySelector('.lf-see-all-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.activeTab = 'details';
      this.isExpanded = true;
      if (!this.currentStageB && !this.isStageBLoading) {
        this.loadStageB();
      } else {
        this.render();
      }
    });

    const expandBtn = el.querySelector('#lf-expand-toggle') as HTMLElement;
    expandBtn?.addEventListener('click', async () => {
      if (this.activeTab === 'details' || this.isExpanded) {
        this.activeTab = 'meaning';
        this.isExpanded = false;
        this.render();
      } else {
        this.activeTab = 'details';
        this.isExpanded = true;
        if (!this.currentStageB && !this.isStageBLoading) {
          await this.loadStageB();
        } else {
          this.render();
        }
      }
    });

    el.querySelector('.lf-show-more-senses-btn')?.addEventListener('click', () => {
      this.showingAllSenses = true;
      this.render();
    });

    el.querySelector('.lf-retry-stage-b-btn')?.addEventListener('click', async () => {
      await this.loadStageB();
    });

    el.querySelector('.lf-looks-wrong-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showFeedbackModal = true;
      this.render({ preserveScroll: true });
    });

    el.querySelector('.lf-report-trigger-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = !this.showFeedbackModal;
      this.feedbackSuccess = false;
      this.render();
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.style.display = isChecked ? 'block' : 'none';
      }
    });

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      const optinEl = el.querySelector('.lf-feedback-optin-checkbox') as HTMLInputElement | null;
      const isOptedIn = Boolean(optinEl?.checked);

      if (this.callbacks.onReportWrongMeaning && this.currentStageA) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: isOptedIn ? this.currentStageA.selectedText : '[Redacted - User Opt-out]',
          contextSentence: isOptedIn ? this.currentContextSentence : undefined,
          reason: reasonEl?.value || 'wrong_meaning',
          userNote: noteEl?.value?.trim() || ''
        };
        const ok = await this.callbacks.onReportWrongMeaning(report);
        if (ok) {
          this.feedbackSuccess = true;
          this.render();
          setTimeout(() => {
            this.showFeedbackModal = false;
            this.feedbackSuccess = false;
            this.render();
          }, 2000);
        }
      }
    });

    el.querySelector('.lf-save-btn')?.addEventListener('click', async () => {
      if (!this.currentStageA) return;
      const item: VocabularyItem = {
        id: `vocab_${Date.now()}`,
        word: this.currentStageA.selectedText,
        selectionType: (this.currentStageA.partOfSpeech === 'phrase' ? 'phrase' : 'word') as SelectionType,
        meaning: this.currentStageA.easyEnglish,
        definition: this.currentStageA.contextMeaning,
        partOfSpeech: this.currentStageA.partOfSpeech,
        bengaliMeaning: this.currentStageA.easyBengali,
        contextSentence: this.currentContextSentence,
        dateAdded: new Date().toISOString(),
        tags: this.readingMode === 'learn' ? ['web-reading', 'learn-mode', 'active-recall'] : ['web-reading'],
        collection: 'Daily Reading',
        difficulty: 'medium',
        fsrs: createInitialFSRSState()
      };
      await this.callbacks.onSave(item);
      this.isSaved = true;
      this.render();
    });

    this.bindSentenceWordListeners(this.currentContextSentence || this.currentStageA?.selectedText);
    this.bindEventsAskAI();
  }

  private bindEventsSentence(s: SentenceAnalysisResult): void {
    const el = this.element;

    el.querySelector('.lf-reading-mode-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleReadingMode();
    });

    el.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });

    el.querySelector('.lf-pin-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isPinned = !this.isPinned;
      this.render();
    });

    el.querySelector('.lf-copy-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(s.selectedText);
      const btn = el.querySelector('.lf-copy-btn') as HTMLElement;
      if (btn) btn.innerHTML = lfIcon('check');
      setTimeout(() => { if (btn) btn.innerHTML = lfIcon('copy'); }, 1200);
    });

    el.querySelectorAll('.lf-voice-btn, .lf-machine-voice-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.speakText(s.selectedText);
      });
    });

    // Native Segmented Tab listeners for Sentence
    el.querySelectorAll('.lf-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = (tabBtn as HTMLElement).getAttribute('data-tab') as 'breakdown' | 'grammar' | 'clauses' | 'ask-ai';
        if (tab) {
          this.activeSentenceTab = tab;
          if (tab === 'ask-ai') {
            this.showAskAI = true;
          } else if (tab === 'grammar' || tab === 'clauses') {
            this.isSentenceAnalysisExpanded = true;
          } else if (tab === 'breakdown') {
            this.isSentenceAnalysisExpanded = false;
            this.showAskAI = false;
          }
          this.render();
        }
      });
    });

    // Explanation Language Picker in Grammar Breakdown
    el.querySelector('.lf-explanation-lang-select')?.addEventListener('change', async (e) => {
      const select = e.target as HTMLSelectElement;
      if (select && select.value) {
        this.targetLanguage = select.value;
        if (this.callbacks.onUpdateSettings) {
          await this.callbacks.onUpdateSettings({ targetLanguage: this.targetLanguage });
        }
        this.render();
      }
    });

    // Quick AI prompt chips for Sentence
    el.querySelectorAll('.lf-quick-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const prompt = (chip as HTMLElement).getAttribute('data-prompt');
        if (prompt) {
          this.activeSentenceTab = 'ask-ai';
          this.showAskAI = true;
          this.submitAskAI(prompt);
        }
      });
    });

    el.querySelector('#lf-sentence-text-toggle')?.addEventListener('click', () => {
      this.isSentenceExpanded = !this.isSentenceExpanded;
      this.render();
    });

    el.querySelector('#lf-sentence-expand-toggle')?.addEventListener('click', () => {
      const contentEl = el.querySelector('.lf-content') as HTMLElement | null;
      const expandedEl = el.querySelector('#lf-sentence-expanded-section') as HTMLElement | null;

      // If already expanded and currently scrolled into view, toggle collapse
      if (this.isSentenceAnalysisExpanded && contentEl && expandedEl && contentEl.scrollTop >= (expandedEl.offsetTop - 80)) {
        this.isSentenceAnalysisExpanded = false;
        this.render();
      } else {
        // Expand and smoothly scroll directly to Grammar & Clauses
        this.isSentenceAnalysisExpanded = true;
        if (this.activeSentenceTab === 'ask-ai') {
          this.activeSentenceTab = 'breakdown';
        }
        this.render({ scrollToExpanded: true });
      }
    });

    el.querySelector('.lf-looks-wrong-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showFeedbackModal = true;
      this.render({ preserveScroll: true });
    });

    el.querySelector('.lf-report-trigger-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = !this.showFeedbackModal;
      this.feedbackSuccess = false;
      this.render();
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.style.display = isChecked ? 'block' : 'none';
      }
    });

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      const optinEl = el.querySelector('.lf-feedback-optin-checkbox') as HTMLInputElement | null;
      const isOptedIn = Boolean(optinEl?.checked);

      if (this.callbacks.onReportWrongMeaning) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: isOptedIn ? s.selectedText : '[Redacted - User Opt-out]',
          contextSentence: isOptedIn ? s.selectedText : undefined,
          reason: reasonEl?.value || 'wrong_sentence_translation',
          userNote: noteEl?.value?.trim() || ''
        };
        const ok = await this.callbacks.onReportWrongMeaning(report);
        if (ok) {
          this.feedbackSuccess = true;
          this.render();
          setTimeout(() => {
            this.showFeedbackModal = false;
            this.feedbackSuccess = false;
            this.render();
          }, 2000);
        }
      }
    });

    el.querySelector('.lf-save-btn')?.addEventListener('click', async () => {
      const item: VocabularyItem = {
        id: `sentence_${Date.now()}`,
        word: s.selectedText,
        selectionType: 'sentence',
        meaning: s.plainEnglishParaphrase || s.overallMeaning || 'Sentence Analysis',
        definition: s.plainEnglishParaphrase || s.overallMeaning || 'Sentence meaning',
        bengaliMeaning: s.bengaliTranslation,
        bengaliExplanation: s.bengaliTranslation,
        contextSentence: s.selectedText,
        dateAdded: new Date().toISOString(),
        tags: ['sentence-study'],
        collection: 'Sentences',
        difficulty: 'medium',
        fsrs: createInitialFSRSState()
      };
      await this.callbacks.onSave(item);
      this.isSaved = true;
      this.render();
    });

    this.bindSentenceWordListeners(s.selectedText, s);

    el.querySelectorAll('.lf-vocab-chip-btn').forEach((chipEl) => {
      chipEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = (chipEl as HTMLElement).getAttribute('data-word');
        if (word && this.callbacks.onSelectWord) {
          this.parentSentenceAnalysis = s;
          this.callbacks.onSelectWord(word, s.selectedText);
        }
      });
    });

    el.querySelectorAll('.lf-practice-reveal-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reveal = el.querySelector('.lf-practice-answer-reveal') as HTMLElement;
        if (reveal) {
          reveal.style.display = reveal.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    el.querySelectorAll('.lf-practice-opt-btn').forEach((optBtn) => {
      optBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reveal = el.querySelector('.lf-practice-answer-reveal') as HTMLElement;
        if (reveal) {
          reveal.style.display = 'block';
        }
      });
    });

    this.bindEventsAskAI();
  }

  private bindEventsParagraph(p: ParagraphAnalysisResult): void {
    const el = this.element;

    el.querySelector('.lf-reading-mode-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleReadingMode();
    });

    el.querySelector('.lf-close-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.unpin();
      this.callbacks.onClose();
    });

    el.querySelector('.lf-pin-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isPinned = !this.isPinned;
      this.render();
    });

    el.querySelector('.lf-copy-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(p.selectedText);
      const btn = el.querySelector('.lf-copy-btn') as HTMLElement;
      if (btn) btn.innerHTML = lfIcon('check');
      setTimeout(() => { if (btn) btn.innerHTML = lfIcon('copy'); }, 1200);
    });

    el.querySelectorAll('.lf-voice-btn, .lf-machine-voice-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.speakText(p.selectedText);
      });
    });

    el.querySelectorAll('.lf-voice-mini-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToSpeak = btn.getAttribute('data-speak') || '';
        if (textToSpeak) {
          this.speakText(textToSpeak);
        }
      });
    });

    el.querySelectorAll('.lf-sentence-switcher .lf-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sentIdx = Number(tab.getAttribute('data-sent-idx') || '0');
        this.activeParaSentenceIndex = sentIdx;
        this.render({ preserveScroll: true });
      });
    });

    el.querySelector('.lf-stepper-prev')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.activeParaSentenceIndex > 0) {
        this.activeParaSentenceIndex--;
        this.render({ preserveScroll: true });
      }
    });

    el.querySelector('.lf-stepper-next')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const hierarchical = this.ensureHierarchicalParagraph(p);
      const currentPara = hierarchical.paragraphs[this.activeParaIndex] || hierarchical.paragraphs[0];
      const maxIdx = (currentPara?.sentences.length || 1) - 1;
      if (this.activeParaSentenceIndex < maxIdx) {
        this.activeParaSentenceIndex++;
        this.render({ preserveScroll: true });
      }
    });

    el.querySelectorAll('.lf-para-tabs .lf-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const paraIdx = Number(tab.getAttribute('data-para-idx') || '0');
        this.activeParaIndex = paraIdx;
        this.activeParaSentenceIndex = 0;
        this.render({ preserveScroll: true });
      });
    });

    el.querySelector('#lf-para-text-toggle')?.addEventListener('click', () => {
      this.isSentenceExpanded = !this.isSentenceExpanded;
      this.render();
    });

    el.querySelector('#lf-para-expand-toggle')?.addEventListener('click', () => {
      const contentEl = el.querySelector('.lf-content') as HTMLElement | null;
      const expandedEl = el.querySelector('#lf-para-expanded-section') as HTMLElement | null;

      if (this.isSentenceAnalysisExpanded && contentEl && expandedEl && contentEl.scrollTop >= (expandedEl.offsetTop - 80)) {
        this.isSentenceAnalysisExpanded = false;
        this.render();
      } else {
        this.isSentenceAnalysisExpanded = true;
        this.render({ scrollToExpanded: true });
      }
    });

    el.querySelector('.lf-report-trigger-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = !this.showFeedbackModal;
      this.feedbackSuccess = false;
      this.render();
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.style.display = isChecked ? 'block' : 'none';
      }
    });

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      const optinEl = el.querySelector('.lf-feedback-optin-checkbox') as HTMLInputElement | null;
      const isOptedIn = Boolean(optinEl?.checked);

      if (this.callbacks.onReportWrongMeaning) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: isOptedIn ? p.selectedText : '[Redacted - User Opt-out]',
          contextSentence: isOptedIn ? p.selectedText : undefined,
          reason: reasonEl?.value || 'wrong_paragraph_translation',
          userNote: noteEl?.value?.trim() || ''
        };
        const ok = await this.callbacks.onReportWrongMeaning(report);
        if (ok) {
          this.feedbackSuccess = true;
          this.render();
          setTimeout(() => {
            this.showFeedbackModal = false;
            this.feedbackSuccess = false;
            this.render();
          }, 2000);
        }
      }
    });

    el.querySelector('.lf-save-btn')?.addEventListener('click', async () => {
      const item: VocabularyItem = {
        id: `para_${Date.now()}`,
        word: p.selectedText.slice(0, 50) + '...',
        selectionType: 'paragraph',
        meaning: p.conciseSummary || p.mainIdea || 'Paragraph Summary',
        definition: p.mainIdea || p.conciseSummary || 'Paragraph text',
        bengaliMeaning: p.bengaliTranslation,
        bengaliExplanation: p.bengaliTranslation,
        contextSentence: p.selectedText,
        dateAdded: new Date().toISOString(),
        tags: ['paragraph-study'],
        collection: 'Paragraphs',
        difficulty: 'medium',
        fsrs: createInitialFSRSState()
      };
      await this.callbacks.onSave(item);
      this.isSaved = true;
      this.render();
    });

    this.bindSentenceWordListeners(p.selectedText);

    el.querySelectorAll('.lf-vocab-chip-btn').forEach((chipEl) => {
      chipEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = (chipEl as HTMLElement).getAttribute('data-word');
        if (word && this.callbacks.onSelectWord) {
          this.callbacks.onSelectWord(word, p.selectedText);
        }
      });
    });

    this.bindEventsAskAI();
  }

  private async loadStageB(): Promise<void> {
    if (!this.callbacks.onFetchStageB || !this.currentStageA) return;
    this.isStageBLoading = true;
    this.stageBError = null;
    this.render();

    try {
      const res = await this.callbacks.onFetchStageB(
        this.currentStageA.lemma,
        this.currentStageA.partOfSpeech,
        this.currentStageA.contextualSenseId
      );
      if (res) {
        this.currentStageB = res;
      } else {
        this.stageBError = 'Could not load detailed vocabulary exploration.';
      }
    } catch (err: any) {
      this.stageBError = err.message || 'Detailed analysis request failed.';
    } finally {
      this.isStageBLoading = false;
      this.render();
    }
  }

  private speakText(text: string, lemma?: string): void {
    playPronunciation(text, { lemma }).catch((err) => {
      console.warn('[LexiFlow Audio] Failed to play natural pronunciation:', err);
    });
  }
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function lfIcon(name: string, extraClass: string = ''): string {
  const cls = extraClass ? `lf-svg-icon ${extraClass}` : 'lf-svg-icon';
  switch (name) {
    case 'volume':
      return `<svg class="${cls}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    case 'pin':
      return `<svg class="${cls}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`;
    case 'copy':
      return `<svg class="${cls}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
    case 'check':
      return `<svg class="${cls}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    case 'close':
      return `<svg class="${cls}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    case 'chevronLeft':
      return `<svg class="${cls}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    case 'chevronRight':
      return `<svg class="${cls}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    case 'sparkles':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>`;
    case 'book':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>`;
    case 'flag':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;
    case 'message':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    case 'bolt':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    case 'brain':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04Z"></path></svg>`;
    case 'puzzle':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c0-1.574-1.277-2.85-2.85-2.85a2.85 2.85 0 0 0-2.85 2.85v.15H10v-.15A2.85 2.85 0 0 0 7.15 5C5.576 5 4.3 6.276 4.3 7.85v2.3h.15a2.85 2.85 0 0 1 0 5.7H4.3v2.3C4.3 19.724 5.576 21 7.15 21a2.85 2.85 0 0 0 2.85-2.85v-.15h3.739v.15a2.85 2.85 0 0 0 2.85 2.85c1.573 0 2.85-1.276 2.85-2.85v-2.3h-.15a2.85 2.85 0 0 1 0-5.7h.15v-2.3Z"></path></svg>`;
    case 'lightbulb':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`;
    case 'search':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    case 'send':
      return `<svg class="${cls}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    case 'trash':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`;
    case 'languages':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>`;
    case 'pen':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
    case 'help':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'alert':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    case 'compass':
      return `<svg class="${cls}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`;
    default:
      return '';
  }
}
