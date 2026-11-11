import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

/** Requires `Authorization: Bearer <access JWT>` and sets `userId`. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to use LexiFlow Cloud.');

  const result = await verifyAccessToken(match[1], c.env.JWT_SECRET);
  if (!result.ok) {
    throw result.reason === 'expired'
      ? new ApiError(401, 'AUTH_EXPIRED', 'Access token expired. Refresh and retry.')
      : new ApiError(401, 'AUTH_REQUIRED', 'Invalid access token.');
  }

  c.set('userId', result.claims.sub);
  await next();
});
