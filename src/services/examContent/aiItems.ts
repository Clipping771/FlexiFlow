/**
 * Exam items that need a model to write them, generated from the article the learner is reading.
 * Shared by the extension (BYOK providers) and LexiFlow Cloud (server/), so both send the same prompt
 * and hold the reply to the same Zod schema (AGENTS.md rule 2). Lists stay at 8 items or fewer and
 * strings under 600 characters, the limits the Cloud exam routes enforce.
 */
import { z } from 'zod';
import { SMART_SCHEMAS, SMART_SYSTEM, checkSmartItem, type SmartKind } from '../smartPractice/items';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const SCHEMAS = {
  pte_essay: z.object({ prompt: text(40, 500) }),
  ielts_task2: z.object({ prompt: text(40, 500) }),
  ielts_task1: z.object({
    prompt: text(40, 500),
    title: text(5, 120),
    unit: text(1, 40),
    columns: z.array(text(1, 30)).min(2).max(5),
    rows: z
      .array(z.object({ label: text(1, 40), values: z.array(z.number()).min(2).max(5) }))
      .min(2)
      .max(6)
  }),
  pte_mcm: z.object({
    question: text(10, 300),
    options: z.array(text(2, 200)).min(4).max(5),
    correct: z.array(z.number().int().min(0).max(4)).min(2).max(3)
  }),
  ielts_tfng: z.object({
    statements: z
      .array(
        z.object({
          statement: text(10, 300),
          answer: z.enum(['TRUE', 'FALSE', 'NOT GIVEN']),
          explanation: text(5, 300)
        })
      )
      .min(3)
      .max(5)
  }),
  ielts_headings: z.object({
    headings: z.array(z.object({ paragraph: z.enum(['A', 'B', 'C']), heading: text(5, 120) })).min(2).max(3),
    distractors: z.array(text(5, 120)).min(1).max(3)
  }),
  pte_asq: z.object({ question: text(10, 300), answers: z.array(text(1, 40)).min(1).max(4) }),
  ielts_speaking: z.object({
    part1: text(10, 300),
    part2Topic: text(10, 200),
    part2Points: z.array(text(3, 150)).min(3).max(4),
    part3: text(10, 300)
  }),
  /** Marks for a Summarize Spoken Text answer against the passage that was heard. */
  pte_sst_marks: z.object({
    content: z.number().min(0).max(2),
    grammar: z.number().min(0).max(2),
    vocabulary: z.number().min(0).max(2),
    spelling: z.number().min(0).max(2),
    feedback: text(5, 500)
  }),
  ...SMART_SCHEMAS
} as const;

export type ExamItemKind = keyof typeof SCHEMAS;
export type ExamItem<K extends ExamItemKind> = z.infer<(typeof SCHEMAS)[K]>;

export const EXAM_ITEM_KINDS = Object.keys(SCHEMAS) as ExamItemKind[];

/** The article text a prompt may include, so long pages stay within the model's budget. */
export const EXAM_SOURCE_MAX_CHARS = 6000;

const SYSTEM = {
  pte_essay:
    'You write PTE Academic "Write Essay" prompts. Using the topic and debate in the article, write ONE argumentative essay prompt of 2-3 sentences that ends with a direct question (e.g. "Discuss both views and give your opinion."). Do not quote the article. Return JSON: {"prompt": string}.',
  ielts_task2:
    'You write IELTS Academic Writing Task 2 questions. Using the issue raised in the article, write ONE Task 2 question (opinion, discussion, advantages/disadvantages or problem/solution) in standard IELTS wording. Return JSON: {"prompt": string}.',
  ielts_task1:
    'You write IELTS Academic Writing Task 1 questions. Build a small data table on the article\'s topic, using figures from the article where it has them and realistic figures otherwise. 2-5 columns (e.g. years or categories) and 2-6 rows, numbers only in "values" (one per column). Write the standard instruction ("The table below shows ... Summarise the information by selecting and reporting the main features, and make comparisons where relevant."). Return JSON: {"prompt": string, "title": string, "unit": string, "columns": string[], "rows": [{"label": string, "values": number[]}]}.',
  pte_mcm:
    'You write PTE Academic Reading "Multiple Choice, Multiple Answers" items. From the passage only, write one question with 5 options where exactly 2 or 3 are clearly supported by the passage and the rest are plausible but wrong. "correct" lists the 0-based indexes of the right options. Return JSON: {"question": string, "options": string[], "correct": number[]}.',
  ielts_tfng:
    'You write IELTS Academic Reading "True / False / Not Given" items. From the passage only, write 4 statements: at least one TRUE (the passage says so), one FALSE (the passage says the opposite) and one NOT GIVEN (the passage does not say). Paraphrase; do not copy sentences. Give a one-sentence explanation each. Return JSON: {"statements": [{"statement": string, "answer": "TRUE"|"FALSE"|"NOT GIVEN", "explanation": string}]}.',
  ielts_headings:
    'You write IELTS Academic Reading "Matching Headings" items. For each labelled paragraph (A, B, C) write a short heading (4-10 words) capturing its main idea, plus 2 distractor headings that fit the topic but match no paragraph. Return JSON: {"headings": [{"paragraph": "A"|"B"|"C", "heading": string}], "distractors": string[]}.',
  pte_asq:
    'You write PTE Academic "Answer Short Question" items. Write one short general-knowledge question related to the article\'s topic whose answer is one to three words and does not require having read the article. List every acceptable answer form in lower case. Return JSON: {"question": string, "answers": string[]}.',
  ielts_speaking:
    'You write IELTS Speaking questions on the article\'s topic. part1: a short personal question. part2Topic: a cue card starting "Describe ...". part2Points: 3-4 "You should say" prompts, the last starting "and explain". part3: an abstract discussion question. Return JSON: {"part1": string, "part2Topic": string, "part2Points": string[], "part3": string}.',
  pte_sst_marks:
    'You are a PTE Academic examiner marking "Summarize Spoken Text". Compare the learner\'s summary with the lecture transcript. Content (0-2): main points captured. Grammar (0-2). Vocabulary (0-2). Spelling (0-2). Give one short paragraph of feedback. Return JSON: {"content": number, "grammar": number, "vocabulary": number, "spelling": number, "feedback": string}.',
  ...SMART_SYSTEM
} satisfies Record<ExamItemKind, string>;

export const EXAM_ITEM_PROMPT_VERSION = 'exam_item_v1';

const isSmart = (kind: ExamItemKind): kind is SmartKind => kind.startsWith('smart_');

/** The prompt for one item. `source` is the article (or passage); `answer` is only for marking kinds. */
export function buildExamItemPrompt(kind: ExamItemKind, source: string, answer?: string): { system: string; user: string } {
  const clipped = source.slice(0, EXAM_SOURCE_MAX_CHARS);
  // Smart kinds: `answer` is the learner profile when writing practice, or the learner's answer when marking.
  const learner = (answer || '').slice(0, 1000);
  const user =
    kind === 'pte_sst_marks'
      ? `LECTURE TRANSCRIPT:\n${clipped}\n\nLEARNER SUMMARY:\n${learner}`
      : kind === 'smart_feedback'
        ? `${source.slice(0, EXAM_SOURCE_MAX_CHARS + 1500)}\n\nLEARNER ANSWER:\n${learner}`
        : isSmart(kind)
          ? `LEARNER:\n${learner || 'Level: B2. No focus.'}\n\nARTICLE:\n${clipped}`
          : `ARTICLE:\n${clipped}`;
  return { system: `${SYSTEM[kind]}\nReturn only the JSON object.`, user };
}

export function examItemSchema<K extends ExamItemKind>(kind: K): (typeof SCHEMAS)[K] {
  return SCHEMAS[kind];
}

/** Validates a model reply; an MCM item must also point its answers at real options. */
export function parseExamItem<K extends ExamItemKind>(kind: K, raw: unknown): ExamItem<K> {
  const data = SCHEMAS[kind].parse(raw) as ExamItem<K>;
  if (kind === 'pte_mcm') {
    const mcm = data as ExamItem<'pte_mcm'>;
    if (mcm.correct.some((i) => i >= mcm.options.length) || new Set(mcm.correct).size !== mcm.correct.length) {
      throw new Error('correct: points at a missing option');
    }
  }
  if (kind === 'ielts_task1') {
    const t1 = data as ExamItem<'ielts_task1'>;
    if (t1.rows.some((r) => r.values.length !== t1.columns.length)) throw new Error('rows: one value per column');
  }
  if (isSmart(kind)) checkSmartItem(kind, data);
  return data;
}
