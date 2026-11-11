/**
 * Smart Practice: AI-written practice built from whatever article the learner is reading.
 * Not tied to any exam. Each kind is one model call that stays inside the Cloud route limits
 * (top-level lists of 8 or fewer, strings under 600 characters, a reply of about 900 tokens),
 * so the reading, vocabulary, listening and task sets are written in parallel.
 *
 * Every reply is held to these Zod schemas (AGENTS.md rule 2) and then checked against the article
 * in `verify.ts`, so an answer the article does not support is never shown as fact.
 */
import { z } from 'zod';
import { CANONICAL_ERRORS } from '../taxonomy/catalog';

/** Error codes the feedback coach may tag a correction with (general English only, no exam-specific codes). */
export const FEEDBACK_ERROR_CODES = CANONICAL_ERRORS.filter((e) => /^(GRA|VOC|MEC)./.test(e.code));

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const CEFR_LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const READING_SKILLS = ['main_idea', 'detail', 'inference', 'purpose', 'tone', 'reference', 'vocabulary'] as const;
export type ReadingSkill = (typeof READING_SKILLS)[number];

const options4 = z.array(text(1, 160)).length(4);

const choiceQuestion = z.object({
  type: z.literal('choice'),
  skill: z.enum(READING_SKILLS),
  question: text(8, 240),
  options: options4,
  answer: z.number().int().min(0).max(3),
  explanation: text(8, 260),
  /** A sentence copied word for word from the article that proves the answer. */
  evidence: text(8, 320)
});

const judgeQuestion = z.object({
  type: z.literal('judge'),
  skill: z.enum(READING_SKILLS),
  statement: text(8, 240),
  answer: z.enum(['true', 'false', 'not_given']),
  explanation: text(8, 260),
  /** Empty for "not_given": the article says nothing about it. */
  evidence: z.string().trim().max(320).default('')
});

export const SMART_SCHEMAS = {
  smart_reading: z.object({
    topic: text(3, 80),
    gist: text(20, 300),
    level: z.enum(CEFR_LEVELS),
    keyIdeas: z.array(text(5, 180)).min(3).max(4),
    questions: z.array(z.discriminatedUnion('type', [choiceQuestion, judgeQuestion])).min(3).max(6)
  }),
  smart_vocab: z.object({
    words: z
      .array(
        z.object({
          word: text(2, 40),
          /** The article sentence the word appears in, copied exactly. */
          sentence: text(8, 320),
          options: options4,
          answer: z.number().int().min(0).max(3),
          explanation: text(8, 240),
          /** A fresh example sentence using the word the same way. */
          example: text(8, 200)
        })
      )
      .min(3)
      .max(5)
  }),
  smart_listening: z.object({
    /** A short spoken news-style brief retelling part of the article in new words. */
    script: text(250, 590),
    questions: z
      .array(
        z.object({
          question: text(8, 200),
          options: options4,
          answer: z.number().int().min(0).max(3),
          explanation: text(8, 220)
        })
      )
      .min(2)
      .max(3)
  }),
  smart_tasks: z.object({
    writing: z.object({
      kind: z.enum(['summary', 'opinion', 'response', 'letter']),
      prompt: text(20, 400),
      minWords: z.number().int().min(30).max(120),
      maxWords: z.number().int().min(60).max(170),
      checklist: z.array(text(5, 140)).min(2).max(4)
    }),
    speaking: z.object({
      prompt: text(15, 300),
      ideas: z.array(text(3, 120)).min(2).max(4),
      followUps: z.array(text(8, 200)).min(1).max(3),
      seconds: z.number().int().min(30).max(120)
    })
  }),
  /** Feedback on a written answer or a spoken transcript. The score is a LexiFlow estimate. */
  smart_feedback: z.object({
    score: z.number().int().min(0).max(100),
    level: z.enum(CEFR_LEVELS),
    verdict: text(5, 220),
    strengths: z.array(text(3, 200)).min(1).max(3),
    fixes: z
      .array(
        z.object({
          original: text(1, 200),
          better: text(1, 200),
          why: text(3, 200),
          /** A taxonomy code from FEEDBACK_ERROR_CODES; checked against the catalogue before use. */
          code: z.string().trim().max(60).optional()
        })
      )
      .max(6),
    coverage: z.array(z.object({ point: text(3, 140), covered: z.boolean() })).max(4),
    improved: text(20, 590)
  })
} as const;

export type SmartKind = keyof typeof SMART_SCHEMAS;
export type SmartItem<K extends SmartKind> = z.infer<(typeof SMART_SCHEMAS)[K]>;
export type ReadingQuestion = SmartItem<'smart_reading'>['questions'][number];

const COMMON =
  'You are an expert English teacher who writes practice for adult learners from a real article. ' +
  'Write in clear, natural English. Never mention any exam (no IELTS, PTE, TOEFL). ' +
  'The LEARNER block gives the difficulty to aim for and skills to focus on; follow it.';

export const SMART_SYSTEM: Record<SmartKind, string> = {
  smart_reading:
    `${COMMON} Read the article and write a reading check. ` +
    'topic: 2-6 words. gist: the article in one or two plain sentences. level: the CEFR level of the article text. keyIdeas: 3-4 main points, one short sentence each. ' +
    'questions: 4 questions that test real understanding, not word matching. Mix skills: always one main_idea, at least one inference, and others from detail, purpose, tone, reference, vocabulary; favour the FOCUS skills. ' +
    'Use type "choice" (4 options under 12 words each, exactly one correct, wrong options plausible and similar in length, answer is the 0-based index; vary which index is right) for most, and type "judge" (statement + answer true/false/not_given) for one. ' +
    'Paraphrase; do not copy the article into questions or options. ' +
    'evidence: the shortest part of one article sentence (under 25 words) that proves the answer, copied exactly, character for character; for not_given use "". ' +
    'explanation: one sentence saying why the answer is right. ' +
    'Return JSON: {"topic": string, "gist": string, "level": "A2"|"B1"|"B2"|"C1"|"C2", "keyIdeas": string[], "questions": [{"type": "choice", "skill": string, "question": string, "options": string[4], "answer": number, "explanation": string, "evidence": string} | {"type": "judge", "skill": string, "statement": string, "answer": "true"|"false"|"not_given", "explanation": string, "evidence": string}]}.',
  smart_vocab:
    `${COMMON} Pick 4 words or short phrases from the article that are worth learning at the LEARNER level (skip names and very common words; include any WEAK WORDS that appear). ` +
    'For each: word (as it appears), sentence (the part of the article sentence containing it, under 30 words, copied exactly), 4 short meaning options where exactly one fits THIS context (others can be other senses of the word or near misses), answer (0-based index; vary it), explanation (one sentence on the meaning here), example (a new everyday sentence using it the same way). ' +
    'Return JSON: {"words": [{"word": string, "sentence": string, "options": string[4], "answer": number, "explanation": string, "example": string}]}.',
  smart_listening:
    `${COMMON} Write a spoken news-style brief (70-100 words) that retells one interesting part of the article in fresh words, as a radio presenter would say it. Plain text only, no headings or lists. ` +
    'Then 3 multiple-choice listening questions answerable only from the brief: 4 options, one correct, answer is the 0-based index (vary it), one-sentence explanation. ' +
    'Return JSON: {"script": string, "questions": [{"question": string, "options": string[4], "answer": number, "explanation": string}]}.',
  smart_tasks:
    `${COMMON} Write one writing task and one speaking task on the article's ideas. ` +
    'writing: kind is summary, opinion, response or letter (pick what suits the article and level), a clear prompt, minWords and maxWords (between 40 and 150, about 60-120 for B1-B2), and a checklist of 2-4 things a strong answer includes. ' +
    'speaking: a prompt that asks the learner to talk about their own view or experience linked to the article, 2-4 short ideas to help them start, 1-3 follow-up questions, and seconds to talk (45-90). ' +
    'Return JSON: {"writing": {"kind": string, "prompt": string, "minWords": number, "maxWords": number, "checklist": string[]}, "speaking": {"prompt": string, "ideas": string[], "followUps": string[], "seconds": number}}.',
  smart_feedback:
    'You are a warm but exact English writing and speaking coach. Mark the LEARNER ANSWER to the TASK (the article is context). ' +
    'score: 0-100 for how well it does the task with accurate, natural English (60 = clear with some errors, 80 = strong, 90+ = near-native). level: the CEFR level the answer shows. ' +
    'verdict: one encouraging, specific sentence. strengths: 1-3 specific things done well. ' +
    'fixes: up to 6 of the most useful corrections; "original" is copied exactly from the answer, "better" is the corrected wording, "why" is a short plain reason. For a spoken answer ignore punctuation and capital letters (it is a speech transcript) and focus on grammar, word choice and clarity. ' +
    'code: tag each fix with the one code below that matches it, or leave code out if none fits: ' +
    FEEDBACK_ERROR_CODES.map((e) => `${e.code} (${e.name})`).join(', ') +
    '. coverage: each CHECKLIST point and whether the answer covered it. improved: the learner\'s answer rewritten as a strong model at one level higher, keeping their ideas. ' +
    'Return JSON: {"score": number, "level": string, "verdict": string, "strengths": string[], "fixes": [{"original": string, "better": string, "why": string, "code"?: string}], "coverage": [{"point": string, "covered": boolean}], "improved": string}.'
};

/** Extra checks a schema cannot express. Throws so the caller retries the model once. */
export function checkSmartItem(kind: SmartKind, data: unknown): void {
  if (kind === 'smart_tasks') {
    const t = data as SmartItem<'smart_tasks'>;
    if (t.writing.maxWords <= t.writing.minWords) throw new Error('writing: maxWords must be above minWords');
  }
  const optionSets: string[][] = [];
  if (kind === 'smart_reading') {
    for (const q of (data as SmartItem<'smart_reading'>).questions) if (q.type === 'choice') optionSets.push(q.options);
  }
  if (kind === 'smart_vocab') for (const w of (data as SmartItem<'smart_vocab'>).words) optionSets.push(w.options);
  if (kind === 'smart_listening') for (const q of (data as SmartItem<'smart_listening'>).questions) optionSets.push(q.options);
  for (const opts of optionSets) {
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) throw new Error('options: two options are the same');
  }
}
