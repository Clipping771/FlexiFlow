import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { PLAN_LIMITS } from '../lib/plans';
import { dhakaDay, nextDhakaMidnight } from '../lib/time';
import { deleteAccount } from '../lib/retention';
import { loadUser, publicUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';

export const me = new Hono<AppEnv>();

me.use('*', requireAuth);

me.get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();

  const user = await loadUser(c.env.DB, userId, now);
  // A valid token for a deleted account must not keep working.
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const usage = await c.env.DB
    .prepare('SELECT credits_used FROM usage_daily WHERE user_id = ?1 AND day = ?2')
    .bind(userId, dhakaDay(now))
    .first<{ credits_used: number }>();

  return c.json({
    user: publicUser(user),
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    usage: {
      used: usage?.credits_used ?? 0,
      limit: PLAN_LIMITS[user.plan].dailyCredits,
      resetAt: nextDhakaMidnight(now)
    }
  });
});

/** Deletes the account and everything tied to it, ending every session on every device. */
me.delete('/', async (c) => {
  await deleteAccount(c.env.DB, c.get('userId'));
  return c.body(null, 204);
});
