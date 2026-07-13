// ============================================
// ROUTE GUARDS
// Pure decision functions used by App.tsx to resolve which top-level view a
// visitor should see. Keeping this logic out of the component eliminates the
// flicker where a signed-in-but-unverified user briefly saw the dashboard
// while React re-rendered on a store update.
// ============================================

import type { User } from '../types';

/** Everything the guard needs to make a decision. All fields are read-only. */
export interface AuthGuardInput {
  authReady: boolean;
  firebaseUser: { emailVerified: boolean } | null;
  user: User | null;
  devMode: boolean;
  currentView: 'landing' | 'auth' | 'dashboard';
  plansOpen: boolean;
}

/**
 * Discriminated result. Each variant maps 1:1 to a view App.tsx already knows
 * how to render — no new rendering paths added here.
 */
export type AuthGuardResult =
  | { view: 'loading'; label?: string }
  | { view: 'plans'; mode: 'onboarding' | 'upgrade' }
  | { view: 'landing' }
  | { view: 'auth' }
  | { view: 'verify' }
  | { view: 'profile-loading' }
  | { view: 'onboarding' }
  | { view: 'dashboard' };

/**
 * Deterministic route resolver. Order matters: auth-ready → sign-in →
 * verification → profile → onboarding → destination.
 */
export function resolveView(
  input: AuthGuardInput,
  plansMode: 'onboarding' | 'upgrade',
): AuthGuardResult {
  if (!input.authReady) return { view: 'loading' };

  // The plan-selection overlay sits above everything except loading.
  if (input.plansOpen) return { view: 'plans', mode: plansMode };

  // The landing page ("/") is PUBLIC for everyone — including signed-in users.
  // Clicking the Inferra logo navigates home without touching the session;
  // the landing UI itself adapts (Dashboard button instead of Login/Sign up).
  if (input.currentView === 'landing') return { view: 'landing' };

  // Dev-auth path: the demo user is pre-verified + onboarded; skip those gates.
  if (input.devMode) {
    if (!input.user) return { view: 'auth' };
    return { view: 'dashboard' };
  }

  // Not signed in — protected views redirect to auth.
  if (!input.firebaseUser) return { view: 'auth' };

  // Signed in — enforce the full gate ladder. Administration happens inside
  // the dashboard (Settings / Teams / Billing / Audit Logs) — there is no
  // separate admin console.
  if (!input.firebaseUser.emailVerified) return { view: 'verify' };
  if (!input.user) return { view: 'profile-loading' };
  if (!input.user.onboarded) return { view: 'onboarding' };
  return { view: 'dashboard' };
}

/** Convenience predicates for feature-flag gates elsewhere in the app. */
export function isVerified(input: Pick<AuthGuardInput, 'firebaseUser' | 'devMode'>): boolean {
  return input.devMode || input.firebaseUser?.emailVerified === true;
}

export function isOnboarded(input: Pick<AuthGuardInput, 'user' | 'devMode'>): boolean {
  return input.devMode || input.user?.onboarded === true;
}

/** Server-authoritative admin check — never trust a client-only flag for real permissions. */
export function isAdmin(user: User | null): boolean {
  return user?.isAdmin === true;
}
