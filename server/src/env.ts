export interface Bindings {
  DB: D1Database;
  /** HMAC key for access tokens (wrangler secret). */
  JWT_SECRET: string;
  /** Comma-separated CORS allowlist, e.g. "chrome-extension://abc,http://localhost:8787". */
  ALLOWED_ORIGINS: string;
  /** Google OAuth web client id; ID tokens must carry it as `aud`. */
  GOOGLE_CLIENT_ID: string;
  /** Gemini API key for all cloud AI calls (wrangler secret). */
  GEMINI_API_KEY: string;
  /** Gemini model id, e.g. "gemini-2.0-flash". */
  GEMINI_MODEL: string;
  /** Where the "upgrade to Pro" button in QUOTA_EXCEEDED errors points. */
  UPGRADE_URL: string;
}

export interface Variables {
  userId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
