export type Plan = 'free' | 'pro';

export interface PlanLimits {
  dailyCredits: number;
  requestsPerMinute: number;
  maxSentenceChars: number;
}

// Starting values from CLOUD_BACKEND_DESIGN.md §5.2. Revisit once usage_events shows real cost per credit.
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { dailyCredits: 30, requestsPerMinute: 10, maxSentenceChars: 600 },
  pro: { dailyCredits: 600, requestsPerMinute: 30, maxSentenceChars: 2000 }
};

/** A lapsed Pro subscription counts as Free. */
export function effectivePlan(plan: string, planExpiresAt: string | null, now: Date = new Date()): Plan {
  if (plan !== 'pro') return 'free';
  if (planExpiresAt && Date.parse(planExpiresAt) <= now.getTime()) return 'free';
  return 'pro';
}
