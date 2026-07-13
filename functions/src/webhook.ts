import { onRequest } from 'firebase-functions/v2/https';
import { createHmac, timingSafeEqual } from 'crypto';
import { db, FieldValue, writeAudit } from './util';
import { planForRazorpayPlanId, requestsLimitFor, PLAN_LIMITS, type PlanType } from './plans';
import type { SubscriptionStatusLike } from './types';
import { notifyRoles } from './notifications';
import { sendEmail, emailSubscriptionUpdate, emailPaymentFailed } from './email';

/**
 * Razorpay webhook. Verifies the X-Razorpay-Signature against the raw body,
 * then reconciles subscription state onto the ORGANIZATION document (the
 * durable source of truth for billing).
 */
export const razorpayWebhook = onRequest(
  { secrets: ['RAZORPAY_WEBHOOK_SECRET'], cors: false },
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const raw = (req as any).rawBody as Buffer | undefined;

    if (!secret || !signature || !raw) {
      res.status(400).send('Missing signature or body.');
      return;
    }

    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const ok = expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) {
      res.status(401).send('Invalid signature.');
      return;
    }

    // ---- Replay / idempotency protection ----
    // A captured-but-valid webhook could be re-sent. Razorpay tags each delivery
    // with a stable event id; process each exactly once by claiming a marker doc
    // in a transaction (create-if-absent). Duplicates ack 200 without re-running
    // any side-effect (plan changes, invoices, emails). Handlers are idempotent
    // too, so this is defence-in-depth, but it also stops duplicate emails.
    const eventId = (req.headers['x-razorpay-event-id'] as string | undefined)?.slice(0, 200);
    if (eventId) {
      const marker = db.doc(`webhookEvents/${eventId}`);
      const fresh = await db.runTransaction(async (tx) => {
        const snap = await tx.get(marker);
        if (snap.exists) return false;
        tx.set(marker, { provider: 'razorpay', receivedAt: FieldValue.serverTimestamp() });
        return true;
      }).catch(() => true); // on marker failure, fall through (handlers are idempotent)
      if (!fresh) {
        res.status(200).send('duplicate');
        return;
      }
    }

    const event = req.body?.event as string;
    try {
      switch (event) {
        case 'subscription.authenticated': {
          // Card verified; if start_at is in the future this is a trial start.
          const sub = req.body.payload.subscription.entity;
          const inTrial = typeof sub.start_at === 'number' && sub.start_at * 1000 > Date.now();
          if (inTrial) await applyPlan(sub.id, planForRazorpayPlanId(sub.plan_id), 'trialing');
          break;
        }
        case 'subscription.activated':
        case 'subscription.resumed': {
          const sub = req.body.payload.subscription.entity;
          await applyPlan(sub.id, planForRazorpayPlanId(sub.plan_id), 'active');
          break;
        }
        case 'subscription.charged': {
          // Renewal / first charge: reconcile plan AND record the invoice.
          const sub = req.body.payload.subscription.entity;
          await applyPlan(sub.id, planForRazorpayPlanId(sub.plan_id), 'active');
          await recordInvoice(sub.id, req.body.payload?.payment?.entity, 'paid');
          break;
        }
        case 'subscription.pending':
          await applyStatus(req.body.payload.subscription.entity.id, 'pending');
          break;
        case 'subscription.halted':
          await applyStatus(req.body.payload.subscription.entity.id, 'halted');
          break;
        case 'subscription.cancelled':
        case 'subscription.completed':
        case 'subscription.expired':
          await downgradeToFree(req.body.payload.subscription.entity.id);
          break;
        case 'payment.failed':
          if (req.body.payload?.payment?.entity?.subscription_id) {
            const subId = req.body.payload.payment.entity.subscription_id;
            await applyStatus(subId, 'past_due');
            await recordInvoice(subId, req.body.payload.payment.entity, 'failed');
            await paymentFailedAlert(subId);
          }
          break;
        default:
          break;
      }
      res.status(200).send('ok');
    } catch (e: any) {
      console.error('[razorpayWebhook] handler error', event, e);
      res.status(500).send('handler error');
    }
  },
);

/* ───────────────────────── invoices ───────────────────────── */

/**
 * Persist a payment record in the `invoices` collection (admin dashboard +
 * the org's Billing tab read from here). Idempotent per Razorpay payment id.
 */
async function recordInvoice(subId: string, payment: any, status: 'paid' | 'failed'): Promise<void> {
  if (!payment?.id) return;
  const orgDoc = await findOrgBySubscription(subId);
  const ref = db.doc(`invoices/${payment.id}`);
  await ref.set({
    paymentId: payment.id,
    subscriptionId: subId,
    organizationId: orgDoc?.id ?? null,
    organizationName: orgDoc?.data()?.name ?? null,
    plan: orgDoc?.data()?.plan ?? null,
    amount: (payment.amount ?? 0) / 100, // paise → currency units
    currency: (payment.currency ?? 'INR').toUpperCase(),
    method: payment.method ?? null,
    email: payment.email ?? null,
    status,
    errorDescription: status === 'failed' ? (payment.error_description ?? null) : null,
    razorpayInvoiceId: payment.invoice_id ?? null,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

/** Notify + email the org's billing roles about a failed payment. */
async function paymentFailedAlert(subId: string): Promise<void> {
  const orgDoc = await findOrgBySubscription(subId);
  if (!orgDoc) return;
  const org = orgDoc.data();
  await notifyRoles(orgDoc.id, ['owner', 'admin'], 'subscription.paymentFailed',
    'Payment failed',
    `The latest subscription payment for ${org.name} failed. Razorpay will retry; please check your payment method.`);
  const ownerSnap = await db.doc(`users/${org.ownerId}`).get();
  const ownerEmail = ownerSnap.data()?.email;
  if (ownerEmail) {
    const tpl = emailPaymentFailed(org.name ?? 'your organization');
    await sendEmail(ownerEmail, tpl.subject, tpl.html);
  }
}

async function findOrgBySubscription(subId: string): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const snap = await db.collection('organizations').where('razorpaySubscriptionId', '==', subId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function applyPlan(subId: string, plan: PlanType | null, status: SubscriptionStatusLike) {
  const orgDoc = await findOrgBySubscription(subId);
  if (!orgDoc) return;
  const effectivePlan = plan ?? 'starter';
  const limits = PLAN_LIMITS[effectivePlan];
  const statusBefore = orgDoc.data().subscriptionStatus;
  await orgDoc.ref.update({
    plan: effectivePlan,
    planLimits: { requestsPerMonth: requestsLimitFor(effectivePlan), usersLimit: limits.users, teamsLimit: limits.teams },
    subscriptionStatus: status,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(orgDoc.id, 'system', 'subscription.reconciled', { plan: effectivePlan, status, subscriptionId: subId });

  // First transition into active/trialing → tell the billing roles + owner.
  if (status !== statusBefore && (status === 'active' || status === 'trialing')) {
    const org = orgDoc.data();
    await notifyRoles(orgDoc.id, ['owner', 'admin'], 'subscription.activated',
      status === 'trialing' ? 'Trial started' : 'Subscription active',
      `${org.name} is now on the ${effectivePlan} plan (${status}).`);
    const ownerSnap = await db.doc(`users/${org.ownerId}`).get();
    const ownerEmail = ownerSnap.data()?.email;
    if (ownerEmail) {
      const tpl = emailSubscriptionUpdate(org.name ?? 'your organization', effectivePlan, status);
      await sendEmail(ownerEmail, tpl.subject, tpl.html);
    }
  }
}

async function applyStatus(subId: string, status: SubscriptionStatusLike) {
  const orgDoc = await findOrgBySubscription(subId);
  if (!orgDoc) return;
  await orgDoc.ref.update({ subscriptionStatus: status, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(orgDoc.id, 'system', 'subscription.reconciled', { status, subscriptionId: subId });
}

async function downgradeToFree(subId: string) {
  const orgDoc = await findOrgBySubscription(subId);
  if (!orgDoc) return;
  const org = orgDoc.data();
  await orgDoc.ref.update({
    plan: 'free',
    planLimits: { requestsPerMonth: PLAN_LIMITS.free.requests, usersLimit: PLAN_LIMITS.free.users, teamsLimit: PLAN_LIMITS.free.teams },
    subscriptionStatus: 'cancelled',
    razorpaySubscriptionId: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(orgDoc.id, 'system', 'subscription.reconciled', { plan: 'free', status: 'cancelled', subscriptionId: subId });

  await notifyRoles(orgDoc.id, ['owner', 'admin'], 'subscription.cancelled',
    'Subscription ended',
    `${org.name} has been moved to the Free plan. Resubscribe any time from Settings.`);
  const ownerSnap = await db.doc(`users/${org.ownerId}`).get();
  const ownerEmail = ownerSnap.data()?.email;
  if (ownerEmail) {
    const tpl = emailSubscriptionUpdate(org.name ?? 'your organization', 'free', 'cancelled');
    await sendEmail(ownerEmail, tpl.subject, tpl.html);
  }
}
