// ============================================
// TEAM ACCESS CONTEXT
// Loads the caller's team memberships + those teams' permission grants for the
// active organization and exposes `canAccess(resource)` — the single client
// gate used by the sidebar and every page guard. Resolution lives in the pure
// helper (src/lib/resources.ts) so it is unit-testable and can't drift.
// ============================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ResourceKey, TeamMember, TeamPermissions } from '../types';
import { canAccessResource, hasCustomPermission } from './resources';
import { listMyTeamMemberships, listTeamPermissionsFor } from './db';
import { useOrganization } from './orgContext';
import { useStore } from '../store/useStore';
import { DEV_AUTH } from './devAuth';

interface TeamAccessValue {
  /** Team-membership rows for the signed-in user in the active org. */
  myMemberships: TeamMember[];
  /** Permission grants of the ACTIVE teams the user belongs to. */
  myGrants: TeamPermissions[];
  loading: boolean;
  canAccess: (resource: ResourceKey) => boolean;
  hasCustom: (customPermissionId: string) => boolean;
  refreshAccess: () => Promise<void>;
}

const TeamAccessContext = createContext<TeamAccessValue>({
  myMemberships: [],
  myGrants: [],
  loading: false,
  canAccess: () => false,
  hasCustom: () => false,
  refreshAccess: async () => {},
});

export function TeamAccessProvider({ children }: { children: ReactNode }) {
  const { organizationId, organizationRole } = useOrganization();
  const user = useStore((s) => s.user);
  const [myMemberships, setMyMemberships] = useState<TeamMember[]>([]);
  const [myGrants, setMyGrants] = useState<TeamPermissions[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!organizationId || !user?.id || DEV_AUTH) {
      setMyMemberships([]);
      setMyGrants([]);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    try {
      const memberships = await listMyTeamMemberships(organizationId, user.id);
      const grants = memberships.length > 0
        ? await listTeamPermissionsFor(memberships.map((m) => m.teamId))
        : [];
      if (mySeq !== seq.current) return;
      setMyMemberships(memberships);
      setMyGrants(grants);
    } catch {
      if (mySeq !== seq.current) return;
      // Offline/unconfigured: fall back to org-role baseline (empty grant sets).
      setMyMemberships([]);
      setMyGrants([]);
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const canAccess = useCallback(
    (resource: ResourceKey) => canAccessResource(organizationRole, myGrants, resource),
    [organizationRole, myGrants],
  );

  const hasCustom = useCallback(
    (id: string) => hasCustomPermission(organizationRole, myGrants, id),
    [organizationRole, myGrants],
  );

  const value = useMemo<TeamAccessValue>(() => ({
    myMemberships, myGrants, loading, canAccess, hasCustom, refreshAccess: load,
  }), [myMemberships, myGrants, loading, canAccess, hasCustom, load]);

  return <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>;
}

export function useTeamAccess(): TeamAccessValue {
  return useContext(TeamAccessContext);
}
