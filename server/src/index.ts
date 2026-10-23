import { Hono } from 'hono';
import type { AppEnv } from './env';
import { ApiError } from './lib/errors';
import { corsForExtension } from './middleware/cors';
import { auth } from './routes/auth';
import { health } from './routes/health';
import { me } from './routes/me';

const app = new Hono<AppEnv>();

app.use('*', corsForExtension);

const v1 = new Hono<AppEnv>();
v1.route('/health', health);
v1.route('/auth', auth);
v1.route('/me', me);
app.route('/v1', v1);

app.notFound((c) => c.json(new ApiError(404, 'NOT_FOUND', 'Route not found.').toBody(), 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json(err.toBody(), err.status);
  // Log the error type only; messages can contain user text or tokens.
  console.error(`[lexiflow-api] unhandled ${err.name} on ${c.req.method} ${c.req.routePath}`);
  return c.json(new ApiError(500, 'INTERNAL', 'Something went wrong.').toBody(), 500);
});

export default app;
