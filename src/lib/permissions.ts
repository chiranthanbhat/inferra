// ============================================
// PERMISSIONS ENGINE
// The reusable capability layer for the Organization subsystem. Every future
// feature (Team Management, Billing, Analytics) MUST consume these helpers —
// never inline role checks. The role → permission table is the single source
// of truth on the client; functions/src/permissions.ts mirrors it verbatim
// for server-side enforcement.
// ============================================

import type { MemberRole, Permission } from '../types';

/**
 * Role hierarchy (higher rank = more capable). Do NOT reorder — used for
 * "at-least-this-role" checks and for validating role changes (an admin can
 * promote a member up to admin but not up to owner).
 */
export const ROLE_HIERARCHY: MemberRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];

/** Numeric rank, higher is stronger. Returns -1 for an unknown role. */
export function roleRank(role: MemberRole | null | undefined): number {
  if (!role) return -1;
  return ROLE_HIERARCHY.indexOf(role);
}

/** True if `role` is at least `minimum` (inclusive). */
export function roleAtLeast(role: MemberRole | null | undefined, minimum: MemberRole): boolean {
  return roleRank(role) >= roleRank(minimum);
}

/**
 * Role → set of granted permissions. Owner is implicitly granted everything by
 * expanding on top of admin.
 */
const PERMISSIONS_BY_ROLE: Record<MemberRole, Permission[]> = {
  viewer: [
    'org.read',
    'members.read',
    'settings.read',
    'usage.read',
    'teams.read',
  ],
  member: [
    'org.read',
    'members.read',
    'settings.read',
    'usage.read',
    'requests.execute',
    'teams.read',
  ],
  // MANAGER is team-scoped by design (Linear/Slack semantics): no org-wide
  // member/settings/team powers. Their management abilities come from being
  // `manager` on specific teams — enforced server-side via team_members
  // checks — never from this org-role table.
  manager: [
    'org.read',
    'members.read',
    'settings.read',
    'usage.read',
    'requests.execute',
    'teams.read',
  ],
  admin: [
    'org.read',
    'org.update',
    'billing.read',
    'billing.manage',
    'members.read',
    'members.invite',
    'members.remove',
    'members.updateRole',
    'settings.read',
    'settings.update',
    'auditLogs.read',
    'usage.read',
    'requests.execute',
    'teams.read',
    'teams.manage',
  ],
  owner: [
    'org.read',
    'org.update',
    'org.delete',
    'org.transferOwnership',
    'billing.read',
    'billing.manage',
    'members.read',
    'members.invite',
    'members.remove',
    'members.updateRole',
    'settings.read',
    'settings.update',
    'auditLogs.read',
    'usage.read',
    'requests.execute',
    'teams.read',
    'teams.manage',
  ],
};

/** Core capability check. */
export function hasPermission(role: MemberRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const list = PERMISSIONS_BY_ROLE[role];
  if (!list) return false;
  return list.includes(permission);
}

// ---- Convenience predicates (spec-mandated names) ----
export const canManageBilling      = (role: MemberRole | null | undefined) => hasPermission(role, 'billing.manage');
export const canManageMembers      = (role: MemberRole | null | undefined) => hasPermission(role, 'members.remove') || hasPermission(role, 'members.updateRole');
export const canInvite             = (role: MemberRole | null | undefined) => hasPermission(role, 'members.invite');
export const canDeleteOrganization = (role: MemberRole | null | undefined) => hasPermission(role, 'org.delete');
export const canTransferOwnership  = (role: MemberRole | null | undefined) => hasPermission(role, 'org.transferOwnership');
export const canEditSettings       = (role: MemberRole | null | undefined) => hasPermission(role, 'settings.update');
export const canViewAuditLogs      = (role: MemberRole | null | undefined) => hasPermission(role, 'auditLogs.read');
export const canExecuteRequests    = (role: MemberRole | null | undefined) => hasPermission(role, 'requests.execute');

/**
 * Guard for role-change actions: an actor may only assign a role strictly LOWER
 * than their own, and never assign or unassign `owner` (that's handled by the
 * separate transfer-ownership flow).
 */
export function canChangeRole(actor: MemberRole | null | undefined, targetRoleBefore: MemberRole, targetRoleAfter: MemberRole): boolean {
  if (!hasPermission(actor, 'members.updateRole')) return false;
  if (targetRoleBefore === 'owner' || targetRoleAfter === 'owner') return false;
  const actorRank = roleRank(actor);
  return roleRank(targetRoleBefore) < actorRank && roleRank(targetRoleAfter) < actorRank;
}

/**
 * List every permission a role has. Handy for UI toggles that need to render
 * a compact permission summary next to a member.
 */
export function permissionsFor(role: MemberRole): Permission[] {
  return [...(PERMISSIONS_BY_ROLE[role] ?? [])];
}
