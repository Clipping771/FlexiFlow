import { z } from 'zod';
import { SummaryCriterionId, SummaryEvaluation } from '../../types';

/** The four marking criteria and their weight out of 10 (see prompts/summary.ts). */
export const SUMMARY_RUBRIC: Array<{ id: SummaryCriterionId; label: string; maxScore: number }> = [
  { id: 'main_idea', label: 'Main idea', maxScore: 4 },
  { id: 'key_points', label: 'Key points', maxScore: 3 },
  { id: 'accuracy', label: 'Accuracy', maxScore: 2 },
  { id: 'expression', label: 'Own words & concision', maxScore: 1 }
];

const stringList = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x: string) => x.trim()) : []),
  z.array(z.string())
);

const RawEvaluationSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.string(),
        score: z.coerce.number(),
        comment: z.string().default('')
      })
    )
    .min(1),
  summaryLanguage: z.string().default('en'),
  overallFeedback: z.string().min(1),
  strengths: stringList,
  missedPoints: stringList,
  misunderstandings: stringList,
  modelSummary: z.string().min(1),
  languageFeedback: z
    .object({
      comment: z.string().default(''),
      corrections: z
        .array(z.object({ original: z.string(), corrected: z.string(), explanation: z.string().default('') }))
        .default([])
    })
    .nullish()
});

/** Rounds to the nearest half mark. */
function half(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Validates the model's marking and makes the numbers trustworthy: every criterion appears exactly
 * once with its fixed maximum, each score is clamped to 0..max, and the total is recomputed from them
 * (the model's own total, if any, is ignored).
 */
export function parseSummaryEvaluation(raw: unknown): SummaryEvaluation {
  const parsed = RawEvaluationSchema.parse(raw);
  const byId = new Map(parsed.criteria.map((c) => [c.id.trim().toLowerCase(), c]));

  const criteria = SUMMARY_RUBRIC.map(({ id, label, maxScore }) => {
    const found = byId.get(id);
    if (!found) throw new Error(`Summary evaluation is missing the "${id}" criterion.`);
    const score = Number.isFinite(found.score) ? half(Math.min(maxScore, Math.max(0, found.score))) : 0;
    return { id, label, maxScore, score, comment: found.comment.trim() };
  });

  const summaryLanguage = (parsed.summaryLanguage || 'en').trim().toLowerCase().slice(0, 5) || 'en';
  const corrections = parsed.languageFeedback?.corrections.filter((c) => c.original.trim() && c.corrected.trim()) ?? [];
  const languageFeedback =
    summaryLanguage.startsWith('en') && parsed.languageFeedback && (parsed.languageFeedback.comment.trim() || corrections.length)
      ? { comment: parsed.languageFeedback.comment.trim(), corrections }
      : undefined;

  return {
    totalScore: criteria.reduce((sum, c) => sum + c.score, 0),
    criteria,
    summaryLanguage,
    overallFeedback: parsed.overallFeedback.trim(),
    strengths: parsed.strengths,
    missedPoints: parsed.missedPoints,
    misunderstandings: parsed.misunderstandings,
    modelSummary: parsed.modelSummary.trim(),
    ...(languageFeedback ? { languageFeedback } : {})
  };
}
