// Server-side plan limits — the authoritative source for enforcement.
// MUST stay in sync with src/lib/plans.ts on the frontend.

export type PlanType = 'free' | 'starter' | 'growth' | 'enterprise';

export interface PlanLimit {
  requests: number; // -1 = unlimited
  users: number;
  teams: number;
  price: number;    // monthly, display currency
}

export const PLAN_LIMITS: Record<PlanType, PlanLimit> = {
  free: { requests: 100, users: 1, teams: 1, price: 0 },
  starter: { requests: 1000, users: 1, teams: 1, price: 19 },
  growth: { requests: 5000, users: 10, teams: 5, price: 79 },
  enterprise: { requests: -1, users: -1, teams: -1, price: 999 },
};

export const PAID_PLANS: PlanType[] = ['starter', 'growth', 'enterprise'];

// Razorpay plan_id per tier (created once in the Razorpay dashboard, set via env).
export function razorpayPlanId(plan: PlanType): string | undefined {
  const map: Record<PlanType, string | undefined> = {
    free: undefined,
    starter: process.env.RAZORPAY_PLAN_STARTER,
    growth: process.env.RAZORPAY_PLAN_GROWTH,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE,
  };
  return map[plan];
}

// Reverse lookup: which plan does a Razorpay plan_id correspond to?
export function planForRazorpayPlanId(rzpPlanId: string): PlanType | null {
  for (const plan of PAID_PLANS) {
    if (razorpayPlanId(plan) === rzpPlanId) return plan;
  }
  return null;
}

export function requestsLimitFor(plan: PlanType): number {
  return (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free).requests;
}
