// ============================================
// ROUTE GUARD TESTS
// resolveView is the single decision point for what a visitor may see. These
// tests pin the gate ladder: loading → plans overlay → dev mode → sign-in →
// email verification → profile → onboarding → admin/dashboard.
// ============================================

import { describe, it, expect } from 'vitest';
import { resolveView, isVerified, isOnboarded, type AuthGuardInput } from '../../src/lib/authGuards';
import type { User } from '../../src/types';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'u1@test.dev',
    name: 'Test User',
    emailVerified: true,
    onboarded: true,
    activeOrganizationId: 'org1',
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
    ...overrides,
  } as User;
}

function input(overrides: Partial<AuthGuardInput> = {}): AuthGuardInput {
  return {
    authReady: true,
    firebaseUser: { emailVerified: true },
    user: makeUser(),
    devMode: false,
    currentView: 'dashboard',
    plansOpen: false,
    ...overrides,
  };
}

describe('resolveView — gate ladder', () => {
  it('shows loading until auth resolves, regardless of anything else', () => {
    expect(resolveView(input({ authReady: false }), 'upgrade').view).toBe('loading');
    expect(resolveView(input({ authReady: false, plansOpen: true }), 'upgrade').view).toBe('loading');
  });

  it('plans overlay sits above every authenticated view', () => {
    const r = resolveView(input({ plansOpen: true }), 'upgrade');
    expect(r).toEqual({ view: 'plans', mode: 'upgrade' });
  });

  it('unauthenticated visitors: landing stays public, everything else → auth', () => {
    expect(resolveView(input({ firebaseUser: null, user: null, currentView: 'landing' }), 'upgrade').view).toBe('landing');
    expect(resolveView(input({ firebaseUser: null, user: null, currentView: 'dashboard' }), 'upgrade').view).toBe('auth');
  });

  it('signed-in but unverified → verify (never the dashboard)', () => {
    const r = resolveView(input({ firebaseUser: { emailVerified: false }, user: null }), 'upgrade');
    expect(r.view).toBe('verify');
  });

  it('verified but profile not loaded yet → profile-loading', () => {
    expect(resolveView(input({ user: null }), 'upgrade').view).toBe('profile-loading');
  });

  it('verified + profile but not onboarded → plan selection (onboarding)', () => {
    const r = resolveView(input({ user: makeUser({ onboarded: false }) }), 'upgrade');
    expect(r.view).toBe('onboarding');
  });

  it('fully gated user reaches the dashboard', () => {
    expect(resolveView(input(), 'upgrade').view).toBe('dashboard');
  });

  it('no separate admin view exists — every authenticated destination is the dashboard', () => {
    // Administration happens inside the dashboard (Settings / Teams / Billing /
    // Audit Logs). The resolver can never emit an 'admin' view.
    expect(resolveView(input({ user: makeUser({ isAdmin: true }) }), 'upgrade').view).toBe('dashboard');
    expect(resolveView(input({ user: makeUser({ isAdmin: false }) }), 'upgrade').view).toBe('dashboard');
  });
});

describe('resolveView — dev auth mode', () => {
  it('without a dev session: landing stays public, protected views → auth', () => {
    expect(resolveView(input({ devMode: true, user: null, firebaseUser: null, currentView: 'landing' }), 'upgrade').view).toBe('landing');
    expect(resolveView(input({ devMode: true, user: null, firebaseUser: null, currentView: 'dashboard' }), 'upgrade').view).toBe('auth');
  });

  it('with a demo user: skips verify/onboarding and lands on the dashboard', () => {
    const r = resolveView(input({ devMode: true, firebaseUser: null, user: makeUser({ onboarded: false }) }), 'upgrade');
    expect(r.view).toBe('dashboard'); // onboarding/verify gates don't apply in dev mode
  });

  it('demo user always lands on the dashboard (no admin console)', () => {
    const r = resolveView(input({ devMode: true, firebaseUser: null, user: makeUser({ isAdmin: true }) }), 'upgrade');
    expect(r.view).toBe('dashboard');
  });
});

describe('predicates', () => {
  it('isVerified honours dev mode and the firebase flag', () => {
    expect(isVerified({ devMode: true, firebaseUser: null })).toBe(true);
    expect(isVerified({ devMode: false, firebaseUser: { emailVerified: true } })).toBe(true);
    expect(isVerified({ devMode: false, firebaseUser: { emailVerified: false } })).toBe(false);
    expect(isVerified({ devMode: false, firebaseUser: null })).toBe(false);
  });

  it('isOnboarded honours dev mode and the profile flag', () => {
    expect(isOnboarded({ devMode: true, user: null })).toBe(true);
    expect(isOnboarded({ devMode: false, user: makeUser({ onboarded: true }) })).toBe(true);
    expect(isOnboarded({ devMode: false, user: makeUser({ onboarded: false }) })).toBe(false);
  });
});
