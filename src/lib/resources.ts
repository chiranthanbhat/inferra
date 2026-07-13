// ============================================
// RESOURCE PERMISSION REGISTRY
// Every page/surface declares a ResourceKey. Access is resolved from BOTH the
// organization role and the caller's team grants:
//
//   1. Org owners/admins always have every resource (they administer the org).
//   2. Universal resources (dashboard, teams, settings) are visible to every
//      member — pages still gate their mutating actions via the org engine.
//   3. A user in NO teams falls back to their org-role baseline (a solo or
//      un-teamed workspace keeps working exactly as before).
//   4. A user in one or more teams is SCOPED to the union of their teams'
//      grants (Linear/Slack-style): joining Marketing gives you Marketing's
//      surfaces — it doesn't leak Backend's.
//
// The same table drives the sidebar, page guards and the team-permission
// editor, so the UI can never disagree with the resolver.
// ============================================

import type { MemberRole, ResourceKey, TeamPermissions } from '../types';
import { roleAtLeast } from './permissions';

export interface ResourceDefinition {
  key: ResourceKey;
  label: string;
  description: string;
  /** Org-role baseline used when the user belongs to no teams. */
  minOrgRole: MemberRole;
  /** Universal resources are member-visible regardless of team grants. */
  universal?: boolean;
}

export const RESOURCES: ResourceDefinition[] = [
  { key: 'dashboard',     label: 'Dashboard',           description: 'Overview KPIs and traffic monitor',            minOrgRole: 'viewer', universal: true },
  { key: 'teams',         label: 'Teams',               description: 'Team directory and membership',                minOrgRole: 'viewer', universal: true },
  { key: 'settings',      label: 'Settings',            description: 'Workspace settings (read; edits are gated)',   minOrgRole: 'viewer', universal: true },
  { key: 'analytics',     label: 'Analytics',           description: 'Usage, cost and quality trends',               minOrgRole: 'viewer' },
  { key: 'commandCenter', label: 'Command Center',      description: 'Run requests through the routing pipeline',    minOrgRole: 'member' },
  { key: 'chat',          label: 'Chat',                description: 'Continue routed conversations',                minOrgRole: 'member' },
  { key: 'routing',       label: 'AI Routing',          description: 'Smart routing insights and model selection',   minOrgRole: 'member' },
  { key: 'optimization',  label: 'Optimization',        description: 'Prompt optimization insights',                 minOrgRole: 'member' },
  { key: 'promptLibrary', label: 'Prompt Library',      description: 'Shared prompt templates',                      minOrgRole: 'member' },
  { key: 'integrations',  label: 'Integrations',        description: 'Provider connections and webhooks',            minOrgRole: 'manager' },
  { key: 'providers',     label: 'Provider Management', description: 'Enable/disable AI providers',                  minOrgRole: 'admin' },
  { key: 'billing',       label: 'Billing',             description: 'Subscription, invoices and payment status',    minOrgRole: 'admin' },
  { key: 'auditLogs',     label: 'Audit Logs',          description: 'Immutable organization activity trail',        minOrgRole: 'admin' },
];

export const RESOURCE_BY_KEY: Record<ResourceKey, ResourceDefinition> = Object.fromEntries(
  RESOURCES.map((r) => [r.key, r]),
) as Record<ResourceKey, ResourceDefinition>;

/** Grants seeded onto every newly created team — the everyday work surfaces. */
export const DEFAULT_TEAM_GRANTS: Partial<Record<ResourceKey, boolean>> = {
  dashboard: true,
  analytics: true,
  commandCenter: true,
  chat: true,
  routing: true,
  optimization: true,
  promptLibrary: true,
};

/**
 * Core resolver — pure, shared by the sidebar, page guards and tests.
 * `teamGrantSets` must contain only the ACTIVE teams the user belongs to.
 */
export function canAccessResource(
  orgRole: MemberRole | null | undefined,
  teamGrantSets: Pick<TeamPermissions, 'grants'>[],
  resource: ResourceKey,
): boolean {
  if (!orgRole) return false;
  const def = RESOURCE_BY_KEY[resource];
  if (!def) return false;

  // 1. Org administrators bypass team scoping entirely.
  if (roleAtLeast(orgRole, 'admin')) return true;

  // 2. Universal surfaces are visible to every org member.
  if (def.universal) return true;

  // 3. No teams → org-role baseline (pre-teams behavior preserved).
  if (teamGrantSets.length === 0) return roleAtLeast(orgRole, def.minOrgRole);

  // 4. Teamed users: union of their teams' grants.
  return teamGrantSets.some((t) => t.grants?.[resource] === true);
}

/** True when the user holds an org-defined custom permission via any team. */
export function hasCustomPermission(
  orgRole: MemberRole | null | undefined,
  teamGrantSets: Pick<TeamPermissions, 'customGrants'>[],
  customPermissionId: string,
): boolean {
  if (!orgRole) return false;
  if (roleAtLeast(orgRole, 'admin')) return true;
  return teamGrantSets.some((t) => t.customGrants?.includes(customPermissionId));
}

/** Curated palette + icon set for team identity (design-system tokens). */
export const TEAM_COLORS = ['#4DEEEA', '#7DD3FC', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#94A3B8'];

export const TEAM_ICONS = [
  'code', 'server', 'database', 'brain', 'megaphone', 'trending-up',
  'dollar-sign', 'users', 'headphones', 'scale', 'pen-tool', 'settings',
  'shield', 'rocket', 'globe', 'briefcase',
] as const;

export type TeamIconKey = (typeof TEAM_ICONS)[number];
