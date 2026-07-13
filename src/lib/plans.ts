// ============================================
// INFERRA PLAN DEFINITIONS
// Single source of truth for plan limits + features. The SAME limits are
// enforced server-side in Cloud Functions (functions/src/plans.ts mirrors this).
// Razorpay plan_ids come from env so they can differ per environment.
// ============================================

import type { PlanDefinition, PlanType } from '../types';

export const PLANS: Record<PlanType, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    requestsLimit: 100,
    usersLimit: 1,
    teamsLimit: 1,
    features: [
      '100 requests/month',
      'Basic routing',
      'Basic optimization',
      'Request history',
      'Single user',
      'Community support',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 19,
    currency: 'USD',
    requestsLimit: 1000,
    usersLimit: 1,
    teamsLimit: 1,
    razorpayPlanIdEnv: 'VITE_RAZORPAY_PLAN_STARTER',
    features: [
      '1,000 requests/month',
      'Advanced routing',
      'Advanced optimization',
      'Cost analytics',
      'Chat continuation',
      'Email support',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 79,
    currency: 'USD',
    requestsLimit: 5000,
    usersLimit: 10,
    teamsLimit: 5,
    razorpayPlanIdEnv: 'VITE_RAZORPAY_PLAN_GROWTH',
    highlighted: true,
    badge: 'Most popular',
    features: [
      '5,000 requests/month',
      'Team workspace',
      'Integrations',
      'Advanced analytics',
      'Priority routing',
      'Usage reports',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 999,
    currency: 'USD',
    requestsLimit: -1, // unlimited
    usersLimit: -1,
    teamsLimit: -1,
    razorpayPlanIdEnv: 'VITE_RAZORPAY_PLAN_ENTERPRISE',
    features: [
      'Unlimited requests',
      'Unlimited team members',
      'SSO',
      'Custom models',
      'Audit logs',
      'Priority support',
      'API access',
      'White-label routing',
    ],
  },
};

export const PLAN_ORDER: PlanType[] = ['free', 'starter', 'growth', 'enterprise'];

export function getPlan(id: PlanType): PlanDefinition {
  return PLANS[id] ?? PLANS.free;
}

export function planRank(id: PlanType): number {
  return PLAN_ORDER.indexOf(id);
}

/** The next tier up (clamped at enterprise) — used by every upsell surface. */
export function nextPlan(id: PlanType): PlanType {
  return PLAN_ORDER[Math.min(planRank(id) + 1, PLAN_ORDER.length - 1)];
}

/** Compare a user's plan to a target: 'current' | 'upgrade' | 'downgrade'. */
export function planRelation(current: PlanType, target: PlanType): 'current' | 'upgrade' | 'downgrade' {
  const c = planRank(current), t = planRank(target);
  return t === c ? 'current' : t > c ? 'upgrade' : 'downgrade';
}

/** Razorpay plan id for a paid plan, from env. Empty string if not configured. */
export function razorpayPlanId(id: PlanType): string {
  const envKey = PLANS[id].razorpayPlanIdEnv;
  if (!envKey) return '';
  return (import.meta.env[envKey as keyof ImportMetaEnv] as string) || '';
}

export function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/** Feature gates derived from plan rank — keep in sync with functions/src/plans.ts. */
export function planAllows(plan: PlanType, feature: FeatureKey): boolean {
  return planRank(plan) >= planRank(FEATURE_MIN_PLAN[feature]);
}

export type FeatureKey =
  // Starter+
  | 'chat'                // chat continuation
  | 'costAnalytics'
  | 'teams'
  | 'collaboration'
  | 'teamDashboard'
  | 'usageAnalytics'
  | 'unlimitedHistory'
  | 'orgSettings'
  // Growth+
  | 'integrations'
  | 'advancedAnalytics'
  | 'teamPermissions'
  | 'aiPolicies'
  | 'advancedCostReports'
  | 'teamUsage'
  | 'auditLogs'
  | 'prioritySupport'
  // Enterprise
  | 'apiAccess'
  | 'sso'
  | 'whiteLabel'
  | 'customModels'
  | 'dedicatedInfra';

// Minimum plan that unlocks each feature — the SINGLE source for feature gating,
// mirrored exactly by the commercial spec (Free/Starter/Growth/Enterprise).
export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanType> = {
  // Starter unlocks collaboration + teams + unlimited history + org settings.
  chat: 'starter',
  costAnalytics: 'starter',
  teams: 'starter',
  collaboration: 'starter',
  teamDashboard: 'starter',
  usageAnalytics: 'starter',
  unlimitedHistory: 'starter',
  orgSettings: 'starter',
  // Growth adds advanced analytics, policies, audit logs, priority support.
  integrations: 'growth',
  advancedAnalytics: 'growth',
  teamPermissions: 'growth',
  aiPolicies: 'growth',
  advancedCostReports: 'growth',
  teamUsage: 'growth',
  auditLogs: 'growth',
  prioritySupport: 'growth',
  // Enterprise unlocks API, SSO, white-label, custom models, dedicated infra.
  apiAccess: 'enterprise',
  sso: 'enterprise',
  whiteLabel: 'enterprise',
  customModels: 'enterprise',
  dedicatedInfra: 'enterprise',
};

/** Human label for the minimum plan that unlocks a feature, e.g. "Growth". */
export function featureMinPlanName(feature: FeatureKey): string {
  return PLANS[FEATURE_MIN_PLAN[feature]].name;
}
