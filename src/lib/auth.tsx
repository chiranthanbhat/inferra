// ============================================
// AUTH CONTEXT
// The single source of truth for "who is signed in". Subscribes to Firebase
// auth, provisions/loads the Firestore profile, and mirrors it into the store.
// App-level route guards read `firebaseUser` + store.user to gate every view.
// ============================================

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { auth as firebaseAuth, onAuthChange, firebaseConfigured, type FirebaseUser } from './firebase';
import { ensureUserProfile, refreshUserProfile } from './db';
import { logAuthError } from './authErrors';
import {
  DEV_AUTH, DEV_EMAIL, DEV_PASSWORD,
  buildDemoUser, buildDemoOrg, persistDevSession, hasDevSession, ensureDemoFirestore,
} from './devAuth';
import { useStore } from '../store/useStore';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  authReady: boolean;          // initial auth check completed
  configured: boolean;         // Firebase env present
  devMode: boolean;            // VITE_DEV_AUTH=true — dev login instead of OAuth
  reloadUser: () => Promise<boolean>;   // re-check email verification
  refreshProfile: () => Promise<void>;  // re-pull Firestore profile (after plan change)
  signInDemo: () => Promise<void>;                                   // dev only
  signInDev: (email: string, password: string) => Promise<{ error: string | null }>; // dev only
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  authReady: false,
  configured: false,
  devMode: false,
  reloadUser: async () => false,
  refreshProfile: async () => {},
  signInDemo: async () => {},
  signInDev: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const setUser = useStore((s) => s.setUser);
  const setOrganization = useStore((s) => s.setOrganization);
  const setAuthError = useStore((s) => s.setAuthError);
  const mounted = useRef(true);

  // Monotonic counter — every onAuthChange fire bumps it; any in-flight
  // profile load that finishes with a stale token is discarded. This prevents
  // a rapid sign-out → sign-in from writing the OLD user's profile into the
  // store on top of the new session.
  const sessionSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;

    // DEV AUTH MODE: bypass Firebase's OAuth listener entirely. Restore a
    // persisted demo session (so you don't re-login on every reload) and finish
    // loading. Production auth below is left completely intact.
    if (DEV_AUTH) {
      if (hasDevSession()) {
        setUser(buildDemoUser());
        setOrganization(buildDemoOrg());
      }
      setAuthReady(true);
      return () => { mounted.current = false; };
    }

    // No Firebase config (local dev): finish "loading" so the UI can show a
    // clear configuration notice instead of hanging on a spinner.
    if (!firebaseConfigured) {
      setAuthReady(true);
      return () => { mounted.current = false; };
    }

    const unsub = onAuthChange(async (fb) => {
      if (!mounted.current) return;
      const seq = ++sessionSeq.current;

      // Synchronously mirror the auth state — atomic sign-out clears store + fb user together.
      setFirebaseUser(fb);
      if (!fb) {
        setUser(null);
        setOrganization(null);
        setAuthError(null);
        setAuthReady(true);
        return;
      }

      // Unverified users don't load the profile — the verify screen handles them.
      if (!fb.emailVerified) {
        setUser(null);
        setOrganization(null);
        setAuthReady(true);
        return;
      }

      try {
        const { user, organization } = await ensureUserProfile(fb);
        // Discard if a newer session has fired since we started.
        if (!mounted.current || seq !== sessionSeq.current) return;
        setUser(user);
        setOrganization(organization);
        setAuthError(null);
      } catch (e: unknown) {
        if (!mounted.current || seq !== sessionSeq.current) return;
        logAuthError({ action: 'provisionProfile', email: fb.email ?? undefined }, e);
        setAuthError((e as { message?: string } | null)?.message || 'Failed to load your account.');
      } finally {
        if (mounted.current && seq === sessionSeq.current) setAuthReady(true);
      }
    });

    return () => {
      mounted.current = false;
      unsub();
    };
  }, [setUser, setOrganization, setAuthError]);

  /**
   * Re-check email verification. Uses `firebaseAuth.currentUser` after reload
   * so we get the FRESH object with updated `emailVerified` (calling
   * setFirebaseUser({...oldUser}) does not — it just re-renders with the same
   * stale flag). Returns the verified state.
   */
  const reloadUser = async (): Promise<boolean> => {
    if (!firebaseAuth.currentUser) return false;
    try {
      await firebaseAuth.currentUser.reload();
    } catch (error: unknown) {
      logAuthError({ action: 'reload', email: firebaseAuth.currentUser.email ?? undefined }, error);
      return firebaseAuth.currentUser.emailVerified;
    }
    const fresh = firebaseAuth.currentUser;
    if (!mounted.current) return fresh.emailVerified;

    setFirebaseUser(fresh);

    // Just verified — pull the Firestore profile so App can move past /verify.
    if (fresh.emailVerified && !useStore.getState().user) {
      const seq = ++sessionSeq.current;
      try {
        const { user, organization } = await ensureUserProfile(fresh);
        if (mounted.current && seq === sessionSeq.current) {
          setUser(user);
          setOrganization(organization);
        }
      } catch (e: unknown) {
        logAuthError({ action: 'provisionProfile', email: fresh.email ?? undefined, extra: { via: 'reloadUser' } }, e);
      }
    } else if (fresh.emailVerified) {
      // Already had a profile — just sync the verified flag.
      const profile = await refreshUserProfile(fresh.uid);
      if (mounted.current && profile) setUser({ ...profile, emailVerified: true });
    }

    return fresh.emailVerified;
  };

  const refreshProfile = async (): Promise<void> => {
    const current = firebaseAuth.currentUser;
    if (!current) return;
    const profile = await refreshUserProfile(current.uid);
    if (mounted.current && profile) setUser(profile);
  };

  // ---- Dev-mode sign-in (no-ops in production) ----
  const signInDemo = async (): Promise<void> => {
    if (!DEV_AUTH) return;
    setUser(buildDemoUser());
    setOrganization(buildDemoOrg());
    persistDevSession();
    void ensureDemoFirestore();
  };

  const signInDev = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!DEV_AUTH) return { error: 'Dev auth is disabled in this build.' };
    if (email.trim().toLowerCase() !== DEV_EMAIL || password !== DEV_PASSWORD) {
      return { error: `Use ${DEV_EMAIL} / ${DEV_PASSWORD} in development mode.` };
    }
    await signInDemo();
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authReady,
        configured: firebaseConfigured,
        devMode: DEV_AUTH,
        reloadUser,
        refreshProfile,
        signInDemo,
        signInDev,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
