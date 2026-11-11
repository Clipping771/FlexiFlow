// Spend tracking and the kill switch (CLOUD_BACKEND_DESIGN.md §5.4).
import type { Bindings } from '../env';
import type { Plan } from './plans';

/** KV key for the manual switch: "free" pauses the Free plan, "all" pauses every plan. */
export const KILL_SWITCH_KEY = 'control:kill_switch';

export type PauseState = { paused: false } | { paused: true; reason: 'manual' | 'budget' };

function price(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Estimated cost in micro-USD. A price of X USD per million tokens is X micro-USD per token.
 * Defaults are gemini-2.0-flash list prices; set GEMINI_*_USD_PER_MTOK when the model or prices change.
 */
export function estimateMicroUsd(env: Pick<Bindings, 'GEMINI_INPUT_USD_PER_MTOK' | 'GEMINI_OUTPUT_USD_PER_MTOK'>, tokensIn: number, tokensOut: number): number {
  const input = price(env.GEMINI_INPUT_USD_PER_MTOK, 0.1);
  const output = price(env.GEMINI_OUTPUT_USD_PER_MTOK, 0.4);
  return Math.ceil(tokensIn * input + tokensOut * output);
}

export function freeBudgetMicroUsd(env: Pick<Bindings, 'FREE_DAILY_BUDGET_USD'>): number {
  return Math.round(price(env.FREE_DAILY_BUDGET_USD, 5) * 1_000_000);
}

async function manualSwitch(kv: KVNamespace): Promise<string | null> {
  try {
    return (await kv.get(KILL_SWITCH_KEY))?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Whether new model calls are paused for this plan today. Cached answers are still served. */
export async function checkPause(env: Bindings, plan: Plan, day: string): Promise<PauseState> {
  const manual = await manualSwitch(env.CACHE);
  if (manual === 'all' || (manual === 'free' && plan === 'free')) return { paused: true, reason: 'manual' };
  if (plan !== 'free') return { paused: false };

  const row = await env.DB
    .prepare(`SELECT micro_usd FROM spend_daily WHERE day = ?1 AND plan = 'free'`)
    .bind(day)
    .first<{ micro_usd: number }>();
  return (row?.micro_usd ?? 0) >= freeBudgetMicroUsd(env) ? { paused: true, reason: 'budget' } : { paused: false };
}

/** Adds a request's estimated cost and alerts once when the Free budget is first crossed today. */
export async function addSpend(env: Bindings, day: string, plan: Plan, microUsd: number): Promise<void> {
  if (microUsd <= 0) return;
  const row = await env.DB
    .prepare(
      `INSERT INTO spend_daily (day, plan, micro_usd) VALUES (?1, ?2, ?3)
       ON CONFLICT(day, plan) DO UPDATE SET micro_usd = micro_usd + ?3
       RETURNING micro_usd`
    )
    .bind(day, plan, microUsd)
    .first<{ micro_usd: number }>();
  if (plan !== 'free' || !row) return;

  const budget = freeBudgetMicroUsd(env);
  const after = row.micro_usd;
  if (after - microUsd < budget && after >= budget) {
    await alert(env, `LexiFlow Cloud: Free-plan AI spend reached the $${(budget / 1e6).toFixed(2)} daily budget for ${day}. ` +
      'New Free requests are paused until midnight (Asia/Dhaka); cached answers and Pro are unaffected.');
  }
}

async function alert(env: Bindings, message: string): Promise<void> {
  console.error(`[lexiflow-api] ${message}`);
  if (!env.ALERT_WEBHOOK_URL) return;
  try {
    // `text` for Slack, `content` for Discord.
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message })
    });
  } catch {
    // The console line above is the fallback.
  }
}
