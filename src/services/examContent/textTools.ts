/**
 * Builds exam items straight from an article's text, with no AI (AGENTS.md rule 9: deterministic first).
 * Every builder takes a seed so "New questions" picks a different part of the article.
 */

export interface BlankItem {
  id: string;
  options: string[];
  answer: string;
}

export interface BlankedPassage {
  /** Text around the blanks: parts[i] comes before blanks[i]; the last part follows the last blank. */
  parts: string[];
  blanks: BlankItem[];
}

export interface ReorderItem {
  items: { id: string; text: string }[];
  correctOrder: string[];
}

export interface HighlightItem {
  spoken: string;
  displayed: string;
  incorrectWords: string[];
}

export interface NoteGapItem {
  spoken: string;
  fields: { id: string; label: string; accepted: string[]; maxWords: number }[];
}

const STOPWORDS = new Set(
  (
    'a an the and or but if then than so as of at by for from in into on onto to with without about above after again against all also am ' +
    'any are because been before being below between both can could did do does doing down during each few further had has have having he ' +
    'her here hers herself him himself his how i is it its itself just me more most my myself no nor not now only other our ours ourselves ' +
    'out over own same she should some such that their theirs them themselves there these they this those through too under until up very ' +
    'was we were what when where which while who whom why will would you your yours yourself yourselves one two may might must shall many ' +
    'much said says say new like well even still yet however although though whether within upon across around'
  ).split(' ')
);

/** FNV-1a, for stable ids and seeds from text. */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const countWords = (text: string) => text.trim().split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => countWords(p) >= 12);
}

const rawSentences = (text: string) => (text.replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+["”’)]?|$)/g) || []).map((s) => s.trim()).filter(Boolean);

/** Reads as a prose sentence: no headings, captions, menus or URLs. */
const isProse = (s: string) =>
  /[.!?]["”’)]?$/.test(s) && /^[A-Z"“‘(]/.test(s) && !/https?:|www\.|@|\|/.test(s) && countWords(s) <= 45;

/** Sentences that read as prose and are long enough to stand alone. */
export function splitSentences(text: string): string[] {
  return rawSentences(text).filter((s) => isProse(s) && countWords(s) >= 5);
}

/**
 * Runs of sentences that follow each other in the article with nothing left out, so a passage built
 * from a run is the article's own text. A heading, caption or link ends a run.
 */
export function sentenceRuns(text: string): string[][] {
  const runs: string[][] = [[]];
  for (const s of rawSentences(text)) {
    if (isProse(s)) runs[runs.length - 1].push(s);
    else if (runs[runs.length - 1].length) runs.push([]);
  }
  return runs.filter((r) => r.length);
}

/** A sentence of the given length, chosen by seed. */
export function pickSentence(text: string, minWords: number, maxWords: number, seed: number): string | null {
  const candidates = splitSentences(text).filter((s) => {
    const n = countWords(s);
    return n >= minWords && n <= maxWords;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(seededRandom(seed)() * candidates.length)];
}

/** Consecutive sentences making a passage of the given length, starting at a seeded point. */
export function pickPassage(text: string, minWords: number, maxWords: number, seed: number): string | null {
  const starts = shuffle(
    sentenceRuns(text).flatMap((run) => run.map((_, i) => ({ run, i }))),
    seededRandom(seed)
  );
  for (const { run, i: start } of starts) {
    let words = 0;
    for (let i = start; i < run.length; i++) {
      words += countWords(run[i]);
      if (words > maxWords) break;
      if (words >= minWords) return run.slice(start, i + 1).join(' ');
    }
  }
  return null;
}

/** Up to `count` paragraphs of a usable length, consecutive from a seeded start. */
export function pickParagraphs(text: string, count: number, seed: number, maxWordsEach = 140): string[] {
  const paragraphs = splitParagraphs(text).filter((p) => countWords(p) <= maxWordsEach && splitSentences(p).length >= 2);
  if (paragraphs.length < count) return [];
  const start = Math.floor(seededRandom(seed)() * (paragraphs.length - count + 1));
  return paragraphs.slice(start, start + count);
}

const tokenWords = (text: string) => (text.match(/[A-Za-z][A-Za-z'-]*/g) || []).map((w) => w.toLowerCase());

/** Words worth testing: not stopwords, long enough, not names. */
function contentWords(text: string): string[] {
  const capitalisedMidSentence = new Set(
    (text.match(/(?<=[a-z,;] )[A-Z][a-z]+/g) || []).map((w) => w.toLowerCase())
  );
  return Array.from(new Set(tokenWords(text))).filter(
    (w) => w.length >= 5 && !STOPWORDS.has(w) && !capitalisedMidSentence.has(w) && !w.includes("'")
  );
}

function wordShape(word: string): string {
  if (word.endsWith('ing')) return 'ing';
  if (word.endsWith('ed')) return 'ed';
  if (word.endsWith('ly')) return 'ly';
  if (word.endsWith('tion') || word.endsWith('sion') || word.endsWith('ment') || word.endsWith('ness')) return 'noun';
  if (word.endsWith('s') && !word.endsWith('ss')) return 's';
  return 'other';
}

/** Three wrong options that look like the answer (same ending), drawn from the rest of the article. */
function distractors(answer: string, pool: string[], rand: () => number): string[] {
  const shape = wordShape(answer);
  const others = pool.filter((w) => w !== answer);
  const sameShape = shuffle(others.filter((w) => wordShape(w) === shape), rand);
  const rest = shuffle(others.filter((w) => wordShape(w) !== shape), rand);
  return [...sameShape, ...rest].slice(0, 3);
}

/** A passage with `count` words removed, each with four options (PTE Fill in the Blanks). */
export function makeBlanks(passage: string, articleText: string, count: number, seed: number): BlankedPassage | null {
  const rand = seededRandom(seed);
  const pool = contentWords(articleText);
  const words = passage.split(/(\s+)/);
  const candidateIdx = words
    .map((w, i) => ({ i, clean: w.toLowerCase().replace(/[^a-z'-]/g, '') }))
    .filter(({ i, clean }) => i > 0 && pool.includes(clean) && /^[A-Za-z]/.test(words[i]));
  if (candidateIdx.length < count || pool.length < count + 3) return null;

  // Spread the blanks out: pick from evenly sized slices of the candidates
  const chosen: number[] = [];
  const slice = candidateIdx.length / count;
  for (let k = 0; k < count; k++) {
    const from = Math.floor(k * slice);
    const to = Math.max(from + 1, Math.floor((k + 1) * slice));
    chosen.push(candidateIdx[from + Math.floor(rand() * (to - from))].i);
  }
  const unique = Array.from(new Set(chosen)).sort((a, b) => a - b);
  if (unique.length < count) return null;

  const parts: string[] = [];
  const blanks: BlankItem[] = [];
  let cursor = 0;
  unique.forEach((idx, n) => {
    const raw = words[idx];
    const match = raw.match(/^([A-Za-z'-]+)(.*)$/);
    const answer = (match?.[1] || raw).toLowerCase();
    parts.push(words.slice(cursor, idx).join(''));
    blanks.push({ id: `b${n + 1}`, answer, options: shuffle([answer, ...distractors(answer, pool, rand)], rand) });
    cursor = idx + 1;
    // Keep trailing punctuation with the following text
    if (match?.[2]) words[idx + 1] = match[2] + (words[idx + 1] || '');
  });
  parts.push(words.slice(cursor).join(''));
  return { parts, blanks };
}

/** Four consecutive sentences, shuffled (PTE Re-order Paragraphs). */
export function makeReorder(articleText: string, seed: number): ReorderItem | null {
  // Four sentences that follow each other in the article, each long enough to carry meaning
  const windows = sentenceRuns(articleText).flatMap((run) =>
    run.slice(0, Math.max(0, run.length - 3)).map((_, i) => run.slice(i, i + 4)).filter((w) => w.every((s) => countWords(s) >= 6))
  );
  if (!windows.length) return null;
  const rand = seededRandom(seed);
  const ordered = windows[Math.floor(rand() * windows.length)].map((text, i) => ({ id: String.fromCharCode(65 + i), text }));
  let items = shuffle(ordered, rand);
  if (items.every((it, i) => it.id === ordered[i].id)) items = [...items.slice(1), items[0]];
  return { items, correctOrder: ordered.map((o) => o.id) };
}

/** The spoken sentence, and a written copy with a few words swapped (PTE Highlight Incorrect Words). */
export function makeHighlight(articleText: string, seed: number, swaps = 2): HighlightItem | null {
  const rand = seededRandom(seed);
  const spoken = pickPassage(articleText, 25, 50, seed);
  if (!spoken) return null;
  const pool = contentWords(articleText);
  const words = spoken.split(' ');
  const candidates = shuffle(
    words.map((w, i) => ({ i, clean: w.toLowerCase().replace(/[^a-z'-]/g, '') })).filter(({ clean }) => pool.includes(clean)),
    rand
  );
  const incorrectWords: string[] = [];
  for (const { i, clean } of candidates) {
    if (incorrectWords.length >= swaps) break;
    const replacement = distractors(clean, pool, rand).find((d) => !spoken.toLowerCase().includes(d));
    if (!replacement) continue;
    words[i] = words[i].replace(new RegExp(clean, 'i'), (m) => (m[0] === m[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement));
    incorrectWords.push(replacement);
  }
  if (incorrectWords.length < swaps) return null;
  return { spoken, displayed: words.join(' '), incorrectWords };
}

/** A passage to hear, and notes with one key word missing per sentence (IELTS note completion). */
export function makeNoteGaps(articleText: string, seed: number, gaps = 3): NoteGapItem | null {
  const rand = seededRandom(seed);
  const spoken = pickPassage(articleText, 45, 90, seed);
  if (!spoken) return null;
  const pool = contentWords(articleText);
  const sentences = splitSentences(spoken);
  const fields: NoteGapItem['fields'] = [];
  for (const sentence of sentences) {
    if (fields.length >= gaps) break;
    const numbers = sentence.match(/\b\d[\d,.]*%?/g) || [];
    const words = sentence.split(' ');
    const options = [
      ...numbers.map((n) => ({ token: n, clean: n })),
      ...shuffle(words.map((w) => ({ token: w, clean: w.toLowerCase().replace(/[^a-z'-]/g, '') })).filter((x) => pool.includes(x.clean)), rand)
    ];
    const pick = options[0];
    if (!pick) continue;
    const answer = pick.clean;
    const label = sentence.replace(pick.token.replace(/[^\w%.,-]/g, ''), '______');
    if (!label.includes('______')) continue;
    // Accept the bare form too ("30%" and "30")
    const accepted = Array.from(new Set([answer, answer.replace(/[^\w\s]/g, '')]));
    fields.push({ id: `f${fields.length + 1}`, label, accepted, maxWords: 2 });
  }
  return fields.length >= 2 ? { spoken, fields } : null;
}
