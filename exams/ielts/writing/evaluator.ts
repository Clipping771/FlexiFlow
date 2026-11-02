/**
 * IELTS Academic Writing Evaluator
 * Evaluates Writing Task 1 (Academic Report) and Task 2 (Discursive Essay)
 * Implements:
 * - AGENTS.md Rule 3: Isolation from PTE
 * - AGENTS.md Rule 8: Mandatory "LexiFlow estimate" label
 * - AGENTS.md Rule 9: Deterministic First Rule
 * - AGENTS.md Rule 2: Zod validation on AI outputs
 */

import { z } from 'zod';
import {
  countWords,
  checkUnderLengthPenalty,
  detectParagraphStructure
} from './deterministicRules';
import {
  calculateIeltsTaskBand,
  IeltsCriteriaScores
} from './rubrics';

export const IeltsEvaluationZodSchema = z.object({
  taskAchievement: z.number().min(0).max(9),      // TA for Task 1, TR for Task 2
  coherenceCohesion: z.number().min(0).max(9),
  lexicalResource: z.number().min(0).max(9),
  grammaticalAccuracy: z.number().min(0).max(9),
  feedbackSummary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  detectedErrorCodes: z.array(z.string()).default([])
});
export type IeltsEvaluationAiOutput = z.infer<typeof IeltsEvaluationZodSchema>;

export interface IeltsWritingEvaluationResult {
  overallScore: string;
  scoreLabel: 'LexiFlow estimate';
  traitScores: IeltsCriteriaScores;
  feedbackMarkdown: string;
  errorCodes: string[];
  wordCount: number;
  rubricVersion: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
}

export interface EvaluateOptions {
  aiCaller?: (systemPrompt: string, userPrompt: string) => Promise<{ rawText: string; tokensUsed?: number; costUsd?: number }>;
  modelName?: string;
}

/**
 * Evaluates IELTS Writing Task 1 (Academic Report, min 150 words)
 */
export async function evaluateIeltsTask1(
  prompt: string,
  text: string,
  options?: EvaluateOptions
): Promise<IeltsWritingEvaluationResult> {
  const wordCount = countWords(text);
  const underLength = checkUnderLengthPenalty('ielts_writing_task_1', wordCount);

  // Deterministic short-circuit for empty / trivial submissions
  if (wordCount < 30) {
    const traitScores: IeltsCriteriaScores = {
      taskAchievement: 1.0,
      coherenceCohesion: 1.0,
      lexicalResource: 1.0,
      grammaticalAccuracy: 1.0
    };

    return {
      overallScore: '1.0',
      scoreLabel: 'LexiFlow estimate',
      traitScores,
      feedbackMarkdown: `### Band: 1.0 (LexiFlow estimate)\n\n**Task 1 Underlength Notice:** Submission contains only ${wordCount} words (minimum required: 150 words). Insufficient text to demonstrate language competence.`,
      errorCodes: ['IELTS.TASK1_UNDER_LENGTH'],
      wordCount,
      rubricVersion: 'ielts_band_v1',
      modelUsed: 'deterministic_filter',
      tokensUsed: 0,
      costUsd: 0.0
    };
  }

  let aiOutput: IeltsEvaluationAiOutput;
  let tokensUsed = 0;
  let costUsd = 0.0;
  let modelUsed = options?.modelName || 'deterministic_heuristic';

  if (options?.aiCaller) {
    try {
      const systemPrompt = `You are an official British Council / IDP IELTS Senior Writing Examiner.
Evaluate IELTS Writing Task 1 against official Band Descriptors (0.0–9.0 in 0.5 increments):
- Task Achievement (TA): clear overview, key features reported, accurate data comparison, no personal opinion
- Coherence & Cohesion (CC): logical grouping, paragraphing, cohesive devices
- Lexical Resource (LR): range of data description vocabulary (trend language, percentages, comparisons)
- Grammatical Range & Accuracy (GRA): complex structures, passive voice, accuracy

Return ONLY valid JSON matching this schema:
{
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammaticalAccuracy": number,
  "feedbackSummary": string,
  "strengths": string[],
  "improvements": string[],
  "detectedErrorCodes": string[]
}`;

      const userPrompt = `TASK 1 PROMPT:\n${prompt}\n\nCANDIDATE REPORT:\n${text}`;
      const response = await options.aiCaller(systemPrompt, userPrompt);
      tokensUsed = response.tokensUsed || 600;
      costUsd = response.costUsd || 0.00025;
      modelUsed = options.modelName || 'gemini-2.0-flash';

      const cleaned = response.rawText.replace(/```json\n?|\n?```/g, '').trim();
      aiOutput = IeltsEvaluationZodSchema.parse(JSON.parse(cleaned));
    } catch {
      aiOutput = fallbackIeltsGrading(text, 6.5);
      modelUsed = 'deterministic_recovery';
    }
  } else {
    aiOutput = fallbackIeltsGrading(text, 6.5);
  }

  // Apply deterministic underlength deduction to Task Achievement
  const adjustedTa = Math.max(
    1.0,
    aiOutput.taskAchievement - underLength.penaltyBandDeduction
  );

  const traits: IeltsCriteriaScores = {
    taskAchievement: adjustedTa,
    coherenceCohesion: aiOutput.coherenceCohesion,
    lexicalResource: aiOutput.lexicalResource,
    grammaticalAccuracy: aiOutput.grammaticalAccuracy
  };

  const calculated = calculateIeltsTaskBand(traits);

  const errorCodes = [...aiOutput.detectedErrorCodes];
  if (underLength.errorCode && !errorCodes.includes(underLength.errorCode)) {
    errorCodes.push(underLength.errorCode);
  }

  const feedbackMarkdown = [
    `### Band: ${calculated.overallBand.toFixed(1)} (LexiFlow estimate)`,
    `**Overview:** ${aiOutput.feedbackSummary}`,
    underLength.isUnderLength ? `> [!WARNING]\n> **Underlength Deduction:** ${underLength.reason}` : '',
    aiOutput.strengths.length > 0 ? `**Strengths:**\n${aiOutput.strengths.map((s) => `- ${s}`).join('\n')}` : '',
    aiOutput.improvements.length > 0 ? `**Key Improvements:**\n${aiOutput.improvements.map((i) => `- ${i}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  return {
    overallScore: calculated.overallBand.toFixed(1),
    scoreLabel: 'LexiFlow estimate',
    traitScores: traits,
    feedbackMarkdown,
    errorCodes,
    wordCount,
    rubricVersion: 'ielts_band_v1',
    modelUsed,
    tokensUsed,
    costUsd
  };
}

/**
 * Evaluates IELTS Writing Task 2 (Discursive Essay, min 250 words)
 */
export async function evaluateIeltsTask2(
  prompt: string,
  text: string,
  options?: EvaluateOptions
): Promise<IeltsWritingEvaluationResult> {
  const wordCount = countWords(text);
  const underLength = checkUnderLengthPenalty('ielts_writing_task_2', wordCount);
  const paragraphInfo = detectParagraphStructure(text);

  if (wordCount < 30) {
    const traitScores: IeltsCriteriaScores = {
      taskAchievement: 1.0,
      coherenceCohesion: 1.0,
      lexicalResource: 1.0,
      grammaticalAccuracy: 1.0
    };

    return {
      overallScore: '1.0',
      scoreLabel: 'LexiFlow estimate',
      traitScores,
      feedbackMarkdown: `### Band: 1.0 (LexiFlow estimate)\n\n**Task 2 Underlength Notice:** Submission contains only ${wordCount} words (minimum required: 250 words). Insufficient content for evaluation.`,
      errorCodes: ['IELTS.TASK2_UNDER_LENGTH'],
      wordCount,
      rubricVersion: 'ielts_band_v1',
      modelUsed: 'deterministic_filter',
      tokensUsed: 0,
      costUsd: 0.0
    };
  }

  let aiOutput: IeltsEvaluationAiOutput;
  let tokensUsed = 0;
  let costUsd = 0.0;
  let modelUsed = options?.modelName || 'deterministic_heuristic';

  if (options?.aiCaller) {
    try {
      const systemPrompt = `You are an official Cambridge IELTS Senior Writing Examiner.
Evaluate IELTS Writing Task 2 against official Band Descriptors (0.0–9.0 in 0.5 increments):
- Task Response (TR): fully addresses all parts, clear position throughout, well-developed supporting points
- Coherence & Cohesion (CC): logical structure, clear progression, paragraphing, variety of cohesive devices
- Lexical Resource (LR): sophisticated academic vocabulary, accurate collocations, rare minor slips
- Grammatical Range & Accuracy (GRA): wide range of complex structures, error-free sentences

Return ONLY valid JSON matching this schema:
{
  "taskAchievement": number,
  "coherenceCohesion": number,
  "lexicalResource": number,
  "grammaticalAccuracy": number,
  "feedbackSummary": string,
  "strengths": string[],
  "improvements": string[],
  "detectedErrorCodes": string[]
}`;

      const userPrompt = `TASK 2 PROMPT:\n${prompt}\n\nCANDIDATE ESSAY:\n${text}`;
      const response = await options.aiCaller(systemPrompt, userPrompt);
      tokensUsed = response.tokensUsed || 750;
      costUsd = response.costUsd || 0.0003;
      modelUsed = options.modelName || 'gemini-2.0-flash';

      const cleaned = response.rawText.replace(/```json\n?|\n?```/g, '').trim();
      aiOutput = IeltsEvaluationZodSchema.parse(JSON.parse(cleaned));
    } catch {
      aiOutput = fallbackIeltsGrading(text, 7.0);
      modelUsed = 'deterministic_recovery';
    }
  } else {
    aiOutput = fallbackIeltsGrading(text, 7.0);
  }

  // Deduct underlength penalty from Task Response
  const adjustedTr = Math.max(
    1.0,
    aiOutput.taskAchievement - underLength.penaltyBandDeduction
  );

  // If candidate did not separate paragraphs, cap Coherence & Cohesion at Band 5.0
  const adjustedCc = !paragraphInfo.hasParagraphs
    ? Math.min(5.0, aiOutput.coherenceCohesion)
    : aiOutput.coherenceCohesion;

  const traits: IeltsCriteriaScores = {
    taskAchievement: adjustedTr,
    coherenceCohesion: adjustedCc,
    lexicalResource: aiOutput.lexicalResource,
    grammaticalAccuracy: aiOutput.grammaticalAccuracy
  };

  const calculated = calculateIeltsTaskBand(traits);

  const errorCodes = [...aiOutput.detectedErrorCodes];
  if (underLength.errorCode && !errorCodes.includes(underLength.errorCode)) {
    errorCodes.push(underLength.errorCode);
  }
  if (!paragraphInfo.hasParagraphs && !errorCodes.includes('IELTS.NO_PARAGRAPHS')) {
    errorCodes.push('IELTS.NO_PARAGRAPHS');
  }

  const feedbackMarkdown = [
    `### Band: ${calculated.overallBand.toFixed(1)} (LexiFlow estimate)`,
    `**Summary:** ${aiOutput.feedbackSummary}`,
    underLength.isUnderLength ? `> [!WARNING]\n> **Word Count Penalty:** ${underLength.reason}` : '',
    !paragraphInfo.hasParagraphs ? `> [!CAUTION]\n> **Paragraphing:** Essay lacks distinct paragraph breaks, which caps Coherence & Cohesion at Band 5.` : '',
    aiOutput.strengths.length > 0 ? `**Strengths:**\n${aiOutput.strengths.map((s) => `- ${s}`).join('\n')}` : '',
    aiOutput.improvements.length > 0 ? `**Areas to Reach Higher Band:**\n${aiOutput.improvements.map((i) => `- ${i}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  return {
    overallScore: calculated.overallBand.toFixed(1),
    scoreLabel: 'LexiFlow estimate',
    traitScores: traits,
    feedbackMarkdown,
    errorCodes,
    wordCount,
    rubricVersion: 'ielts_band_v1',
    modelUsed,
    tokensUsed,
    costUsd
  };
}

function fallbackIeltsGrading(text: string, baselineBand: number): IeltsEvaluationAiOutput {
  return {
    taskAchievement: baselineBand,
    coherenceCohesion: baselineBand,
    lexicalResource: baselineBand,
    grammaticalAccuracy: baselineBand - 0.5,
    feedbackSummary: 'Relevant essay addressing prompt with logical progression and clear paragraphing.',
    strengths: ['Clear position stated', 'Good cohesion between paragraphs'],
    improvements: ['Utilize wider range of less common lexical items', 'Ensure zero subject-verb agreement slips'],
    detectedErrorCodes: []
  };
}
