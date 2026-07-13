// ============================================
// DEVELOPMENT AUTH MODE (feature-flagged)
// Enabled ONLY when VITE_DEV_AUTH=true AND we're not in a PROD build AND no
// real Firebase project is configured. Any one of those conditions failing
// disables dev-mode entirely — this prevents a shipped build with the flag
// accidentally left on from signing users in as the demo owner.
// Production Firebase auth is untouched and returns automatically when the
// flag is false/absent.
// ============================================

import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';
import type { User, Organization } from '../types';

const FLAG = import.meta.env.VITE_DEV_AUTH === 'true';
const IS_PROD = import.meta.env.PROD === true;

/**
 * True only when it is safe to bypass real auth. The three conditions must all
 * hold: flag on, not a production build, and no real Firebase project wired up.
 */
export const DEV_AUTH: boolean = FLAG && !IS_PROD && !firebaseConfigured;

// Loud warning when the flag was intended but got disabled by our safety net —
// makes an accidental production ship instantly visible in the console.
if (FLAG && !DEV_AUTH) {
  // eslint-disable-next-line no-console
  console.warn(
    '[inferra] VITE_DEV_AUTH=true was ignored: ' +
      (IS_PROD ? 'production build detected. ' : '') +
      (firebaseConfigured ? 'real Firebase project detected. ' : '') +
      'Real Firebase auth will be used.',
  );
}

// Loud warning when dev mode IS active, so nobody demos an unsecured build.
if (DEV_AUTH) {
  // eslint-disable-next-line no-console
  console.warn('[inferra] DEV AUTH MODE is ACTIVE — OAuth is skipped. Set VITE_DEV_AUTH=false for real sign-in.');
}

export const DEV_EMAIL = 'demo@inferra.ai';
export const DEV_PASSWORD = 'demo123';

/**
 * Bumped when the on-disk dev-session shape changes so an old session can't
 * resurrect after the flag is flipped or the demo identity is rebuilt.
 */
const DEV_SESSION_VERSION = '2';
const DEV_SESSION_KEY = 'inferra_dev_session';

function nextMonthlyReset(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

// The demo identity — Enterprise, unlimited, fully onboarded + verified so the
// app behaves exactly as a real signed-in user (skips verify + plan selection).
export function buildDemoUser(): User {
  const now = new Date();
  return {
    id: 'demo-user',
    email: DEV_EMAIL,
    name: 'Demo User',
    photoURL: undefined,
    emailVerified: true,
    onboarded: true,
    activeOrganizationId: 'demo-workspace',
    isAdmin: true, // so the Admin Console is reachable while testing
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
}

export function buildDemoOrg(): Organization {
  const now = new Date();
  return {
    id: 'demo-workspace',
    name: 'Demo Workspace',
    ownerId: 'demo-user',
    plan: 'enterprise',
    planLimits: { requestsPerMonth: -1, usersLimit: -1, teamsLimit: -1 },
    usage: { requestsUsed: 0, totalSpend: 0, totalSavings: 0, tokensProcessed: 0 },
    subscriptionStatus: 'active',
    monthlyResetDate: nextMonthlyReset(now),
    settings: {
      defaultModel: 'gpt-4o-mini',
      defaultPriority: 'balanced',
      enableOptimization: true,
      enableRouting: true,
      enableGovernance: true,
      piiPolicy: 'sanitize',
      secretPolicy: 'block',
    },
    notifications: {
      budgetAlerts: true,
      securityAlerts: true,
      weeklyReports: false,
      usageAlertThresholds: [50, 80, 90, 95, 100],
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function persistDevSession(): void {
  try {
    localStorage.setItem(DEV_SESSION_KEY, DEV_SESSION_VERSION);
  } catch {
    /* non-fatal — private mode / storage full */
  }
}

export function clearDevSession(): void {
  try {
    localStorage.removeItem(DEV_SESSION_KEY);
    // Clean up legacy key from the pre-versioned implementation.
    localStorage.removeItem('inferra_dev_session_v1');
  } catch {
    /* non-fatal */
  }
}

/**
 * A dev session is only considered valid when DEV_AUTH is still on AND the
 * on-disk version matches. Flipping the flag off or bumping the version
 * automatically invalidates old sessions on the next boot.
 */
export function hasDevSession(): boolean {
  if (!DEV_AUTH) return false;
  try {
    return localStorage.getItem(DEV_SESSION_KEY) === DEV_SESSION_VERSION;
  } catch {
    return false;
  }
}

/**
 * Best-effort: create the demo Firestore docs if a real project is configured
 * (e.g. against the emulator with open rules). Silently ignored otherwise —
 * the in-memory demo session is the source of truth in dev mode.
 * NOTE: only runs when DEV_AUTH is active, so it can never fire in production.
 */
export async function ensureDemoFirestore(): Promise<void> {
  if (!DEV_AUTH || !firebaseConfigured) return;
  try {
    await setDoc(
      doc(db, 'organizations', 'demo-workspace'),
      {
        name: 'Demo Workspace', ownerId: 'demo-user', plan: 'enterprise',
        planLimits: { requestsPerMonth: -1, usersLimit: -1, teamsLimit: -1 },
        usage: { requestsUsed: 0, totalSpend: 0, totalSavings: 0, tokensProcessed: 0 },
        settings: { defaultModel: 'gpt-4o-mini', enableOptimization: true, enableRouting: true, enableGovernance: true, piiPolicy: 'sanitize', secretPolicy: 'block' },
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await setDoc(
      doc(db, 'users', 'demo-user'),
      {
        email: DEV_EMAIL, email_lower: DEV_EMAIL.toLowerCase(), name: 'Demo User', emailVerified: true, onboarded: true,
        organizationId: 'demo-workspace', role: 'owner', teamIds: [], isAdmin: true,
        currentPlan: 'enterprise', requestsUsed: 0, requestsLimit: -1, subscriptionStatus: 'active',
        monthlyResetDate: Timestamp.fromDate(nextMonthlyReset()),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    /* rules deny without a real auth token — expected; ignore in dev */
  }
}
