import { HighlightVocabularyItem, HighlightColor, HighlightFilters, HighlightType } from '../types';
import { MainArticleExtractor } from './articleExtractor';

export interface HighlightClickEvent {
  item: HighlightVocabularyItem;
  targetElement: HTMLElement;
  rect: DOMRect;
}

export class DOMHighlighter {
  private items: HighlightVocabularyItem[] = [];
  private itemMap: Map<string, HighlightVocabularyItem> = new Map();
  private highlightMarks: HTMLElement[] = [];
  private currentIndex: number = -1;
  private currentColor: HighlightColor = 'yellow';
  private currentFilters: HighlightFilters = { words: true, phrases: true, idioms: true };
  private onHighlightClick?: ((event: any, rect?: any) => void);

  constructor(options?: {
    color?: HighlightColor;
    filters?: HighlightFilters;
    onHighlightClick?: ((event: any, rect?: any) => void);
  }) {
    if (options?.color) this.currentColor = options.color;
    if (options?.filters) this.currentFilters = options.filters;
    this.onHighlightClick = options?.onHighlightClick;
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById('lexiflow-highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'lexiflow-highlight-styles';
    style.textContent = `
      .lexiflow-highlight {
        border-radius: 4px;
        padding: 1px 3px;
        margin: 0 1px;
        cursor: pointer !important;
        font-weight: 500;
        display: inline;
        text-decoration: none;
        transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
      }

      .lexiflow-highlight:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }

      /* Color Variations */
      .lexiflow-color-yellow {
        background-color: rgba(254, 240, 138, 0.65) !important;
        border-bottom: 2px solid #eab308 !important;
        color: inherit !important;
      }
      .lexiflow-color-yellow:hover {
        background-color: rgba(253, 224, 71, 0.9) !important;
      }

      .lexiflow-color-blue {
        background-color: rgba(191, 219, 254, 0.65) !important;
        border-bottom: 2px solid #3b82f6 !important;
        color: inherit !important;
      }
      .lexiflow-color-blue:hover {
        background-color: rgba(147, 197, 253, 0.9) !important;
      }

      .lexiflow-color-green {
        background-color: rgba(187, 247, 208, 0.65) !important;
        border-bottom: 2px solid #22c55e !important;
        color: inherit !important;
      }
      .lexiflow-color-green:hover {
        background-color: rgba(134, 239, 172, 0.9) !important;
      }

      .lexiflow-color-pink {
        background-color: rgba(251, 207, 232, 0.65) !important;
        border-bottom: 2px solid #ec4899 !important;
        color: inherit !important;
      }
      .lexiflow-color-pink:hover {
        background-color: rgba(244, 114, 182, 0.9) !important;
      }

      .lexiflow-color-purple {
        background-color: rgba(233, 213, 255, 0.65) !important;
        border-bottom: 2px solid #a855f7 !important;
        color: inherit !important;
      }
      .lexiflow-color-purple:hover {
        background-color: rgba(216, 180, 254, 0.9) !important;
      }

      /* Active Navigation Pulse */
      .lexiflow-highlight-active {
        outline: 2.5px solid #0071e3 !important;
        outline-offset: 2px;
        box-shadow: 0 0 12px rgba(0, 113, 227, 0.5) !important;
        animation: lexiflow-pulse 1.4s ease-in-out infinite alternate;
      }

      @keyframes lexiflow-pulse {
        from {
          box-shadow: 0 0 6px rgba(0, 113, 227, 0.4);
        }
        to {
          box-shadow: 0 0 16px rgba(0, 113, 227, 0.85);
        }
      }

      /* Filter Hidden State */
      .lexiflow-highlight.lexiflow-hidden {
        display: inline !important;
        background: transparent !important;
        border-bottom: none !important;
        cursor: inherit !important;
        box-shadow: none !important;
        transform: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  highlightItems(
    items: HighlightVocabularyItem[],
    color: HighlightColor = 'yellow',
    filters: HighlightFilters = { words: true, phrases: true, idioms: true }
  ): number {
    this.clearHighlights();
    this.items = items;
    this.itemMap.clear();
    this.currentColor = color;
    this.currentFilters = filters;

    if (!items || items.length === 0) return 0;

    for (const item of items) {
      this.itemMap.set(item.id, item);
    }

    // Sort items by text length descending so longer phrases match before sub-words
    const sortedItems = [...items].sort((a, b) => b.text.length - a.text.length);

    // Identify readable candidate containers
    const containers = this.findReadableContainers();

    for (const item of sortedItems) {
      this.highlightItemInContainers(item, containers);
    }

    this.applyFilters(this.currentFilters);
    return this.highlightMarks.length;
  }

  private findReadableContainers(): HTMLElement[] {
    const article = MainArticleExtractor.findMainArticle();
    if (article && article.container && article.paragraphs.length > 0) {
      const set = new Set<HTMLElement>([article.container, ...article.paragraphs]);
      return Array.from(set);
    }
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'article, main, [role="main"], section, p'
      )
    );
    if (candidates.length === 0) {
      return [document.body];
    }
    return candidates.filter((el) => !this.isUnsuitableElement(el));
  }

  private isUnsuitableElement(el: Element | null): boolean {
    return MainArticleExtractor.isUnsuitableOrNoise(el);
  }

  private highlightItemInContainers(item: HighlightVocabularyItem, containers: HTMLElement[]): void {
    const searchText = item.text.trim();
    if (!searchText) return;

    // Word boundary regex
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isWord = item.type === 'word';
    const pattern = isWord
      ? new RegExp(`\\b${escaped}\\b`, 'i')
      : new RegExp(`${escaped}`, 'i');

    const seenNodes = new Set<Text>();
    const textNodes: Text[] = [];

    for (const container of containers) {
      if (this.isUnsuitableElement(container)) continue;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          if (this.isUnsuitableElement(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement?.classList.contains('lexiflow-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let current: Node | null;
      while ((current = walker.nextNode())) {
        const tn = current as Text;
        if (!seenNodes.has(tn)) {
          seenNodes.add(tn);
          textNodes.push(tn);
        }
      }
    }

    const matchesToApply: Array<{ node: Text; match: RegExpExecArray }> = [];
    const context = (item.contextSentence || (item as any).context || '').trim();

    // 1. Primary preference: If a specific context sentence is provided, target specifically inside that sentence
    if (context && context.length > 10) {
      const sPrefix = context.slice(0, 30).toLowerCase();
      for (const tn of textNodes) {
        if (!tn.parentElement) continue;
        const parentText = (tn.parentElement.textContent || '').toLowerCase();
        if (parentText.includes(sPrefix) || sPrefix.includes(parentText.slice(0, 20))) {
          const m = pattern.exec(tn.nodeValue || '');
          if (m && m.index !== undefined) {
            matchesToApply.push({ node: tn, match: m });
            break; // Target single intended pedagogical occurrence in context sentence
          }
        }
      }
    }

    // 2. Fallback: If no context sentence was specified or matched, highlight across distinct block elements
    // (At most 1 highlight per block element like paragraph/heading, capped at 3 to prevent spamming)
    if (matchesToApply.length === 0) {
      const seenBlocks = new Set<Element>();
      for (const tn of textNodes) {
        if (!tn.parentElement) continue;
        const block = tn.parentElement.closest('p, li, blockquote, div, section, article') || tn.parentElement;
        if (seenBlocks.has(block)) continue;

        const m = pattern.exec(tn.nodeValue || '');
        if (m && m.index !== undefined) {
          seenBlocks.add(block);
          matchesToApply.push({ node: tn, match: m });
          if (matchesToApply.length >= 3) break;
        }
      }
    }

    for (const { node, match } of matchesToApply) {
      if (!node.parentNode || !node.nodeValue) continue;
      const matchIdx = match.index;
      const matchLen = match[0].length;

      // Split text node: before, match, after
      const matchedNode = node.splitText(matchIdx);
      matchedNode.splitText(matchLen);

      const itemCat = (item as any).category || item.type || 'word';
      const mark = document.createElement('mark');
      mark.className = `lexiflow-highlight lexiflow-color-${this.currentColor} lexiflow-type-${itemCat}`;
      mark.setAttribute('data-lexiflow-id', item.id || `hl_${Math.random().toString(36).slice(2, 8)}`);
      mark.setAttribute('data-lexiflow-text', item.text);
      mark.setAttribute('data-lexiflow-type', itemCat);
      mark.setAttribute('data-category', itemCat);
      mark.textContent = matchedNode.nodeValue;

      mark.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        this.setActiveMark(target);
        const eventObj = Object.assign({ item, targetElement: target, rect }, item);
        this.onHighlightClick?.(eventObj, rect);
      });

      matchedNode.parentNode.replaceChild(mark, matchedNode);
      this.highlightMarks.push(mark);
    }
  }

  applyHighlights(
    items: HighlightVocabularyItem[],
    container?: HTMLElement
  ): number {
    this.clearHighlights();
    this.items = items;
    this.itemMap.clear();

    if (!items || items.length === 0) return 0;

    for (const item of items) {
      const id = item.id || `hl_${Math.random().toString(36).slice(2, 8)}`;
      (item as any).id = id;
      this.itemMap.set(id, item);
    }

    // 1. Sort items by text length descending so longer phrases match first
    const sortedItems = [...items].sort((a, b) => b.text.length - a.text.length);

    // 2. Drop sub-word fragments when a complete multiword phrase covers them
    const multiwordTexts = sortedItems
      .filter((it) => it.text.trim().includes(' '))
      .map((it) => it.text.trim().toLowerCase());

    const filteredItems = sortedItems.filter((item) => {
      const itemText = item.text.trim().toLowerCase();
      if (!itemText.includes(' ')) {
        const escapedWord = itemText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
        for (const mw of multiwordTexts) {
          if (mw !== itemText && wordRegex.test(mw)) {
            return false; // Skip sub-word to prevent broken side-by-side [word1][word2] tags
          }
        }
      }
      return true;
    });

    const containers = container ? [container] : this.findReadableContainers();

    for (const item of filteredItems) {
      this.highlightItemInContainers(item, containers);
    }

    this.applyFilters(this.currentFilters);
    return this.highlightMarks.length;
  }

  updateFilters(filters: HighlightFilters): void {
    this.setFilters(filters);
  }

  updateColor(color: HighlightColor): void {
    this.setColor(color);
  }

  navigateToNext(): HTMLElement | null {
    this.nextHighlight();
    const visible = this.getVisibleMarks();
    return visible[this.currentIndex] || null;
  }

  navigateToPrev(): HTMLElement | null {
    this.prevHighlight();
    const visible = this.getVisibleMarks();
    return visible[this.currentIndex] || null;
  }

  getHighlightCount(): number {
    return this.highlightMarks.length;
  }

  setColor(color: HighlightColor): void {
    const oldColor = this.currentColor;
    this.currentColor = color;
    for (const mark of this.highlightMarks) {
      mark.classList.remove(`lexiflow-color-${oldColor}`);
      mark.classList.add(`lexiflow-color-${color}`);
    }
  }

  setFilters(filters: HighlightFilters): void {
    this.currentFilters = filters;
    this.applyFilters(filters);
  }

  private applyFilters(filters: HighlightFilters): void {
    for (const mark of this.highlightMarks) {
      const type = (mark.getAttribute('data-category') || mark.getAttribute('data-lexiflow-type')) as HighlightType;
      const isVisible =
        (type === 'word' && filters.words) ||
        (type === 'phrase' && filters.phrases) ||
        (type === 'idiom' && filters.idioms);

      if (isVisible) {
        mark.classList.remove('lexiflow-hidden', 'lf-highlight-hidden');
      } else {
        mark.classList.add('lexiflow-hidden', 'lf-highlight-hidden');
      }
    }
  }

  getVisibleMarks(): HTMLElement[] {
    return this.highlightMarks.filter((m) => !m.classList.contains('lexiflow-hidden') && !m.classList.contains('lf-highlight-hidden'));
  }

  nextHighlight(): { index: number; total: number; item: HighlightVocabularyItem | null } {
    const visible = this.getVisibleMarks();
    if (visible.length === 0) {
      return { index: 0, total: 0, item: null };
    }

    this.currentIndex = (this.currentIndex + 1) % visible.length;
    const target = visible[this.currentIndex];
    this.setActiveMark(target);
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const id = target.getAttribute('data-lexiflow-id') || '';
    const item = this.itemMap.get(id) || null;
    return { index: this.currentIndex + 1, total: visible.length, item };
  }

  prevHighlight(): { index: number; total: number; item: HighlightVocabularyItem | null } {
    const visible = this.getVisibleMarks();
    if (visible.length === 0) {
      return { index: 0, total: 0, item: null };
    }

    this.currentIndex = (this.currentIndex - 1 + visible.length) % visible.length;
    const target = visible[this.currentIndex];
    this.setActiveMark(target);
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const id = target.getAttribute('data-lexiflow-id') || '';
    const item = this.itemMap.get(id) || null;
    return { index: this.currentIndex + 1, total: visible.length, item };
  }

  private setActiveMark(target: HTMLElement): void {
    for (const m of this.highlightMarks) {
      m.classList.remove('lexiflow-highlight-active');
    }
    target.classList.add('lexiflow-highlight-active');
  }

  clearHighlights(): void {
    for (const mark of this.highlightMarks) {
      mark.classList.remove('lexiflow-highlight-active');
      const parent = mark.parentNode;
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '');
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    }
    this.highlightMarks = [];
    this.items = [];
    this.itemMap.clear();
    this.currentIndex = -1;
  }

  getCount(): { total: number; words: number; phrases: number; idioms: number; visible: number } {
    const visible = this.getVisibleMarks();
    let words = 0;
    let phrases = 0;
    let idioms = 0;

    for (const m of visible) {
      const type = m.getAttribute('data-lexiflow-type');
      if (type === 'word') words++;
      else if (type === 'phrase') phrases++;
      else if (type === 'idiom') idioms++;
    }

    return {
      total: this.highlightMarks.length,
      visible: visible.length,
      words,
      phrases,
      idioms
    };
  }

  getDiscoveredItems(): HighlightVocabularyItem[] {
    return this.items;
  }
}
