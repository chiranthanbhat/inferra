import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { db, Timestamp, FieldValue, assertAuth, assertVerified, assertOrgPermission, writeAudit } from './util';
import { razorpayPlanId, planForRazorpayPlanId, requestsLimitFor, PLAN_LIMITS, type PlanType } from './plans';

const RAZORPAY_SECRETS = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];

// Shared options for billing callables: App Check enforcement is a deploy-time
// flag so it can be enabled after the client ships with a site key.
const BILLING_OPTS = {
  secrets: RAZORPAY_SECRETS,
  enforceAppCheck: process.env.ENFORCE_APPCHECK === 'true',
};

function client(): Razorpay {
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!, key_secret: process.env.RAZORPAY_KEY_SECRET! });
}

async function resolveOrg(uid: string, providedOrgId?: string): Promise<{ orgId: string; org: FirebaseFirestore.DocumentData }> {
  let orgId = providedOrgId;
  if (!orgId) {
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'Account not found.');
    orgId = (userSnap.data()!.activeOrganizationId as string) || (userSnap.data()!.organizationId as string);
  }
  if (!orgId) throw new HttpsError('failed-precondition', 'No active organization.');
  const orgSnap = await db.doc(`organizations/${orgId}`).get();
  if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
  return { orgId, org: orgSnap.data()! };
}

/**
 * Create a Razorpay subscription for the caller's active org. Requires
 * `billing.manage` on the org (admin+). Returns the subscription id + public
 * key for the Razorpay Checkout SDK.
 */
export const createSubscription = onCall<{ plan: PlanType; organizationId?: string }>(
  BILLING_OPTS,
  async (request) => {
    const uid = assertVerified(request);
    const plan = request.data?.plan;
    if (!plan || plan === 'free') throw new HttpsError('invalid-argument', 'Choose a paid plan.');

    const planId = razorpayPlanId(plan);
    if (!planId) throw new HttpsError('failed-precondition', `Razorpay plan id for "${plan}" is not configured.`);

    const { orgId, org } = await resolveOrg(uid, request.data?.organizationId);
    const actor = await assertOrgPermission(uid, orgId, 'billing.manage');

    const orgRef = db.doc(`organizations/${orgId}`);
    const rzp = client();

    // Reuse or create a Razorpay customer for this org (billing entity).
    // We fall back to the requesting user's email/name — Razorpay just needs
    // a contactable customer record.
    let customerId: string | undefined = org.razorpayCustomerId;
    if (!customerId) {
      try {
        const userSnap = await db.doc(`users/${uid}`).get();
        const u = userSnap.data() ?? {};
        const customer: any = await rzp.customers.create({
          name: (u.name as string) || (u.email as string) || org.name,
          email: (u.email as string) || 'billing@inferra.ai',
          fail_existing: 0,
        });
        customerId = customer.id;
        await orgRef.update({ razorpayCustomerId: customerId });
      } catch (e: any) {
        throw new HttpsError('internal', `Could not create customer: ${e?.error?.description || e?.message || e}`);
      }
    }

    // TRIAL SUPPORT: when TRIAL_DAYS is configured (and the org has never had
    // a subscription before), delay the first charge via Razorpay `start_at`.
    // The card is authenticated at checkout; billing begins after the trial.
    const trialDays = Number(process.env.TRIAL_DAYS || 0);
    const firstSubscription = !org.razorpaySubscriptionId && !org.hadSubscription;
    const trialing = trialDays > 0 && firstSubscription;

    const subscription: any = await rzp.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      ...(trialing ? { start_at: Math.floor(Date.now() / 1000) + trialDays * 86_400 } : {}),
      notes: { uid, orgId, plan },
    });

    await orgRef.update({
      razorpaySubscriptionId: subscription.id,
      subscriptionStatus: trialing ? 'trialing' : 'pending',
      pendingPlan: plan,
      hadSubscription: true,
      ...(trialing ? { trialEndsAt: Timestamp.fromMillis((Math.floor(Date.now() / 1000) + trialDays * 86_400) * 1000) } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(orgId, uid, 'subscription.created',
      { plan, subscriptionId: subscription.id },
      { actorEmail: actor.email, actorName: actor.name });

    return { subscriptionId: subscription.id, razorpayKeyId: process.env.RAZORPAY_KEY_ID!, shortUrl: subscription.short_url };
  },
);

/**
 * Verify the Checkout signature and immediately unlock the plan on the ORG.
 * The webhook (razorpayWebhook) remains the durable source of truth and will
 * reconcile any drift.
 */
export const confirmSubscription = onCall<{ razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string; organizationId?: string }>(
  BILLING_OPTS,
  async (request) => {
    const uid = assertVerified(request);
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = request.data || ({} as any);
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      throw new HttpsError('invalid-argument', 'Missing payment confirmation fields.');
    }

    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      throw new HttpsError('permission-denied', 'Payment signature verification failed.');
    }

    const { orgId } = await resolveOrg(uid, request.data?.organizationId);
    const actor = await assertOrgPermission(uid, orgId, 'billing.manage');

    const rzp = client();
    const sub: any = await rzp.subscriptions.fetch(razorpay_subscription_id);
    const plan = planForRazorpayPlanId(sub.plan_id) ?? 'starter';
    const limits = PLAN_LIMITS[plan];

    // A future start_at means the card was authenticated but billing hasn't
    // begun — the plan unlocks immediately while the org shows as trialing.
    const inTrial = typeof sub.start_at === 'number' && sub.start_at * 1000 > Date.now();

    await db.doc(`organizations/${orgId}`).set({
      plan,
      planLimits: { requestsPerMonth: requestsLimitFor(plan), usersLimit: limits.users, teamsLimit: limits.teams },
      subscriptionStatus: inTrial ? 'trialing' : 'active',
      razorpaySubscriptionId: razorpay_subscription_id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await writeAudit(orgId, uid, 'subscription.confirmed',
      { plan, subscriptionId: razorpay_subscription_id },
      { actorEmail: actor.email, actorName: actor.name });

    return { ok: true, plan };
  },
);

/**
 * Cancel the org's active subscription (at cycle end by default). Requires
 * `billing.manage` on the org. Assert-authed rather than assert-verified so a
 * user who has lost verification for any reason can still cancel.
 */
export const cancelSubscription = onCall<{ atCycleEnd?: boolean; organizationId?: string }>(
  BILLING_OPTS,
  async (request) => {
    const uid = assertAuth(request);
    const { orgId, org } = await resolveOrg(uid, request.data?.organizationId);
    const actor = await assertOrgPermission(uid, orgId, 'billing.manage');
    const subId: string | undefined = org.razorpaySubscriptionId;
    if (!subId) throw new HttpsError('failed-precondition', 'No active subscription.');

    const atCycleEnd = request.data?.atCycleEnd !== false;
    const rzp = client();
    await (rzp.subscriptions as any).cancel(subId, atCycleEnd);

    await db.doc(`organizations/${orgId}`).update({
      subscriptionStatus: atCycleEnd ? 'active' : 'cancelled',
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(orgId, uid, 'subscription.cancelled',
      { subscriptionId: subId, atCycleEnd },
      { actorEmail: actor.email, actorName: actor.name });

    return { ok: true };
  },
);
