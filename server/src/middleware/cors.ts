import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';

// CORS is a first barrier against other web pages, not authentication: auth and quotas protect the API.
export const corsForExtension = createMiddleware<AppEnv>((c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    exposeHeaders: ['Retry-After'],
    maxAge: 86400
  })(c, next);
});
