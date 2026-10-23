export interface Bindings {
  DB: D1Database;
  /** HMAC key for access tokens (wrangler secret). */
  JWT_SECRET: string;
  /** Comma-separated CORS allowlist, e.g. "chrome-extension://abc,http://localhost:8787". */
  ALLOWED_ORIGINS: string;
  /** Google OAuth web client id; ID tokens must carry it as `aud`. */
  GOOGLE_CLIENT_ID: string;
}

export interface Variables {
  userId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
