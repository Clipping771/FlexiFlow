import { SelectionType } from '../types';

export interface SelectionData {
  text: string;
  cleanText: string;
  selectionType: SelectionType;
  contextSentence: string;
  nearbyParagraph: string;
  rect: DOMRect;
}

export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  let curr: Element | null = element;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const tag = curr.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    const el = curr as HTMLElement;
    if (
      el.isContentEditable ||
      el.contentEditable === 'true' ||
      curr.getAttribute('contenteditable') === 'true' ||
      curr.getAttribute('role') === 'textbox'
    ) {
      return true;
    }
    curr = curr.parentElement;
  }
  return false;
}

export function detectSelectionType(text: string): SelectionType {
  const trimmed = text.trim();
  if (!trimmed) return 'word';

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount <= 1) {
    return 'word';
  }

  // 1. Check for paragraph:
  // Explicit multi-paragraph blocks separated by double newlines
  const doubleNewlineBlocks = trimmed.split(/\n\s*\n+/).filter((line) => line.trim().length > 0);
  if (doubleNewlineBlocks.length >= 2) {
    return 'paragraph';
  }

  // Multiple completed sentences detected using robust sentence segmentation (with abbreviation/number protection)
  const sentences = splitIntoSentences(trimmed);
  if (sentences.length >= 2) {
    return 'paragraph';
  }

  // Check for internal sentence boundary (e.g. terminal punctuation followed by space and capital letter/number/quote)
  const sanitizedForBoundary = trimmed.replace(
    /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K|Jan|Feb|Mar|Apr|Aug|Sept|Oct|Nov|Dec)\./gi,
    'ABBR'
  ).replace(/\b\d+\.\d+\b/g, 'NUM');
  const internalSentenceEndings = sanitizedForBoundary.match(/[.!?]["'”’]?\s+[A-Z0-9"“'‘]/g) || [];
  if (internalSentenceEndings.length >= 1) {
    return 'paragraph';
  }

  // If text is very long with multiple terminal punctuation marks (> 50 words and 2+ sentence boundaries)
  if (wordCount > 50 && (trimmed.match(/[.!?]/g) || []).length >= 2) {
    return 'paragraph';
  }

  // 2. Sentence vs Phrase:
  // If ends with sentence punctuation (. ! ?)
  const endsWithTerminal = /[.!?]["'”’]?$/.test(trimmed);
  if (endsWithTerminal) {
    // 2 or more words ending with terminal punctuation is a sentence
    return 'sentence';
  }

  // 3. For text without terminal punctuation (Headlines, article titles, clauses, fragments):
  // Common finite, auxiliary, modal, and news headline action verbs
  const verbPattern = /\b(?:is|are|was|were|am|be|been|being|has|have|had|do|does|did|will|would|shall|should|can|could|may|might|must|battle|battled|battles|blaze|blazes|blazed|fight|fights|fighting|hit|hits|hitting|kill|kills|killed|die|dies|died|strike|strikes|struck|break|breaks|broke|broken|swept|sweep|sweeps|shut|shuts|halt|halts|halted|spark|sparks|sparked|erupt|erupts|erupted|face|faces|faced|seek|seeks|sought|win|wins|won|lose|loses|lost|take|takes|took|taken|make|makes|made|get|gets|got|give|gives|gave|given|say|says|said|tell|tells|told|go|goes|went|gone|come|comes|came|see|sees|saw|seen|know|knows|knew|known|think|thinks|thought|find|finds|found|leave|leaves|left|feel|feels|felt|bring|brings|brought|hold|holds|held|write|writes|wrote|written|stand|stands|stood|hear|hears|heard|let|lets|run|runs|ran|pay|pays|paid|sit|sits|sat|speak|speaks|spoke|spoken|lead|leads|led|read|reads|grow|grew|fall|fell|fallen|send|sends|sent|build|builds|built|stay|stays|stayed|cut|cuts|reach|reaches|reached|remain|remains|remained|suggest|suggests|suggested|raise|raises|raised|pass|passes|passed|sell|sells|sold|require|requires|required|report|reports|reported|decide|decides|decided|pull|pulls|pulled|agree|agrees|agreed|hope|hopes|hoped|develop|develops|developed|carry|carries|carried|receive|receives|received|join|joins|joined|create|creates|created|happen|happens|happened|appear|appears|appeared|cause|causes|caused|threaten|threatens|threatened|announce|announces|announced|protest|protests|protested|arrest|arrests|arrested|charge|charges|charged|pledge|pledges|pledged|urge|urges|urged|warn|warns|warned|order|orders|ordered|demand|demands|demanded|ban|bans|banned|meet|meets|met|begin|begins|began|cost|costs|shoot|shoots|shot|drive|drove|clash|clashes|clashed|injure|injures|injured|destroy|destroys|destroyed|damage|damages|damaged|burn|burns|burned|burnt|[a-z]{3,}ed|[a-z]{3,}s)\b/i;

  const hasVerb = verbPattern.test(trimmed);

  // Check for clause markers connecting subjects and verbs
  const hasClauseConnectors = /\b(?:although|because|while|since|whereas|if|unless|whenever|after|before|until|as soon as|so that|that|which|who|whom|whose)\b/i.test(trimmed);

  // Check for headline / sentence subject starters:
  // - Pronouns: I, you, he, she, it, we, they, someone, etc.
  const hasPronounSubject = /^(?:i|you|he|she|it|we|they|someone|anyone|everyone|nobody|some|many|all)\b/i.test(trimmed);

  // 4. Short selections (2-3 words) without terminal punctuation:
  // If it has an overt pronoun subject + verb ("he laughed", "she cried", "they won"), it's a short sentence.
  if (wordCount <= 3) {
    if (hasPronounSubject && hasVerb) {
      return 'sentence';
    }
    return 'phrase';
  }

  // 5. For selections with 4 or more words without terminal punctuation:
  // Check for headline / sentence subject starters:
  // - Numbers or counts: "19 fire engines...", "Three dead...", "Over 100 students..."
  const hasNumberSubject = /^(?:\d+|(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|over|more than|at least)\s+\d+|\d+\s+[a-z]+)/i.test(trimmed);

  // - Determiners: "The committee...", "A major fire...", "This decision..."
  const hasDeterminerSubject = /^(?:the|a|an|this|that|these|those)\s+/i.test(trimmed);

  // - Proper Noun / Capitalized Subject (standard headline form like "Police arrest...", "Bangladesh wins...", "NASA discovers...")
  // Note: NO /i flag, must start with actual capital letter
  const hasCapitalizedSubject = /^[A-Z][a-zA-Z0-9-]*\s+/.test(trimmed);

  // Prepositional phrases starting with prepositions (e.g. "under the direct supervision of the chief medical officer", "on the other hand")
  const startsWithPreposition = /^(?:in|on|at|under|with|by|for|from|about|into|through|during|before|after|above|below|to|upon|against|between|without|as per|in terms of|in spite of|according to)\b/i.test(trimmed);

  if (startsWithPreposition && !hasPronounSubject && !hasNumberSubject) {
    if (!hasClauseConnectors && wordCount <= 15) {
      return 'phrase';
    }
  }

  // If there's a subject + verb structure, it's definitely a sentence (even without period!)
  if ((hasPronounSubject || hasNumberSubject || hasDeterminerSubject || hasCapitalizedSubject) && hasVerb) {
    return 'sentence';
  }

  if (hasClauseConnectors && hasVerb) {
    return 'sentence';
  }

  // Any selection with a verb and >= 4 words is a sentence / clause
  if (hasVerb && wordCount >= 4) {
    return 'sentence';
  }

  // Any selection with 7 or more words without a preposition start is almost certainly a title or sentence
  if (wordCount >= 7) {
    return 'sentence';
  }

  // Default for short expressions without clear verb / subject structure: phrase
  return 'phrase';
}

export function extractSurroundingContext(range: Range): { sentence: string; paragraph: string } {
  let sentence = '';
  let paragraph = '';

  try {
    const container = range.startContainer;
    const textNode = container.textContent || '';
    const offset = range.startOffset;

    // Search backward for sentence boundary (. ! ? \n)
    let startIdx = 0;
    for (let i = offset; i >= 0; i--) {
      const char = textNode[i];
      if (char === '.' || char === '!' || char === '?' || char === '\n') {
        startIdx = i + 1;
        break;
      }
    }

    // Search forward for sentence boundary
    let endIdx = textNode.length;
    for (let i = offset; i < textNode.length; i++) {
      const char = textNode[i];
      if (char === '.' || char === '!' || char === '?' || char === '\n') {
        endIdx = i + 1;
        break;
      }
    }

    const localSentence = textNode.substring(startIdx, endIdx).trim();
    if (localSentence.length > 5) {
      sentence = localSentence;
    }

    // Extract enclosing block element for paragraph context (supporting both standard web DOM and PDF text layers)
    let parent = container.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const display = window.getComputedStyle(parent).display;
      const isBlock = display === 'block' || display === 'flex' || parent.tagName === 'P' || parent.tagName === 'ARTICLE';
      const isPdfLayer = parent.classList.contains('textLayer') || parent.classList.contains('page') || parent.getAttribute('role') === 'region';

      if (isBlock || isPdfLayer) {
        paragraph = (parent.innerText || parent.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 1000);
        break;
      }
      parent = parent.parentElement;
    }

    if (!sentence && paragraph) {
      sentence = paragraph.slice(0, 300);
    }
  } catch {
    // ignore
  }

  return { sentence, paragraph };
}

export function getInputElementSelection(): SelectionData | null {
  try {
    const activeEl = document.activeElement;
    if (!activeEl) return null;
    const isInput = activeEl instanceof HTMLInputElement && /^(?:text|search|url|tel|password)$/i.test(activeEl.type);
    const isTextArea = activeEl instanceof HTMLTextAreaElement;
    if (!isInput && !isTextArea) return null;

    const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    if (start === null || end === null || start === end) return null;

    const rawText = inputEl.value.slice(Math.min(start, end), Math.max(start, end));
    const text = rawText.trim();
    if (!text) return null;

    const words = text.split(/\s+/).filter(Boolean);
    let cleanText = text;
    if (words.length <= 1) {
      cleanText = text.replace(/^["'“”‘`([{]+|[)"'“”’`\]}.,;:!?]+$/g, '').trim();
    } else {
      cleanText = text.replace(/^["'“”‘`([{]+|[)"'“”’`\]}]+$/g, '').trim();
    }
    if (!cleanText) return null;

    let rect = typeof inputEl.getBoundingClientRect === 'function' ? inputEl.getBoundingClientRect() : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = {
        top: 100,
        bottom: 120,
        left: 100,
        right: 200,
        width: 100,
        height: 20
      } as DOMRect;
    }

    const selectionType = detectSelectionType(cleanText);

    return {
      text,
      cleanText,
      selectionType,
      contextSentence: cleanText,
      nearbyParagraph: inputEl.value.slice(0, 500),
      rect
    };
  } catch {
    return null;
  }
}

export function getDeepSelection(target?: EventTarget | null): { selection: Selection | null; range: Range | null } {
  try {
    // 1. If target is inside a ShadowRoot (e.g. Google Gemini Web Components), get selection from that ShadowRoot
    if (target && typeof (target as any).getRootNode === 'function') {
      const rootNode = (target as any).getRootNode();
      if (rootNode && rootNode !== document && typeof (rootNode as any).getSelection === 'function') {
        const shadowSel = (rootNode as any).getSelection() as Selection | null;
        if (shadowSel && !shadowSel.isCollapsed && shadowSel.toString().trim()) {
          const range = shadowSel.rangeCount > 0 ? shadowSel.getRangeAt(0) : null;
          return { selection: shadowSel, range };
        }
      }
    }

    // 2. Check activeElement shadow root chain
    let active: Element | null = document.activeElement;
    while (active && active.shadowRoot) {
      if (typeof (active.shadowRoot as any).getSelection === 'function') {
        const shadowSel = (active.shadowRoot as any).getSelection() as Selection | null;
        if (shadowSel && !shadowSel.isCollapsed && shadowSel.toString().trim()) {
          const range = shadowSel.rangeCount > 0 ? shadowSel.getRangeAt(0) : null;
          return { selection: shadowSel, range };
        }
      }
      active = active.shadowRoot.activeElement;
    }

    // 3. Fallback to standard window selection
    const winSel = window.getSelection();
    const range = winSel && winSel.rangeCount > 0 ? winSel.getRangeAt(0) : null;
    return { selection: winSel, range };
  } catch {
    const winSel = window.getSelection();
    const range = winSel && winSel.rangeCount > 0 ? winSel.getRangeAt(0) : null;
    return { selection: winSel, range };
  }
}

export function getSelectionData(target?: EventTarget | null): SelectionData | null {
  // 1. First check if selection is inside an active HTML input or textarea
  const inputData = getInputElementSelection();
  if (inputData) {
    return inputData;
  }

  // 2. Check deep selection (including ShadowRoot in web components like Gemini)
  const { selection, range } = getDeepSelection(target);
  if (!selection || selection.isCollapsed || !range) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  // Ensure selection is not inside extension-owned UI
  const host = document.getElementById('lexiflow-host');
  if (host && (host.contains(range.startContainer) || host.contains(range.endContainer))) {
    return null;
  }

  // Clean text: strip leading/trailing quotes, outer punctuation
  const words = text.split(/\s+/).filter(Boolean);
  let cleanText = text;
  if (words.length <= 1) {
    cleanText = text.replace(/^["'“”‘`([{]+|[)"'“”’`\]}.,;:!?]+$/g, '').trim();
  } else {
    // Rejoin hyphenated words split across lines (typical in PDFs and columns)
    cleanText = cleanText.replace(/(\w+)-\r?\n\s*(\w+)/g, '$1$2');
    // Normalize soft line breaks into spaces, preserving double newlines for genuine paragraphs
    cleanText = cleanText.replace(/([^\n])\r?\n([^\n])/g, '$1 $2');
    cleanText = cleanText.replace(/[ \t]+/g, ' ');
    cleanText = cleanText.replace(/^["'“”‘`([{]+|[)"'“”’`\]}]+$/g, '').trim();
  }
  if (!cleanText) return null;

  let rect: DOMRect | null = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const clientRects = typeof range.getClientRects === 'function' ? range.getClientRects() : [];
    if (clientRects.length > 0) {
      rect = clientRects[0];
    } else {
      const parent = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
      if (parent && typeof parent.getBoundingClientRect === 'function') {
        rect = parent.getBoundingClientRect();
      }
    }
  }

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    rect = {
      top: 100,
      bottom: 120,
      left: 100,
      right: 200,
      width: 100,
      height: 20
    } as DOMRect;
  }

  const selectionType = detectSelectionType(cleanText);
  const { sentence, paragraph } = extractSurroundingContext(range);

  return {
    text,
    cleanText,
    selectionType,
    contextSentence: (sentence && sentence.length >= cleanText.length) ? sentence : cleanText,
    nearbyParagraph: paragraph,
    rect
  };
}

/**
 * Splits text into paragraphs based on double newlines or line breaks.
 */
export function splitIntoParagraphs(text: string): string[] {
  if (!text || !text.trim()) return [];
  const normalized = text.replace(/\r\n/g, '\n').trim();

  // Try double newlines first (standard paragraph breaks)
  const doubleNewlineBlocks = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (doubleNewlineBlocks.length > 1) {
    return doubleNewlineBlocks;
  }

  // Check if single newlines divide distinct paragraph blocks
  const lines = normalized
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length > 1 && lines.every((l) => l.length > 30 || /[.!?]["'”’]?$/.test(l))) {
    return lines;
  }

  return [normalized];
}

/**
 * Splits paragraph text into distinct grammatical sentences.
 * Protects common abbreviations and decimal numbers so they don't cause false splits.
 */
export function splitIntoSentences(paragraphText: string): string[] {
  const clean = (paragraphText || '').trim();
  if (!clean) return [];

  // Protect known abbreviations and numbers so they don't trigger false sentence boundaries
  const abbrMap = new Map<string, string>();
  let placeholderCount = 0;
  const masked = clean
    .replace(
      /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K|Jan|Feb|Mar|Apr|Aug|Sept|Oct|Nov|Dec)\./gi,
      (m) => {
        const key = `__ABBR_${placeholderCount++}__`;
        abbrMap.set(key, m);
        return key;
      }
    )
    .replace(/\b\d+\.\d+\b/g, (m) => {
      const key = `__NUM_${placeholderCount++}__`;
      abbrMap.set(key, m);
      return key;
    });

  let rawParts: string[] = [];

  // 1. Try native Intl.Segmenter on the masked text
  if (typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function') {
    try {
      const segmenter = new (Intl as any).Segmenter('en', { granularity: 'sentence' });
      const rawSegments = Array.from(segmenter.segment(masked)) as Array<{ segment: string }>;
      rawParts = rawSegments
        .map((s) => s.segment.trim())
        .filter((s) => s.length > 0);
    } catch {
      rawParts = [];
    }
  }

  // 2. Resilient fallback regex if Intl.Segmenter produced nothing
  if (rawParts.length === 0) {
    rawParts = masked.split(/(?<=[.!?]["'”’]?)\s+(?=[A-Z0-9"“'‘])/);
  }

  return rawParts
    .map((part) => {
      let restored = part.trim();
      abbrMap.forEach((orig, key) => {
        restored = restored.replaceAll(key, orig);
      });
      return restored;
    })
    .filter((s) => s.length > 0);
}

