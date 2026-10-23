import { CLOUD_API_BASE_URL, GOOGLE_OAUTH_CLIENT_ID } from '../../config/cloud';

// Runs only in the background service worker; other contexts reach it through
// AUTH_LOGIN / AUTH_LOGOUT / GET_ACCOUNT messages, so tokens never leave the background.

const REFRESH_TOKEN_KEY = 'lexiflow.auth.refreshToken';
const ACCESS_TOKEN_KEY = 'lexiflow.auth.accessToken';
/** Refresh this long before the access token expires (CLOUD_BACKEND_DESIGN.md §4.2). */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type CloudAuthErrorCode =
  | 'AUTH_REQUIRED'
  | 'CANCELLED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK'
  | 'NOT_CONFIGURED';

export class CloudAuthError extends Error {
  constructor(readonly code: CloudAuthErrorCode, message: string) {
    super(message);
    this.name = 'CloudAuthError';
  }
}

export interface CloudAccount {
  user: { id: string; email: string; name: string | null };
  plan: 'free' | 'pro';
  planExpiresAt: string | null;
  usage: { used: number; limit: number; resetAt: string };
}

interface StoredAccessToken {
  token: string;
  expiresAt: number;
}

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// --- storage: access token in session storage (cleared with the browser), refresh token in local storage

async function readRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
  return (result[REFRESH_TOKEN_KEY] as string | undefined) ?? null;
}

async function readAccessToken(): Promise<StoredAccessToken | null> {
  const result = await chrome.storage.session.get(ACCESS_TOKEN_KEY);
  return (result[ACCESS_TOKEN_KEY] as StoredAccessToken | undefined) ?? null;
}

async function storeSession(session: SessionResponse): Promise<void> {
  const access: StoredAccessToken = { token: session.accessToken, expiresAt: Date.now() + session.expiresIn * 1000 };
  await chrome.storage.session.set({ [ACCESS_TOKEN_KEY]: access });
  await chrome.storage.local.set({ [REFRESH_TOKEN_KEY]: session.refreshToken });
}

async function clearSession(): Promise<void> {
  await chrome.storage.session.remove(ACCESS_TOKEN_KEY);
  await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
}

// --- network

async function post(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${CLOUD_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new CloudAuthError('NETWORK', 'Could not reach LexiFlow Cloud. Check your connection.');
  }
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    return ((await res.clone().json()) as { error?: { code?: string } }).error?.code;
  } catch {
    return undefined;
  }
}

async function errorFromResponse(res: Response): Promise<CloudAuthError> {
  let message = `LexiFlow Cloud error (${res.status}).`;
  try {
    message = ((await res.clone().json()) as { error?: { message?: string } }).error?.message || message;
  } catch {
    // keep the generic message
  }
  if (res.status === 401) return new CloudAuthError('AUTH_REQUIRED', message);
  if (res.status === 429) return new CloudAuthError('RATE_LIMITED', message);
  return new CloudAuthError('SERVICE_UNAVAILABLE', message);
}

function randomString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- refresh: one in-flight exchange at a time, because the server treats a reused refresh token as theft

let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) return null;

  const res = await post('/v1/auth/refresh', { refreshToken });
  if (res.status === 401) {
    await clearSession();
    return null;
  }
  // Keep the session on transient failures; the next call retries.
  if (!res.ok) throw await errorFromResponse(res);

  const session = (await res.json()) as SessionResponse;
  await storeSession(session);
  return session.accessToken;
}

function refreshOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export const AuthService = {
  async isSignedIn(): Promise<boolean> {
    return (await readRefreshToken()) !== null;
  },

  /** Opens Google's account chooser and exchanges the ID token for a LexiFlow session. */
  async login(): Promise<void> {
    if (GOOGLE_OAUTH_CLIENT_ID.startsWith('REPLACE_WITH')) {
      throw new CloudAuthError('NOT_CONFIGURED', 'Google sign-in is not configured in this build.');
    }

    const nonce = randomString();
    const state = randomString();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.search = new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      response_type: 'id_token',
      redirect_uri: chrome.identity.getRedirectURL(),
      scope: 'openid email profile',
      nonce,
      state,
      prompt: 'select_account'
    }).toString();

    let responseUrl: string | undefined;
    try {
      responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
    } catch {
      // Chrome rejects when the user closes the window or denies access.
      throw new CloudAuthError('CANCELLED', 'Sign-in was cancelled.');
    }
    if (!responseUrl) throw new CloudAuthError('CANCELLED', 'Sign-in was cancelled.');

    const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
    if (params.get('error')) throw new CloudAuthError('CANCELLED', 'Sign-in was cancelled.');
    if (params.get('state') !== state) throw new CloudAuthError('AUTH_REQUIRED', 'Sign-in response did not match. Try again.');
    const idToken = params.get('id_token');
    if (!idToken) throw new CloudAuthError('AUTH_REQUIRED', 'Google did not return an ID token.');

    const res = await post('/v1/auth/google', { idToken, nonce });
    if (!res.ok) throw await errorFromResponse(res);
    await storeSession((await res.json()) as SessionResponse);
  },

  /** Ends this device's session on the server (best effort) and locally (always). */
  async logout(): Promise<void> {
    const refreshToken = await readRefreshToken();
    await clearSession();
    if (refreshToken) {
      try {
        await post('/v1/auth/logout', { refreshToken });
      } catch {
        // Offline: the server-side token simply expires.
      }
    }
  },

  /** Permanently deletes the LexiFlow Cloud account on the server, then signs out locally. */
  async deleteAccount(): Promise<void> {
    const res = await AuthService.authorizedFetch('/v1/me', { method: 'DELETE' });
    if (!res.ok && res.status !== 401) throw await errorFromResponse(res);
    await clearSession();
  },

  /** A valid access token, refreshed when close to expiry; null when signed out. */
  async getAccessToken(): Promise<string | null> {
    const access = await readAccessToken();
    if (access && access.expiresAt - REFRESH_MARGIN_MS > Date.now()) return access.token;
    return refreshOnce();
  },

  /** fetch() against LexiFlow Cloud with the access token; refreshes and retries once on AUTH_EXPIRED. */
  async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const send = async (token: string) => {
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      try {
        return await fetch(`${CLOUD_API_BASE_URL}${path}`, { ...init, headers });
      } catch {
        throw new CloudAuthError('NETWORK', 'Could not reach LexiFlow Cloud. Check your connection.');
      }
    };

    const token = await AuthService.getAccessToken();
    if (!token) throw new CloudAuthError('AUTH_REQUIRED', 'Sign in to use LexiFlow Cloud.');

    const res = await send(token);
    if (res.status !== 401 || (await errorCode(res)) !== 'AUTH_EXPIRED') return res;

    await chrome.storage.session.remove(ACCESS_TOKEN_KEY);
    const fresh = await refreshOnce();
    if (!fresh) throw new CloudAuthError('AUTH_REQUIRED', 'Session ended. Sign in again.');
    return send(fresh);
  },

  /** The signed-in account with plan and today's usage, or null when signed out. */
  async getAccount(): Promise<CloudAccount | null> {
    if (!(await AuthService.isSignedIn())) return null;
    let res: Response;
    try {
      res = await AuthService.authorizedFetch('/v1/me');
    } catch (err) {
      if (err instanceof CloudAuthError && err.code === 'AUTH_REQUIRED') return null;
      throw err;
    }
    if (res.status === 401) {
      await clearSession();
      return null;
    }
    if (!res.ok) throw await errorFromResponse(res);
    return (await res.json()) as CloudAccount;
  }
};
