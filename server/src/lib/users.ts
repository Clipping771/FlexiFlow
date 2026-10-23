import { type Plan, effectivePlan } from './plans';

export interface AccountUser {
  id: string;
  email: string;
  name: string | null;
  /** Effective plan: a lapsed Pro is reported as Free. */
  plan: Plan;
  planExpiresAt: string | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  plan_expires_at: string | null;
}

export async function loadUser(db: D1Database, id: string, now: Date = new Date()): Promise<AccountUser | null> {
  const row = await db
    .prepare('SELECT id, email, name, plan, plan_expires_at FROM users WHERE id = ?1')
    .bind(id)
    .first<UserRow>();
  if (!row) return null;
  const plan = effectivePlan(row.plan, row.plan_expires_at, now);
  return { id: row.id, email: row.email, name: row.name, plan, planExpiresAt: plan === 'pro' ? row.plan_expires_at : null };
}

export function publicUser(user: AccountUser) {
  return { id: user.id, email: user.email, name: user.name };
}
