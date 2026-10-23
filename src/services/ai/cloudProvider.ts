import {
  SelectionType,
  LinguisticAnalysisResult,
  WritingGoal,
  WritingAssistResult,
  FollowUpResponse,
  StageAExplanation,
  StageBDetailedVocabulary
} from '../../types';
import { AuthService, CloudAuthError } from '../auth/authService';
import { AIProvider } from './types';

export type CloudAIErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INPUT_TOO_LONG'
  | 'INVALID_REQUEST'
  | 'AI_UNAVAILABLE'
  | 'AI_PAUSED'
  | 'NOT_AVAILABLE';

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
      return new CloudAIError(
        'QUOTA_EXCEEDED',
        `You've used all ${details.limit ?? ''} of today's LexiFlow credits.${reset ? ` They reset at ${reset}.` : ''} Upgrade to Pro for more.`.replace('all  of', 'all of'),
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
 * AI provider backed by LexiFlow Cloud (server/). Never falls back to offline results:
 * a refusal is surfaced to the reader (CLOUD_BACKEND_DESIGN.md §3.3).
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

  private notYet(feature: string): never {
    throw new CloudAIError(
      'NOT_AVAILABLE',
      `${feature} is not on LexiFlow Cloud yet. Choose another AI provider in Settings to use it.`
    );
  }

  async analyze(_text: string, type: SelectionType): Promise<LinguisticAnalysisResult> {
    return this.notYet(type === 'sentence' ? 'Sentence X-Ray' : type === 'paragraph' ? 'Paragraph analysis' : 'Full analysis');
  }

  async assistWriting(_text: string, _goal: WritingGoal): Promise<WritingAssistResult> {
    return this.notYet('Writing help');
  }

  async askFollowUp(_text: string, _context: string, _question: string): Promise<FollowUpResponse> {
    return this.notYet('AI chat');
  }
}
