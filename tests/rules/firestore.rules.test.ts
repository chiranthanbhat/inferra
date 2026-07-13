// ============================================
// FIRESTORE SECURITY RULES TESTS
// Runs against the local emulator:
//   npm run test:rules      (wraps `firebase emulators:exec --only firestore`)
// Requires firebase-tools + Java. NOT part of the default `npm test` run.
//
// Covers the invariants the platform depends on:
//   • tenant isolation (no cross-org reads)
//   • server-only billing fields (client can never touch plan/usage)
//   • notification read-flag is the only client mutation allowed
//   • invitations are readable by managers + the invitee, writable by no client
//   • the mail queue is completely sealed
// ============================================

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;

const OWNER = 'owner-uid';
const MEMBER = 'member-uid';
const OUTSIDER = 'outsider-uid';
const ORG = 'org-a';

function authed(uid: string, email = `${uid}@test.dev`, verified = true) {
  return env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'inferra-rules-test',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  // Seed a tenant with an owner + a member, bypassing rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`organizations/${ORG}`).set({
      name: 'Org A', ownerId: OWNER, plan: 'growth',
      planLimits: { requestsPerMonth: 5000, usersLimit: 10, teamsLimit: 5 },
      usage: { requestsUsed: 10, totalSpend: 1, totalSavings: 2, tokensProcessed: 100 },
      subscriptionStatus: 'active',
    });
    await db.doc(`organizations/${ORG}/members/${OWNER}`).set({ userId: OWNER, role: 'owner', email: `${OWNER}@test.dev` });
    await db.doc(`organizations/${ORG}/members/${MEMBER}`).set({ userId: MEMBER, role: 'member', email: `${MEMBER}@test.dev` });
    await db.doc(`users/${OWNER}`).set({ email: `${OWNER}@test.dev`, isAdmin: false, activeOrganizationId: ORG });
    await db.doc(`users/${MEMBER}`).set({ email: `${MEMBER}@test.dev`, isAdmin: false, activeOrganizationId: ORG });
  });
});

describe('tenant isolation', () => {
  it('members read their org; outsiders are denied', async () => {
    await assertSucceeds(authed(MEMBER).doc(`organizations/${ORG}`).get());
    await assertFails(authed(OUTSIDER).doc(`organizations/${ORG}`).get());
  });

  it('users can only read their own profile', async () => {
    await assertSucceeds(authed(MEMBER).doc(`users/${MEMBER}`).get());
    await assertFails(authed(MEMBER).doc(`users/${OWNER}`).get());
  });
});

describe('server-only billing fields', () => {
  it('no client — not even the owner — can change plan or usage', async () => {
    await assertFails(authed(OWNER).doc(`organizations/${ORG}`).update({ plan: 'enterprise' }));
    await assertFails(authed(OWNER).doc(`organizations/${ORG}`).update({ 'usage.requestsUsed': 0 }));
    await assertFails(authed(OWNER).doc(`organizations/${ORG}`).update({ subscriptionStatus: 'active' }));
    await assertFails(authed(MEMBER).doc(`users/${MEMBER}`).update({ isAdmin: true }));
  });

  it('owner CAN rename / edit settings (whitelisted keys)', async () => {
    await assertSucceeds(authed(OWNER).doc(`organizations/${ORG}`).update({ name: 'Renamed' }));
  });

  it('usage records are read-only for members, sealed to outsiders', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('usage/u1').set({ organizationId: ORG, userId: MEMBER, cost: 0.1 });
    });
    await assertSucceeds(authed(MEMBER).doc('usage/u1').get());
    await assertFails(authed(OUTSIDER).doc('usage/u1').get());
    await assertFails(authed(OWNER).doc('usage/u1').update({ cost: 0 }));
  });
});

describe('notifications', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('notifications/n1').set({
        userId: MEMBER, organizationId: ORG, type: 'usage.warning', title: 't', body: 'b', read: false,
      });
    });
  });

  it('owner of the notification can read + flip the read flag + delete', async () => {
    await assertSucceeds(authed(MEMBER).doc('notifications/n1').get());
    await assertSucceeds(authed(MEMBER).doc('notifications/n1').update({ read: true }));
    await assertSucceeds(authed(MEMBER).doc('notifications/n1').delete());
  });

  it('cannot edit anything but the read flag; others cannot read; clients cannot create', async () => {
    await assertFails(authed(MEMBER).doc('notifications/n1').update({ title: 'forged' }));
    await assertFails(authed(OWNER).doc('notifications/n1').get());
    await assertFails(authed(MEMBER).collection('notifications').add({ userId: MEMBER, title: 'x', read: false }));
  });
});

describe('invitations', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invitations/i1').set({
        organizationId: ORG, email_lower: 'invitee@test.dev', role: 'member', status: 'pending', invitedBy: OWNER,
      });
    });
  });

  it('org managers+ can read; the invitee (by verified email) can read', async () => {
    await assertSucceeds(authed(OWNER).doc('invitations/i1').get());
    await assertSucceeds(authed('invitee-uid', 'invitee@test.dev').doc('invitations/i1').get());
  });

  it('plain members / strangers / unverified invitees are denied; all client writes denied', async () => {
    await assertFails(authed(MEMBER).doc('invitations/i1').get());          // member is not manager+
    await assertFails(authed(OUTSIDER, 'other@test.dev').doc('invitations/i1').get());
    await assertFails(authed('invitee-uid', 'invitee@test.dev', false).doc('invitations/i1').get()); // unverified
    await assertFails(authed(OWNER).doc('invitations/i1').update({ status: 'accepted' }));
  });
});

describe('invoices + mail queue', () => {
  it('invoices: org admin reads, member/outsider denied, writes sealed', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invoices/p1').set({ organizationId: ORG, amount: 79, status: 'paid' });
    });
    await assertSucceeds(authed(OWNER).doc('invoices/p1').get());
    await assertFails(authed(MEMBER).doc('invoices/p1').get());
    await assertFails(authed(OWNER).doc('invoices/p1').update({ amount: 0 }));
  });

  it('mail queue is completely sealed to clients', async () => {
    await assertFails(authed(OWNER).collection('mail').add({ to: 'x@y.z', message: { subject: 's', html: 'h' } }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('mail/m1').set({ to: 'x@y.z' });
    });
    await assertFails(authed(OWNER).doc('mail/m1').get());
  });
});

describe('chats', () => {
  it('chat owner only — verified, and member of the org on create', async () => {
    const mine = authed(MEMBER);
    await assertSucceeds(mine.doc('chats/c1').set({ userId: MEMBER, organizationId: ORG, title: 't' }));
    await assertSucceeds(mine.doc('chats/c1').get());
    await assertFails(authed(OWNER).doc('chats/c1').get());                 // not the chat owner
    await assertFails(authed(OUTSIDER).doc('chats/c2').set({ userId: OUTSIDER, organizationId: ORG })); // not an org member
  });
});
