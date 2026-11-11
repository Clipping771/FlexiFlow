import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary,
  HighlightExtractionResult,
  UsageCoachFeedback
} from '../../types';
import { AuthService, CloudAuthError } from '../auth/authService';
import { AIProvider } from './types';
import { SummaryEvaluation } from '../../types';
import { SummaryEvaluationInput } from './prompts';
import { parseSummaryEvaluation } from './summarySchema';
import { MONETIZATION_ENABLED } from '../../config/features';

export type CloudAIErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INPUT_TOO_LONG'
  | 'INVALID_REQUEST'
  | 'AI_UNAVAILABLE'
  | 'AI_PAUSED';

/**
 * A LexiFlow Cloud refusal. The message is written for the reader (the popup shows it as is);
 * `details` carries the server's extra fields such as resetAt, upgradeUrl or retryAfterSeconds.
 */
export class CloudAIError extends Error {
  constructor(
    readonly code: CloudAIErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'CloudAIError';
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; [key: string]: unknown };
}

function formatTime(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toCloudError(status: number, envelope: ErrorEnvelope): Error {
  const { code, message, ...details } = envelope.error ?? {};
  switch (code) {
    case 'QUOTA_EXCEEDED': {
      const reset = formatTime(details.resetAt);
      const resets = reset ? ` It resets at ${reset}.` : '';
      // Upsell only when paid plans exist on both sides: the build flag and the server's upgrade link.
      const upsell = MONETIZATION_ENABLED && typeof details.upgradeUrl === 'string';
      return new CloudAIError(
        'QUOTA_EXCEEDED',
        upsell
          ? `You've used all ${details.limit} of today's LexiFlow credits.${resets.replace('It resets', 'They reset')} Upgrade to Pro for more.`
          : `You've reached today's LexiFlow limit of ${details.limit} AI uses.${resets}`,
        details
      );
    }
    case 'RATE_LIMITED':
      return new CloudAIError(
        'RATE_LIMITED',
        `Too many lookups at once. Try again in ${details.retryAfterSeconds ?? 'a few'} seconds.`,
        details
      );
    case 'INPUT_TOO_LONG':
      return new CloudAIError('INPUT_TOO_LONG', `That selection is too long for LexiFlow Cloud. Select a shorter piece of text.`, details);
    case 'AI_PAUSED': {
      const resume = formatTime(details.resetAt);
      return new CloudAIError(
        'AI_PAUSED',
        `${message || 'LexiFlow Cloud is paused right now.'}${resume ? ` New lookups resume at ${resume}.` : ''}`,
        details
      );
    }
    case 'INVALID_REQUEST':
      return new CloudAIError('INVALID_REQUEST', message || 'LexiFlow Cloud could not read this request.', details);
    case 'AUTH_REQUIRED':
    case 'AUTH_EXPIRED':
      return new CloudAuthError('AUTH_REQUIRED', 'Sign in to LexiFlow Cloud in Settings to look up words.');
    default:
      return new CloudAIError(
        'AI_UNAVAILABLE',
        message || `LexiFlow AI is unavailable right now (${status}). Try again in a moment.`,
        details
      );
  }
}

/**
 * An exam answer to mark on LexiFlow Cloud. The server builds the grading prompt from the exam engine,
 * so only the question and the learner's answer travel; `taskId` labels the server's usage record.
 */
export type CloudExamRequest =
  | { task: 'pte-essay'; prompt: string; text: string; taskId?: string }
  | { task: 'pte-swt'; passage: string; text: string; taskId?: string }
  | { task: 'pte-read-aloud'; prompt: string; transcript: string; durationMs: number; taskId?: string }
  | { task: 'ielts-task'; taskNumber: 1 | 2; prompt: string; text: string; taskId?: string }
  | { task: 'ielts-speaking'; part: 1 | 2; prompt: string; transcript: string; durationMs: number; taskId?: string };

/**
 * AI provider backed by LexiFlow Cloud (server/). Never falls back to offline results:
 * a refusal is surfaced to the reader (CLOUD_BACKEND_DESIGN.md §3.3). Article analysis stays on the
 * extension's built-in pipeline, as for every provider.
 */
export class CloudProvider implements AIProvider {
  name = 'lexiflow';
  private targetLang: string;

  constructor(targetLang: string = 'bn') {
    // The server takes plain language codes; pair ids like "en-bn" come from settings.
    this.targetLang = targetLang.toLowerCase().replace(/^en-/, '');
  }

  /** Sign-in is checked per request by the server; settings do not hold a key for this provider. */
  isAvailable(): boolean {
    return true;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await AuthService.authorizedFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, targetLang: this.targetLang })
      });
    } catch (err) {
      if (err instanceof CloudAuthError && err.code === 'AUTH_REQUIRED') {
        throw new CloudAuthError('AUTH_REQUIRED', 'Sign in to LexiFlow Cloud in Settings to look up words.');
      }
      throw err;
    }

    if (!res.ok) {
      let envelope: ErrorEnvelope = {};
      try {
        envelope = await res.json();
      } catch {
        // non-JSON error page; fall through to AI_UNAVAILABLE
      }
      throw toCloudError(res.status, envelope);
    }
    return ((await res.json()) as { data: T }).data;
  }

  analyzeStageA(text: string, contextSentence?: string, paragraphContext?: string): Promise<StageAExplanation> {
    return this.post('/v1/ai/stage-a', { text, contextSentence, paragraphContext });
  }

  analyzeStageB(lemma: string, partOfSpeech?: string, contextualSenseId?: string): Promise<StageBDetailedVocabulary> {
    return this.post('/v1/ai/stage-b', { lemma, partOfSpeech, contextualSenseId });
  }

  analyze(text: string, type: SelectionType, contextSentence?: string, paragraphContext?: string): Promise<LinguisticAnalysisResult> {
    return this.post('/v1/ai/analyze', { text, selectionType: type, contextSentence, paragraphContext });
  }

  assistWriting(text: string, goal: WritingGoal): Promise<WritingAssistResult> {
    return this.post('/v1/ai/assist-writing', { text, goal });
  }

  askFollowUp(text: string, context: string, question: string): Promise<FollowUpResponse> {
    return this.post('/v1/ai/follow-up', { text, context, question });
  }

  async evaluateSummary(input: SummaryEvaluationInput): Promise<SummaryEvaluation> {
    // The server validates too; parsing again keeps the score rules identical on every provider
    const raw = await this.post<unknown>('/v1/ai/evaluate-summary', { ...input });
    return parseSummaryEvaluation(raw);
  }

  extractHighlights(rawText: string, pageTitle?: string): Promise<HighlightExtractionResult> {
    return this.post('/v1/ai/highlights', { rawText, pageTitle });
  }

  /** Both word analyses in one metered request (2 credits); each word is cached on the server. */
  compareWords(wordA: string, wordB: string): Promise<{ wordA: LinguisticAnalysisResult; wordB: LinguisticAnalysisResult }> {
    return this.post('/v1/ai/compare-words', { wordA, wordB });
  }

  evaluateUsage(targetWord: string, sentence: string): Promise<UsageCoachFeedback> {
    return this.post('/v1/ai/evaluate-usage', { targetWord, sentence });
  }

  /*
   * Exam marking. Each returns the model's marks, already checked by the server against the engine's
   * schema; the exam engine validates them again and does the scoring, as it does for every provider.
   */
  markPteEssay(prompt: string, text: string, taskId?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/pte-essay', { prompt, text, taskId });
  }

  markPteSwt(passage: string, text: string, taskId?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/pte-swt', { passage, text, taskId });
  }

  markPteReadAloud(prompt: string, transcript: string, durationMs: number, taskId?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/pte-read-aloud', { prompt, transcript, durationMs: String(Math.round(durationMs)), taskId });
  }

  markIeltsTask(taskNumber: 1 | 2, prompt: string, text: string, taskId?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/ielts-task', { task: String(taskNumber), prompt, text, taskId });
  }

  markIeltsSpeaking(part: 1 | 2, prompt: string, transcript: string, durationMs: number, taskId?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/ielts-speaking', { part: String(part), prompt, transcript, durationMs: String(Math.round(durationMs)), taskId });
  }

  /** An exam item written from the article (or marks for a Summarize Spoken Text answer). */
  generateExamItem(kind: string, source: string, answer?: string): Promise<unknown> {
    return this.post('/v1/ai/exam/generate', { kind, source, ...(answer ? { answer } : {}) });
  }

  markExam(req: CloudExamRequest): Promise<unknown> {
    switch (req.task) {
      case 'pte-essay':
        return this.markPteEssay(req.prompt, req.text, req.taskId);
      case 'pte-swt':
        return this.markPteSwt(req.passage, req.text, req.taskId);
      case 'pte-read-aloud':
        return this.markPteReadAloud(req.prompt, req.transcript, req.durationMs, req.taskId);
      case 'ielts-task':
        return this.markIeltsTask(req.taskNumber, req.prompt, req.text, req.taskId);
      case 'ielts-speaking':
        return this.markIeltsSpeaking(req.part, req.prompt, req.transcript, req.durationMs, req.taskId);
    }
  }
}
