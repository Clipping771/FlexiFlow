/**
 * Main Article Detection & Content Extractor
 * Identifies the primary editorial article body on news sites, blogs, and essays,
 * strictly filtering out headers, footers, sidebars, navigation, ads, and comment sections,
 * while ensuring the FULL article (intro, all body paragraphs, sections) is completely captured.
 */
export interface ArticleExtraction {
  container: HTMLElement;
  title: string;
  paragraphs: HTMLElement[];
  cleanText: string;
}

export class MainArticleExtractor {
  private static readonly NOISE_SELECTORS = [
    'header',
    'footer',
    'nav',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '.sidebar',
    '#sidebar',
    '.comments',
    '#comments',
    '.comment-section',
    '.advertisement',
    '.ad-container',
    '.ad-banner',
    '.social-share',
    '.share-buttons',
    '.related-news',
    '.related-articles',
    '.trending',
    '.most-read',
    '.author-bio',
    '.site-header',
    '.site-footer',
    '#lexiflow-host'
  ];

  private static readonly ARTICLE_CANDIDATE_SELECTORS = [
    'article',
    '[itemprop="articleBody"]',
    '[role="article"]',
    '.field--name-body',
    '.node__content',
    '.field--type-text-with-summary',
    '.story-content',
    '.story-body',
    '.article-body',
    '.article__body',
    '.article-content',
    '.article__content',
    '.entry-content',
    '.post-content',
    '#article-body',
    '.story-detail',
    '.article-details',
    '.story-text',
    '.article-wrapper',
    '.story-wrapper',
    '.article-wrap',
    '.story-wrap',
    '[role="main"] article',
    'main article',
    '[role="main"]',
    'main',
    '.main-content',
    '#main-content'
  ];

  /**
   * Discovers the primary editorial article container on the page,
   * guaranteeing complete coverage of the full article.
   */
  static findMainArticle(): ArticleExtraction | null {
    const docTitle = document.title || '';
    const h1 = document.querySelector('h1')?.textContent?.trim() || docTitle;

    // 1. Collect all candidate containers
    const candidates: HTMLElement[] = [];
    for (const sel of this.ARTICLE_CANDIDATE_SELECTORS) {
      try {
        const found = Array.from(document.querySelectorAll<HTMLElement>(sel));
        for (const el of found) {
          if (!this.isUnsuitableOrNoise(el) && !candidates.includes(el)) {
            candidates.push(el);
          }
        }
      } catch {
        // ignore selector errors
      }
    }

    // 2. Score candidates based on readable paragraph text and paragraph count
    let bestContainer: HTMLElement | null = null;
    let bestScore = -1;

    for (const cand of candidates) {
      const score = this.scoreContainer(cand);
      if (score > bestScore) {
        bestScore = score;
        bestContainer = cand;
      }
    }

    // 3. Fallback: If no candidate container reached threshold, scan top-level sections/divs
    if (!bestContainer || bestScore < 80) {
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>('body > div, body > section, body > main, main > div, [role="main"] > div')
      );
      for (const block of blocks) {
        if (this.isUnsuitableOrNoise(block)) continue;
        const score = this.scoreContainer(block);
        if (score > bestScore) {
          bestScore = score;
          bestContainer = block;
        }
      }
    }

    if (!bestContainer) {
      bestContainer = (document.querySelector('main') || document.body) as HTMLElement;
    }

    // 4. Ancestor Expansion:
    // If bestContainer has few paragraphs (e.g. only intro lead or only a single subsection),
    // check its parent and grandparent elements. If the parent contains significantly more valid
    // article paragraphs without introducing noise, expand bestContainer to the parent!
    let expanded = bestContainer;
    while (
      expanded &&
      expanded.parentElement &&
      expanded.parentElement !== document.body &&
      expanded.parentElement !== document.documentElement
    ) {
      const parent = expanded.parentElement;
      if (this.isUnsuitableOrNoise(parent)) break;

      const parentParas = this.getValidSubstantiveParagraphs(parent);
      const currentParas = this.getValidSubstantiveParagraphs(expanded);

      if (parentParas.length > currentParas.length) {
        const parentScore = this.scoreContainer(parent);
        if (parentScore >= bestScore * 0.85) {
          expanded = parent;
          bestContainer = parent;
          bestScore = parentScore;
          continue;
        }
      }
      break;
    }

    // 5. Global Substantive Paragraphs & LCA Check:
    // If the chosen container only captured a fraction of all substantive editorial paragraphs
    // on the page, find their Lowest Common Ancestor so the entire article body is preserved!
    let finalParagraphs = this.getValidSubstantiveParagraphs(bestContainer);
    const allPageParas = this.getAllSubstantivePageParagraphs();

    if (allPageParas.length >= 2 && finalParagraphs.length < allPageParas.length * 0.7) {
      const lca = this.findLowestCommonAncestor(allPageParas);
      if (lca && lca !== document.body && lca !== document.documentElement && !this.isUnsuitableOrNoise(lca)) {
        bestContainer = lca;
        finalParagraphs = this.getValidSubstantiveParagraphs(lca);
      }
      if (finalParagraphs.length < allPageParas.length * 0.7) {
        finalParagraphs = allPageParas;
      }
    }

    const cleanText = finalParagraphs.map((p) => p.textContent?.trim() || '').join('\n\n');

    return {
      container: bestContainer,
      title: h1,
      paragraphs: finalParagraphs,
      cleanText: cleanText || bestContainer.innerText || ''
    };
  }

  /**
   * Discovers all substantive editorial paragraphs across the page outside noise areas
   */
  public static getAllSubstantivePageParagraphs(): HTMLElement[] {
    const list = Array.from(document.querySelectorAll<HTMLElement>('p, blockquote'));
    return list.filter((p) => {
      if (this.isUnsuitableOrNoise(p)) return false;
      const text = p.textContent?.trim() || '';
      return text.length > 25 && this.getLinkDensity(p) < 0.45;
    });
  }

  /**
   * Finds the lowest common ancestor of a list of elements
   */
  public static findLowestCommonAncestor(elements: HTMLElement[]): HTMLElement | null {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0].parentElement;

    let ancestors: HTMLElement[] = [];
    let curr: HTMLElement | null = elements[0].parentElement;
    while (curr && curr !== document.documentElement) {
      ancestors.push(curr);
      curr = curr.parentElement;
    }

    for (let i = 1; i < elements.length; i++) {
      let elCurr: HTMLElement | null = elements[i].parentElement;
      const elAncestors = new Set<HTMLElement>();
      while (elCurr && elCurr !== document.documentElement) {
        elAncestors.add(elCurr);
        elCurr = elCurr.parentElement;
      }
      ancestors = ancestors.filter((a) => elAncestors.has(a));
      if (ancestors.length === 0) return document.body;
    }

    return ancestors[0] || document.body;
  }

  /**
   * Returns substantive paragraphs under a container with noise and widget links filtered out
   */
  public static getValidSubstantiveParagraphs(container: HTMLElement): HTMLElement[] {
    const list = Array.from(container.querySelectorAll<HTMLElement>('p, blockquote'));
    return list.filter((p) => {
      if (this.isUnsuitableOrNoise(p)) return false;
      const text = p.textContent?.trim() || '';
      return text.length > 25 && this.getLinkDensity(p) < 0.45;
    });
  }

  /**
   * Scores a container based on substantive story text, paragraph count, and low link density
   */
  private static scoreContainer(container: HTMLElement): number {
    const paragraphs = this.getValidSubstantiveParagraphs(container);
    if (paragraphs.length === 0) return 0;

    let totalChars = 0;
    let linkChars = 0;

    for (const p of paragraphs) {
      const pText = p.textContent?.trim() || '';
      totalChars += pText.length;
      const links = Array.from(p.querySelectorAll('a'));
      for (const a of links) {
        linkChars += (a.textContent?.trim() || '').length;
      }
    }

    if (totalChars < 80) return 0;

    const linkDensity = totalChars > 0 ? linkChars / totalChars : 0;
    if (linkDensity > 0.45) return 0;

    let score = totalChars * (1 - linkDensity);
    score += paragraphs.length * 40;

    // Bonus for semantic tags and article class names
    const tag = container.tagName.toLowerCase();
    if (tag === 'article') score += 150;
    if (container.getAttribute('itemprop') === 'articleBody') score += 200;
    if (container.className && /story|article|entry-content|node__content|field--name-body/i.test(container.className)) {
      score += 120;
    }

    return score;
  }

  private static getLinkDensity(el: HTMLElement): number {
    const text = el.textContent?.trim() || '';
    if (!text) return 0;
    const links = Array.from(el.querySelectorAll('a'));
    const linkText = links.map((a) => a.textContent?.trim() || '').join('');
    return linkText.length / text.length;
  }

  /**
   * Accurately flags noise elements without false-positive rejection of article layout containers
   */
  public static isUnsuitableOrNoise(el: Element | null): boolean {
    if (!el) return false;

    const tag = el.tagName.toLowerCase();
    if (
      tag === 'script' ||
      tag === 'style' ||
      tag === 'noscript' ||
      tag === 'textarea' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'button' ||
      tag === 'svg' ||
      tag === 'canvas' ||
      tag === 'header' ||
      tag === 'footer' ||
      tag === 'nav' ||
      tag === 'aside'
    ) {
      return true;
    }

    if (el.id === 'lexiflow-host' || el.closest('#lexiflow-host')) {
      return true;
    }

    if (el.getAttribute('contenteditable') === 'true' || el.closest('[contenteditable="true"]')) {
      return true;
    }

    const classIdStr = `${el.className || ''} ${el.id || ''}`.toLowerCase();

    // NEVER flag recognized core article elements as noise!
    if (
      tag === 'article' ||
      tag === 'main' ||
      el.getAttribute('itemprop') === 'articleBody' ||
      el.getAttribute('role') === 'main' ||
      /article-body|story-body|article-content|story-content|field--name-body|node__content|entry-content/i.test(classIdStr)
    ) {
      return false;
    }

    // Do NOT flag layout classes like "with-sidebar", "has-sidebar", "layout--sidebar"
    if (/\b(with|has|layout|content|col)[-_]sidebar\b/i.test(classIdStr)) {
      return false;
    }

    // Check specific noise container patterns using word boundaries
    if (
      /\b(comments?|advertisement|ad[-_]container|ad[-_]banner|ad[-_]box|dfp[-_]ad|social[-_]share|share[-_]buttons?|share[-_]tools?|related[-_](news|articles?|stories)|trending[-_]news|most[-_]read|author[-_]bio|site[-_]header|site[-_]footer)\b/i.test(
        classIdStr
      )
    ) {
      return true;
    }

    // If an element itself is the sidebar
    if (el.matches('.sidebar, #sidebar, [role="complementary"]')) {
      return true;
    }

    return false;
  }
}
