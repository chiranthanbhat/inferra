// ============================================
// RESOURCE PERMISSION RESOLUTION TESTS
// Pins the workspace access model: org-admin bypass, universal surfaces,
// org-role baseline for un-teamed users, and team-grant scoping for teamed
// users — including the spec's Backend / Marketing / Finance scenarios.
// ============================================

import { describe, it, expect } from 'vitest';
import { canAccessResource, hasCustomPermission, RESOURCES, DEFAULT_TEAM_GRANTS } from '../../src/lib/resources';
import type { ResourceKey } from '../../src/types';

const grants = (g: Partial<Record<ResourceKey, boolean>>) => ({ grants: g });

describe('org-admin bypass', () => {
  it('owners and admins can access every resource regardless of teams', () => {
    for (const r of RESOURCES) {
      expect(canAccessResource('owner', [], r.key)).toBe(true);
      expect(canAccessResource('admin', [grants({})], r.key)).toBe(true);
    }
  });
});

describe('universal surfaces', () => {
  it('dashboard, teams and settings are visible to every member — even fully scoped ones', () => {
    for (const key of ['dashboard', 'teams', 'settings'] as ResourceKey[]) {
      expect(canAccessResource('viewer', [], key)).toBe(true);
      expect(canAccessResource('member', [grants({})], key)).toBe(true); // empty team grants
    }
  });
});

describe('un-teamed users fall back to the org-role baseline', () => {
  it('member baseline: command center yes, billing/audit no', () => {
    expect(canAccessResource('member', [], 'commandCenter')).toBe(true);
    expect(canAccessResource('member', [], 'chat')).toBe(true);
    expect(canAccessResource('member', [], 'routing')).toBe(true);
    expect(canAccessResource('member', [], 'billing')).toBe(false);
    expect(canAccessResource('member', [], 'auditLogs')).toBe(false);
    expect(canAccessResource('member', [], 'providers')).toBe(false);
  });

  it('viewer baseline: analytics yes, execution surfaces no', () => {
    expect(canAccessResource('viewer', [], 'analytics')).toBe(true);
    expect(canAccessResource('viewer', [], 'commandCenter')).toBe(false);
  });

  it('manager baseline adds integrations but not billing', () => {
    expect(canAccessResource('manager', [], 'integrations')).toBe(true);
    expect(canAccessResource('manager', [], 'billing')).toBe(false);
  });

  it('null role has no access to anything', () => {
    expect(canAccessResource(null, [], 'dashboard')).toBe(false);
  });
});

describe('teamed users are scoped to the union of their teams’ grants', () => {
  const backend = grants({ routing: true, analytics: true, commandCenter: true, chat: true, optimization: true });
  const marketing = grants({ analytics: true });
  const finance = grants({ billing: true, analytics: true });

  it('Backend team: routing/usage/command center yes — billing no', () => {
    expect(canAccessResource('member', [backend], 'routing')).toBe(true);
    expect(canAccessResource('member', [backend], 'commandCenter')).toBe(true);
    expect(canAccessResource('member', [backend], 'analytics')).toBe(true);
    expect(canAccessResource('member', [backend], 'billing')).toBe(false);
  });

  it('Marketing team: analytics yes — AI routing and providers no (baseline does NOT leak through)', () => {
    expect(canAccessResource('member', [marketing], 'analytics')).toBe(true);
    // An un-teamed member would get routing from the baseline; a Marketing-scoped
    // member must NOT — this is the restriction the workspace model exists for.
    expect(canAccessResource('member', [marketing], 'routing')).toBe(false);
    expect(canAccessResource('member', [marketing], 'commandCenter')).toBe(false);
    expect(canAccessResource('member', [marketing], 'providers')).toBe(false);
  });

  it('Finance team: billing granted BEYOND the member baseline', () => {
    // billing normally needs org admin — a Finance team grant extends it.
    expect(canAccessResource('member', [finance], 'billing')).toBe(true);
    expect(canAccessResource('member', [finance], 'routing')).toBe(false);
  });

  it('multiple teams union their grants', () => {
    expect(canAccessResource('member', [marketing, finance], 'billing')).toBe(true);
    expect(canAccessResource('member', [marketing, finance], 'analytics')).toBe(true);
    expect(canAccessResource('member', [marketing, finance], 'routing')).toBe(false);
  });
});

describe('custom permissions', () => {
  it('granted via any team; admins bypass; others denied', () => {
    const team = { customGrants: ['perm-prompt-library'] };
    expect(hasCustomPermission('member', [team], 'perm-prompt-library')).toBe(true);
    expect(hasCustomPermission('member', [team], 'perm-other')).toBe(false);
    expect(hasCustomPermission('member', [], 'perm-prompt-library')).toBe(false);
    expect(hasCustomPermission('admin', [], 'perm-prompt-library')).toBe(true);
    expect(hasCustomPermission(null, [team], 'perm-prompt-library')).toBe(false);
  });
});

describe('defaults', () => {
  it('new teams are seeded with the everyday work surfaces', () => {
    for (const key of ['dashboard', 'analytics', 'commandCenter', 'chat', 'routing', 'optimization'] as ResourceKey[]) {
      expect(DEFAULT_TEAM_GRANTS[key], `${key} should be a default grant`).toBe(true);
    }
    expect(DEFAULT_TEAM_GRANTS.billing).toBeUndefined();
    expect(DEFAULT_TEAM_GRANTS.auditLogs).toBeUndefined();
  });

  it('every registry entry has a unique key', () => {
    const keys = RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
