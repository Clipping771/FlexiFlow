/**
 * The deterministic half of Smart Practice (AGENTS.md rule 9): checking AI answers against the
 * article, adapting difficulty to the learner's results, and measuring spoken answers. No model calls.
 */
import type { ReadingSkill, SmartItem } from './items';

// ---------------------------------------------------------------------------
// Evidence: is the AI's quote really in the article?
// ---------------------------------------------------------------------------

export interface Span {
  start: number;
  end: number;
}

const QUOTES: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-' };

/** Lower-cased words of `text` with the offset where each starts and ends in the original. */
function wordsWithOffsets(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ word: m[0].toLowerCase().replace(/[‘’]/g, "'"), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function normalizeText(text: string): string {
  return wordsWithOffsets(text.replace(/[‘’“”–—]/g, (c) => QUOTES[c] || c))
    .map((w) => w.word)
    .join(' ');
}

/**
 * Where `quote` appears in `article`, ignoring case, punctuation and spacing. Falls back to the
 * longest run of at least 6 consecutive quote words, so a quote with one changed word at the end
 * still points at the right place. Returns null when the article does not contain it.
 */
export function findEvidence(article: string, quote: string): Span | null {
  const a = wordsWithOffsets(article);
  const q = wordsWithOffsets(quote).map((w) => w.word);
  if (q.length === 0 || a.length === 0) return null;

  let best: { len: number; i: number } = { len: 0, i: -1 };
  for (let i = 0; i < a.length; i++) {
    let len = 0;
    while (len < q.length && i + len < a.length && a[i + len].word === q[len]) len++;
    if (len > best.len) best = { len, i };
    if (len === q.length) break;
  }
  const needed = q.length < 6 ? q.length : Math.max(6, Math.ceil(q.length * 0.6));
  if (best.len < needed) return null;
  return { start: a[best.i].start, end: a[best.i + best.len - 1].end };
}

export function containsWord(article: string, word: string): boolean {
  const target = normalizeText(word);
  return target.length > 0 && ` ${normalizeText(article)} `.includes(` ${target} `);
}

export type CheckedQuestion = SmartItem<'smart_reading'>['questions'][number] & { span: Span | null; uncertain: boolean };

/** Ties each reading answer to its place in the article. An answer the article cannot back is marked uncertain. */
export function checkReading(article: string, set: SmartItem<'smart_reading'>): CheckedQuestion[] {
  return set.questions.map((q) => {
    const span = q.evidence ? findEvidence(article, q.evidence) : null;
    const needsEvidence = !(q.type === 'judge' && q.answer === 'not_given');
    return { ...q, span, uncertain: needsEvidence && span === null };
  });
}

export type CheckedWord = SmartItem<'smart_vocab'>['words'][number] & { span: Span | null };

/** Keeps the words that really occur in the article (all of them if that would leave fewer than 2). */
export function checkVocab(article: string, set: SmartItem<'smart_vocab'>): CheckedWord[] {
  const found = set.words.filter((w) => containsWord(article, w.word));
  const kept = found.length >= 2 ? found : set.words;
  return kept.map((w) => ({ ...w, span: findEvidence(article, w.sentence) }));
}

// ---------------------------------------------------------------------------
// Adaptive difficulty and the learner's weak spots
// ---------------------------------------------------------------------------

export type Difficulty = 'gentle' | 'standard' | 'stretch';
export type PracticeSkill = ReadingSkill | 'listening';

export interface SmartProgress {
  difficulty: Difficulty;
  skills: Partial<Record<PracticeSkill, { right: number; total: number }>>;
  /** Last CEFR level an AI coach gave the learner's writing or speaking. */
  producedLevel?: string;
  sessions: number;
}

export const DEFAULT_PROGRESS: SmartProgress = { difficulty: 'standard', skills: {}, sessions: 0 };

const ORDER: Difficulty[] = ['gentle', 'standard', 'stretch'];

/** 80%+ right moves up a step, under 50% moves down, anything else stays. */
export function nextDifficulty(current: Difficulty, right: number, total: number): Difficulty {
  if (total < 3) return current;
  const rate = right / total;
  const i = ORDER.indexOf(current);
  if (rate >= 0.8) return ORDER[Math.min(i + 1, ORDER.length - 1)];
  if (rate < 0.5) return ORDER[Math.max(i - 1, 0)];
  return current;
}

export function recordAnswer(progress: SmartProgress, skill: PracticeSkill, correct: boolean): SmartProgress {
  const prev = progress.skills[skill] || { right: 0, total: 0 };
  return { ...progress, skills: { ...progress.skills, [skill]: { right: prev.right + (correct ? 1 : 0), total: prev.total + 1 } } };
}

/** The two skills with the lowest accuracy (only skills tried at least twice and under 75%). */
export function weakSkills(progress: SmartProgress): PracticeSkill[] {
  return (Object.entries(progress.skills) as [PracticeSkill, { right: number; total: number }][])
    .filter(([, s]) => s.total >= 2 && s.right / s.total < 0.75)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
    .slice(0, 2)
    .map(([k]) => k);
}

export const SKILL_LABELS: Record<PracticeSkill, string> = {
  main_idea: 'Main idea',
  detail: 'Detail',
  inference: 'Inference',
  purpose: "Writer's purpose",
  tone: 'Tone & attitude',
  reference: 'Reference',
  vocabulary: 'Word meaning',
  listening: 'Listening'
};

const DIFFICULTY_BRIEF: Record<Difficulty, string> = {
  gentle: 'gentle (direct questions, clear clues, clearly wrong distractors)',
  standard: 'standard (some paraphrase and inference, plausible distractors)',
  stretch: 'stretch (subtle inference, close distractors, less common words)'
};

/** The LEARNER block sent with every request, so the AI writes for this learner. Under 1000 characters. */
export function learnerBrief(progress: SmartProgress, weakWords: string[] = []): string {
  const focus = weakSkills(progress).map((s) => SKILL_LABELS[s].toLowerCase());
  const lines = [
    `Difficulty: ${DIFFICULTY_BRIEF[progress.difficulty]}.`,
    progress.producedLevel ? `Learner level: about ${progress.producedLevel}.` : 'Learner level: not known yet, aim for B1-B2.',
    `FOCUS: ${focus.length ? focus.join(', ') : 'none yet'}.`,
    weakWords.length ? `WEAK WORDS: ${weakWords.slice(0, 15).join(', ')}.` : ''
  ];
  return lines.filter(Boolean).join('\n').slice(0, 1000);
}

const PROGRESS_KEY = 'lexiflow_smart_progress';

export function loadProgress(): SmartProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as SmartProgress;
    return { ...DEFAULT_PROGRESS, ...parsed, difficulty: ORDER.includes(parsed.difficulty) ? parsed.difficulty : 'standard' };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: SmartProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable: progress lasts this session only */
  }
}

// ---------------------------------------------------------------------------
// Writing and speaking measurements
// ---------------------------------------------------------------------------

export const countWords = (text: string) => wordsWithOffsets(text).length;

const FILLERS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'you know', 'i mean', 'sort of', 'kind of', 'basically', 'actually'];

export interface SpeechMetrics {
  words: number;
  seconds: number;
  wordsPerMinute: number;
  fillers: number;
  pace: 'slow' | 'good' | 'fast';
}

export function speechMetrics(transcript: string, durationMs: number): SpeechMetrics {
  const norm = ` ${normalizeText(transcript)} `;
  const words = countWords(transcript);
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const wordsPerMinute = Math.round((words / seconds) * 60);
  let fillers = 0;
  for (const f of FILLERS) fillers += norm.split(` ${f} `).length - 1;
  const pace = wordsPerMinute < 90 ? 'slow' : wordsPerMinute > 170 ? 'fast' : 'good';
  return { words, seconds, wordsPerMinute, fillers, pace };
}

/** Problems found without AI; an answer with any of these is not sent for marking. */
export function answerProblems(text: string, minWords: number): string[] {
  const words = countWords(text);
  if (words === 0) return ['Write your answer first.'];
  if (words < Math.min(minWords, 20)) return [`Write at least ${Math.min(minWords, 20)} words so there is something to mark.`];
  return [];
}

// ---------------------------------------------------------------------------
// Feedback -> Mistakes page
// ---------------------------------------------------------------------------

/**
 * The fixes worth saving as mistakes: tagged with a known general-English taxonomy code, and
 * quoting text that really is in the learner's answer. Anything else is uncertain and skipped.
 * One entry per code.
 */
export function mistakesFromFeedback(
  fixes: SmartItem<'smart_feedback'>['fixes'],
  answer: string,
  isKnownCode: (code: string) => boolean
): { code: string; evidence: string; better: string }[] {
  const said = ` ${normalizeText(answer)} `;
  const seen = new Set<string>();
  const out: { code: string; evidence: string; better: string }[] = [];
  for (const fix of fixes) {
    const code = (fix.code || '').trim().toUpperCase();
    if (!/^(GRA|VOC|MEC)\.[A-Z0-9_]+$/.test(code) || !isKnownCode(code) || seen.has(code)) continue;
    const quoted = normalizeText(fix.original);
    if (!quoted || !said.includes(` ${quoted} `)) continue;
    seen.add(code);
    out.push({ code, evidence: fix.original, better: fix.better });
  }
  return out;
}
