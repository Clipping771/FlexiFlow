import { decode, verifyWithJwks } from 'hono/jwt';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUER = /^(https:\/\/)?accounts\.google\.com$/;
const DEFAULT_CACHE_SECONDS = 3600;

type Jwk = JsonWebKey & { kid?: string };

// Per-isolate cache; Google rotates keys about weekly and sends Cache-Control max-age.
let cached: { keys: Jwk[]; expiresAt: number } | null = null;

export function clearGoogleKeyCache(): void {
  cached = null;
}

async function googleKeys(forceRefresh: boolean): Promise<Jwk[]> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`Google JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error('Google JWKS has no keys');
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') ?? '')?.[1];
  cached = { keys: body.keys, expiresAt: Date.now() + (maxAge ? Number(maxAge) : DEFAULT_CACHE_SECONDS) * 1000 };
  return body.keys;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

export type GoogleVerifyResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; reason: 'invalid' | 'unverified_email' | 'nonce_mismatch' };

/**
 * Verifies a Google ID token from `launchWebAuthFlow`: RS256 signature against Google's JWKS,
 * issuer, audience (our web client id), expiry, the nonce the extension generated, and a verified email.
 * Throws only when Google's keys cannot be fetched, so callers can answer 503 instead of 401.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string }
): Promise<GoogleVerifyResult> {
  let kid: unknown;
  try {
    kid = decode(idToken).header.kid;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (typeof kid !== 'string') return { ok: false, reason: 'invalid' };

  let keys = await googleKeys(false);
  // An unknown kid means Google rotated keys since we cached them.
  if (!keys.some((k) => k.kid === kid)) keys = await googleKeys(true);

  let payload: Record<string, unknown>;
  try {
    payload = await verifyWithJwks(idToken, {
      keys: keys as Parameters<typeof verifyWithJwks>[1]['keys'],
      verification: { iss: GOOGLE_ISSUER, aud: expected.clientId },
      allowedAlgorithms: ['RS256']
    });
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (typeof payload.nonce !== 'string' || payload.nonce !== expected.nonce) {
    return { ok: false, reason: 'nonce_mismatch' };
  }
  if (payload.email_verified !== true || typeof payload.email !== 'string') {
    return { ok: false, reason: 'unverified_email' };
  }
  if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    identity: {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : null
    }
  };
}
