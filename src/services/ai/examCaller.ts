/**
 * Bridges the exam engines (exams/pte, exams/ielts) to the learner's configured AI provider.
 * The engines take an `aiCaller` and validate its output themselves; this sends the prompt to the
 * background worker, which owns the API key.
 */
import type { CloudExamRequest } from './cloudProvider';

export interface ExamAiResponse {
  rawText: string;
  tokensUsed?: number;
  costUsd?: number;
}

export interface ExamAiCaller {
  /** Pass as `aiCaller` to an exam evaluator. */
  call: (systemPrompt: string, userPrompt: string) => Promise<ExamAiResponse>;
  /** The model that answered, once a call has succeeded. */
  modelName: () => string | undefined;
  /** Why the last call failed, so the UI can say so instead of showing a made-up score. */
  lastError: () => string | null;
}

/**
 * `cloud` describes the same answer as an exam task, for LexiFlow Cloud: it marks the task with the
 * engine's prompt on the server instead of taking the prompt from here. BYOK providers ignore it.
 */
export function createExamAiCaller(cloud?: CloudExamRequest): ExamAiCaller {
  let model: string | undefined;
  let error: string | null = null;

  const call = (systemPrompt: string, userPrompt: string): Promise<ExamAiResponse> =>
    new Promise((resolve, reject) => {
      const fail = (message: string) => {
        error = message;
        reject(new Error(message));
      };
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        fail('AI marking only works inside the LexiFlow extension.');
        return;
      }
      chrome.runtime.sendMessage({ type: 'EXAM_AI_COMPLETE', payload: { systemPrompt, userPrompt, cloud } }, (res) => {
        if (chrome.runtime?.lastError) fail(chrome.runtime.lastError.message || 'Could not reach LexiFlow.');
        else if (res?.success && res.data?.rawText) {
          error = null;
          model = res.data.model;
          resolve({ rawText: res.data.rawText });
        } else fail(res?.error || 'AI marking failed. Please try again.');
      });
    });

  return { call, modelName: () => model, lastError: () => error };
}

/** Scores from these sources are fixed placeholders, not a judgement of the learner's answer. */
export function isPlaceholderScore(modelUsed: string): boolean {
  return modelUsed === 'deterministic_heuristic' || modelUsed === 'deterministic_recovery';
}
