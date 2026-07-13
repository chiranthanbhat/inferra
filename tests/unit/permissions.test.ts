// ============================================
// PERMISSION ENGINE TESTS
// Covers the role hierarchy, the capability table, role-change guards, and —
// most importantly — PARITY between the client engine (src/lib/permissions.ts)
// and the server mirror (functions/src/permissions.ts). Those two files must
// never drift; this suite fails the build if they do.
// ============================================

import { describe, it, expect } from 'vitest';
import * as client from '../../src/lib/permissions';
import * as server from '../../functions/src/permissions';
import type { MemberRole, Permission } from '../../src/types';

const ROLES: MemberRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];
const ALL_PERMISSIONS: Permission[] = [
  'org.read', 'org.update', 'org.delete', 'org.transferOwnership',
  'billing.read', 'billing.manage',
  'members.read', 'members.invite', 'members.remove', 'members.updateRole',
  'settings.read', 'settings.update',
  'auditLogs.read', 'usage.read', 'requests.execute',
];

describe('role hierarchy', () => {
  it('orders viewer < member < manager < admin < owner', () => {
    expect(client.ROLE_HIERARCHY).toEqual(['viewer', 'member', 'manager', 'admin', 'owner']);
    for (let i = 1; i < ROLES.length; i++) {
      expect(client.roleRank(ROLES[i])).toBeGreaterThan(client.roleRank(ROLES[i - 1]));
    }
  });

  it('returns -1 for unknown/null roles', () => {
    expect(client.roleRank(null)).toBe(-1);
    expect(client.roleRank(undefined)).toBe(-1);
    expect(client.roleRank('ghost' as MemberRole)).toBe(-1);
  });

  it('roleAtLeast is inclusive', () => {
    expect(client.roleAtLeast('admin', 'admin')).toBe(true);
    expect(client.roleAtLeast('admin', 'owner')).toBe(false);
    expect(client.roleAtLeast('owner', 'viewer')).toBe(true);
    expect(client.roleAtLeast(null, 'viewer')).toBe(false);
  });
});

describe('capability table', () => {
  it('owner has every permission', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(client.hasPermission('owner', p), `owner should have ${p}`).toBe(true);
    }
  });

  it('viewer is read-only (no execute, no mutations)', () => {
    expect(client.hasPermission('viewer', 'org.read')).toBe(true);
    expect(client.hasPermission('viewer', 'requests.execute')).toBe(false);
    expect(client.hasPermission('viewer', 'members.invite')).toBe(false);
    expect(client.hasPermission('viewer', 'settings.update')).toBe(false);
    expect(client.hasPermission('viewer', 'billing.manage')).toBe(false);
  });

  it('member can execute requests but not manage anything', () => {
    expect(client.hasPermission('member', 'requests.execute')).toBe(true);
    expect(client.hasPermission('member', 'members.invite')).toBe(false);
    expect(client.hasPermission('member', 'org.update')).toBe(false);
  });

  it('manager is TEAM-scoped: no org-wide member/settings/team management', () => {
    // Spec: managers only manage the teams they are assigned to. Their powers
    // come from team_members.teamRole === 'manager', never from the org table.
    expect(client.hasPermission('manager', 'members.invite')).toBe(false);
    expect(client.hasPermission('manager', 'members.remove')).toBe(false);
    expect(client.hasPermission('manager', 'members.updateRole')).toBe(false);
    expect(client.hasPermission('manager', 'settings.update')).toBe(false);
    expect(client.hasPermission('manager', 'org.update')).toBe(false);
    expect(client.hasPermission('manager', 'teams.manage')).toBe(false);
    expect(client.hasPermission('manager', 'billing.manage')).toBe(false);
    expect(client.hasPermission('manager', 'auditLogs.read')).toBe(false);
    // …but they still work: execute requests + read surfaces.
    expect(client.hasPermission('manager', 'requests.execute')).toBe(true);
    expect(client.hasPermission('manager', 'usage.read')).toBe(true);
  });

  it('teams.manage is admin+ only; teams.read is universal', () => {
    expect(client.hasPermission('admin', 'teams.manage')).toBe(true);
    expect(client.hasPermission('owner', 'teams.manage')).toBe(true);
    expect(client.hasPermission('manager', 'teams.manage')).toBe(false);
    for (const r of ['viewer', 'member', 'manager', 'admin', 'owner'] as const) {
      expect(client.hasPermission(r, 'teams.read')).toBe(true);
    }
  });

  it('admin adds billing + audit but not org.delete / ownership transfer', () => {
    expect(client.hasPermission('admin', 'billing.manage')).toBe(true);
    expect(client.hasPermission('admin', 'auditLogs.read')).toBe(true);
    expect(client.hasPermission('admin', 'org.delete')).toBe(false);
    expect(client.hasPermission('admin', 'org.transferOwnership')).toBe(false);
  });

  it('permissions grow monotonically up the hierarchy (higher roles never lose a capability)', () => {
    // Sanity for the "at-least-this-role" pattern used across the app: any
    // permission granted to a role is also granted to every higher role.
    for (let i = 0; i < ROLES.length - 1; i++) {
      const lower = client.permissionsFor(ROLES[i]);
      const higher = client.permissionsFor(ROLES[i + 1]);
      for (const p of lower) {
        expect(higher, `${ROLES[i + 1]} should inherit ${p} from ${ROLES[i]}`).toContain(p);
      }
    }
  });

  it('null/unknown role has no permissions', () => {
    expect(client.hasPermission(null, 'org.read')).toBe(false);
    expect(client.hasPermission('ghost' as MemberRole, 'org.read')).toBe(false);
  });
});

describe('canChangeRole guard', () => {
  it('never allows assigning or unassigning owner', () => {
    expect(client.canChangeRole('owner', 'admin', 'owner')).toBe(false);
    expect(client.canChangeRole('owner', 'owner', 'admin')).toBe(false);
  });

  it('actor may only touch roles strictly below their own', () => {
    expect(client.canChangeRole('admin', 'member', 'manager')).toBe(true);
    expect(client.canChangeRole('admin', 'admin', 'member')).toBe(false);   // peer
    expect(client.canChangeRole('admin', 'member', 'admin')).toBe(false);   // promote to own rank
  });

  it('org managers cannot change ORG roles at all (team-scoped role)', () => {
    expect(client.canChangeRole('manager', 'member', 'viewer')).toBe(false);
    expect(client.canChangeRole('manager', 'viewer', 'member')).toBe(false);
  });

  it('roles without members.updateRole can never change roles', () => {
    expect(client.canChangeRole('member', 'viewer', 'viewer')).toBe(false);
    expect(client.canChangeRole('viewer', 'viewer', 'viewer')).toBe(false);
    expect(client.canChangeRole(null, 'member', 'viewer')).toBe(false);
  });
});

describe('client ↔ server engine parity (must never drift)', () => {
  it('hasPermission agrees for every role × permission', () => {
    for (const role of ROLES) {
      for (const p of ALL_PERMISSIONS) {
        expect(server.hasPermission(role, p as server.Permission),
          `parity broken: ${role} / ${p}`)
          .toBe(client.hasPermission(role, p));
      }
    }
  });

  it('roleRank agrees for every role', () => {
    for (const role of ROLES) {
      expect(server.roleRank(role)).toBe(client.roleRank(role));
    }
    expect(server.ROLE_HIERARCHY).toEqual(client.ROLE_HIERARCHY);
  });

  it('canChangeRole agrees for every actor × before × after combination', () => {
    for (const actor of ROLES) {
      for (const before of ROLES) {
        for (const after of ROLES) {
          expect(server.canChangeRole(actor, before, after),
            `parity broken: actor=${actor} ${before}→${after}`)
            .toBe(client.canChangeRole(actor, before, after));
        }
      }
    }
  });
});
