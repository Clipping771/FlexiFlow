import { getLanguageConfig } from '../../../config/languages';
import { PromptSpec } from './types';

/** Most article text sent for marking (the cloud backend accepts the same amount). */
export const SUMMARY_MAX_ARTICLE_CHARS = 15000;
/** Longest summary accepted (the free cloud plan's paragraph limit). */
export const SUMMARY_MAX_CHARS = 3000;

export interface SummaryEvaluationInput {
  articleText: string;
  articleTitle?: string;
  summary: string;
}

/**
 * Summary practice: marks the learner's summary of an article for how well it shows they understood it.
 * Output is checked and normalized by parseSummaryEvaluation (summarySchema.ts), which recomputes the total.
 */
export function buildSummaryEvaluationPrompt(
  { articleText, articleTitle, summary }: SummaryEvaluationInput,
  targetLang: string
): PromptSpec {
  const lang = getLanguageConfig(targetLang);
  const system = `You are a fair, encouraging reading-comprehension examiner. An English learner whose own language is ${lang.targetLabel} read the article below and wrote a summary to show what they understood. Mark THEIR summary against THE ARTICLE.

The summary may be written in English, ${lang.targetLabel} or another language. First detect its language. Write every comment, list item and the model summary in THAT SAME language, so the learner can read it. Judge understanding, not the choice of language.

Marking (total 10), score each criterion in steps of 0.5:
- "main_idea" (0-4): does the summary state the article's central message or argument correctly? 4 = clearly and correctly; 2 = partly or vaguely; 0 = missing or wrong.
- "key_points" (0-3): does it cover the most important supporting points? Judge coverage of what matters, not length.
- "accuracy" (0-2): is everything it says true to the article? Deduct for misreadings, invented claims, or reversing the author's view.
- "expression" (0-1): is it concise and mostly in the learner's own words rather than copied sentences?

Rules:
- Base every judgement only on the article text given. Never reward facts that are not in the article.
- Be honest: an off-topic, copied or empty summary scores low. Do not inflate scores to be kind.
- "missedPoints": the important points from the article that the summary left out (empty if none).
- "misunderstandings": statements in the summary that contradict or misread the article, each with what the article actually says (empty if none).
- "strengths": what the learner did well, concretely.
- "modelSummary": a 3-5 sentence summary of the article a strong reader would write.
- "languageFeedback": ONLY if the summary is in English: up to 5 corrections of grammar or wording with a short explanation each, plus a one-line comment. These do not change the score. Use null for a non-English summary.

Return raw JSON:
{
  "summaryLanguage": "ISO 639-1 code of the summary's language, e.g. en, bn, he",
  "criteria": [
    { "id": "main_idea", "score": 0-4, "comment": "why" },
    { "id": "key_points", "score": 0-3, "comment": "why" },
    { "id": "accuracy", "score": 0-2, "comment": "why" },
    { "id": "expression", "score": 0-1, "comment": "why" }
  ],
  "overallFeedback": "2-3 sentences on how well the learner understood the article and what to do next",
  "strengths": ["..."],
  "missedPoints": ["..."],
  "misunderstandings": ["..."],
  "modelSummary": "...",
  "languageFeedback": { "comment": "...", "corrections": [{ "original": "...", "corrected": "...", "explanation": "..." }] } | null
}`;

  const user = `Article title: ${articleTitle || 'Untitled'}

Article:
"""
${articleText.slice(0, SUMMARY_MAX_ARTICLE_CHARS)}
"""

Learner's summary:
"""
${summary.slice(0, SUMMARY_MAX_CHARS)}
"""`;

  return { system, user, maxTokens: 2000 };
}
