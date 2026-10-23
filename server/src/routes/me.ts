import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { PLAN_LIMITS, effectivePlan } from '../lib/plans';
import { dhakaDay, nextDhakaMidnight } from '../lib/time';
import { requireAuth } from '../middleware/auth';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  plan_expires_at: string | null;
}

export const me = new Hono<AppEnv>();

me.use('*', requireAuth);

me.get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const day = dhakaDay(now);

  const user = await c.env.DB
    .prepare('SELECT id, email, name, plan, plan_expires_at FROM users WHERE id = ?1')
    .bind(userId)
    .first<UserRow>();
  // A valid token for a deleted account must not keep working.
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const usage = await c.env.DB
    .prepare('SELECT credits_used FROM usage_daily WHERE user_id = ?1 AND day = ?2')
    .bind(userId, day)
    .first<{ credits_used: number }>();

  const plan = effectivePlan(user.plan, user.plan_expires_at, now);
  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    plan,
    planExpiresAt: plan === 'pro' ? user.plan_expires_at : null,
    usage: {
      used: usage?.credits_used ?? 0,
      limit: PLAN_LIMITS[plan].dailyCredits,
      resetAt: nextDhakaMidnight(now)
    }
  });
});
