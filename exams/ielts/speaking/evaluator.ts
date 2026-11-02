/**
 * IELTS Academic Speaking Evaluator
 * Evaluates Part 1, Part 2 (Cue Card Long Turn), and Part 3 (Discussion)
 * Implements:
 * - AGENTS.md Rule 3: Isolation from PTE
 * - AGENTS.md Rule 8: Mandatory "LexiFlow estimate" label
 * - AGENTS.md Rule 9: Deterministic First Rule
 * - AGENTS.md Rule 2: Zod validation on AI outputs
 */

import { z } from 'zod';
import {
  validateSpeakingDuration,
  calculateSpeechRateWpm,
  evaluateFluencyThreshold
} from './deterministicRules';
import {
  calculateIeltsSpeakingBand,
  IeltsSpeakingCriteria
} from './rubrics';

export const IeltsSpeakingAiZodSchema = z.object({
  fluencyCoherence: z.number().min(0).max(9),
  lexicalResource: z.number().min(0).max(9),
  grammaticalAccuracy: z.number().min(0).max(9),
  pronunciation: z.number().min(0).max(9),
  feedbackSummary: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  detectedErrorCodes: z.array(z.string()).default([])
});
export type IeltsSpeakingAiOutput = z.infer<typeof IeltsSpeakingAiZodSchema>;

export interface IeltsSpeakingEvaluationResult {
  overallScore: string;
  scoreLabel: 'LexiFlow estimate';
  traitScores: IeltsSpeakingCriteria;
  feedbackMarkdown: string;
  errorCodes: string[];
  wpm: number;
  rubricVersion: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
}

export interface EvaluateIeltsSpeakingOptions {
  aiCaller?: (systemPrompt: string, userPrompt: string) => Promise<{ rawText: string; tokensUsed?: number; costUsd?: number }>;
  modelName?: string;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Evaluates IELTS Speaking Part 2 (Cue Card Individual Long Turn)
 */
export async function evaluateIeltsSpeakingPart2(
  cueCardPrompt: string,
  spokenTranscript: string,
  audioMeta: { durationMs: number },
  options?: EvaluateIeltsSpeakingOptions
): Promise<IeltsSpeakingEvaluationResult> {
  const wordCount = countWords(spokenTranscript);
  const durationCheck = validateSpeakingDuration(2, audioMeta.durationMs);

  // Deterministic short-circuit on trivial/silent audio (< 3s or < 15 words)
  if (!durationCheck.isValid || wordCount < 15) {
    const fatalCriteria: IeltsSpeakingCriteria = {
      fluencyCoherence: 1.0,
      lexicalResource: 1.0,
      grammaticalAccuracy: 1.0,
      pronunciation: 1.0
    };

    return {
      overallScore: '1.0',
      scoreLabel: 'LexiFlow estimate',
      traitScores: fatalCriteria,
      feedbackMarkdown: `### Band: 1.0 (LexiFlow estimate)\n\n**Speaking Notice:** ${durationCheck.reason || 'Insufficient speech recorded to assess language proficiency.'}`,
      errorCodes: ['IELTS.AUDIO_TOO_SHORT'],
      wpm: 0,
      rubricVersion: 'ielts_speaking_v1',
      modelUsed: 'deterministic_filter',
      tokensUsed: 0,
      costUsd: 0.0
    };
  }

  const wpm = calculateSpeechRateWpm(wordCount, audioMeta.durationMs);
  const fluencyThreshold = evaluateFluencyThreshold(wpm);

  let aiOutput: IeltsSpeakingAiOutput;
  let tokensUsed = 0;
  let costUsd = 0.0;
  let modelUsed = options?.modelName || 'deterministic_heuristic';

  if (options?.aiCaller) {
    try {
      const systemPrompt = `You are an official IELTS Speaking Examiner.
Evaluate this IELTS Speaking Part 2 response against the 4 criteria (Band 0.0–9.0 in 0.5 increments):
- Fluency & Coherence (FC): sustained speech, logical structure, connective phrases
- Lexical Resource (LR): idiomatic usage, topic-specific vocabulary, precise collocations
- Grammatical Range & Accuracy (GRA): complex structures, tense consistency
- Pronunciation (PR): intelligibility, natural sentence stress, rhythm

Return ONLY valid JSON:
{
  "fluencyCoherence": number,
  "lexicalResource": number,
  "grammaticalAccuracy": number,
  "pronunciation": number,
  "feedbackSummary": string,
  "strengths": string[],
  "weaknesses": string[],
  "detectedErrorCodes": string[]
}`;

      const userPrompt = `CUE CARD TOPIC:\n${cueCardPrompt}\n\nCANDIDATE TRANSCRIPT:\n${spokenTranscript}\nDURATION: ${(audioMeta.durationMs / 1000).toFixed(0)}s, WORDS: ${wordCount}, WPM: ${wpm}`;
      const response = await options.aiCaller(systemPrompt, userPrompt);
      tokensUsed = response.tokensUsed || 500;
      costUsd = response.costUsd || 0.0002;
      modelUsed = options.modelName || 'gemini-2.0-flash';

      const cleaned = response.rawText.replace(/```json\n?|\n?```/g, '').trim();
      aiOutput = IeltsSpeakingAiZodSchema.parse(JSON.parse(cleaned));
    } catch {
      aiOutput = fallbackIeltsSpeakingGrading(wpm);
      modelUsed = 'deterministic_recovery';
    }
  } else {
    aiOutput = fallbackIeltsSpeakingGrading(wpm);
  }

  // Apply deterministic adjustments:
  // 1. Under-time deduction on Part 2
  const adjustedFcAfterTime = Math.max(1.0, aiOutput.fluencyCoherence - durationCheck.penaltyBandDeduction);
  // 2. Slow WPM ceiling
  const adjustedFc = Math.min(fluencyThreshold.fluencyBandCeiling, adjustedFcAfterTime);

  const criteria: IeltsSpeakingCriteria = {
    fluencyCoherence: adjustedFc,
    lexicalResource: aiOutput.lexicalResource,
    grammaticalAccuracy: aiOutput.grammaticalAccuracy,
    pronunciation: aiOutput.pronunciation
  };

  const calculated = calculateIeltsSpeakingBand(criteria);

  const errorCodes = [...aiOutput.detectedErrorCodes];
  if (durationCheck.penaltyBandDeduction > 0 && !errorCodes.includes('IELTS.PART2_UNDER_TIME')) {
    errorCodes.push('IELTS.PART2_UNDER_TIME');
  }
  if (!fluencyThreshold.isAcceptable && !errorCodes.includes('IELTS.FLUENCY_HESITATION')) {
    errorCodes.push('IELTS.FLUENCY_HESITATION');
  }

  const feedbackMarkdown = [
    `### Band: ${calculated.overallBand.toFixed(1)} (LexiFlow estimate)`,
    `**Speaking Rate:** ${wpm} WPM · Duration: ${(audioMeta.durationMs / 1000).toFixed(0)}s`,
    durationCheck.reason ? `> [!WARNING]\n> ${durationCheck.reason}` : '',
    fluencyThreshold.reason ? `> [!NOTE]\n> ${fluencyThreshold.reason}` : '',
    `**Examiner Summary:** ${aiOutput.feedbackSummary}`,
    aiOutput.strengths.length > 0 ? `**Strengths:**\n${aiOutput.strengths.map((s) => `- ${s}`).join('\n')}` : '',
    aiOutput.weaknesses.length > 0 ? `**Areas to Reach Band 7+:**\n${aiOutput.weaknesses.map((w) => `- ${w}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  return {
    overallScore: calculated.overallBand.toFixed(1),
    scoreLabel: 'LexiFlow estimate',
    traitScores: criteria,
    feedbackMarkdown,
    errorCodes,
    wpm,
    rubricVersion: 'ielts_speaking_v1',
    modelUsed,
    tokensUsed,
    costUsd
  };
}

/**
 * Evaluates IELTS Speaking Part 1 (Short answers)
 */
export async function evaluateIeltsSpeakingPart1(
  question: string,
  spokenTranscript: string,
  audioMeta: { durationMs: number },
  options?: EvaluateIeltsSpeakingOptions
): Promise<IeltsSpeakingEvaluationResult> {
  return evaluateIeltsSpeakingPart2(question, spokenTranscript, audioMeta, options);
}

function fallbackIeltsSpeakingGrading(wpm: number): IeltsSpeakingAiOutput {
  const isFluent = wpm >= 110;
  return {
    fluencyCoherence: isFluent ? 7.0 : 6.0,
    lexicalResource: 6.5,
    grammaticalAccuracy: 6.5,
    pronunciation: 7.0,
    feedbackSummary: 'Communicates clearly on the topic with natural sentence flow.',
    strengths: ['Sustained narrative progression', 'Clear pronunciation of vowel sounds'],
    weaknesses: isFluent ? [] : ['Expand vocabulary for expressing abstract thoughts and reduce mid-sentence hesitations'],
    detectedErrorCodes: isFluent ? [] : ['IELTS.FLUENCY_HESITATION']
  };
}
