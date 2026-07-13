// ============================================
// SERVER-SIDE PERMISSIONS
// Mirrors src/lib/permissions.ts VERBATIM. Never trust a role sent by the
// client — always re-read the membership doc under the callable's uid before
// consulting these helpers.
// ============================================

export type MemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export type Permission =
  | 'org.read'
  | 'org.update'
  | 'org.delete'
  | 'org.transferOwnership'
  | 'billing.read'
  | 'billing.manage'
  | 'members.read'
  | 'members.invite'
  | 'members.remove'
  | 'members.updateRole'
  | 'settings.read'
  | 'settings.update'
  | 'auditLogs.read'
  | 'usage.read'
  | 'requests.execute'
  | 'teams.read'
  | 'teams.manage';

export const ROLE_HIERARCHY: MemberRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];

export function roleRank(role: MemberRole | null | undefined): number {
  if (!role) return -1;
  return ROLE_HIERARCHY.indexOf(role);
}

const PERMISSIONS_BY_ROLE: Record<MemberRole, Permission[]> = {
  viewer: ['org.read', 'members.read', 'settings.read', 'usage.read', 'teams.read'],
  member: ['org.read', 'members.read', 'settings.read', 'usage.read', 'requests.execute', 'teams.read'],
  // MANAGER is team-scoped by design: no org-wide member/settings/team powers.
  // Their management abilities come from being `manager` on specific teams
  // (enforced via team_members checks in the callables), never from this table.
  manager: [
    'org.read',
    'members.read',
    'settings.read',
    'usage.read',
    'requests.execute',
    'teams.read',
  ],
  admin: [
    'org.read', 'org.update',
    'billing.read', 'billing.manage',
    'members.read', 'members.invite', 'members.remove', 'members.updateRole',
    'settings.read', 'settings.update',
    'auditLogs.read', 'usage.read', 'requests.execute',
    'teams.read', 'teams.manage',
  ],
  owner: [
    'org.read', 'org.update', 'org.delete', 'org.transferOwnership',
    'billing.read', 'billing.manage',
    'members.read', 'members.invite', 'members.remove', 'members.updateRole',
    'settings.read', 'settings.update',
    'auditLogs.read', 'usage.read', 'requests.execute',
    'teams.read', 'teams.manage',
  ],
};

export function hasPermission(role: MemberRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS_BY_ROLE[role] ?? []).includes(permission);
}

/**
 * Guard for role-change actions (mirrors src/lib/permissions.ts): the actor may
 * only assign a role strictly LOWER than their own, and never touch `owner`
 * (ownership moves only via the transfer-ownership flow).
 */
export function canChangeRole(actor: MemberRole | null | undefined, targetRoleBefore: MemberRole, targetRoleAfter: MemberRole): boolean {
  if (!hasPermission(actor, 'members.updateRole')) return false;
  if (targetRoleBefore === 'owner' || targetRoleAfter === 'owner') return false;
  const actorRank = roleRank(actor);
  return roleRank(targetRoleBefore) < actorRank && roleRank(targetRoleAfter) < actorRank;
}
