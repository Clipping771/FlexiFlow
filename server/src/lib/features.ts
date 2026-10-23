import type { Bindings } from '../env';

/**
 * Paid plans, upgrade links and Pro upsell. Off unless MONETIZATION_ENABLED is "true", so a missing var
 * never shows payment prompts. Plans, limits and quotas keep working either way: they protect costs.
 */
export function monetizationEnabled(env: Pick<Bindings, 'MONETIZATION_ENABLED'>): boolean {
  return env.MONETIZATION_ENABLED?.trim().toLowerCase() === 'true';
}
