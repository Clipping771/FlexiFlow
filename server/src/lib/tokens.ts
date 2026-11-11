import { sign, verify } from 'hono/jwt';
import type { Plan } from './plans';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const ISSUER = 'lexiflow';

export interface AccessClaims {
  sub: string;
  /** Hint for the UI only; quota checks always read the plan from D1. */
  plan: Plan;
  planExp: string | null;
  iss: string;
  iat: number;
  exp: number;
}

export async function signAccessToken(
  user: { id: string; plan: Plan; planExpiresAt: string | null },
  secret: string,
  now: Date = new Date()
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  const claims: AccessClaims = {
    sub: user.id,
    plan: user.plan,
    planExp: user.planExpiresAt,
    iss: ISSUER,
    iat,
    exp: iat + ACCESS_TOKEN_TTL_SECONDS
  };
  return sign({ ...claims }, secret, 'HS256');
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: 'expired' | 'invalid' };

export async function verifyAccessToken(token: string, secret: string): Promise<VerifyResult> {
  try {
    const payload = await verify(token, secret, { alg: 'HS256', iss: ISSUER });
    if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'invalid' };
    return { ok: true, claims: payload as unknown as AccessClaims };
  } catch (err) {
    // Hono's error messages embed the token, so only the error name is inspected.
    return { ok: false, reason: (err as Error)?.name === 'JwtTokenExpired' ? 'expired' : 'invalid' };
  }
}
