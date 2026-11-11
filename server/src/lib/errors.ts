import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error codes the extension maps to UI states (CLOUD_BACKEND_DESIGN.md §7). */
export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'QUOTA_EXCEEDED'
  | 'PLAN_REQUIRED'
  | 'INPUT_TOO_LONG'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'AI_PAUSED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'INTERNAL';

/** Thrown from routes and middleware; `app.onError` renders it as the error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toBody() {
    return { error: { code: this.code, message: this.message, ...this.details } };
  }
}
