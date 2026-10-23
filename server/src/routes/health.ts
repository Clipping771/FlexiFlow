import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const health = new Hono<AppEnv>();

health.get('/', async (c) => {
  let db: 'ok' | 'error' = 'ok';
  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    db = 'error';
  }
  const status = db === 'ok' ? 'ok' : 'degraded';
  return c.json({ status, db, time: new Date().toISOString() }, db === 'ok' ? 200 : 503);
});
