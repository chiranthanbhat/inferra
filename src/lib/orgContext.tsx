// ============================================
// ORGANIZATION CONTEXT
// The single source of truth for "which organization am I working in right
// now". Wraps the currently active org, the caller's role in it, the list of
// every org they belong to, and the switcher.
//
// Every page consumes `useOrganization()`. The store is still used for
// dashboard-local UI state; anything organization-scoped goes through this
// context so a switch immediately propagates.
// ============================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MemberRole, Organization, OrgMembership, Permission } from '../types';
import {
  getOrganization,
  getMembership,
  listMemberships,
  switchActiveOrganization,
} from './db';
import { useStore } from '../store/useStore';
import { useAuth } from './auth';
import { hasPermission as hasPermissionForRole } from './permissions';
import { logAuthError } from './authErrors';
import { DEV_AUTH } from './devAuth';

interface OrgContextValue {
  currentOrganization: Organization | null;
  organizationId: string | null;
  organizationRole: MemberRole | null;
  memberships: OrgMembership[];
  loading: boolean;
  error: string | null;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganization: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const OrgContext = createContext<OrgContextValue>({
  currentOrganization: null,
  organizationId: null,
  organizationRole: null,
  memberships: [],
  loading: false,
  error: null,
  switchOrganization: async () => {},
  refreshOrganization: async () => {},
  refreshMemberships: async () => {},
  hasPermission: () => false,
});

/**
 * Client-only cache of the last-selected org id so refreshes / relaunches
 * resume the same context immediately (before the async membership load).
 */
const LAST_ORG_KEY = 'inferra_last_org_v1';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const storeUser = useStore((s) => s.user);
  const storeOrganization = useStore((s) => s.organization);
  const setStoreOrganization = useStore((s) => s.setOrganization);

  const [role, setRole] = useState<MemberRole | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic counter — drops stale loads if the user switches again mid-fetch.
  const loadSeq = useRef(0);

  const uid = firebaseUser?.uid ?? storeUser?.id ?? null;

  // Persist the current org id so the next load can hint the context.
  useEffect(() => {
    if (storeOrganization?.id) {
      try {
        localStorage.setItem(LAST_ORG_KEY, storeOrganization.id);
      } catch {
        /* private mode / storage full — non-fatal */
      }
    }
  }, [storeOrganization?.id]);

  // Hydrate role + memberships once the auth layer produces a user + org.
  useEffect(() => {
    if (!uid || !storeOrganization) {
      setRole(null);
      setMemberships([]);
      return;
    }

    // Dev-mode: skip Firestore reads (the SDK is pointed at demo placeholders).
    // Synthesise a single-membership view so the switcher renders correctly.
    if (DEV_AUTH) {
      setRole('owner');
      setMemberships([{
        organizationId: storeOrganization.id,
        organizationName: storeOrganization.name,
        userId: uid,
        email: storeUser?.email ?? '',
        name: storeUser?.name ?? '',
        role: 'owner',
        joinedAt: new Date(),
        lastAccessedAt: new Date(),
      }]);
      return;
    }

    const seq = ++loadSeq.current;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const [membership, list] = await Promise.all([
          getMembership(uid, storeOrganization.id),
          listMemberships(uid),
        ]);
        if (cancelled || seq !== loadSeq.current) return;
        setRole(membership?.role ?? null);
        setMemberships(list);
        setError(null);
      } catch (e: unknown) {
        if (cancelled || seq !== loadSeq.current) return;
        logAuthError({ action: 'provisionProfile', extra: { step: 'orgContextLoad' } }, e);
        setError((e as { message?: string } | null)?.message ?? 'Failed to load organization.');
      } finally {
        if (!cancelled && seq === loadSeq.current) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uid, storeOrganization?.id, storeOrganization?.name, storeUser?.email, storeUser?.name]);

  const refreshOrganization = useCallback(async () => {
    if (!storeOrganization?.id) return;
    const fresh = await getOrganization(storeOrganization.id);
    if (fresh) setStoreOrganization(fresh);
  }, [storeOrganization?.id, setStoreOrganization]);

  const refreshMemberships = useCallback(async () => {
    if (!uid) return;
    setMemberships(await listMemberships(uid));
  }, [uid]);

  const switchOrganization = useCallback(async (orgId: string) => {
    if (!uid) throw new Error('You must be signed in to switch organizations.');
    if (storeOrganization?.id === orgId) return;

    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      await switchActiveOrganization(uid, orgId);
      const [nextOrg, nextMembership, nextList] = await Promise.all([
        getOrganization(orgId),
        getMembership(uid, orgId),
        listMemberships(uid),
      ]);
      if (seq !== loadSeq.current) return;
      if (!nextOrg) throw new Error('Organization not found.');
      setStoreOrganization(nextOrg);
      setRole(nextMembership?.role ?? null);
      setMemberships(nextList);
    } catch (e: unknown) {
      if (seq !== loadSeq.current) return;
      logAuthError({ action: 'provisionProfile', extra: { step: 'switchOrganization' } }, e);
      setError((e as { message?: string } | null)?.message ?? 'Could not switch organization.');
      throw e;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [uid, storeOrganization?.id, setStoreOrganization]);

  const hasPermission = useCallback((permission: Permission) => hasPermissionForRole(role, permission), [role]);

  const value = useMemo<OrgContextValue>(() => ({
    currentOrganization: storeOrganization,
    organizationId: storeOrganization?.id ?? null,
    organizationRole: role,
    memberships,
    loading,
    error,
    switchOrganization,
    refreshOrganization,
    refreshMemberships,
    hasPermission,
  }), [storeOrganization, role, memberships, loading, error, switchOrganization, refreshOrganization, refreshMemberships, hasPermission]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrganization(): OrgContextValue {
  return useContext(OrgContext);
}
