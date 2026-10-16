import {
  SelectionType,
  LinguisticAnalysisResult,
  WordAnalysisResult,
  PhraseAnalysisResult,
  SentenceAnalysisResult,
  ParagraphAnalysisResult,
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
import { getLanguageConfig } from '../config/languages';
import { clampPositionToViewport } from './positioning';
import { playPronunciation } from '../services/audio/voiceService';

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
  private activeSentenceTab: 'breakdown' | 'ask-ai' | 'grammar' = 'breakdown';
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
  private targetLanguage: string = 'bn';
  private currentTheme: 'light' | 'dark' | 'system' = 'dark';

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
    });
  }

  private setupDragHandler(): void {
    const header = this.element.querySelector('.lf-header') as HTMLElement | null;
    if (!header) return;

    this.currentHeaderEl = header;

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      // Allow only primary button (0 for mouse) or touch/pen (0)
      if (e.button !== 0) return;

      // Do not initiate drag when user clicks interactive buttons, tabs, or input controls
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('button, input, select, textarea, a, .lf-btn-icon, .lf-tab, .lf-back-sentence-btn, [role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = true;
      this.isUserDragged = true;
      this.activePointerId = e.pointerId;

      document.documentElement.style.setProperty('cursor', 'grabbing', 'important');
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

          const minW = 280;
          const minH = 200;
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
    const isSentenceOrPara = type === 'sentence' || type === 'paragraph';
    const clean = text.trim();
    const headingHtml = isSentenceOrPara
      ? `<span class="lf-heading-sentence">${type === 'paragraph' ? 'Paragraph Intelligence' : 'Sentence Analysis'}</span>`
      : `<span class="lf-heading-word" title="${escapeHtml(clean)}">${escapeHtml(clean)}</span>`;

    const langConfig = getLanguageConfig(this.targetLanguage);
    const nativeHeader = langConfig?.targetNativeHeader || 'সহজ বাংলা';
    const nativeLabel = langConfig?.targetNativeLabel || 'বাংলা';

    const tabsHtml = isSentenceOrPara
      ? `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">🧩 Breakdown</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">✨ Ask AI</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">🔍 Grammar</button>
        </div>
      `
      : `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">📖 Meaning</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">✨ Ask AI</button>
          <button type="button" class="lf-tab" tabindex="-1" style="opacity: 0.5;">📚 Deep Dive</button>
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
              📖 Easy English:
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
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">✕</button>
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
    const headingHtml = clean.length > 35
      ? `${escapeHtml(clean.slice(0, 32))}...`
      : escapeHtml(clean);

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-heading-word" title="${escapeHtml(clean)}">${headingHtml}</span>
          <span class="lf-pos" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">ERROR</span>
        </div>
        <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">✕</button>
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
      badgeEl.textContent = '✨ AI-generated';
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
          contextualSenseId: 'sense_1'
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
          partOfSpeech: 'phrase',
          easyEnglish: p.simpleEnglishExplanation || p.overallMeaning || 'Phrase meaning',
          easyBengali: p.bengaliTranslation || 'বাংলা অর্থ',
          contextMeaning: p.whyFitsContext || p.overallMeaning || 'Meaning in this sentence.',
          example: p.examples?.[0],
          confidence: 'high',
          contextualSenseId: 'sense_1'
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

  private render(options?: { preserveScroll?: boolean; scrollToAskAI?: boolean }): void {
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
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Pronounce word / উচ্চারণ শুনুন" aria-label="Listen pronunciation" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; font-size: 13px; margin: 0 2px;">🔊</button>
          <span class="lf-pos" title="${escapeHtml(rawPos)}">${escapeHtml(displayPos)}</span>
        </div>
        <div class="lf-actions-top">
          <button class="lf-btn-icon lf-zoom-btn" title="Text size: ${this.currentSize.toUpperCase()} (Click to toggle larger text / চোখের আরাম)" aria-label="Toggle text size">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.5px;">A<sup>+</sup></span>
          </button>
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">📌</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy text" aria-label="Copy text">📋</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">✕</button>
        </div>
      </div>

      <!-- Native Segmented Control -->
      <div class="lf-tabs" role="tablist">
        <button type="button" class="lf-tab ${this.activeTab === 'meaning' ? 'active' : ''}" data-tab="meaning">
          📖 Meaning
        </button>
        <button type="button" class="lf-tab ${this.activeTab === 'ask-ai' ? 'active' : ''}" data-tab="ask-ai">
          ✨ Ask AI
        </button>
        <button type="button" class="lf-tab ${this.activeTab === 'details' ? 'active' : ''}" data-tab="details">
          📚 Deep Dive ${bCount ? `(${bCount})` : ''}
        </button>
      </div>

      <div class="lf-content" id="lf-main-content">
        ${this.activeTab === 'meaning' ? `
          <!-- 1. Easy English First -->
          <div class="lf-def-item" style="margin-bottom: 8px;">
            <div class="lf-section-sublabel" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 2px;">
              📖 Easy English:
            </div>
            <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 16px); line-height: 1.45; font-weight: 500;">
              ${escapeHtml(a.easyEnglish)}
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
              💡 In this sentence:
            </div>
            <div class="lf-context-text" style="font-size: var(--lf-font-context, 15px); line-height: 1.45;">
              ${escapeHtml(a.contextMeaning)}
            </div>
          </div>

          <!-- 4. Natural Example -->
          <div class="lf-example-box" style="margin-bottom: 8px; padding-left: 8px; border-left: 2px solid rgba(0, 113, 227, 0.4); font-size: var(--lf-font-example, 14px); font-style: italic; display: ${a.example ? 'block' : 'none'};">
            <span class="lf-example-text">"${escapeHtml(a.example || '')}"</span>
            <div class="lf-example-bengali" style="font-style: normal; font-size: var(--lf-font-context, 13px); margin-top: 2px; display: ${a.exampleBengali ? 'block' : 'none'};">(${escapeHtml(a.exampleBengali || '')})</div>
          </div>

          <!-- 5. Quick AI Instant Actions -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>✨ Ask AI Quick Actions:</span>
            </div>
            <div class="lf-quick-ai-chips">
              <button type="button" class="lf-quick-chip" data-prompt="Explain this word in super simple terms like I'm 5 years old">
                <span>💡</span><span>Like I'm 5</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="What is the subtle difference between this word and its common synonyms?">
                <span>🔍</span><span>Nuance vs Synonyms</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="How do native English speakers naturally use this in everyday conversation?">
                <span>🗣️</span><span>Daily Native Usage</span>
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
              <span class="lf-ai-badge">${isVerifiedDict ? '📖 Verified Lexicon' : '✨ AI-generated'}</span>
              <span class="lf-confidence-pill ${a.confidence}">Confidence: ${escapeHtml(a.confidence)}</span>
            </div>
            <button class="lf-machine-voice-btn" title="Machine-synthesized text-to-speech" aria-label="Listen with machine speech synthesis">
              Machine voice 🔊
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
        ${this.showFeedbackModal ? this.renderFeedbackForm(a.selectedText) : ''}
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
            ${(this.activeTab === 'details' || this.isExpanded) ? '▲ Overview' : '📖 Meanings'}
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI follow-up" aria-label="Ask AI">
            💬 Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            🚩 Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">
            ${this.isSaved ? '✓ Saved' : '+ Save'}
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

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          <span class="lf-heading-sentence">Sentence Analysis</span>
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Listen to sentence / বাক্যটি শুনুন" aria-label="Listen to sentence" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; font-size: 13px; margin: 0 2px;">🔊</button>
          <span class="lf-pos">SENTENCE</span>
        </div>
        <div class="lf-actions-top">
          <button class="lf-btn-icon lf-zoom-btn" title="Text size: ${this.currentSize.toUpperCase()} (Click to toggle larger text / চোখের আরাম)" aria-label="Toggle text size">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.5px;">A<sup>+</sup></span>
          </button>
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">📌</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy sentence text" aria-label="Copy sentence text">📋</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">✕</button>
        </div>
      </div>

      <!-- Native Segmented Control -->
      <div class="lf-tabs" role="tablist">
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'breakdown' ? 'active' : ''}" data-tab="breakdown">
          📝 Sentence
        </button>
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'ask-ai' ? 'active' : ''}" data-tab="ask-ai">
          ✨ Ask AI
        </button>
        <button type="button" class="lf-tab ${this.activeSentenceTab === 'grammar' ? 'active' : ''}" data-tab="grammar">
          🧩 Grammar & Clauses
        </button>
      </div>

      <div class="lf-content" id="lf-main-content">
        ${this.activeSentenceTab === 'breakdown' ? `
          <!-- A. Original Text -->
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>📝 Original Text:</span>
              ${isLongSentence ? `
                <button class="lf-text-toggle-btn" id="lf-sentence-text-toggle">
                  ${this.isSentenceExpanded ? 'Show less' : 'Show full'}
                </button>
              ` : ''}
            </div>
            <div class="lf-sentence-text ${!this.isSentenceExpanded && isLongSentence ? 'truncated' : ''}">
              ${this.renderInteractiveSentence(s.selectedText)}
            </div>
            <div class="lf-sentence-hint">
              💡 Click any word in the text to inspect its contextual meaning
            </div>
          </div>

          <!-- B. Phrase-by-Phrase Explanation -->
          ${this.renderPhraseBreakdownHtml(phrases)}

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
                💡 English Summary:
              </div>
              <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 15px); line-height: 1.45; font-weight: 500;">
                ${escapeHtml(s.plainEnglishParaphrase || s.overallMeaning)}
              </div>
            </div>
          ` : ''}

          <!-- Quick AI Prompt Chips for Sentence -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>✨ Ask AI Quick Actions:</span>
            </div>
            <div class="lf-quick-ai-chips">
              <button type="button" class="lf-quick-chip" data-prompt="Break down the core message in super easy everyday English">
                <span>💡</span><span>Explain simply</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="Explain the grammatical structure and rhetorical tone used here">
                <span>🧩</span><span>Grammar & Tone</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="How would a native speaker rephrase this in casual speech or friendly email?">
                <span>🗣️</span><span>Conversational</span>
              </button>
              <button type="button" class="lf-quick-chip" data-prompt="Explain the deeper meaning of this statement in ${escapeHtml(langConfig.targetLabel)}">
                <span style="font-size: 10px; font-weight: 700; color: #0071e3;">${escapeHtml(langConfig.targetNativeLabel)}</span><span>${escapeHtml(langConfig.targetNativeHeader)}</span>
              </button>
            </div>
          </div>

          <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 0, 0, 0.08);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="lf-ai-badge">✨ AI-generated</span>
              ${s.toneAndRegister ? `
                <span class="lf-confidence-pill high" style="background: rgba(0, 113, 227, 0.12); color: #0071e3;">${escapeHtml(s.toneAndRegister)}</span>
              ` : ''}
            </div>
            <button class="lf-machine-voice-btn" title="Read sentence aloud with speech synthesis" aria-label="Listen to sentence">
              Machine voice 🔊
            </button>
          </div>

          <!-- Inline Ask AI Follow-Up Panel (legacy toggle) -->
          ${this.showAskAI ? this.renderAskAIPanel('sentence', s.selectedText) : ''}

          <!-- Compatibility Container for Detailed Sentence Breakdown -->
          <div id="lf-sentence-expanded-section" role="region" aria-label="Detailed Sentence Breakdown" style="display: ${this.isSentenceAnalysisExpanded ? 'block' : 'none'};">
            ${this.renderSentenceAnalysisDetails(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'ask-ai' ? `
          ${this.renderAskAIPanel('sentence', s.selectedText)}
          <div id="lf-sentence-expanded-section" style="display: none;"></div>
        ` : ''}

        ${this.activeSentenceTab === 'grammar' ? `
          <div id="lf-sentence-expanded-section" role="region" aria-label="Detailed Sentence Breakdown" style="display: block;">
            ${this.renderSentenceAnalysisDetails(s)}
          </div>
        ` : ''}

        <!-- Inline Report Form across all sentence tabs -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(s.selectedText) : ''}
      </div>

      <div class="lf-footer">
        <div class="lf-footer-left">
          <button
            class="lf-btn-action secondary lf-sentence-expand-btn"
            id="lf-sentence-expand-toggle"
            aria-expanded="${this.activeSentenceTab === 'grammar' || this.isSentenceAnalysisExpanded}"
            aria-controls="lf-sentence-expanded-section"
            title="Toggle grammar structure and syntax breakdown"
          >
            ${(this.activeSentenceTab === 'grammar' || this.isSentenceAnalysisExpanded) ? '▲ Sentence' : '🧩 Grammar'}
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI about this sentence" aria-label="Ask AI">
            💬 Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            🚩 Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">
            ${this.isSaved ? '✓ Saved' : '+ Save'}
          </button>
        </div>
      </div>
    `;

    this.bindEventsSentence(s);
  }

  private renderParagraphView(p: ParagraphAnalysisResult): void {
    const isLongText = p.selectedText.length > 200;
    const langConfig = getLanguageConfig(this.targetLanguage);
    const phrases = this.ensurePhraseBreakdown(
      p.selectedText,
      p.phraseBreakdown,
      undefined,
      p.bengaliTranslation
    );

    this.element.innerHTML = `
      <div class="lf-header">
        <div class="lf-title-row">
          <span class="lf-drag-indicator" title="Drag to reposition">⠿</span>
          <span class="lf-heading-sentence">Paragraph Intelligence</span>
          <button type="button" class="lf-btn-icon lf-voice-btn" title="Listen to paragraph / প্যারাগ্রাফটি শুনুন" aria-label="Listen to paragraph" style="width: 26px; height: 26px; min-width: 26px; min-height: 26px; font-size: 13px; margin: 0 2px;">🔊</button>
          <span class="lf-pos">PARAGRAPH</span>
        </div>
        <div class="lf-actions-top">
          <button class="lf-btn-icon lf-zoom-btn" title="Text size: ${this.currentSize.toUpperCase()} (Click to toggle larger text / চোখের আরাম)" aria-label="Toggle text size">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.5px;">A<sup>+</sup></span>
          </button>
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}" aria-label="Pin popup">📌</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy paragraph text" aria-label="Copy paragraph text">📋</button>
          <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">✕</button>
        </div>
      </div>

      <div class="lf-content" id="lf-main-content">
        <!-- A. Original Text -->
        <div class="lf-sentence-card">
          <div class="lf-section-label">
            <span>📝 Original Text:</span>
            ${isLongText ? `
              <button class="lf-text-toggle-btn" id="lf-para-text-toggle">
                ${this.isSentenceExpanded ? 'Show less' : 'Show full'}
              </button>
            ` : ''}
          </div>
          <div class="lf-sentence-text ${!this.isSentenceExpanded && isLongText ? 'truncated' : ''}">
            ${this.renderInteractiveSentence(p.selectedText)}
          </div>
          <div class="lf-sentence-hint">
            💡 Click any word in the text to inspect its contextual meaning
          </div>
        </div>

        <!-- B. Phrase-by-Phrase Explanation -->
        ${this.renderPhraseBreakdownHtml(phrases)}

        <!-- C. Full Target Language -->
        <div class="lf-bengali-box" style="margin-bottom: 12px; padding: 10px 12px; border-radius: 8px;">
          <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; margin-bottom: 3px;">
            ${langConfig.targetLang === 'bn' ? '🇧🇩 সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)} (${escapeHtml(langConfig.targetLabel)}):`}
          </div>
          <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 700; line-height: 1.45;">
            ${escapeHtml(p.bengaliTranslation || `${langConfig.targetNativeHeader}...`)}
          </div>
        </div>

        <!-- Optional Main Idea & Summary -->
        ${(p.mainIdea || p.conciseSummary) ? `
          <div class="lf-def-item" style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px;">
            <div class="lf-section-sublabel" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
              💡 Main Idea:
            </div>
            <div class="lf-easy-english-text" style="font-size: var(--lf-font-english, 15px); line-height: 1.45; font-weight: 500;">
              ${escapeHtml(p.mainIdea || p.conciseSummary)}
            </div>
          </div>
        ` : ''}

        <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0, 0, 0, 0.08);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="lf-ai-badge">✨ AI-generated</span>
            ${p.toneAndRegister ? `
              <span class="lf-confidence-pill high" style="background: rgba(10, 132, 255, 0.14); color: #0a84ff;">${escapeHtml(p.toneAndRegister)}</span>
            ` : ''}
          </div>
          <button class="lf-machine-voice-btn" title="Read paragraph aloud with speech synthesis" aria-label="Listen to paragraph">
            Machine voice 🔊
          </button>
        </div>

        <!-- Inline Ask AI Follow-Up Panel -->
        ${this.showAskAI ? this.renderAskAIPanel('paragraph', p.selectedText) : ''}

        <!-- Inline Report Form -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(p.selectedText) : ''}

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
            ${this.isSentenceAnalysisExpanded ? '▲ Summary' : '📑 Key Terms'}
          </button>
          <button type="button" class="lf-btn-action secondary lf-qa-toggle-btn" title="Ask AI about this paragraph" aria-label="Ask AI">
            💬 Ask AI
          </button>
        </div>
        <div class="lf-footer-right">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            🚩 Report
          </button>
          <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">
            ${this.isSaved ? '✓ Saved' : '+ Save'}
          </button>
        </div>
      </div>
    `;

    this.bindEventsParagraph(p);
  }

  private renderPhraseBreakdownHtml(phrases: PhraseExplanation[]): string {
    const langConfig = getLanguageConfig(this.targetLanguage);
    return `
      <!-- B. Phrase-by-Phrase Explanation -->
      <div class="lf-phrase-breakdown-section">
        <div class="lf-section-label" style="color: #0a84ff; margin-bottom: 6px;">
          <span>🔍 Phrase-by-Phrase Explanation (${phrases.length}):</span>
        </div>
        <div class="lf-phrases-list">
          ${phrases.map((item, idx) => `
            <div class="lf-phrase-item">
              <div class="lf-phrase-orig">
                <span class="lf-phrase-num">#${idx + 1}</span>
                <strong>"${escapeHtml(item.phrase)}"</strong>
              </div>
              <div class="lf-phrase-field lf-phrase-english">
                <span class="lf-field-label">📖 Easy English:</span>
                <span>${escapeHtml(item.easyEnglish)}</span>
              </div>
              <div class="lf-phrase-field lf-phrase-bengali">
                <span class="lf-field-label">${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)}:</span>
                <span>${escapeHtml(item.easyBengali)}</span>
              </div>
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

    if (clauses && clauses.length > 0) {
      return clauses.map((c) => ({
        phrase: c.text,
        easyEnglish: c.role ? `Acts as the ${c.role.toLowerCase()} of the statement.` : 'Key clause conveying a central thought.',
        easyBengali: c.explanationBengali || defaultBengali || 'বাক্যের প্রধান অর্থবহ খণ্ডবাক্য।'
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
            easyBengali: 'প্রাসঙ্গিক অর্থবহ ভাব ও বক্তব্য।'
          });
        }
        if (chunk2) {
          phrases.push({
            phrase: chunk2,
            easyEnglish: `Part stating: "${chunk2}".`,
            easyBengali: 'প্রাসঙ্গিক ভাবার্থ ও মূল বক্তব্য।'
          });
        }
      } else {
        phrases.push({
          phrase: part,
          easyEnglish: `Phrase conveying: "${part}".`,
          easyBengali: 'প্রাসঙ্গিক ভাবার্থ ও মূল অর্থ।'
        });
      }
    }

    if (phrases.length === 0) {
      phrases.push({
        phrase: text.trim(),
        easyEnglish: 'This statement conveys a complete idea clearly.',
        easyBengali: defaultBengali || 'সম্পূর্ণ বক্তব্য বা ভাবার্থ।'
      });
    }

    return phrases;
  }

  private renderInteractiveSentence(sentence: string): string {
    const tokens = sentence.split(/(\s+|[.,;:"'!?()[\]{}]+)/g);
    return tokens.map((token) => {
      if (/^\s+$/.test(token) || /^[.,;:"'!?()[\]{}]+$/.test(token)) {
        return escapeHtml(token);
      }
      const cleanWord = token.replace(/^[^\w]+|[^\w]+$/g, '');
      if (!cleanWord) return escapeHtml(token);
      return `<span class="lf-sentence-word" data-word="${escapeHtml(cleanWord)}" title="Inspect &quot;${escapeHtml(cleanWord)}&quot;">${escapeHtml(token)}</span>`;
    }).join('');
  }

  private renderSentenceAnalysisDetails(s: SentenceAnalysisResult): string {
    const vocab = s.difficultVocabulary || [];
    const clauses = s.clauses || [];
    const highlights = s.grammaticalHighlights || [];

    return `
      <div style="margin-top: 10px; padding-top: 10px; border-top: 0.5px solid rgba(0, 0, 0, 0.08);">
        <!-- Difficult Words & Useful Vocabulary -->
        ${vocab.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 11.5px; color: #0071e3; text-transform: uppercase; display: block; margin-bottom: 6px;">
              🔍 Difficult Words & Key Terms (${vocab.length}):
            </strong>
            ${vocab.map((item) => `
              <div class="lf-vocab-item">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                  <button class="lf-vocab-chip-btn" data-word="${escapeHtml(item.word)}" title="Analyze &quot;${escapeHtml(item.word)}&quot; in context">
                    ${escapeHtml(item.word)} ↗
                  </button>
                  <span class="lf-vocab-bengali" style="font-size: 11.5px; font-weight: 600;">${escapeHtml(item.bengali || '')}</span>
                </div>
                <div class="lf-vocab-meaning" style="font-size: 12.5px; line-height: 1.4;">
                  ${escapeHtml(item.meaningInContext || 'Contextual meaning in this sentence.')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Syntactic Clauses -->
        ${clauses.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong class="lf-syntactic-title" style="font-size: 11.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">
              🧩 Syntactic Structure (${clauses.length} clauses):
            </strong>
            ${clauses.map((c) => `
              <div class="lf-clause-item">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                  <span class="lf-pos" style="font-size: 9.5px; padding: 1px 5px;">${escapeHtml((c.type || 'Clause').toUpperCase())}</span>
                  <span class="lf-clause-role" style="font-size: 11px; font-weight: 600;">${escapeHtml(c.role || 'Role')}</span>
                </div>
                <div class="lf-clause-text" style="font-size: 12.5px; font-style: italic; margin-bottom: 2px;">
                  "${escapeHtml(c.text)}"
                </div>
                ${c.explanationBengali ? `
                  <div class="lf-clause-bengali" style="font-size: 11.5px;">
                    ${escapeHtml(c.explanationBengali)}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Grammatical Highlights -->
        ${highlights.length > 0 ? `
          <div style="margin-bottom: 10px;">
            <strong style="font-size: 11.5px; color: #6e6e73; text-transform: uppercase; display: block; margin-bottom: 4px;">
              💡 Grammatical Highlights:
            </strong>
            <ul style="padding-left: 16px; margin: 0; font-size: 12px; color: #424245; line-height: 1.5;">
              ${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
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
              ${sentences.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
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
                  ${escapeHtml(item.meaning || 'Meaning in paragraph context.')}
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
              ${escapeHtml(p.argumentStructure)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderAskAIPanel(targetMode: 'word' | 'sentence' | 'paragraph', focusText?: string): string {
    const isWord = targetMode === 'word';
    const displayFocus = focusText ? (focusText.length > 32 ? focusText.slice(0, 29) + '...' : focusText) : '';

    const wordChips = [
      { emoji: '💡', label: "Explain like I'm 5", prompt: "Explain this word in super simple terms like I'm 5 years old" },
      { emoji: '🔍', label: "Nuance vs Synonyms", prompt: "What is the subtle difference between this word and its common synonyms?" },
      { emoji: '🗣️', label: "Native Daily Usage", prompt: "How do native English speakers naturally use this in everyday conversation?" },
      { emoji: '✍️', label: "2 Real Examples", prompt: "Give me 2 practical, everyday example sentences with Bengali translation" },
      { emoji: '🇧🇩', label: "সহজ বাংলায় বিশদ", prompt: "এই শব্দের সূক্ষ্ম অর্থ ও ব্যবহার সহজ বাংলায় বিস্তারিত বুঝিয়ে দাও" },
      { emoji: '⚠️', label: "Common Pitfalls", prompt: "What are the most common mistakes learners make with this word?" }
    ];

    const sentenceChips = [
      { emoji: '💡', label: "Explain simply", prompt: "Break down the core message in super easy everyday English" },
      { emoji: '🧩', label: "Grammar & Tone", prompt: "Explain the grammatical structure and rhetorical tone used here" },
      { emoji: '🗣️', label: "Conversational Rewrite", prompt: "How would a native speaker rephrase this in casual speech or friendly email?" },
      { emoji: '🇧🇩', label: "সহজ বাংলা ভাবার্থ", prompt: "এই বক্তব্যটির অন্তর্নিহিত ভাব ও তাৎপর্য সহজ বাংলায় বুঝিয়ে দাও" },
      { emoji: '✍️', label: "Practice Variation", prompt: "Give me a similar sentence with this same structure to practice with" },
      { emoji: '❓', label: "Why this phrasing?", prompt: "Why did the author use this specific phrasing instead of simpler words?" }
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
            <span class="lf-qa-avatar-icon">✨</span>
            <span class="lf-qa-title">LexiFlow AI Coach</span>
            ${displayFocus ? `<span class="lf-qa-focus-tag" title="${escapeHtml(focusText || '')}">Focus: "${escapeHtml(displayFocus)}"</span>` : ''}
          </div>
          <div class="lf-qa-controls">
            ${this.followUpList.length > 0 ? `
              <button type="button" class="lf-qa-mini-btn lf-qa-clear-btn" title="Clear conversation history">🗑️ Clear</button>
            ` : ''}
            <button type="button" class="lf-btn-icon lf-qa-close-panel-btn" title="Close Ask AI panel" aria-label="Close Ask AI">✕</button>
          </div>
        </div>

        <!-- Quick Prompt Chips -->
        <div class="lf-qa-chips-row">
          ${activeChips.map((c) => `
            <button type="button" class="lf-qa-chip" data-prompt="${escapeHtml(c.prompt)}" title="${escapeHtml(c.prompt)}">
              <span>${c.emoji}</span>
              <span>${escapeHtml(c.label)}</span>
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
            <span>➤</span>
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
            ${synonyms.slice(0, 3).map((s) => `<span class="lf-synonym-tag" title="${escapeHtml(s.easyEnglish)}">${escapeHtml(s.word)}</span>`).join('')}
          </div>
        ` : ''}
        ${collocations.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-left: 4px;">
            <span class="lf-preview-label">Collocations:</span>
            ${collocations.slice(0, 2).map((c) => `<span class="lf-synonym-tag">${escapeHtml(c.english)}</span>`).join('')}
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
              ${escapeHtml(s.easyEnglish)}
            </div>
            <div class="lf-bengali-meaning" style="font-size: var(--lf-font-bengali, 17.5px); color: #0071e3; font-weight: 600; line-height: 1.5; margin-top: 3px;">
              ${escapeHtml(s.easyBengali)}
            </div>

            <!-- Sense Examples -->
            ${(s.examples || []).map((ex) => `
              <div class="lf-sense-example" style="margin-top: 5px; padding-left: 8px; border-left: 2px solid rgba(0, 113, 227, 0.35); font-size: var(--lf-font-example, 14px); color: #6e6e73; font-style: italic; line-height: 1.45;">
                "${escapeHtml(ex.english)}"
                ${ex.bengali ? `<span style="font-style: normal; color: #86868b; margin-left: 4px;">(${escapeHtml(ex.bengali)})</span>` : ''}
              </div>
            `).join('')}

            <!-- Synonyms -->
            ${s.synonyms && s.synonyms.length > 0 ? `
              <div class="lf-synonyms-row" style="margin-top: 7px; font-size: var(--lf-font-base, 13.5px);">
                <span style="color: #6e6e73; font-weight: 600;">Synonyms:</span>
                ${s.synonyms.map((syn) => `<span class="lf-synonym-tag" style="font-size: var(--lf-font-chip, 12.5px);" title="${escapeHtml(syn.easyEnglish)} (${escapeHtml(syn.easyBengali)})">${escapeHtml(syn.word)}</span>`).join(' ')}
              </div>
            ` : ''}

            <!-- Antonyms -->
            ${s.antonyms && s.antonyms.length > 0 ? `
              <div class="lf-antonyms-row" style="margin-top: 5px; font-size: var(--lf-font-base, 13.5px);">
                <span style="color: #6e6e73; font-weight: 600;">Opposites:</span>
                ${s.antonyms.map((ant) => `<span class="lf-synonym-tag" style="background: rgba(239, 68, 68, 0.08); color: #dc2626; font-size: var(--lf-font-chip, 12.5px);" title="${escapeHtml(ant.easyEnglish)}">${escapeHtml(ant.word)}</span>`).join(' ')}
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
              ${b.collocations.map((c) => `<span class="lf-synonym-tag" style="font-size: var(--lf-font-chip, 12.5px);">${escapeHtml(c.english)}${c.bengali ? ` (${escapeHtml(c.bengali)})` : ''}</span>`).join('')}
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
                  <span style="color: #0071e3; font-weight: 600;">${escapeHtml(ip.phrase)}</span> &mdash; ${escapeHtml(ip.easyEnglish)} <em>(${escapeHtml(ip.easyBengali)})</em>
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
                <span style="color: #e8890c; font-weight: 600;">${escapeHtml(cw.word)}</span>: ${escapeHtml(cw.difference)}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderFeedbackForm(selectedText: string): string {
    if (this.feedbackSuccess) {
      return `
        <div class="lf-feedback-box" style="background: rgba(16, 185, 129, 0.15); border-color: #10b981;">
          <div style="font-size: 12.5px; color: #34d399; font-weight: 600;">
            ✓ Report saved locally. Thank you for your feedback!
          </div>
        </div>
      `;
    }

    return `
      <div class="lf-feedback-box">
        <div style="font-size: 12px; font-weight: 700; color: #f87171; margin-bottom: 6px;">
          Report Issue with "${escapeHtml(selectedText)}"
        </div>
        <select class="lf-feedback-reason" style="width: 100%; border: 0.5px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 4px; font-size: 12px; margin-bottom: 6px;">
          <option value="wrong_context_meaning">Wrong meaning for this context</option>
          <option value="incorrect_bengali">Incorrect Bengali translation</option>
          <option value="complicated_english">English explanation is too complicated</option>
          <option value="fabricated_antonym">Invalid or inaccurate antonym</option>
          <option value="other">Other issue</option>
        </select>
        <textarea class="lf-feedback-note" placeholder="Optional details..." rows="2" style="width: 100%; border: 0.5px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 4px; font-size: 11.5px; margin-bottom: 6px; resize: none;"></textarea>
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
            ${escapeHtml(f.question)}
          </div>

          <!-- LexiFlow AI Response Bubble -->
          <div class="lf-chat-ai">
            <div class="lf-ai-header-pill">
              <span class="lf-qa-avatar-icon" style="width: 14px; height: 14px; font-size: 8px;">✨</span>
              <span>LexiFlow AI Tutor</span>
            </div>

            <!-- Key Takeaway Pill if present -->
            ${f.keyTakeaway ? `
              <div class="lf-qa-takeaway-box">
                <span class="lf-qa-takeaway-label">💡 Key Takeaway:</span>
                <span>${escapeHtml(f.keyTakeaway)}</span>
              </div>
            ` : ''}

            <!-- Main Answer with formatted markdown -->
            <div class="lf-qa-body-text">
              ${this.formatClaudeMessage(f.answer)}
            </div>

            <!-- Warm Bengali Insight Card -->
            ${f.bengaliSummary ? `
              <div class="lf-qa-bengali-card">
                <div class="lf-qa-bengali-label">🇧🇩 সহজ বাংলা সারসংক্ষেপ:</div>
                <div class="lf-qa-bengali-text">${escapeHtml(f.bengaliSummary)}</div>
              </div>
            ` : ''}

            <!-- Practical Examples if present -->
            ${f.examples && f.examples.length > 0 ? `
              <div class="lf-qa-examples-box">
                <div style="font-size: 10.5px; font-weight: 700; color: #a855f7; text-transform: uppercase; margin-bottom: 4px;">
                  ✍️ Practical Usage:
                </div>
                ${f.examples.map((ex) => `
                  <div class="lf-qa-example-item">
                    <div>"${escapeHtml(ex.english)}"</div>
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
                📋 Copy
              </button>
              <button
                type="button"
                class="lf-qa-mini-btn lf-qa-speak-btn"
                data-speak="${escapeHtml(f.answer)}"
                title="Listen to explanation"
              >
                🔊 Listen
              </button>
            </div>

            <!-- Suggested Next Questions (Dynamic Chips) -->
            ${f.suggestedFollowUps && f.suggestedFollowUps.length > 0 ? `
              <div class="lf-qa-suggested-box">
                <div class="lf-qa-suggested-title">
                  <span>✨</span>
                  <span>Explore further with LexiFlow AI:</span>
                </div>
                <div class="lf-qa-suggested-chips">
                  ${f.suggestedFollowUps.map((sug) => `
                    <button type="button" class="lf-qa-suggested-chip" data-prompt="${escapeHtml(sug)}" title="${escapeHtml(sug)}">
                      <span>💬</span>
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

  private formatClaudeMessage(rawText: string): string {
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

    return formatted;
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
          <button class="lf-btn-icon lf-zoom-btn" title="Text size: ${this.currentSize.toUpperCase()} (Click to toggle larger text / চোখের আরাম)" aria-label="Toggle text size">
            <span style="font-weight: 800; font-size: 11px; letter-spacing: -0.5px;">A<sup>+</sup></span>
          </button>
          <button class="lf-btn-icon lf-pin-btn ${this.isPinned ? 'active' : ''}" title="${this.isPinned ? 'Unpin popup' : 'Pin popup'}">📌</button>
          <button class="lf-btn-icon lf-copy-btn" title="Copy text">📋</button>
          <button class="lf-btn-icon lf-close-btn" title="Close">✕</button>
        </div>
      </div>
      <div class="lf-content">
        ${isParagraph && para.mainIdea ? `
          <div style="margin-bottom: 8px; padding: 8px 10px; background: rgba(255,255,255,0.04); border-radius: 6px;">
            <div style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; color: #0a84ff; font-weight: 700; margin-bottom: 2px;">
              💡 Main Idea:
            </div>
            <div style="font-size: var(--lf-font-english, 15px); color: #f1f5f9; line-height: 1.45;">
              ${escapeHtml(para.mainIdea)}
            </div>
          </div>
        ` : ''}

        <div class="lf-bengali-box" style="margin-bottom: 8px; padding: 10px 12px; border-radius: 8px;">
          <div class="lf-bengali-box-header" style="font-size: var(--lf-font-sublabel, 12px); text-transform: uppercase; font-weight: 700; margin-bottom: 3px;">
            🇧🇩 সম্পূর্ণ বাংলা অর্থ (Full Bengali):
          </div>
          <div class="lf-easy-bengali-text" style="font-size: var(--lf-font-bengali, 18.5px); font-weight: 600; line-height: 1.45;">
            ${escapeHtml(a.bengaliTranslation)}
          </div>
        </div>
      </div>
      <div class="lf-footer">
        <div></div>
        <button class="lf-btn-action lf-save-btn ${this.isSaved ? 'saved' : ''}">${this.isSaved ? '✓ Saved' : '+ Save'}</button>
      </div>
    `;

    this.element.querySelector('.lf-zoom-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleSize();
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
      if (btn) btn.textContent = '✓';
      setTimeout(() => { if (btn) btn.textContent = '📋'; }, 1200);
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

    this.bindEventsAskAI();
  }

  private bindEventsStageA(): void {
    const el = this.element;

    el.querySelector('.lf-zoom-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleSize();
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
        if (btn) btn.textContent = '✓';
        setTimeout(() => { if (btn) btn.textContent = '📋'; }, 1200);
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

    el.querySelector('.lf-report-trigger-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = !this.showFeedbackModal;
      this.feedbackSuccess = false;
      this.render();
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      if (this.callbacks.onReportWrongMeaning && this.currentStageA) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: this.currentStageA.selectedText,
          contextSentence: this.currentContextSentence,
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
        tags: ['web-reading'],
        collection: 'Daily Reading',
        difficulty: 'medium',
        fsrs: createInitialFSRSState()
      };
      await this.callbacks.onSave(item);
      this.isSaved = true;
      this.render();
    });

    this.bindEventsAskAI();
  }

  private bindEventsSentence(s: SentenceAnalysisResult): void {
    const el = this.element;

    el.querySelector('.lf-zoom-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleSize();
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
      if (btn) btn.textContent = '✓';
      setTimeout(() => { if (btn) btn.textContent = '📋'; }, 1200);
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
        const tab = (tabBtn as HTMLElement).getAttribute('data-tab') as 'breakdown' | 'ask-ai' | 'grammar';
        if (tab) {
          this.activeSentenceTab = tab;
          if (tab === 'ask-ai') {
            this.showAskAI = true;
          } else if (tab === 'grammar') {
            this.isSentenceAnalysisExpanded = true;
          } else if (tab === 'breakdown') {
            this.isSentenceAnalysisExpanded = false;
            this.showAskAI = false;
          }
          this.render();
        }
      });
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
      if (this.activeSentenceTab === 'grammar' || this.isSentenceAnalysisExpanded) {
        this.activeSentenceTab = 'breakdown';
        this.isSentenceAnalysisExpanded = false;
        this.render();
      } else {
        this.activeSentenceTab = 'grammar';
        this.isSentenceAnalysisExpanded = true;
        this.render();
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

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      if (this.callbacks.onReportWrongMeaning) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: s.selectedText,
          contextSentence: s.selectedText,
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

    el.querySelectorAll('.lf-sentence-word').forEach((wordEl) => {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = (wordEl as HTMLElement).getAttribute('data-word');
        if (word && this.callbacks.onSelectWord) {
          this.parentSentenceAnalysis = s;
          this.callbacks.onSelectWord(word, s.selectedText);
        }
      });
    });

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

    this.bindEventsAskAI();
  }

  private bindEventsParagraph(p: ParagraphAnalysisResult): void {
    const el = this.element;

    el.querySelector('.lf-zoom-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cycleSize();
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
      if (btn) btn.textContent = '✓';
      setTimeout(() => { if (btn) btn.textContent = '📋'; }, 1200);
    });

    el.querySelectorAll('.lf-voice-btn, .lf-machine-voice-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.speakText(p.selectedText);
      });
    });

    el.querySelector('#lf-para-text-toggle')?.addEventListener('click', () => {
      this.isSentenceExpanded = !this.isSentenceExpanded;
      this.render();
    });

    el.querySelector('#lf-para-expand-toggle')?.addEventListener('click', () => {
      this.isSentenceAnalysisExpanded = !this.isSentenceAnalysisExpanded;
      this.render();
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

    el.querySelector('.lf-feedback-submit-btn')?.addEventListener('click', async () => {
      const reasonEl = el.querySelector('.lf-feedback-reason') as HTMLSelectElement;
      const noteEl = el.querySelector('.lf-feedback-note') as HTMLTextAreaElement;
      if (this.callbacks.onReportWrongMeaning) {
        const report: WrongMeaningReport = {
          id: `rep_${Date.now()}`,
          timestamp: new Date().toISOString(),
          selectedText: p.selectedText,
          contextSentence: p.selectedText,
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

    el.querySelectorAll('.lf-sentence-word').forEach((wordEl) => {
      wordEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = (wordEl as HTMLElement).getAttribute('data-word');
        if (word && this.callbacks.onSelectWord) {
          this.callbacks.onSelectWord(word, p.selectedText);
        }
      });
    });

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
