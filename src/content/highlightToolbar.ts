import { HighlightColor, HighlightFilters, HighlightVocabularyItem } from '../types';
import { escapeHtml } from './popupHtml';

export interface HighlightToolbarCallbacks {
  onAnalyzePage: () => void;
  onClearHighlights: () => void;
  onNext: () => void;
  onPrev: () => void;
  onColorChange: (color: HighlightColor) => void;
  onFilterChange: (filters: HighlightFilters) => void;
  onSelectSummaryItem: (item: HighlightVocabularyItem) => void;
  onClose?: () => void;
}

export class HighlightToolbar {
  private element: HTMLElement;
  private callbacks: HighlightToolbarCallbacks;
  private currentColor: HighlightColor = 'yellow';
  private currentFilters: HighlightFilters = { words: true, phrases: true, idioms: true };
  private itemCount: { total: number; visible: number; words: number; phrases: number; idioms: number } = {
    total: 0,
    visible: 0,
    words: 0,
    phrases: 0,
    idioms: 0
  };
  private currentIndex: number = 0;
  private isSummaryOpen: boolean = false;
  private discoveredItems: HighlightVocabularyItem[] = [];
  private isLoading: boolean = false;

  constructor(callbacks: HighlightToolbarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'lexiflow-highlight-toolbar-container';
    this.element.setAttribute('data-theme', 'dark');
    this.render();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.render();
  }

  updateState(params: {
    color?: HighlightColor;
    filters?: HighlightFilters;
    count?: { total: number; visible: number; words: number; phrases: number; idioms: number };
    currentIndex?: number;
    discoveredItems?: HighlightVocabularyItem[];
  }): void {
    if (params.color) this.currentColor = params.color;
    if (params.filters) this.currentFilters = { ...params.filters };
    if (params.count) this.itemCount = params.count;
    if (params.currentIndex !== undefined) this.currentIndex = params.currentIndex;
    if (params.discoveredItems !== undefined) this.discoveredItems = params.discoveredItems;
    this.render();
  }

  render(): void {
    const { total, visible } = this.itemCount;
    const colors: HighlightColor[] = ['yellow', 'blue', 'green', 'pink', 'purple'];

    this.element.innerHTML = `
      <div class="lf-hl-bar" role="toolbar" aria-label="LexiFlow AI Highlight Toolbar">
        <!-- Brand / Status Pill -->
        <div class="lf-hl-brand">
          <span class="lf-hl-sparkle">✨</span>
          <span class="lf-hl-title">AI Highlights</span>
          <span class="lf-hl-badge ${visible > 0 ? 'active' : ''}">
            ${this.isLoading ? 'Analyzing...' : (total > 0 ? `${visible} found` : 'Ready')}
          </span>
        </div>

        <div class="lf-hl-divider"></div>

        <!-- Main Action Buttons -->
        <div class="lf-hl-actions">
          ${total === 0 ? `
            <button type="button" class="lf-hl-btn primary" id="lf-hl-analyze-btn" title="Discover and highlight learning vocabulary across this page" ${this.isLoading ? 'disabled' : ''}>
              ${this.isLoading ? '⏳ Scanning Page...' : '🔍 Highlight All'}
            </button>
          ` : `
            <div class="lf-hl-nav-group">
              <button type="button" class="lf-hl-btn-icon" id="lf-hl-prev-btn" title="Previous highlight (Shift+Tab)">
                ▲
              </button>
              <span class="lf-hl-counter" title="Current highlight position">
                ${this.currentIndex > 0 ? `${this.currentIndex}/${visible}` : `${visible}`}
              </span>
              <button type="button" class="lf-hl-btn-icon" id="lf-hl-next-btn" title="Next highlight (Tab)">
                ▼
              </button>
            </div>

            <button type="button" class="lf-hl-btn ${this.isSummaryOpen ? 'active' : ''}" id="lf-hl-summary-toggle" title="View discovered vocabulary summary">
              📋 Summary
            </button>

            <button type="button" class="lf-hl-btn-icon danger" id="lf-hl-clear-btn" title="Clear highlights from page">
              ✕
            </button>
          `}
        </div>

        <div class="lf-hl-divider"></div>

        <!-- Filter Chips -->
        <div class="lf-hl-filters">
          <button type="button" class="lf-hl-chip ${this.currentFilters.words ? 'selected' : ''}" data-filter="words" title="Toggle Words">
            W
          </button>
          <button type="button" class="lf-hl-chip ${this.currentFilters.phrases ? 'selected' : ''}" data-filter="phrases" title="Toggle Phrases & Collocations">
            P
          </button>
          <button type="button" class="lf-hl-chip ${this.currentFilters.idioms ? 'selected' : ''}" data-filter="idioms" title="Toggle Idioms">
            I
          </button>
        </div>

        <!-- Color Palette Picker -->
        <div class="lf-hl-colors">
          ${colors.map((c) => `
            <button
              type="button"
              class="lf-hl-color-dot color-${c} ${this.currentColor === c ? 'active' : ''}"
              data-color="${c}"
              title="Highlight color: ${c}"
              aria-label="${c}"
            ></button>
          `).join('')}
        </div>
      </div>

      <!-- Discovered Vocabulary Summary Drawer -->
      ${this.isSummaryOpen && this.discoveredItems.length > 0 ? `
        <div class="lf-hl-summary-card">
          <div class="lf-hl-summary-header">
            <div>
              <h4 class="lf-hl-summary-title">Discovered Vocabulary (${this.discoveredItems.length})</h4>
              <p class="lf-hl-summary-subtitle">Click any item to inspect its complete contextual meaning and grammar</p>
            </div>
            <button type="button" class="lf-hl-btn-icon" id="lf-hl-summary-close" title="Close summary">✕</button>
          </div>
          <div class="lf-hl-summary-list">
            ${this.discoveredItems.map((item) => `
              <div class="lf-hl-summary-item" data-id="${escapeHtml(item.id)}">
                <div class="lf-hl-summary-item-top">
                  <div class="lf-hl-summary-term">
                    <span class="lf-hl-type-tag type-${escapeHtml(item.type)}">${escapeHtml(item.type.toUpperCase())}</span>
                    <strong>${escapeHtml(item.text)}</strong>
                  </div>
                  <span class="lf-hl-diff-badge diff-${escapeHtml(item.difficulty)}">${escapeHtml(item.difficulty)}</span>
                </div>
                <div class="lf-hl-summary-meaning">${escapeHtml(item.easyEnglish)}</div>
                ${item.easyBengali ? `<div class="lf-hl-summary-bengali">${escapeHtml(item.easyBengali)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Analyze button
    const analyzeBtn = this.element.querySelector('#lf-hl-analyze-btn');
    analyzeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onAnalyzePage();
    });

    // Clear button
    const clearBtn = this.element.querySelector('#lf-hl-clear-btn');
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onClearHighlights();
    });

    // Prev / Next
    const prevBtn = this.element.querySelector('#lf-hl-prev-btn');
    prevBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onPrev();
    });

    const nextBtn = this.element.querySelector('#lf-hl-next-btn');
    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onNext();
    });

    // Summary Toggle
    const summaryBtn = this.element.querySelector('#lf-hl-summary-toggle');
    summaryBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isSummaryOpen = !this.isSummaryOpen;
      this.render();
    });

    const summaryCloseBtn = this.element.querySelector('#lf-hl-summary-close');
    summaryCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isSummaryOpen = false;
      this.render();
    });

    // Filters
    this.element.querySelectorAll('.lf-hl-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const filterType = (chip as HTMLElement).getAttribute('data-filter') as keyof HighlightFilters;
        if (filterType) {
          this.currentFilters[filterType] = !this.currentFilters[filterType];
          this.callbacks.onFilterChange(this.currentFilters);
          this.render();
        }
      });
    });

    // Colors
    this.element.querySelectorAll('.lf-hl-color-dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (dot as HTMLElement).getAttribute('data-color') as HighlightColor;
        if (color) {
          this.currentColor = color;
          this.callbacks.onColorChange(color);
          this.render();
        }
      });
    });

    // Summary Items 1-click lookup
    this.element.querySelectorAll('.lf-hl-summary-item').forEach((itemEl) => {
      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (itemEl as HTMLElement).getAttribute('data-id');
        const found = this.discoveredItems.find((it) => it.id === id);
        if (found) {
          this.callbacks.onSelectSummaryItem(found);
        }
      });
    });
  }
}
