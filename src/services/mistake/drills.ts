/**
 * Mistake → Drill engine (deterministic, no AI call).
 *
 * Builds a short practice session for one mistake from:
 *  1. the learner's own wrong sentences (saved with each occurrence), and
 *  2. the hand-written drill bank plus the taxonomy example.
 * A session is varied every time, so a mistake cannot be "mastered" by memorising one sentence.
 */
import type { TaxonomyError } from '../taxonomy/catalog';
import type { MistakeMemoryItem } from './client';
import { DRILL_BANK, DrillPair } from './drillBank';

export type DrillSource = 'own' | 'bank';

export interface FixDrill {
  kind: 'fix';
  id: string;
  source: DrillSource;
  /** The sentence that contains the mistake */
  wrong: string;
  /** Accepted corrections; the first one is shown as the model answer */
  answers: string[];
  why: string;
  /** Punctuation and capital letters count (spelling and punctuation codes) */
  strict: boolean;
}

export interface ChooseDrill {
  kind: 'choose';
  id: string;
  source: DrillSource;
  prompt: string;
  options: string[];
  answer: number;
  why: string;
}

export type Drill = FixDrill | ChooseDrill;

export const DEFAULT_SESSION_SIZE = 4;
/** Share of drills that must be right for a session to count as a successful correction */
export const PASS_RATIO = 0.75;

/** Codes where punctuation or capital letters are the point of the drill */
const STRICT_CODES = new Set(['GRA.RUN_ON_SENTENCE', 'GRA.FRAGMENT']);

export function isStrictCode(code: string): boolean {
  return code.startsWith('MEC.') || STRICT_CODES.has(code);
}

/** Exam strategy codes are practised with choices, not by rewriting a sentence */
export function isSentenceCode(code: string): boolean {
  return code.startsWith('GRA.') || code.startsWith('VOC.') || code.startsWith('MEC.');
}

// ---------------------------------------------------------------------------
// Seeded randomness so a session is stable while open but differs between sessions
// ---------------------------------------------------------------------------

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export function tokenize(text: string, strict: boolean): string[] {
  const unified = text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  if (strict) {
    return unified
      .replace(/([.,;:!?])/g, ' $1 ')
      .split(/\s+/)
      .filter(Boolean);
  }
  return unified
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function counts(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}

/**
 * True when `input` makes the same correction as `answer`.
 * An exact match always counts. Otherwise the learner may reword the rest of the sentence, as long as
 * every word the correction adds is present, every word it removes is gone, and the sentence stays close
 * to the answer.
 */
function matchesCorrection(input: string[], answer: string[], wrong: string[]): boolean {
  if (input.join(' ') === answer.join(' ')) return true;

  const inCount = counts(input);
  const ansCount = counts(answer);
  const wrongCount = counts(wrong);

  const added: string[] = [];
  const removed: string[] = [];
  for (const [t, n] of ansCount) if (n > (wrongCount.get(t) || 0)) added.push(t);
  for (const [t, n] of wrongCount) if (n > (ansCount.get(t) || 0)) removed.push(t);
  if (added.length === 0 && removed.length === 0) return false;

  for (const t of added) if ((inCount.get(t) || 0) < (ansCount.get(t) || 0)) return false;
  for (const t of removed) if ((inCount.get(t) || 0) > (ansCount.get(t) || 0)) return false;

  // The rest of the sentence must still be there (no one-word answers)
  let overlap = 0;
  for (const [t, n] of ansCount) overlap += Math.min(n, inCount.get(t) || 0);
  if (overlap < Math.ceil(answer.length * 0.7)) return false;
  if (input.length > answer.length * 1.5 + 2) return false;
  return true;
}

export function gradeFix(drill: FixDrill, input: string): boolean {
  const inTokens = tokenize(input, drill.strict);
  if (inTokens.length === 0) return false;
  const wrongTokens = tokenize(drill.wrong, drill.strict);
  // Submitting the wrong sentence unchanged is never correct
  if (inTokens.join(' ') === wrongTokens.join(' ')) return false;
  return drill.answers.some((a) => matchesCorrection(inTokens, tokenize(a, drill.strict), wrongTokens));
}

export function gradeChoice(drill: ChooseDrill, picked: number): boolean {
  return picked === drill.answer;
}

export function sessionPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= PASS_RATIO;
}

// ---------------------------------------------------------------------------
// Session building
// ---------------------------------------------------------------------------

/** The learner's own mistakes that have a usable correction, most recent first, without repeats */
export function ownPairs(item: MistakeMemoryItem): { wrong: string; right: string; spoken: boolean }[] {
  const seen = new Set<string>();
  const out: { wrong: string; right: string; spoken: boolean }[] = [];
  for (const occ of item.recentOccurrences || []) {
    const wrong = (occ.evidenceText || '').trim();
    const right = (occ.contextSnippet || '').trim();
    if (wrong.length < 3 || right.length < 3 || wrong.length > 320 || right.length > 320) continue;
    if (tokenize(wrong, false).join(' ') === tokenize(right, false).join(' ')) continue;
    const key = wrong.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ wrong, right, spoken: /speak/i.test(occ.taskId || '') });
  }
  return out;
}

function bankPairs(tax: TaxonomyError): DrillPair[] {
  const fromTaxonomy: DrillPair = {
    wrong: tax.incorrect_example,
    right: tax.correct_example,
    why: tax.definition
  };
  return [fromTaxonomy, ...(DRILL_BANK[tax.code]?.pairs || [])];
}

function choosePairDrill(id: string, pair: DrillPair, random: () => number): ChooseDrill {
  const rightFirst = random() < 0.5;
  return {
    kind: 'choose',
    id,
    source: 'bank',
    prompt: 'Which sentence is correct?',
    options: rightFirst ? [pair.right, pair.wrong] : [pair.wrong, pair.right],
    answer: rightFirst ? 0 : 1,
    why: pair.why
  };
}

/**
 * Builds a varied practice session for one mistake.
 * `seed` changes between sessions (for example the number of sessions done), so the learner sees
 * different sentences each time.
 */
export function buildDrillSession(
  item: MistakeMemoryItem,
  tax: TaxonomyError,
  seed: number,
  size = DEFAULT_SESSION_SIZE
): Drill[] {
  const random = rng(hashSeed(`${tax.code}:${seed}`));
  const drills: Drill[] = [];

  if (!isSentenceCode(tax.code)) {
    // Exam strategy: scenario choices, then the taxonomy example as a "which is better" choice
    const choices = shuffle(DRILL_BANK[tax.code]?.choices || [], random);
    choices.forEach((c, i) => {
      const order = shuffle(
        c.options.map((_, idx) => idx),
        random
      );
      drills.push({
        kind: 'choose',
        id: `${tax.code}:choice:${i}`,
        source: 'bank',
        prompt: c.prompt,
        options: order.map((idx) => c.options[idx]),
        answer: order.indexOf(c.answer),
        why: c.why
      });
    });
    if (drills.length < size) {
      const pick = choosePairDrill(`${tax.code}:example`, bankPairs(tax)[0], random);
      pick.prompt = 'Which is the better approach?';
      drills.push(pick);
    }
    return drills.slice(0, size);
  }

  const strict = isStrictCode(tax.code);

  // 1. Up to two of the learner's own sentences: the most useful practice
  const own = ownPairs(item);
  const ownPicked = own.length > 2 ? [own[0], ...shuffle(own.slice(1), random).slice(0, 1)] : own;
  const ownDrills: FixDrill[] = ownPicked.map((p, i) => ({
    kind: 'fix',
    id: `${tax.code}:own:${i}`,
    source: 'own',
    wrong: p.wrong,
    answers: [p.right],
    why: `This is from your own ${p.spoken ? 'speaking' : 'writing'}. ${tax.definition}`,
    strict: strict && !p.spoken
  }));

  // 2. Fill the rest from the bank: one "choose" warm-up, then "fix it" drills
  const bank = shuffle(bankPairs(tax), random);
  const bankNeeded = Math.max(1, size - ownDrills.length);
  const bankDrills: Drill[] = bank.slice(0, bankNeeded).map((pair, i) =>
    i === 0
      ? choosePairDrill(`${tax.code}:bank:${i}`, pair, random)
      : {
          kind: 'fix',
          id: `${tax.code}:bank:${i}`,
          source: 'bank',
          wrong: pair.wrong,
          answers: [pair.right, ...(pair.alsoRight || [])],
          why: pair.why,
          strict
        }
  );

  // Warm-up choice first, then a mix of own and bank rewrites
  const [warmUp, ...bankFixes] = bankDrills;
  drills.push(warmUp);
  const rest: Drill[] = [];
  const longest = Math.max(ownDrills.length, bankFixes.length);
  for (let i = 0; i < longest; i++) {
    if (ownDrills[i]) rest.push(ownDrills[i]);
    if (bankFixes[i]) rest.push(bankFixes[i]);
  }
  drills.push(...rest);
  return drills.slice(0, size);
}
