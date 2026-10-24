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
import { playPronunciation, stopPronunciation } from '../services/audio/voiceService';
import { getValidatedWhyThisMatters, findDiscourseConnectors, MatchedConnector } from '../services/connectors/matcher';
import { generateCloze } from '../services/cloze/generator';
import { getSentenceOverviewTeaching, buildBeginnerBreakdownSections } from '../services/grammar/grammarL10n';
import { decodeHtml, escapeHtml, isValidExampleTranslation, lfIcon } from './popupHtml';
import { DragResizeController } from './dragResize';
import { tagTargetLanguage } from '../shared/targetLang';
import {
  CardRenderContext,
  renderPhraseBreakdownHtml as renderPhraseBreakdownHtmlImpl,
  ensurePhraseBreakdown as ensurePhraseBreakdownImpl,
  renderDifficultVocabulary as renderDifficultVocabularyImpl,
  renderSummaryHighlights as renderSummaryHighlightsImpl,
  renderParagraphAnalysisDetails as renderParagraphAnalysisDetailsImpl,
  formatClaudeMessage as formatClaudeMessageImpl
} from './cardSections';
import {
  renderSentenceGrammarTab as renderSentenceGrammarTabImpl,
  renderSentenceClausesTab as renderSentenceClausesTabImpl
} from './sentenceTabs';

export { decodeHtml, isValidExampleTranslation, lfIcon };

type PopupSize = 'small' | 'medium' | 'large' | 'xlarge';

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
  /** Re-runs the last lookup after a failure. */
  onRetry?: () => void;
  /** The reader closed the first-use tip; it should not show again. */
  onDismissTip?: () => void;
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

  // Header dragging and edge resizing
  private dragResize: DragResizeController;

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
    this.dragResize = new DragResizeController(this.element, () => this.callbacks.onResize?.());
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
      ${this.renderTextSizeHtml()}
    `;
  }

  private loadingStepTimer: ReturnType<typeof setInterval> | null = null;

  /** Shows which step the AI is on while a lookup runs, so a slow response does not look frozen. */
  private startLoadingSteps(type: SelectionType): void {
    if (this.loadingStepTimer) clearInterval(this.loadingStepTimer);
    const lang = getLanguageConfig(this.targetLanguage);
    const lastStep = this.targetLanguage === 'en'
      ? 'Writing the simple English explanation…'
      : `Writing the ${lang?.targetLabel || 'translated'} explanation…`;
    const steps = type === 'word' || type === 'phrase'
      ? ['Reading the sentence around it…', 'Finding the meaning in this context…', lastStep]
      : ['Reading the text…', 'Breaking it into phrases…', lastStep];
    const host = this.element.querySelector('.lf-skeleton-content') || this.element.querySelector('.lf-content');
    if (!host) return;
    const line = document.createElement('div');
    line.className = 'lf-loading-step';
    line.textContent = steps[0];
    host.prepend(line);
    let i = 0;
    this.loadingStepTimer = setInterval(() => {
      if (!line.isConnected) {
        if (this.loadingStepTimer) clearInterval(this.loadingStepTimer);
        this.loadingStepTimer = null;
        return;
      }
      i = Math.min(i + 1, steps.length - 1);
      line.textContent = steps[i];
    }, 1800);
  }

  private showFirstUseTip = false;

  setFirstUseTip(show: boolean): void {
    this.showFirstUseTip = show;
    this.renderFirstUseTip();
  }

  /** Moves keyboard focus into the card (used when the reader explicitly opened it). */
  focusCard(): void {
    this.element.focus({ preventScroll: true });
  }

  /** Inserts the one-time tip at the top of the card content after each render. */
  private renderFirstUseTip(): void {
    const existing = this.element.querySelector('.lf-first-tip');
    if (!this.showFirstUseTip) {
      existing?.remove();
      return;
    }
    const host = this.element.querySelector('.lf-content:not(.lf-skeleton-content)');
    if (!host || existing) return;
    const tip = document.createElement('div');
    tip.className = 'lf-first-tip';
    tip.setAttribute('role', 'note');
    tip.innerHTML = `
      <span class="lf-first-tip-text"><strong>Tip:</strong> click any word in this card to see its meaning. Use <strong>Aa</strong> to change the text size.</span>
      <button type="button" class="lf-first-tip-close" aria-label="Dismiss tip">${lfIcon('close')}</button>
    `;
    host.prepend(tip);
  }

  /** English text, with the Bengali gloss appended only for Bengali readers. */
  private bilingual(en: string, bn: string): string {
    return this.targetLanguage === 'bn' ? `${en} / ${bn}` : en;
  }

  private renderRetryHtml(): string {
    if (!this.callbacks.onRetry) return '';
    return `<button type="button" class="lf-retry-btn">${lfIcon('refresh')}<span>Try again</span></button>`;
  }

  /** Tab and Shift+Tab cycle through the card's controls instead of leaving it for the page. */
  private keepFocusInside(e: KeyboardEvent): void {
    const focusable = Array.from(this.element.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])'
    )).filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0);
    if (!focusable.length) return;
    const root = this.element.getRootNode() as Document | ShadowRoot;
    const current = (root.activeElement as HTMLElement | null) || null;
    const i = current ? focusable.indexOf(current) : -1;
    const next = e.shiftKey
      ? (i <= 0 ? focusable[focusable.length - 1] : null)
      : (i === focusable.length - 1 || i === -1 ? focusable[0] : null);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  /** Gives every segmented control tab semantics and roving focus so it works from the keyboard. */
  private enhanceTabAccessibility(): void {
    this.element.querySelectorAll<HTMLElement>('.lf-tabs, .lf-para-tabs').forEach((list) => {
      if (list.getAttribute('aria-hidden') === 'true') return;
      list.setAttribute('role', 'tablist');
      const tabs = Array.from(list.querySelectorAll<HTMLElement>('.lf-tab'));
      const hasActive = tabs.some((t) => t.classList.contains('active'));
      tabs.forEach((tab, i) => {
        const selected = tab.classList.contains('active') || (!hasActive && i === 0);
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
        tab.tabIndex = selected ? 0 : -1;
      });
    });
  }

  /** Wraps secondary detail in a fold: collapsed in Quick mode, open in Learn mode. */
  private renderMoreDetails(innerHtml: string): string {
    if (!innerHtml.trim()) return '';
    return `
      <details class="lf-more-details" ${this.readingMode === 'learn' ? 'open' : ''}>
        <summary class="lf-more-summary">More details</summary>
        <div class="lf-more-body">${innerHtml}</div>
      </details>
    `;
  }

  private renderTextSizeHtml(): string {
    const options: Array<{ size: PopupSize; label: string }> = [
      { size: 'small', label: 'Small' },
      { size: 'medium', label: 'Medium' },
      { size: 'large', label: 'Large' },
      { size: 'xlarge', label: 'Extra large' }
    ];
    return `
      <span class="lf-textsize-wrap">
        <button type="button" class="lf-btn-icon lf-textsize-btn" title="Text size" aria-label="Text size" aria-haspopup="true" aria-expanded="false">
          <span class="lf-textsize-glyph" aria-hidden="true">Aa</span>
        </button>
        <span class="lf-textsize-menu" role="menu" aria-label="Text size" hidden>
          <span class="lf-textsize-title">Text size</span>
          ${options.map((o, i) => `
            <button type="button" role="menuitemradio" class="lf-textsize-opt ${this.currentSize === o.size ? 'active' : ''}" data-size="${o.size}" aria-checked="${this.currentSize === o.size}">
              <span class="lf-textsize-sample" style="font-size: ${11 + i * 2.5}px;" aria-hidden="true">A</span>
              <span>${o.label}</span>
            </button>
          `).join('')}
        </span>
      </span>
    `;
  }

  private setTextSizeMenuOpen(open: boolean): void {
    const menu = this.element.querySelector('.lf-textsize-menu') as HTMLElement | null;
    const btn = this.element.querySelector('.lf-textsize-btn') as HTMLElement | null;
    if (!menu || !btn) return;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) (menu.querySelector('.lf-textsize-opt.active') as HTMLElement | null)?.focus();
  }

  private applyTextSizeChoice(size: PopupSize): void {
    this.setSize(size);
    this.element.querySelectorAll<HTMLElement>('.lf-textsize-opt').forEach((opt) => {
      const active = opt.dataset.size === size;
      opt.classList.toggle('active', active);
      opt.setAttribute('aria-checked', String(active));
    });
    this.callbacks.onResize?.();
    this.callbacks.onUpdateSettings?.({ popupSize: size });
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
    const sizes: PopupSize[] = ['small', 'medium', 'large', 'xlarge'];
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
    return this.dragResize.isUserDragged;
  }

  resetDrag(): void {
    this.dragResize.finishDrag();
    this.dragResize.finishResize();
    this.dragResize.isUserDragged = false;
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

    // Text size menu and long-list disclosure (delegated: headers and lists are re-rendered often)
    this.element.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.lf-retry-btn')) {
        this.callbacks.onRetry?.();
        return;
      }
      if (target?.closest('.lf-first-tip-close')) {
        this.showFirstUseTip = false;
        this.renderFirstUseTip();
        this.callbacks.onDismissTip?.();
        return;
      }
      if (target?.closest('.lf-textsize-btn')) {
        const menu = this.element.querySelector('.lf-textsize-menu') as HTMLElement | null;
        this.setTextSizeMenuOpen(Boolean(menu?.hidden));
        return;
      }
      const opt = target?.closest('.lf-textsize-opt') as HTMLElement | null;
      if (opt?.dataset.size) {
        this.applyTextSizeChoice(opt.dataset.size as PopupSize);
        this.setTextSizeMenuOpen(false);
        (this.element.querySelector('.lf-textsize-btn') as HTMLElement | null)?.focus();
        return;
      }
      if (!target?.closest('.lf-textsize-menu')) {
        this.setTextSizeMenuOpen(false);
      }
      const moreBtn = target?.closest('.lf-phrases-more') as HTMLElement | null;
      if (moreBtn) {
        const list = moreBtn.previousElementSibling as HTMLElement | null;
        const collapsed = list?.classList.toggle('is-collapsed');
        moreBtn.setAttribute('aria-expanded', String(!collapsed));
        moreBtn.textContent = collapsed ? moreBtn.dataset.moreLabel || 'Show all' : 'Show fewer';
      }
    });

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
      if (e.key === 'Tab') {
        this.keepFocusInside(e);
        return;
      }
      const tab = (e.target as HTMLElement | null)?.closest('[role="tab"]') as HTMLElement | null;
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        const tabs = Array.from(tab.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') || []);
        const i = tabs.indexOf(tab);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
          : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        e.preventDefault();
        const dataTab = tabs[next]?.dataset.tab;
        tabs[next]?.click();
        // Re-render replaces the tab buttons, so focus the fresh one
        const fresh = dataTab ? this.element.querySelector(`[role="tab"][data-tab="${dataTab}"]`) as HTMLElement | null : null;
        (fresh || tabs[next])?.focus();
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        const sizeMenu = this.element.querySelector('.lf-textsize-menu') as HTMLElement | null;
        if (sizeMenu && !sizeMenu.hidden) {
          this.setTextSizeMenuOpen(false);
          (this.element.querySelector('.lf-textsize-btn') as HTMLElement | null)?.focus();
        } else if (this.showFeedbackModal) {
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
    this.enhanceTabAccessibility();
    this.element.setAttribute('lang', this.sourceLanguage || 'en');
    tagTargetLanguage(this.element, this.targetLanguage);
    this.renderFirstUseTip();
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
    this.dragResize.setupDragHandler();
  }

  private setupResizeHandlers(): void {
    this.dragResize.setupResizeHandlers();
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
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Ask AI</button>
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Grammar</button>
        </div>

        <div class="lf-content lf-skeleton-content" id="lf-main-content" role="status" aria-live="polite">
          <!-- A. Selected Sentence displayed immediately with rule-based connector marks -->
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>Your sentence:</span>
            </div>
            <div class="lf-sentence-text ${!this.isSentenceExpanded && isLongSentence ? 'truncated' : ''}">
              ${this.renderSentenceWithConnectors(clean, connectors)}
            </div>
            <div class="lf-sentence-hint">
              Click any word in the text to inspect its dictionary meaning
            </div>

            ${connectors.length > 0 ? `
              <div class="lf-connector-detected-card lf-u-mt-8px lf-u-p-7px-10px lf-u-bg-rgb147-51-234-008 lf-u-bl-3px-solid-9333ea lf-u-r-6px">
                <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-purple-ink lf-u-mb-2px">
                  Linking word: "${escapeHtml(connectors[0].text)}" (${escapeHtml(connectors[0].categoryLabel)})
                </div>
                <div class="lf-u-fs-12px lf-u-c-ink lf-u-lh-1p4">
                  ${escapeHtml(connectors[0].discourseRole)}
                  <div class="lf-u-fs-11px lf-u-c-ink-muted lf-u-mt-2px">
                    ${flag} ${escapeHtml(connectorRoleText || '')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Honest live AI loading indicator with luxury shimmering effect -->
          <div class="lf-ai-shimmer-card">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-9px lf-u-gap-8px">
              <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-6px lf-u-minw-0 lf-u-flex-1-1-auto lf-u-ov-hidden">
                <div class="lf-skeleton-pulse-dot lf-u-fsh-0"></div>
                <span class="lf-u-fs-12px lf-u-fw-700 lf-u-c-accent-ink lf-u-ls-0p01em lf-u-lh-1p35 lf-u-ov-hidden lf-u-tov-ellipsis">
                  Analyzing phrase breakdown & ${escapeHtml(targetLabel)} translation with AI...
                </span>
              </div>
              <span class="lf-ai-live-badge lf-u-fsh-0 lf-u-ws-nowrap">${lfIcon('sparkles')} Live AI</span>
            </div>

            <!-- Shimmering placeholder breakdown lines -->
            <div class="lf-u-d-flex lf-u-gap-6px lf-u-m-10px-0-8px-0 lf-u-fwrap-wrap">
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-75px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-110px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-82px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-95px lf-u-h-22px"></span>
            </div>

            <!-- Shimmering target translation bar -->
            <div class="lf-u-p-8px-10px lf-u-bg-rgb0-113-227-005 lf-u-r-6px lf-u-mb-9px lf-u-bl-2px-solid-0071e3">
              <div class="lf-shimmer-accent lf-u-h-13px lf-u-w-85pct lf-u-mb-5px"></div>
              <div class="lf-shimmer-accent lf-u-h-11px lf-u-w-50pct lf-u-op-0p7"></div>
            </div>

            <div class="lf-u-fs-11px lf-u-c-ink-muted lf-u-lh-1p4">
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
      this.startLoadingSteps(type);
      this.callbacks.onResize?.();
      return;
    }

    const headingHtml = isSentenceOrPara
      ? `<span class="lf-heading-sentence">${type === 'paragraph' ? 'Paragraph Analysis' : 'Sentence Analysis'}</span>`
      : `<span class="lf-heading-word" title="${escapeHtml(clean)}">${escapeHtml(clean)}</span>`;

    const langConfig = getLanguageConfig(this.targetLanguage);
    const nativeHeader = langConfig?.targetNativeHeader || 'সহজ বাংলা';
    const nativeLabel = langConfig?.targetNativeLabel || 'বাংলা';

    const tabsHtml = isSentenceOrPara
      ? `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">Breakdown</button>
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Ask AI</button>
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Grammar</button>
        </div>
      `
      : `
        <div class="lf-tabs lf-tabs-skeleton" aria-hidden="true">
          <button type="button" class="lf-tab active" tabindex="-1">Meaning</button>
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Ask AI</button>
          <button type="button" class="lf-tab lf-u-op-0p5" tabindex="-1">Details</button>
        </div>
      `;

    const contentHtml = isSentenceOrPara
      ? `
        <div class="lf-content lf-skeleton-content" role="status" aria-live="polite">
          <div class="lf-u-mb-12px">
            <div class="lf-u-fs-sublabel lf-u-tt-uppercase lf-u-c-ink-muted lf-u-fw-700 lf-u-mb-7px">
              Interactive Breakdown:
            </div>
            <div class="lf-u-d-flex lf-u-fwrap-wrap lf-u-gap-6px lf-u-mb-8px">
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-52px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-78px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-44px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-92px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-64px lf-u-h-22px"></span>
              <span class="lf-skeleton-chip lf-shimmer lf-u-w-48px lf-u-h-22px"></span>
            </div>
          </div>

          <div class="lf-bengali-box lf-skeleton-box lf-u-mb-12px lf-u-p-10px-12px lf-u-bg-rgb0-113-227-006 lf-u-bl-3px-solid-0071e3 lf-u-r-8px">
            <div class="lf-u-fs-sublabel lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-accent-ink lf-u-fw-700 lf-u-mb-6px lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-u-bg-rgb0-113-227-015 lf-u-c-accent-ink lf-u-p-1px-6px lf-u-r-4px lf-u-fs-10px lf-u-fw-700">
                ${escapeHtml(nativeLabel)}
              </span>
              <span>${escapeHtml(nativeHeader)}:</span>
            </div>
            <div class="lf-skeleton-line lf-shimmer-accent lf-u-w-90pct lf-u-h-16px lf-u-mb-6px"></div>
            <div class="lf-skeleton-line lf-shimmer-accent lf-u-w-62pct lf-u-h-16px"></div>
          </div>

          <div class="lf-skeleton-status">
            <div class="lf-skeleton-pulse-dot"></div>
            <span class="lf-skeleton-status-text">${type === 'paragraph' ? 'Analyzing paragraph intelligence...' : 'Analyzing text & phrase-by-phrase meaning...'}</span>
          </div>
        </div>
      `
      : `
        <div class="lf-content lf-skeleton-content" role="status" aria-live="polite">
          <div class="lf-def-item lf-u-mb-10px">
            <div class="lf-u-fs-sublabel lf-u-tt-uppercase lf-u-c-ink-muted lf-u-fw-700 lf-u-mb-6px">
              Easy English:
            </div>
            <div class="lf-skeleton-line lf-shimmer lf-u-w-94pct lf-u-h-14px lf-u-mb-6px"></div>
            <div class="lf-skeleton-line lf-shimmer lf-u-w-66pct lf-u-h-14px"></div>
          </div>

          <div class="lf-bengali-box lf-skeleton-box lf-u-mb-12px lf-u-p-10px-12px lf-u-bg-rgb0-113-227-006 lf-u-bl-3px-solid-0071e3 lf-u-r-8px">
            <div class="lf-u-fs-sublabel lf-u-tt-uppercase lf-u-ls-0p04em lf-u-c-accent-ink lf-u-fw-700 lf-u-mb-6px lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-u-bg-rgb0-113-227-015 lf-u-c-accent-ink lf-u-p-1px-6px lf-u-r-4px lf-u-fs-10px lf-u-fw-700">
                ${escapeHtml(nativeLabel)}
              </span>
              <span>${escapeHtml(nativeHeader)}:</span>
            </div>
            <div class="lf-skeleton-line lf-shimmer-accent lf-u-w-88pct lf-u-h-16px lf-u-mb-6px"></div>
            <div class="lf-skeleton-line lf-shimmer-accent lf-u-w-48pct lf-u-h-16px"></div>
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
    this.startLoadingSteps(type);
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
            <span class="lf-pos lf-u-bg-rgb239-68-68-015 lf-u-c-danger-ink">OFFLINE</span>
          </div>
          <div class="lf-actions-top">
            <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
          </div>
        </div>
        <div class="lf-content" id="lf-main-content">
          <div class="lf-sentence-card">
            <div class="lf-section-label">
              <span>Your sentence:</span>
            </div>
            <div class="lf-sentence-text">
              ${this.renderSentenceWithConnectors(clean, connectors)}
            </div>
            <div class="lf-sentence-hint">
              Click any word in the text to inspect its dictionary meaning
            </div>

            ${connectors.length > 0 ? `
              <div class="lf-connector-detected-card lf-u-mt-8px lf-u-p-7px-10px lf-u-bg-rgb147-51-234-008 lf-u-bl-3px-solid-9333ea lf-u-r-6px">
                <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-purple-ink lf-u-mb-2px">
                  Linking word: "${escapeHtml(connectors[0].text)}" (${escapeHtml(connectors[0].categoryLabel)})
                </div>
                <div class="lf-u-fs-12px lf-u-c-ink lf-u-lh-1p4">
                  ${escapeHtml(connectors[0].discourseRole)}
                  <div class="lf-u-fs-11px lf-u-c-ink-muted lf-u-mt-2px">
                    ${getLanguageConfig(this.targetLanguage)?.flagEmoji || '🇧🇩'} ${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetLang === 'bn' ? connectors[0].defaultBengaliRole : connectors[0].discourseRole)}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="lf-u-mt-10px lf-u-p-12px-14px lf-u-bg-rgb239-68-68-005 lf-u-b-1px-solid-rgb239-68-68-02 lf-u-r-8px">
            <div class="lf-u-fs-12p5px lf-u-fw-700 lf-u-c-danger-ink lf-u-mb-4px">
              ${this.bilingual("Couldn't get an AI explanation", 'AI ব্যাখ্যা পাওয়া যায়নি')}
            </div>
            <div class="lf-u-fs-12px lf-u-c-ink lf-u-mb-6px lf-u-lh-1p45">
              ${escapeHtml(errorMessage || 'AI provider unavailable or offline.')}
            </div>
            <div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-lh-1p4">
              Deep phrase breakdown and contextual translation require an active AI provider.
            </div>
            ${this.renderRetryHtml()}
          </div>

          <!-- Inline Quick Setup Card -->
          <div class="lf-quick-api-setup lf-u-mt-10px lf-u-p-12px lf-u-r-8px lf-u-bg-rgb37-99-235-004 lf-u-b-1px-solid-rgb37-99-235-02">
            <div class="lf-u-fs-12px lf-u-fw-700 lf-u-c-accent-ink lf-u-mb-4px">
              ${lfIcon('bolt')} Connect AI for Live Analysis
            </div>
            <div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mb-8px">
              Enter your Gemini API key (Free from Google AI Studio) to unlock real-time syntactic and clause breakdowns:
            </div>
            <div class="lf-u-d-flex lf-u-gap-6px">
              <input type="password" class="lf-quick-api-input lf-u-flex-1 lf-u-p-6px-8px lf-u-fs-12px lf-u-r-6px lf-u-b-1px-solid-rgb0-0-0-015 lf-u-bg-surface lf-u-c-ink" placeholder="Paste Gemini API Key..." />
              <button type="button" class="lf-quick-api-save-btn lf-u-p-6px-12px lf-u-fs-11p5px lf-u-fw-600 lf-u-r-6px lf-u-bg-2563eb lf-u-c-ffffff lf-u-b-none lf-u-cur-pointer lf-u-ws-nowrap">
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
          <span class="lf-pos lf-u-bg-rgb239-68-68-02 lf-u-c-danger-ink">ERROR</span>
        </div>
        <button class="lf-btn-icon lf-close-btn" title="Close" aria-label="Close popup">${lfIcon('close')}</button>
      </div>
      <div class="lf-u-p-16px lf-u-fs-13px lf-u-c-ink lf-u-lh-1p5">
        <strong class="lf-u-mb-6px lf-u-c-danger-ink lf-u-d-block">Couldn't get an AI explanation</strong>
        <span>${escapeHtml(errorMessage)}</span>
        <div class="lf-u-mt-10px lf-u-fs-11p5px lf-u-c-ink-muted">
          Check your internet connection, or your AI provider settings in the LexiFlow dashboard.
        </div>
        ${this.renderRetryHtml()}
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
      exampleBox.hidden = false;
      if (isValidExampleTranslation(aiResult.exampleBengali) && exampleBengali) {
        exampleBengali.textContent = `(${aiResult.exampleBengali})`;
        exampleBengali.hidden = false;
      } else if (exampleBengali) {
        exampleBengali.textContent = '';
        exampleBengali.hidden = true;
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
          easyBengali: w.bengaliTranslation || '—',
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
          easyBengali: p.bengaliTranslation || '—',
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

  private render(options?: { preserveScroll?: boolean; scrollToAskAI?: boolean; scrollToExpanded?: boolean; scrollToFeedback?: boolean }): void {
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

      if (options?.scrollToFeedback) {
        // The report form renders at the bottom of the scrollable content; bring it into view
        // within the card only (scrollIntoView could also scroll the host page).
        setTimeout(() => {
          const form = newContentEl.querySelector('.lf-feedback-box') as HTMLElement | null;
          if (!form) return;
          const formRect = form.getBoundingClientRect();
          const boxRect = newContentEl.getBoundingClientRect();
          // Show the whole form if it fits, otherwise keep its top edge visible
          const delta = Math.min(formRect.bottom - boxRect.bottom + 8, formRect.top - boxRect.top - 8);
          const top = newContentEl.scrollTop + Math.max(0, delta);
          if (typeof newContentEl.scrollTo === 'function') {
            newContentEl.scrollTo({ top, behavior: 'smooth' });
          } else {
            newContentEl.scrollTop = top;
          }
          (form.querySelector('.lf-feedback-reason') as HTMLElement | null)?.focus({ preventScroll: true });
        }, 40);
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
          <button type="button" class="lf-btn-icon lf-voice-btn lf-u-w-26px lf-u-h-26px lf-u-minw-26px lf-u-minh-26px lf-u-m-0-2px" title="${this.bilingual('Pronounce word', 'উচ্চারণ শুনুন')}" aria-label="Listen pronunciation">${lfIcon('volume')}</button>
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
          Details ${bCount ? `(${bCount})` : ''}
        </button>
      </div>

      <div class="lf-content" id="lf-main-content">
        ${this.activeTab === 'meaning' ? `
          <!-- 1. Easy English First -->
          <div class="lf-def-item lf-u-mb-8px">
            <div class="lf-section-sublabel lf-u-fs-sublabel lf-u-tt-uppercase lf-u-fw-700 lf-u-mb-2px">
              Easy English:
            </div>
            <div class="lf-easy-english-text lf-u-fs-english lf-u-lh-1p45 lf-u-fw-500">
              ${this.renderInteractiveSentence(a.easyEnglish, this.currentContextSentence || a.selectedText)}
            </div>
          </div>

          <!-- 2. Easy Target Language Second -->
          <div class="lf-bengali-box lf-u-mb-10px lf-u-p-10px-12px lf-u-r-8px">
            <div class="lf-bengali-box-header lf-u-fs-sublabel lf-u-tt-uppercase lf-u-ls-0p04em lf-u-fw-700 lf-u-mb-4px lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-target-badge lf-u-p-1px-6px lf-u-r-4px lf-u-fs-10px lf-u-fw-700">${escapeHtml(langConfig.targetNativeLabel)}</span>
              <span class="lf-target-header">${escapeHtml(langConfig.targetNativeHeader)}:</span>
            </div>
            <div class="lf-easy-bengali-text lf-u-fs-bengali lf-u-fw-600 lf-u-lh-1p45">
              ${escapeHtml(a.easyBengali)}
            </div>
          </div>

          <!-- 3. In this sentence -->
          <div class="lf-context-box lf-u-mb-8px lf-u-p-8px-10px lf-u-r-8px">
            <div class="lf-context-label lf-u-fs-sublabel lf-u-tt-uppercase lf-u-fw-600 lf-u-mb-2px">
              In this sentence:
            </div>
            <div class="lf-context-text lf-u-fs-context lf-u-lh-1p45">
              ${this.renderInteractiveSentence(a.contextMeaning, this.currentContextSentence || a.selectedText)}
            </div>
          </div>

          <!-- 3.5 Why This Matters (Discourse Connector Analysis) - Learn Mode Only -->
          ${(this.readingMode === 'learn' && whyMatters) ? `
            <div class="lf-why-matters-box lf-u-mb-10px lf-u-p-10px-12px lf-u-bg-rgb147-51-234-008 lf-u-bl-3px-solid-9333ea lf-u-r-8px">
              <div class="lf-u-d-flex lf-u-jc-space-between lf-u-ai-center lf-u-mb-4px">
                <span class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-purple-ink lf-u-d-flex lf-u-ai-center lf-u-gap-4px">
                  Why This Matters (${escapeHtml(whyMatters.connector.categoryLabel)}):
                </span>
                <button type="button" class="lf-looks-wrong-btn lf-u-bg-none lf-u-b-none lf-u-fs-10p5px lf-u-c-ink-muted lf-u-cur-pointer lf-u-td-underline" title="Report inaccurate connector or why it matters analysis">
                  Looks wrong?
                </button>
              </div>
              <div class="lf-u-fs-12p5px lf-u-c-ink lf-u-lh-1p45">
                <strong class="lf-u-c-purple-ink">"${this.renderInteractiveSentence(whyMatters.connector.text, this.currentContextSentence || a.selectedText)}"</strong>: ${this.renderInteractiveSentence(whyMatters.explanation, this.currentContextSentence || a.selectedText)}
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
              <div class="lf-active-recall-box lf-u-mb-10px lf-u-p-10px-12px lf-u-bg-rgb147-51-234-006 lf-u-b-1px-dashed-rgb147-51-234-035 lf-u-r-8px">
                <div class="lf-u-d-flex lf-u-jc-space-between lf-u-ai-center lf-u-mb-5px">
                  <span class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-purple-ink lf-u-d-flex lf-u-ai-center lf-u-gap-4px">
                    Active Recall Challenge:
                  </span>
                  <span class="lf-u-fs-10p5px lf-u-c-ink-muted lf-u-fw-600">
                    Hint: ${escapeHtml(cloze.hint.firstLetter)}... (${cloze.hint.length} letters)
                  </span>
                </div>
                <div class="lf-cloze-text lf-u-fs-13px lf-u-lh-1p45 lf-u-c-ink lf-u-fst-italic lf-u-mb-6px">
                  "${this.renderInteractiveSentence(cloze.clozeSentence, this.currentContextSentence || a.example || '')}"
                </div>
                <div class="lf-u-d-flex lf-u-jc-flex-end">
                  <button type="button" class="lf-reveal-cloze-btn lf-u-bg-none lf-u-b-none lf-u-fs-11px lf-u-fw-600 lf-u-c-purple-ink lf-u-cur-pointer lf-u-td-underline lf-u-p-0">
                    Test memory: click to reveal answer
                  </button>
                </div>
                <div class="lf-cloze-answer lf-u-mt-6px lf-u-p-5px-8px lf-u-bg-rgb147-51-234-012 lf-u-r-5px lf-u-fs-12px lf-u-fw-700 lf-u-c-purple-ink" hidden>
                  Word: <strong>${escapeHtml(cloze.targetWord)}</strong> ${a.easyBengali ? `(${escapeHtml(a.easyBengali)})` : ''}
                </div>
              </div>
            `;
          })()}

          <!-- 4. Natural Example -->
          <div class="lf-example-box lf-u-mb-8px lf-u-pl-8px lf-u-bl-2px-solid-rgb0-113-227-04 lf-u-fs-example lf-u-fst-italic" ${a.example ? '' : 'hidden'}>
            <span class="lf-example-text">"${this.renderInteractiveSentence(a.example || '', a.example)}"</span>
            <div class="lf-example-bengali lf-u-fst-normal lf-u-fs-context-2 lf-u-mt-2px" ${isValidExampleTranslation(a.exampleBengali) ? '' : 'hidden'}>${isValidExampleTranslation(a.exampleBengali) ? `(${escapeHtml(a.exampleBengali || '')})` : ''}</div>
          </div>

          <!-- 4.5. Grammar Breakdown (Streamlined in Quick Mode, In-depth in Learn Mode) -->
          <div class="lf-word-grammar-card lf-u-mb-10px lf-u-p-10px-12px lf-u-bg-rgb0-113-227-005 lf-u-b-1px-solid-rgb0-113-227-018 lf-u-r-8px">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-6px">
              <span class="lf-u-fs-11p5px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-accent-ink lf-u-ls-0p04em">
                Grammar Breakdown:
              </span>
              <span class="lf-u-fs-11px lf-u-p-2px-7px lf-u-r-4px lf-u-bg-rgb0-113-227-012 lf-u-c-accent-ink lf-u-fw-600">
                ${escapeHtml(a.partOfSpeech || 'Word')}
              </span>
            </div>
            ${a.grammaticalRole ? `
              <div class="lf-u-fs-13px lf-u-c-ink lf-u-mb-4px lf-u-lh-1p4">
                <strong class="lf-u-c-accent-ink">Role in Sentence:</strong> ${this.renderInteractiveSentence(a.grammaticalRole, this.currentContextSentence || a.selectedText)}
              </div>
            ` : `
              <div class="lf-u-fs-12p5px lf-u-c-ink lf-u-mb-4px lf-u-lh-1p4">
                <strong class="lf-u-c-accent-ink">Role in this sentence:</strong> works as a <strong>${this.renderInteractiveSentence(a.partOfSpeech || 'lexical item', this.currentContextSentence || a.selectedText)}</strong> in this context.
              </div>
            `}
            ${this.readingMode === 'learn' && a.transitivityOrPattern ? `
              <div class="lf-u-fs-12p5px lf-u-c-ink-muted lf-u-mb-4px lf-u-lh-1p4">
                <strong>Pattern:</strong> <code class="lf-u-bg-rgb0-0-0-004 lf-u-p-1px-4px lf-u-r-3px">${this.renderInteractiveSentence(a.transitivityOrPattern, this.currentContextSentence || a.selectedText)}</code>
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.literalVsFigurative ? `
              <div class="lf-u-fs-12p5px lf-u-c-warn-ink lf-u-mb-4px lf-u-lh-1p4">
                <strong>Literal vs Figurative:</strong> ${this.renderInteractiveSentence(a.literalVsFigurative, this.currentContextSentence || a.selectedText)}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.grammaticalNote ? `
              <div class="lf-u-fs-12px lf-u-c-ink-muted lf-u-lh-1p4">
                ${this.renderInteractiveSentence(a.grammaticalNote, this.currentContextSentence || a.selectedText)}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && a.wordForms && a.wordForms.length > 0 ? `
              <div class="lf-u-fs-11p5px lf-u-c-ink-muted lf-u-mt-5px">
                <strong>Word Forms:</strong> ${a.wordForms.map(wf => `<span class="lf-sentence-word" data-word="${escapeHtml(wf.trim())}" title="Inspect &quot;${escapeHtml(wf.trim())}&quot;">${escapeHtml(wf.trim())}</span>`).join(' • ')}
              </div>
            ` : ''}
            ${this.readingMode === 'learn' && this.parentSentenceAnalysis ? `
              <div class="lf-u-mt-8px lf-u-pt-6px lf-u-bt-1px-dashed-rgb0-113-227-02 lf-u-d-flex lf-u-jc-flex-end">
                <button type="button" class="lf-sentence-link-btn lf-u-bg-none lf-u-b-none lf-u-c-accent-ink lf-u-fs-11p5px lf-u-fw-600 lf-u-cur-pointer lf-u-p-2px-4px lf-u-td-underline" id="lf-view-parent-sentence-btn">
                  View Full Sentence Grammar X-Ray →
                </button>
              </div>
            ` : ''}
          </div>

          <!-- 5. Quick AI Instant Actions -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>Ask AI:</span>
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
                <span class="lf-u-fs-10px lf-u-fw-700 lf-u-c-accent-ink">${escapeHtml(langConfig.targetNativeLabel)}</span><span>${escapeHtml(langConfig.targetNativeHeader)}</span>
              </button>
            </div>
          </div>

          <!-- 6. Quick Intelligence Preview (Synonyms & Collocations) -->
          ${this.renderStageBPreview(this.currentStageB)}

          <!-- 7. Honesty Bar: AI-generated + Confidence + Machine voice -->
          <div class="lf-honesty-bar lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-fwrap-wrap lf-u-gap-6px lf-u-mt-10px lf-u-pt-8px lf-u-bt-1px-solid-rgb0-0-0-008">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-ai-badge">${isVerifiedDict ? `${lfIcon('book')} Verified Lexicon` : `${lfIcon('sparkles')} AI-generated`}</span>
              <span class="lf-confidence-pill ${a.confidence}">Confidence: ${escapeHtml(a.confidence)}</span>
            </div>
            <button class="lf-machine-voice-btn" title="Machine-synthesized text-to-speech" aria-label="Listen with machine speech synthesis">
              Machine voice ${lfIcon('volume')}
            </button>
          </div>

          ${a.confidence === 'low' ? `
            <div class="lf-u-fs-11px lf-u-c-danger-ink lf-u-mt-4px lf-u-p-4px-8px lf-u-bg-rgb239-68-68-008 lf-u-r-4px">
              ⚠️ ${escapeHtml(a.uncertaintyReason || 'Context is limited. This is one possible meaning.')}
            </div>
          ` : ''}

          <!-- Legacy Inline Ask AI Panel (when toggled via footer button) -->
          ${this.showAskAI ? this.renderAskAIPanel('word', a.selectedText) : ''}

          <!-- Compatibility Container for Stage B -->
          <div id="lf-expanded-section" role="region" aria-label="Detailed Vocabulary" ${this.isExpanded ? '' : 'hidden'}>
            ${this.renderStageBContent()}
          </div>
        ` : ''}

        ${this.activeTab === 'ask-ai' ? `
          ${this.renderAskAIPanel('word', a.selectedText)}
          <div id="lf-expanded-section" hidden></div>
        ` : ''}

        ${this.activeTab === 'details' ? `
          <div id="lf-expanded-section" role="region" aria-label="Detailed Vocabulary">
            ${this.renderStageBContent()}
          </div>
        ` : ''}

        <!-- Inline Report Form across all tabs -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(a.selectedText, this.currentContextSentence) : ''}
      </div>

      <div class="lf-footer">
        <!-- Meanings and Ask AI live in the tabs above; the footer keeps the two actions -->
        <div class="lf-footer-left">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            ${lfIcon('flag')} Report
          </button>
        </div>
        <div class="lf-footer-right">
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
          <button type="button" class="lf-btn-icon lf-voice-btn lf-u-w-26px lf-u-h-26px lf-u-minw-26px lf-u-minh-26px lf-u-m-0-2px" title="${this.bilingual('Listen to sentence', 'বাক্যটি শুনুন')}" aria-label="Listen to sentence">${lfIcon('volume')}</button>
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
            <div class="lf-why-matters-box lf-u-mb-12px lf-u-p-10px-12px lf-u-bg-rgb147-51-234-008 lf-u-bl-3px-solid-9333ea lf-u-r-8px">
              <div class="lf-u-d-flex lf-u-jc-space-between lf-u-ai-center lf-u-mb-4px">
                <span class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-purple-ink lf-u-d-flex lf-u-ai-center lf-u-gap-4px">
                  Why This Matters (${escapeHtml(sentenceWhyMatters.connector.categoryLabel)}):
                </span>
                <button type="button" class="lf-looks-wrong-btn lf-u-bg-none lf-u-b-none lf-u-fs-10p5px lf-u-c-ink-muted lf-u-cur-pointer lf-u-td-underline" title="Report inaccurate connector or why it matters analysis">
                  Looks wrong?
                </button>
              </div>
              <div class="lf-u-fs-12p5px lf-u-c-ink lf-u-lh-1p45">
                <strong class="lf-u-c-purple-ink">"${this.renderInteractiveSentence(sentenceWhyMatters.connector.text, s.selectedText)}"</strong>: ${this.renderInteractiveSentence(sentenceWhyMatters.explanation, s.selectedText)}
              </div>
            </div>
          ` : ''}

          <!-- C. Full Target Language -->
          <div class="lf-bengali-box lf-u-mb-12px lf-u-p-10px-12px lf-u-r-8px">
            <div class="lf-bengali-box-header lf-u-fs-sublabel lf-u-tt-uppercase lf-u-ls-0p04em lf-u-fw-700 lf-u-mb-3px lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-target-badge lf-u-p-1px-6px lf-u-r-4px lf-u-fs-10px lf-u-fw-700">${escapeHtml(langConfig.targetNativeLabel)}</span>
              <span class="lf-target-header">${escapeHtml(langConfig.targetLang === 'bn' ? 'সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${langConfig.targetNativeHeader} (${langConfig.targetLabel}):`)}</span>
            </div>
            <div class="lf-easy-bengali-text lf-u-fs-bengali lf-u-fw-700 lf-u-lh-1p45">
              ${escapeHtml(s.bengaliTranslation || `${langConfig.targetNativeHeader}...`)}
            </div>
          </div>

          <!-- Difficult Words & Vocabulary (Moved out of Grammar & Clauses into Sentence Analysis) -->
          ${this.renderDifficultVocabulary(s.difficultVocabulary || [], s.selectedText)}

          <!-- Secondary detail: folded in Quick mode, open in Learn mode -->
          ${this.renderMoreDetails(`
            ${(s.plainEnglishParaphrase || s.overallMeaning) ? `
              <div class="lf-def-item lf-u-mb-10px lf-u-p-8px-10px lf-u-r-6px">
                <div class="lf-section-sublabel lf-u-fs-sublabel lf-u-tt-uppercase lf-u-fw-700 lf-u-mb-3px">
                  In simple English:
                </div>
                <div class="lf-easy-english-text lf-u-fs-english-2 lf-u-lh-1p45 lf-u-fw-500">
                  ${this.renderInteractiveSentence(s.plainEnglishParaphrase || s.overallMeaning || '', s.selectedText)}
                </div>
              </div>
            ` : ''}
            ${this.renderSummaryHighlights(s.grammaticalHighlights || [], s.selectedText)}
          `)}

          <!-- Quick AI Prompt Chips for Sentence -->
          <div class="lf-quick-ai-box">
            <div class="lf-quick-ai-title">
              <span>Ask AI:</span>
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
                <span class="lf-u-fs-10px lf-u-fw-700 lf-u-c-accent-ink">${escapeHtml(langConfig.targetNativeLabel)}</span><span>${escapeHtml(langConfig.targetNativeHeader)}</span>
              </button>
            </div>
          </div>

          <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
          <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-fwrap-wrap lf-u-gap-6px lf-u-mt-10px lf-u-pt-8px lf-u-bt-1px-solid-rgb0-0-0-008">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
              <span class="lf-ai-badge">${lfIcon('sparkles')} AI-generated</span>
              ${s.toneAndRegister ? `
                <span class="lf-confidence-pill high lf-u-bg-rgb0-113-227-012 lf-u-c-accent-ink">${escapeHtml(s.toneAndRegister)}</span>
              ` : ''}
            </div>
            <button class="lf-machine-voice-btn" title="Read sentence aloud with speech synthesis" aria-label="Listen to sentence">
              Machine voice ${lfIcon('volume')}
            </button>
          </div>

          <!-- Inline Ask AI Follow-Up Panel (legacy toggle) -->
          ${this.showAskAI ? this.renderAskAIPanel('sentence', s.selectedText) : ''}

          <!-- Compatibility Container for Detailed Sentence Breakdown -->
          <div id="lf-sentence-expanded-section" role="region" aria-label="Detailed Sentence Breakdown" ${this.isSentenceAnalysisExpanded ? '' : 'hidden'}>
            ${this.renderSentenceGrammarTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'grammar' ? `
          <div id="lf-sentence-expanded-section" role="region" aria-label="Grammar Analysis">
            ${this.renderSentenceGrammarTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'clauses' ? `
          <div id="lf-sentence-expanded-section" role="region" aria-label="Clauses Breakdown">
            ${this.renderSentenceClausesTab(s)}
          </div>
        ` : ''}

        ${this.activeSentenceTab === 'ask-ai' ? `
          ${this.renderAskAIPanel('sentence', s.selectedText)}
          <div id="lf-sentence-expanded-section" hidden></div>
        ` : ''}

        <!-- Inline Report Form across all sentence tabs -->
        ${this.showFeedbackModal ? this.renderFeedbackForm(s.selectedText, s.selectedText) : ''}
      </div>

      <div class="lf-footer">
        <!-- Grammar, Clauses and Ask AI live in the tabs above; the footer keeps the two actions -->
        <div class="lf-footer-left">
          <button class="lf-btn-action secondary lf-report-trigger-btn" title="Report inaccurate explanation" aria-label="Report wrong meaning">
            ${lfIcon('flag')} Report
          </button>
        </div>
        <div class="lf-footer-right">
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
          <span class="lf-heading-sentence">Paragraph Analysis</span>
          <button type="button" class="lf-btn-icon lf-voice-btn lf-u-w-26px lf-u-h-26px lf-u-minw-26px lf-u-minh-26px lf-u-m-0-2px" title="${this.bilingual('Listen to paragraph', 'প্যারাগ্রাফটি শুনুন')}" aria-label="Listen to paragraph">${lfIcon('volume')}</button>
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
          <div class="lf-para-panel" data-para-panel-idx="${pIdx}" ${this.activeParaIndex === pIdx ? '' : 'hidden'}>
            ${para.sentences.map((sent, sIdx) => {
              const isSentenceVisible = (this.activeParaIndex === pIdx && this.activeParaSentenceIndex === sIdx);
              return `
                <div class="lf-sentence-panel" data-panel-idx="${sIdx}" ${isSentenceVisible ? '' : 'hidden'}>
                  <!-- A. Original Sentence Text (Exact Sentence Mode Pattern!) -->
                  <div class="lf-sentence-card">
                    <div class="lf-section-label">
                      <span>${isBn ? `বাক্য ${toBnNum(sent.sentenceIndex)} (মূল বাক্য):` : `Sentence ${sent.sentenceIndex}:`}</span>
                      <button type="button" class="lf-btn-icon lf-voice-mini-btn lf-u-w-22px lf-u-h-22px lf-u-minw-22px lf-u-minh-22px lf-u-m-0-4px" data-speak="${escapeHtml(sent.sentenceText)}" title="Listen to this sentence" aria-label="Listen to sentence">
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
                    <div class="lf-section-label lf-u-c-accent-ink lf-u-mb-6px">
                      <span>Phrase by phrase (${sent.phraseBreakdown.length}):</span>
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
                  <div class="lf-bengali-box lf-u-mb-12px lf-u-p-10px-12px lf-u-r-8px">
                    <div class="lf-bengali-box-header lf-u-fs-sublabel lf-u-tt-uppercase lf-u-ls-0p04em lf-u-fw-700 lf-u-mb-3px">
                      ${langConfig.targetLang === 'bn' ? '🇧🇩 সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${langConfig.flagEmoji} ${escapeHtml(langConfig.targetNativeHeader)} (${escapeHtml(langConfig.targetLabel)}):`}
                    </div>
                    <div class="lf-easy-bengali-text lf-u-fs-bengali lf-u-fw-700 lf-u-lh-1p45">
                      ${escapeHtml(sent.bengaliTranslation || p.bengaliTranslation || `${langConfig.targetNativeHeader}...`)}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}

        <!-- Toggle for Complete Full Paragraph Text & Translation -->
        <div class="lf-u-mt-10px lf-u-mb-8px">
          <button type="button" class="lf-text-toggle-btn lf-u-bg-none lf-u-b-none lf-u-fs-11p5px lf-u-fw-600 lf-u-c-accent-ink lf-u-cur-pointer lf-u-p-2px-0" id="lf-para-text-toggle">
            ${this.isSentenceExpanded ? (isBn ? '▲ সম্পূর্ণ প্যারাগ্রাফ বিবরণ বন্ধ করুন' : '▲ Hide Full Paragraph Overview') : (isBn ? '▼ সম্পূর্ণ প্যারাগ্রাফ বিবরণ দেখুন' : '▼ Show Full Paragraph Overview')}
          </button>
        </div>

        ${this.isSentenceExpanded ? `
          <div class="lf-u-p-10px-12px lf-u-r-8px lf-u-bg-rgb0-0-0-002 lf-u-b-1px-solid-rgb0-0-0-006 lf-u-mb-10px">
            <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-ink-muted lf-u-mb-4px">
              ${isBn ? `প্যারাগ্রাফ ${toBnNum(currentPara.paragraphIndex)} (সম্পূর্ণ মূল অংশ):` : `Paragraph ${currentPara.paragraphIndex} (Full Original):`}
            </div>
            <div class="lf-u-fs-13p5px lf-u-c-ink lf-u-lh-1p45 lf-u-mb-8px">
              ${this.renderInteractiveSentence(currentPara.paragraphText || p.selectedText)}
            </div>
            ${(currentPara.bengaliTranslation || p.bengaliTranslation) ? `
              <div class="lf-u-fs-11px lf-u-fw-700 lf-u-tt-uppercase lf-u-c-accent-ink lf-u-mb-4px">
                ${isBn ? 'সম্পূর্ণ বাংলা ভাবার্থ:' : 'Full Translation:'}
              </div>
              <div class="lf-u-fs-14px lf-u-c-ink lf-u-lh-1p45 lf-u-fw-500">
                ${escapeHtml(decodeHtml(currentPara.bengaliTranslation || p.bengaliTranslation))}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Optional Main Idea & Summary -->
        ${(p.mainIdea || p.conciseSummary) ? `
          <div class="lf-def-item lf-u-mb-10px lf-u-p-8px-10px lf-u-r-6px">
            <div class="lf-section-sublabel lf-u-fs-sublabel lf-u-tt-uppercase lf-u-fw-700 lf-u-mb-3px">
              Main Idea:
            </div>
            <div class="lf-easy-english-text lf-u-fs-english-2 lf-u-lh-1p45 lf-u-fw-500">
              ${escapeHtml(p.mainIdea || p.conciseSummary)}
            </div>
          </div>
        ` : ''}

        <!-- Honesty Bar: AI Badge, Tone & Register, Machine Voice -->
        <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-fwrap-wrap lf-u-gap-6px lf-u-mt-10px lf-u-pt-8px lf-u-bt-1px-solid-rgb0-0-0-008">
          <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-6px">
            <span class="lf-ai-badge">${lfIcon('sparkles')} AI-generated</span>
            ${p.toneAndRegister ? `
              <span class="lf-confidence-pill high lf-u-bg-rgb10-132-255-014 lf-u-c-accent-ink">${escapeHtml(p.toneAndRegister)}</span>
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
        <div id="lf-para-expanded-section" role="region" aria-label="Paragraph Details" ${this.isSentenceAnalysisExpanded ? '' : 'hidden'}>
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
    return renderPhraseBreakdownHtmlImpl(this.cardContext(), phrases, contextSentence);
  }

  private ensurePhraseBreakdown(text: string,
    existingBreakdown?: PhraseExplanation[],
    clauses?: Array<{ text: string; role?: string; explanationBengali?: string }>,
    defaultBengali?: string): PhraseExplanation[] {
    return ensurePhraseBreakdownImpl(this.cardContext(), text, existingBreakdown, clauses, defaultBengali);
  }

  private renderInteractiveSentence(sentence: string, contextSentence?: string): string {
    if (!sentence) return '';
    const cleanSentence = decodeHtml(sentence);
    const tokens = cleanSentence.split(/(\s+|[.,;:"'!?()[\]{}«»“”‘’—–…]+)/g);
    return tokens.map((token) => {
      if (/^\s+$/.test(token) || /^[.,;:"'!?()[\]{}«»“”‘’—–…]+$/.test(token)) {
        return escapeHtml(token);
      }
      const cleanWord = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!cleanWord || !/\p{L}/u.test(cleanWord)) return escapeHtml(token);
      const ctxAttr = contextSentence ? ` data-context="${escapeHtml(decodeHtml(contextSentence))}"` : '';
      return `<span class="lf-sentence-word" data-word="${escapeHtml(cleanWord)}"${ctxAttr} title="Inspect &quot;${escapeHtml(cleanWord)}&quot;">${escapeHtml(token)}</span>`;
    }).join('');
  }

  private renderSentenceWithConnectors(sentence: string, connectors: MatchedConnector[] = []): string {
    const cleanSentence = decodeHtml(sentence);
    if (!connectors || connectors.length === 0) {
      return this.renderInteractiveSentence(cleanSentence, cleanSentence);
    }

    const tokens = cleanSentence.split(/(\s+|[.,;:"'!?()[\]{}«»“”‘’—–…]+)/g);
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
        return `<span class="lf-sentence-word lf-connector-word lf-u-bg-rgb147-51-234-015 lf-u-c-purple-ink lf-u-fw-700 lf-u-r-3px lf-u-p-1px-3px" data-word="${escapeHtml(cleanWord)}"${ctxAttr} title="Discourse Connector: ${escapeHtml(matched.categoryLabel)}">${escapeHtml(token)}</span>`;
      }

      return `<span class="lf-sentence-word" data-word="${escapeHtml(cleanWord)}"${ctxAttr} title="Inspect &quot;${escapeHtml(cleanWord)}&quot;">${escapeHtml(token)}</span>`;
    }).join('');
  }

  private renderDifficultVocabulary(vocab: Array<{ word: string; meaningInContext: string; bengali: string; grammaticalRole?: string }>, contextSentence?: string): string {
    return renderDifficultVocabularyImpl(this.cardContext(), vocab, contextSentence);
  }

  private renderSummaryHighlights(highlights: string[], contextSentence?: string): string {
    return renderSummaryHighlightsImpl(this.cardContext(), highlights, contextSentence);
  }

  private cardContext(): CardRenderContext {
    return {
      targetLanguage: this.targetLanguage,
      sourceLanguage: this.sourceLanguage,
      renderInteractiveSentence: (text, context) => this.renderInteractiveSentence(text, context)
    };
  }

  public renderSentenceGrammarTab(s: SentenceAnalysisResult): string {
    return renderSentenceGrammarTabImpl(this.cardContext(), s);
  }

  public renderSentenceClausesTab(s: SentenceAnalysisResult): string {
    return renderSentenceClausesTabImpl(this.cardContext(), s);
  }

  private renderSentenceAnalysisDetails(s: SentenceAnalysisResult): string {
    return this.renderSentenceGrammarTab(s);
  }

  private renderParagraphAnalysisDetails(p: ParagraphAnalysisResult): string {
    return renderParagraphAnalysisDetailsImpl(this.cardContext(), p);
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
          <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-4px lf-u-fwrap-wrap">
            <span class="lf-preview-label">Synonyms:</span>
            ${synonyms.slice(0, 3).map((s) => `<span class="lf-synonym-tag lf-sentence-word lf-u-cur-pointer" data-word="${escapeHtml(s.word.trim())}" title="${escapeHtml(s.easyEnglish)}">${escapeHtml(s.word)}</span>`).join('')}
          </div>
        ` : ''}
        ${collocations.length > 0 ? `
          <div class="lf-u-d-flex lf-u-ai-center lf-u-gap-4px lf-u-fwrap-wrap lf-u-ml-4px">
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
        <div class="lf-stage-b-skeleton lf-u-p-10px-0" role="status" aria-live="polite">
          <div class="lf-skeleton-line lf-shimmer lf-u-w-92pct lf-u-h-14px lf-u-mb-8px"></div>
          <div class="lf-skeleton-line lf-shimmer lf-u-w-70pct lf-u-h-14px lf-u-mb-12px"></div>
          <div class="lf-u-p-10px-12px lf-u-bg-rgb120-120-128-006 lf-u-r-8px lf-u-mb-10px">
            <div class="lf-skeleton-pill lf-shimmer lf-u-w-60px lf-u-h-11px lf-u-mb-6px"></div>
            <div class="lf-skeleton-line lf-shimmer lf-u-w-85pct lf-u-h-13px"></div>
          </div>
          <div class="lf-skeleton-status lf-u-jc-center lf-u-mt-10px">
            <div class="lf-skeleton-pulse-dot"></div>
            <span class="lf-skeleton-status-text lf-u-fs-11p5px">Exploring all meanings & examples...</span>
          </div>
        </div>
      `;
    }

    if (this.stageBError) {
      return `
        <div class="lf-u-p-12px lf-u-bg-rgb239-68-68-008 lf-u-r-8px lf-u-mt-10px">
          <span class="lf-u-fs-12px lf-u-c-danger-ink">${escapeHtml(this.stageBError)}</span>
          <button class="lf-btn-action secondary lf-retry-stage-b-btn lf-u-mt-6px lf-u-p-4px-8px lf-u-fs-11px">
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
      <div class="lf-u-mt-10px lf-u-pt-10px lf-u-bt-0p5px-solid-rgb0-0-0-008">
        <strong class="lf-u-fs-sublabel-2 lf-u-c-accent-ink lf-u-tt-uppercase lf-u-mb-8px lf-u-d-block">
          📚 Senses & Meanings (${senses.length}):
        </strong>

        ${visibleSenses.map((s, idx) => `
          <div class="lf-sense-item ${s.isContextual ? 'contextual' : ''}">
            <div class="lf-u-d-flex lf-u-ai-center lf-u-jc-space-between lf-u-mb-5px">
              <div>
                <span class="lf-pos lf-u-fs-10p5px">${escapeHtml(s.partOfSpeech)}</span>
                ${s.isContextual ? `<span class="lf-badge-contextual">In this sentence</span>` : ''}
              </div>
              <span class="lf-u-fs-sublabel-3 lf-u-c-ink-muted">Sense #${idx + 1}</span>
            </div>

            <!-- Sense Easy English & Bengali -->
            <div class="lf-def-text lf-u-fs-english-3 lf-u-fw-500 lf-u-lh-1p5 lf-u-mt-3px">
              ${this.renderInteractiveSentence(s.easyEnglish, this.currentContextSentence || b.lemma)}
            </div>
            <div class="lf-bengali-meaning lf-u-fs-bengali-2 lf-u-c-accent-ink lf-u-fw-600 lf-u-lh-1p5 lf-u-mt-3px">
              ${escapeHtml(s.easyBengali)}
            </div>

            <!-- Sense Examples -->
            ${(s.examples || []).map((ex) => `
              <div class="lf-sense-example lf-u-mt-5px lf-u-pl-8px lf-u-bl-2px-solid-rgb0-113-227-035 lf-u-fs-example lf-u-c-ink-muted lf-u-fst-italic lf-u-lh-1p45">
                "${this.renderInteractiveSentence(ex.english, ex.english)}"
                ${ex.bengali ? `<span class="lf-u-fst-normal lf-u-c-ink-muted lf-u-ml-4px">(${escapeHtml(ex.bengali)})</span>` : ''}
              </div>
            `).join('')}

            <!-- Synonyms -->
            ${s.synonyms && s.synonyms.length > 0 ? `
              <div class="lf-synonyms-row lf-u-mt-7px lf-u-fs-base">
                <span class="lf-u-c-ink-muted lf-u-fw-600">Synonyms:</span>
                ${s.synonyms.map((syn) => `<span class="lf-synonym-tag lf-sentence-word lf-u-fs-chip lf-u-cur-pointer" data-word="${escapeHtml(syn.word.trim())}" title="${escapeHtml(syn.easyEnglish)} (${escapeHtml(syn.easyBengali)})">${escapeHtml(syn.word)}</span>`).join(' ')}
              </div>
            ` : ''}

            <!-- Antonyms -->
            ${s.antonyms && s.antonyms.length > 0 ? `
              <div class="lf-antonyms-row lf-u-mt-5px lf-u-fs-base">
                <span class="lf-u-c-ink-muted lf-u-fw-600">Opposites:</span>
                ${s.antonyms.map((ant) => `<span class="lf-synonym-tag lf-sentence-word lf-u-bg-rgb239-68-68-008 lf-u-c-danger-ink lf-u-fs-chip lf-u-cur-pointer" data-word="${escapeHtml(ant.word.trim())}" title="${escapeHtml(ant.easyEnglish)}">${escapeHtml(ant.word)}</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `).join('')}

        ${senses.length > 5 && !this.showingAllSenses ? `
          <button class="lf-btn-action secondary lf-show-more-senses-btn lf-u-w-100pct lf-u-jc-center lf-u-mb-10px">
            Show ${senses.length - 5} more meanings
          </button>
        ` : ''}

        <!-- Collocations -->
        ${b.collocations && b.collocations.length > 0 ? `
          <div class="lf-u-mt-10px">
            <strong class="lf-collocations-title lf-u-fs-sublabel-4 lf-u-tt-uppercase">Common Collocations:</strong>
            <div class="lf-u-d-flex lf-u-fwrap-wrap lf-u-gap-5px lf-u-mt-5px">
              ${b.collocations.map((c) => `<span class="lf-synonym-tag lf-u-fs-chip">${this.renderInteractiveSentence(c.english, c.english)}${c.bengali ? ` (${escapeHtml(c.bengali)})` : ''}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Idioms & Phrases -->
        ${b.idiomsAndPhrases && b.idiomsAndPhrases.length > 0 ? `
          <div class="lf-u-mt-10px">
            <strong class="lf-idioms-title lf-u-fs-sublabel-4 lf-u-tt-uppercase">Idioms & Phrases:</strong>
            <div class="lf-u-mt-5px">
              ${b.idiomsAndPhrases.map((ip) => `
                <div class="lf-idiom-text lf-u-fs-base-2 lf-u-mb-5px lf-u-lh-1p45">
                  <span class="lf-u-c-accent-ink lf-u-fw-600">${this.renderInteractiveSentence(ip.phrase, ip.phrase)}</span> &mdash; ${this.renderInteractiveSentence(ip.easyEnglish, ip.phrase)} <em>(${escapeHtml(ip.easyBengali)})</em>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Confusing Words -->
        ${b.confusingWords && b.confusingWords.length > 0 ? `
          <div class="lf-u-mt-10px">
            <strong class="lf-confusing-title lf-u-fs-sublabel-4 lf-u-tt-uppercase">Don't Confuse With:</strong>
            ${b.confusingWords.map((cw) => `
              <div class="lf-confusing-text lf-u-fs-base-2 lf-u-mt-5px lf-u-lh-1p45">
                <span class="lf-u-c-warn-ink lf-u-fw-600">${this.renderInteractiveSentence(cw.word, this.currentContextSentence || b.lemma)}</span>: ${this.renderInteractiveSentence(cw.difference, this.currentContextSentence || b.lemma)}
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
        <div class="lf-feedback-box lf-u-bg-rgb16-185-129-015 lf-u-bc-10b981">
          <div class="lf-u-fs-12p5px lf-u-c-success-ink lf-u-fw-600">
            ✓ Report saved locally. Thank you for your feedback!
          </div>
        </div>
      `;
    }

    const effectiveContext = contextSentence || this.currentContextSentence;

    return `
      <div class="lf-feedback-box">
        <div class="lf-u-fs-12px lf-u-fw-700 lf-u-c-danger-ink lf-u-mb-6px">
          ${this.bilingual('Report Issue', 'রিপোর্ট বা পরামর্শ')}
        </div>
        <select class="lf-feedback-reason lf-u-w-100pct lf-u-b-0p5px-solid-rgb0-0-0-02 lf-u-r-6px lf-u-p-4px lf-u-fs-12px lf-u-mb-6px">
          <option value="wrong_context_meaning">Wrong meaning for this context</option>
          <option value="incorrect_bengali">Incorrect Bengali translation</option>
          <option value="complicated_english">English explanation is too complicated</option>
          <option value="fabricated_antonym">Invalid or inaccurate antonym</option>
          <option value="other">Other issue</option>
        </select>
        <textarea class="lf-feedback-note lf-u-w-100pct lf-u-b-0p5px-solid-rgb0-0-0-02 lf-u-r-6px lf-u-p-4px lf-u-fs-11p5px lf-u-mb-6px lf-u-rs-none" placeholder="Optional details..." rows="2"></textarea>

        <!-- Privacy Opt-In Checkbox -->
        <div class="lf-feedback-optin lf-u-mb-6px lf-u-p-6px-8px lf-u-bg-rgb0-0-0-003 lf-u-r-6px lf-u-fs-11px">
          <label class="lf-u-d-flex lf-u-ai-flex-start lf-u-gap-6px lf-u-cur-pointer lf-u-c-ink">
            <input type="checkbox" class="lf-feedback-optin-checkbox lf-u-mt-2px" />
            <span>Include selected text and sentence context to help diagnose and fix this issue</span>
          </label>
        </div>

        <!-- Diagnostic Preview (only visible when opted in) -->
        <div class="lf-feedback-preview lf-u-mb-8px lf-u-p-6px-8px lf-u-bg-rgb0-113-227-008 lf-u-b-1px-dashed-rgb0-113-227-035 lf-u-r-6px lf-u-fs-11px lf-u-lh-1p35" hidden>
          <strong class="lf-u-mb-3px lf-u-c-accent-ink lf-u-d-block">Preview of diagnostic data to be included:</strong>
          <div><strong>Text:</strong> "${escapeHtml(selectedText)}"</div>
          ${effectiveContext ? `<div><strong>Context:</strong> "${escapeHtml(effectiveContext)}"</div>` : ''}
        </div>

        <div class="lf-u-d-flex lf-u-jc-flex-end lf-u-gap-6px">
          <button class="lf-btn-action secondary lf-feedback-cancel-btn lf-u-p-3px-8px lf-u-fs-11px">Cancel</button>
          <button class="lf-btn-action lf-feedback-submit-btn lf-u-p-3px-10px lf-u-fs-11px">Submit Report</button>
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
                <span>${this.renderInteractiveSentence(decodeHtml(f.keyTakeaway), f.question || f.answer)}</span>
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
                <div class="lf-qa-bengali-text">${escapeHtml(decodeHtml(f.bengaliSummary))}</div>
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
                    <div class="lf-qa-example-english">"${this.renderInteractiveSentence(decodeHtml(ex.english), ex.english)}"</div>
                    ${ex.bengali ? `<div class="lf-qa-example-bengali">↳ ${escapeHtml(decodeHtml(ex.bengali))}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Actions Row (Copy, Listen) -->
            <div class="lf-qa-actions-row">
              <button
                type="button"
                class="lf-qa-mini-btn lf-qa-copy-btn"
                data-copy="${escapeHtml(decodeHtml(f.answer + (f.bengaliSummary ? '\n\n' + f.bengaliSummary : '')))}"
                title="Copy answer"
              >
                ${lfIcon('copy')}
                <span>Copy</span>
              </button>
              <button
                type="button"
                class="lf-qa-mini-btn lf-qa-speak-btn"
                data-speak="${escapeHtml(decodeHtml(f.answer))}"
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
                    <button type="button" class="lf-qa-suggested-chip" data-prompt="${escapeHtml(decodeHtml(sug))}" title="${escapeHtml(decodeHtml(sug))}">
                      ${lfIcon('message')}
                      <span>${escapeHtml(decodeHtml(sug))}</span>
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
    return formatClaudeMessageImpl(this.cardContext(), rawText, contextSentence);
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
          this.speakText(textToSpeak, undefined, btn as HTMLElement);
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
          <span class="lf-heading-sentence">${isParagraph ? 'Paragraph Analysis' : 'Text Analysis'}</span>
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
          <div class="lf-u-mb-8px lf-u-p-8px-10px lf-u-bg-rgb255-255-255-004 lf-u-r-6px">
            <div class="lf-u-fs-sublabel lf-u-tt-uppercase lf-u-c-accent-ink lf-u-fw-700 lf-u-mb-2px">
              Main Idea:
            </div>
            <div class="lf-u-fs-english-2 lf-u-c-ink lf-u-lh-1p45">
              ${this.renderInteractiveSentence(para.mainIdea, a.selectedText)}
            </div>
          </div>
        ` : ''}

        <div class="lf-bengali-box lf-u-mb-8px lf-u-p-10px-12px lf-u-r-8px">
          <div class="lf-bengali-box-header lf-u-fs-sublabel lf-u-tt-uppercase lf-u-fw-700 lf-u-mb-3px">
            ${getLanguageConfig(this.targetLanguage)?.targetLang === 'bn' ? 'সম্পূর্ণ বাংলা অর্থ (Full Bengali):' : `${getLanguageConfig(this.targetLanguage)?.flagEmoji || '🌐'} ${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetNativeHeader || 'Translation')} (${escapeHtml(getLanguageConfig(this.targetLanguage)?.targetLabel || 'Target')}):`}
          </div>
          <div class="lf-easy-bengali-text lf-u-fs-bengali lf-u-fw-600 lf-u-lh-1p45">
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
        if (ans.hidden) {
          ans.hidden = false;
          if (btn) btn.textContent = 'Hide answer';
        } else {
          ans.hidden = true;
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
          this.speakText(this.currentStageA.selectedText, this.currentStageA.lemma, btn as HTMLElement);
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
      this.render({ preserveScroll: true, scrollToFeedback: this.showFeedbackModal });
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.hidden = !isChecked;
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
        this.speakText(s.selectedText, undefined, btn as HTMLElement);
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
      this.render({ preserveScroll: true, scrollToFeedback: this.showFeedbackModal });
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.hidden = !isChecked;
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
          reveal.hidden = !reveal.hidden;
        }
      });
    });

    el.querySelectorAll('.lf-practice-opt-btn').forEach((optBtn) => {
      optBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reveal = el.querySelector('.lf-practice-answer-reveal') as HTMLElement;
        if (reveal) {
          reveal.hidden = false;
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
        this.speakText(p.selectedText, undefined, btn as HTMLElement);
      });
    });

    el.querySelectorAll('.lf-voice-mini-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const textToSpeak = btn.getAttribute('data-speak') || '';
        if (textToSpeak) {
          this.speakText(textToSpeak, undefined, btn as HTMLElement);
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
      this.render({ preserveScroll: true, scrollToFeedback: this.showFeedbackModal });
    });

    el.querySelector('.lf-feedback-cancel-btn')?.addEventListener('click', () => {
      this.showFeedbackModal = false;
      this.render();
    });

    el.querySelector('.lf-feedback-optin-checkbox')?.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const previewEl = el.querySelector('.lf-feedback-preview') as HTMLElement | null;
      if (previewEl) {
        previewEl.hidden = !isChecked;
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

  private speakingText: string | null = null;
  private speakingBtn: HTMLElement | null = null;

  /** Plays the text, or stops it when the same text is already playing (the speaker icon doubles as a stop button). */
  private speakText(text: string, lemma?: string, btn?: HTMLElement): void {
    const wasSameText = this.speakingText === text;
    if (this.speakingText !== null) this.stopAudio();
    if (wasSameText) return;

    this.speakingText = text;
    this.setSpeakingButton(btn || null);
    playPronunciation(text, { lemma })
      .catch((err) => {
        console.warn('[LexiFlow Audio] Failed to play natural pronunciation:', err);
      })
      .finally(() => {
        if (this.speakingText === text) {
          this.speakingText = null;
          this.setSpeakingButton(null);
        }
      });
  }

  /** Stops any pronunciation this card started and resets the speaker icon. */
  stopAudio(): void {
    this.speakingText = null;
    this.setSpeakingButton(null);
    stopPronunciation();
  }

  private setSpeakingButton(btn: HTMLElement | null): void {
    const prev = this.speakingBtn;
    if (prev) {
      prev.classList.remove('lf-speaking');
      prev.removeAttribute('aria-pressed');
      const icon = prev.querySelector('svg.lf-svg-icon');
      if (icon) icon.outerHTML = lfIcon('volume');
      const original = prev.getAttribute('data-lf-title');
      if (original !== null) {
        prev.setAttribute('title', original);
        prev.removeAttribute('data-lf-title');
      }
    }
    this.speakingBtn = btn;
    if (btn) {
      btn.classList.add('lf-speaking');
      btn.setAttribute('aria-pressed', 'true');
      const icon = btn.querySelector('svg.lf-svg-icon');
      if (icon) icon.outerHTML = lfIcon('stop');
      btn.setAttribute('data-lf-title', btn.getAttribute('title') || '');
      btn.setAttribute('title', 'Stop audio');
    }
  }
}
