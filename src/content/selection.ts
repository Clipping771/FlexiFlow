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
  // Explicit multi-line blocks with content
  const nonBlankLines = trimmed.split(/\r?\n+/).filter((line) => line.trim().length > 0);
  if (nonBlankLines.length >= 2) {
    return 'paragraph';
  }

  // Multiple completed sentences detected with terminal punctuation followed by space and capital letter/number
  // Filter out common abbreviations like Mr., Dr., e.g., i.e.
  const sanitizedForBoundary = trimmed.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\./gi, 'ABBR');
  const internalSentenceEndings = sanitizedForBoundary.match(/[.!?]["'”’]?\s+[A-Z0-9]/g) || [];
  if (internalSentenceEndings.length >= 1 && /[.!?]["'”’]?$/.test(trimmed)) {
    return 'paragraph';
  }

  // If text is very long with multiple terminal punctuation marks (> 60 words and 2+ sentence boundaries)
  if (wordCount > 60 && (trimmed.match(/[.!?]/g) || []).length >= 2) {
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

    // Extract enclosing block element for paragraph context
    let parent = container.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const display = window.getComputedStyle(parent).display;
      if (display === 'block' || display === 'flex' || parent.tagName === 'P' || parent.tagName === 'ARTICLE') {
        paragraph = (parent.innerText || parent.textContent || '').trim().slice(0, 1000);
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

export function getSelectionData(): SelectionData | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();
  if (!text) return null;

  // Ensure selection is not inside editable element or extension-owned UI
  if (
    isEditableElement(range.startContainer.parentElement) ||
    isEditableElement(range.endContainer.parentElement)
  ) {
    return null;
  }

  const host = document.getElementById('lexiflow-host');
  if (host && (host.contains(range.startContainer) || host.contains(range.endContainer))) {
    return null;
  }

  // Clean text: strip leading/trailing quotes, outer punctuation
  const cleanText = text.replace(/^["'“”‘`([{]+|[)"'“”’`\]}.,;:!?]+$/g, '').trim();
  if (!cleanText) return null;

  let rect: DOMRect | null = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const clientRects = typeof range.getClientRects === 'function' ? range.getClientRects() : [];
    if (clientRects.length > 0) {
      rect = clientRects[0];
    } else {
      const parent = range.startContainer.parentElement;
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
    contextSentence: sentence || cleanText,
    nearbyParagraph: paragraph,
    rect
  };
}
