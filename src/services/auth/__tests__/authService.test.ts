import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../config/cloud', () => ({
  CLOUD_API_BASE_URL: 'https://api.test',
  GOOGLE_OAUTH_CLIENT_ID: 'test-client.apps.googleusercontent.com'
}));

import { AuthService, CloudAuthError } from '../authService';

const REDIRECT = 'https://extid.chromiumapp.org/';

function memoryArea() {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    })
  };
}

let local: ReturnType<typeof memoryArea>;
let session: ReturnType<typeof memoryArea>;
let launchWebAuthFlow: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function sessionBody(n: number) {
  return { accessToken: `at_${n}`, refreshToken: `rt_${n}`, expiresIn: 3600, user: { id: 'usr_1' }, plan: 'free' };
}

function signedIn(expiresInMs = 60 * 60 * 1000) {
  local.data['lexiflow.auth.refreshToken'] = 'rt_0';
  session.data['lexiflow.auth.accessToken'] = { token: 'at_0', expiresAt: Date.now() + expiresInMs };
}

function requestsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => url === `https://api.test${path}`);
}

beforeEach(() => {
  local = memoryArea();
  session = memoryArea();
  launchWebAuthFlow = vi.fn();
  fetchMock = vi.fn();
  (globalThis as any).chrome = {
    storage: { local, session },
    identity: { getRedirectURL: () => REDIRECT, launchWebAuthFlow }
  };
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as any).chrome;
});

describe('AuthService.login', () => {
  it('runs the Google flow with a nonce and state, then stores the session', async () => {
    launchWebAuthFlow.mockImplementation(async ({ url }: { url: string }) => {
      const params = new URL(url).searchParams;
      expect(params.get('client_id')).toBe('test-client.apps.googleusercontent.com');
      expect(params.get('response_type')).toBe('id_token');
      expect(params.get('redirect_uri')).toBe(REDIRECT);
      expect(params.get('scope')).toBe('openid email profile');
      return `${REDIRECT}#id_token=google.jwt&state=${params.get('state')}`;
    });
    fetchMock.mockResolvedValue(jsonResponse(200, sessionBody(1)));

    await AuthService.login();

    const authUrl = new URL(launchWebAuthFlow.mock.calls[0][0].url);
    const [, init] = requestsTo('/v1/auth/google')[0];
    expect(JSON.parse(init.body)).toEqual({ idToken: 'google.jwt', nonce: authUrl.searchParams.get('nonce') });
    expect(local.data['lexiflow.auth.refreshToken']).toBe('rt_1');
    expect((session.data['lexiflow.auth.accessToken'] as any).token).toBe('at_1');
    // The refresh token is never written to session storage, nor the access token to local storage.
    expect(Object.keys(local.data)).toEqual(['lexiflow.auth.refreshToken']);
  });

  it('rejects a response whose state does not match', async () => {
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT}#id_token=google.jwt&state=forged`);
    await expect(AuthService.login()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(local.data).toEqual({});
  });

  it('reports a closed window or denied consent as CANCELLED', async () => {
    launchWebAuthFlow.mockRejectedValueOnce(new Error('The user did not approve access.'));
    await expect(AuthService.login()).rejects.toMatchObject({ code: 'CANCELLED' });

    launchWebAuthFlow.mockResolvedValueOnce(`${REDIRECT}#error=access_denied`);
    await expect(AuthService.login()).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('surfaces server rejections with their code', async () => {
    launchWebAuthFlow.mockImplementation(async ({ url }: { url: string }) =>
      `${REDIRECT}#id_token=x&state=${new URL(url).searchParams.get('state')}`
    );
    fetchMock.mockResolvedValue(jsonResponse(429, { error: { code: 'RATE_LIMITED', message: 'Too many new accounts.' } }));
    const err = await AuthService.login().catch((e) => e);
    expect(err).toBeInstanceOf(CloudAuthError);
    expect(err).toMatchObject({ code: 'RATE_LIMITED', message: 'Too many new accounts.' });
  });
});

describe('AuthService.getAccessToken', () => {
  it('returns null when signed out without calling the server', async () => {
    expect(await AuthService.getAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a fresh stored token without refreshing', async () => {
    signedIn();
    expect(await AuthService.getAccessToken()).toBe('at_0');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes once for concurrent callers when the token is about to expire', async () => {
    signedIn(60 * 1000); // inside the 5-minute margin
    fetchMock.mockImplementation(async () => jsonResponse(200, sessionBody(2)));

    const tokens = await Promise.all([AuthService.getAccessToken(), AuthService.getAccessToken(), AuthService.getAccessToken()]);

    expect(tokens).toEqual(['at_2', 'at_2', 'at_2']);
    expect(requestsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(JSON.parse(requestsTo('/v1/auth/refresh')[0][1].body)).toEqual({ refreshToken: 'rt_0' });
    expect(local.data['lexiflow.auth.refreshToken']).toBe('rt_2');
  });

  it('signs out locally when the server ends the session', async () => {
    signedIn(0);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'AUTH_REQUIRED' } }));
    expect(await AuthService.getAccessToken()).toBeNull();
    expect(await AuthService.isSignedIn()).toBe(false);
  });

  it('keeps the session on a transient server failure', async () => {
    signedIn(0);
    fetchMock.mockResolvedValue(jsonResponse(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'down' } }));
    await expect(AuthService.getAccessToken()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(await AuthService.isSignedIn()).toBe(true);
  });
});

describe('AuthService.authorizedFetch', () => {
  it('sends the bearer token', async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await AuthService.authorizedFetch('/v1/me');
    const [, init] = requestsTo('/v1/me')[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer at_0');
  });

  it('refreshes and retries once when the server says the token expired', async () => {
    signedIn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'AUTH_EXPIRED' } }))
      .mockResolvedValueOnce(jsonResponse(200, sessionBody(3)))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const res = await AuthService.authorizedFetch('/v1/me');

    expect(res.status).toBe(200);
    const meCalls = requestsTo('/v1/me');
    expect(meCalls).toHaveLength(2);
    expect(new Headers(meCalls[1][1].headers).get('Authorization')).toBe('Bearer at_3');
  });

  it('does not retry other 401s', async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'AUTH_REQUIRED' } }));
    const res = await AuthService.authorizedFetch('/v1/me');
    expect(res.status).toBe(401);
    expect(requestsTo('/v1/me')).toHaveLength(1);
    expect(requestsTo('/v1/auth/refresh')).toHaveLength(0);
  });

  it('maps network failures to NETWORK', async () => {
    signedIn();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(AuthService.authorizedFetch('/v1/me')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('AuthService.getAccount and logout', () => {
  it('returns null when signed out', async () => {
    expect(await AuthService.getAccount()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the account from /v1/me', async () => {
    signedIn();
    const account = { user: { id: 'usr_1', email: 'a@b.c', name: null }, plan: 'free', planExpiresAt: null, usage: { used: 3, limit: 30, resetAt: 'x' } };
    fetchMock.mockResolvedValue(jsonResponse(200, account));
    expect(await AuthService.getAccount()).toEqual(account);
  });

  it('clears the session when /v1/me rejects the account', async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'AUTH_REQUIRED' } }));
    expect(await AuthService.getAccount()).toBeNull();
    expect(await AuthService.isSignedIn()).toBe(false);
  });

  it('revokes on the server and clears locally even when offline', async () => {
    signedIn();
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));
    await AuthService.logout();
    expect(JSON.parse(requestsTo('/v1/auth/logout')[0][1].body)).toEqual({ refreshToken: 'rt_0' });
    expect(local.data).toEqual({});
    expect(session.data).toEqual({});

    signedIn();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(AuthService.logout()).resolves.toBeUndefined();
    expect(await AuthService.isSignedIn()).toBe(false);
  });
});
