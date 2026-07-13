// ============================================
// PLAN DEFINITION TESTS
// Pins the commercial spec (Free 100 / Starter 1,000 / Growth 5,000 /
// Enterprise unlimited at $0/$19/$79/$999) and enforces parity between the
// client plan sheet and the server-side enforcement limits.
// ============================================

import { describe, it, expect } from 'vitest';
import { PLANS, PLAN_ORDER, planRank, planAllows, isUnlimited, getPlan } from '../../src/lib/plans';
import { PLAN_LIMITS, requestsLimitFor, PAID_PLANS } from '../../functions/src/plans';
import type { PlanType } from '../../src/types';

const SPEC: Record<PlanType, { price: number; requests: number }> = {
  free: { price: 0, requests: 100 },
  starter: { price: 19, requests: 1000 },
  growth: { price: 79, requests: 5000 },
  enterprise: { price: 999, requests: -1 },
};

describe('plan sheet matches the commercial spec', () => {
  for (const [id, spec] of Object.entries(SPEC) as [PlanType, { price: number; requests: number }][]) {
    it(`${id}: $${spec.price}/mo, ${spec.requests < 0 ? 'unlimited' : spec.requests} requests`, () => {
      expect(PLANS[id].price).toBe(spec.price);
      expect(PLANS[id].requestsLimit).toBe(spec.requests);
    });
  }

  it('orders plans free → starter → growth → enterprise', () => {
    expect(PLAN_ORDER).toEqual(['free', 'starter', 'growth', 'enterprise']);
    expect(planRank('free')).toBeLessThan(planRank('starter'));
    expect(planRank('growth')).toBeLessThan(planRank('enterprise'));
  });

  it('getPlan falls back to free for unknown ids', () => {
    expect(getPlan('nonsense' as PlanType).id).toBe('free');
  });

  it('isUnlimited only for negative limits', () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(100)).toBe(false);
  });
});

describe('client ↔ server plan parity (enforcement can never be looser than the sheet)', () => {
  for (const id of Object.keys(SPEC) as PlanType[]) {
    it(`${id}: server request limit matches the client plan sheet`, () => {
      expect(PLAN_LIMITS[id].requests).toBe(PLANS[id].requestsLimit);
      expect(requestsLimitFor(id)).toBe(PLANS[id].requestsLimit);
      expect(PLAN_LIMITS[id].price).toBe(PLANS[id].price);
    });
  }

  it('paid plans are exactly starter/growth/enterprise', () => {
    expect(PAID_PLANS).toEqual(['starter', 'growth', 'enterprise']);
  });
});

describe('feature gates', () => {
  it('chat continuation unlocks at starter', () => {
    expect(planAllows('free', 'chat')).toBe(false);
    expect(planAllows('starter', 'chat')).toBe(true);
    expect(planAllows('enterprise', 'chat')).toBe(true);
  });

  it('teams + collaboration + unlimited history unlock at starter', () => {
    for (const f of ['teams', 'collaboration', 'unlimitedHistory', 'orgSettings'] as const) {
      expect(planAllows('free', f), `free should NOT have ${f}`).toBe(false);
      expect(planAllows('starter', f), `starter should have ${f}`).toBe(true);
    }
  });

  it('advanced analytics / audit logs / AI policies unlock at growth', () => {
    for (const f of ['integrations', 'advancedAnalytics', 'auditLogs', 'aiPolicies', 'prioritySupport'] as const) {
      expect(planAllows('starter', f), `starter should NOT have ${f}`).toBe(false);
      expect(planAllows('growth', f), `growth should have ${f}`).toBe(true);
    }
  });

  it('API access / SSO / white-label are enterprise-only', () => {
    for (const f of ['apiAccess', 'sso', 'whiteLabel', 'customModels'] as const) {
      expect(planAllows('growth', f), `growth should NOT have ${f}`).toBe(false);
      expect(planAllows('enterprise', f), `enterprise should have ${f}`).toBe(true);
    }
  });
});
