// ============================================
// SUBSCRIPTION / USAGE SNAPSHOT
// Pure helpers that turn an Organization document into the numbers every
// usage surface needs (sidebar widget, dashboard card, upgrade gate): plan,
// used/limit/remaining, percent, and a human reset countdown. The monthly
// limit itself is enforced SERVER-SIDE in executeRequest — this is display.
// ============================================

import type { Organization, PlanType } from '../types';
import { getPlan, isUnlimited, nextPlan } from './plans';

export interface UsageSnapshot {
  plan: PlanType;
  planName: string;
  used: number;
  limit: number;          // -1 = unlimited
  unlimited: boolean;
  remaining: number;      // Number.POSITIVE_INFINITY when unlimited
  percent: number;        // 0..100 (0 when unlimited)
  resetDate: Date | null;
  resetLabel: string;     // "Resets today" | "Resets tomorrow" | "Resets in N days"
  renewalLabel: string;   // e.g. "Aug 1, 2026"
  nextPlan: PlanType;     // the tier to upsell to (== plan when already enterprise)
  atLimit: boolean;
}

/** Whole days from now until `date` (never negative). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86_400_000));
}

/** Human reset countdown per the product spec. */
export function resetLabel(date: Date | null, now: Date = new Date()): string {
  if (!date) return 'Resets monthly';
  const days = daysUntil(date, now);
  if (days <= 0) return 'Resets today';
  if (days === 1) return 'Resets tomorrow';
  return `Resets in ${days} days`;
}

/** Compute the full usage snapshot from an organization (null-safe). */
export function usageSnapshot(org: Organization | null, now: Date = new Date()): UsageSnapshot {
  const planId = org?.plan ?? 'free';
  const plan = getPlan(planId);
  const used = org?.usage?.requestsUsed ?? 0;
  const limit = org?.planLimits?.requestsPerMonth ?? plan.requestsLimit;
  const unlimited = isUnlimited(limit);
  const resetDate = org?.monthlyResetDate ?? null;
  const remaining = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));

  return {
    plan: planId,
    planName: plan.name,
    used,
    limit,
    unlimited,
    remaining,
    percent,
    resetDate,
    resetLabel: resetLabel(resetDate, now),
    renewalLabel: resetDate ? resetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    nextPlan: nextPlan(planId),
    atLimit: !unlimited && used >= limit,
  };
}

/** The next usage-warning threshold the user is approaching (or null). */
export const USAGE_THRESHOLDS = [50, 80, 90, 95, 100] as const;
