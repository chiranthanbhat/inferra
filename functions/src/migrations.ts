// ============================================
// ONE-SHOT DATA MIGRATIONS
// Admin-only, idempotent. Each migration is safe to re-run — it only rewrites
// documents that still hold the pre-migration shape.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp, assertVerified, isAdmin, nextMonthlyReset } from './util';
import { requestsLimitFor, PLAN_LIMITS, type PlanType } from './plans';

/**
 * Iteration 1 → Iteration 2 migration:
 * Move plan/usage/subscription/razorpay/monthlyResetDate from users/{uid} onto
 * organizations/{orgId} where the user is the OWNER. Also creates the
 * `users/{uid}/memberships/{orgId}` mirror docs so the org switcher works for
 * legacy accounts. Skips docs that already have the org-side shape.
 */
export const migrateBillingToOrg = onCall(async (request) => {
  const callerUid = assertVerified(request);
  if (!(await isAdmin(callerUid))) throw new HttpsError('permission-denied', 'Admin access required.');

  let usersScanned = 0;
  let orgsUpdated = 0;
  let membershipsCreated = 0;
  let userDocsCleaned = 0;

  const users = await db.collection('users').get();
  for (const userDoc of users.docs) {
    usersScanned += 1;
    const d = userDoc.data();
    const targetUid = userDoc.id;
    const orgId = (d.activeOrganizationId as string) || (d.organizationId as string);
    if (!orgId) continue;

    const orgRef = db.doc(`organizations/${orgId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) continue;
    const orgData = orgSnap.data()!;
    const isOwnerOfOrg = orgData.ownerId === targetUid;

    // Move billing on the owner's copy only (the target user IS the org owner)
    // — non-owners inherit billing implicitly by belonging to the org.
    if (isOwnerOfOrg) {
      const orgPatch: Record<string, unknown> = {};
      const plan: PlanType = (d.currentPlan as PlanType) ?? (orgData.plan as PlanType) ?? 'free';
      if (orgData.plan == null) orgPatch.plan = plan;
      if (orgData.subscriptionStatus == null) orgPatch.subscriptionStatus = d.subscriptionStatus ?? 'none';
      if (orgData.monthlyResetDate == null) {
        const reset = d.monthlyResetDate ?? Timestamp.fromDate(nextMonthlyReset());
        orgPatch.monthlyResetDate = reset;
      }
      if (orgData.usage?.requestsUsed == null) {
        orgPatch.usage = {
          requestsUsed: d.requestsUsed ?? 0,
          totalSpend: orgData.usage?.totalSpend ?? 0,
          totalSavings: orgData.usage?.totalSavings ?? 0,
          tokensProcessed: orgData.usage?.tokensProcessed ?? 0,
        };
      }
      if (orgData.planLimits?.requestsPerMonth == null) {
        const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
        orgPatch.planLimits = {
          requestsPerMonth: requestsLimitFor(plan),
          usersLimit: limits.users,
          teamsLimit: limits.teams,
        };
      }
      if (d.razorpayCustomerId && orgData.razorpayCustomerId == null) orgPatch.razorpayCustomerId = d.razorpayCustomerId;
      if (d.razorpaySubscriptionId && orgData.razorpaySubscriptionId == null) orgPatch.razorpaySubscriptionId = d.razorpaySubscriptionId;

      if (Object.keys(orgPatch).length > 0) {
        orgPatch.updatedAt = FieldValue.serverTimestamp();
        await orgRef.update(orgPatch);
        orgsUpdated += 1;
      }
    }

    // Create the membership mirror if missing.
    const membershipRef = db.doc(`users/${targetUid}/memberships/${orgId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      const memberRef = db.doc(`organizations/${orgId}/members/${targetUid}`);
      const memberSnap = await memberRef.get();
      const role = memberSnap.exists ? memberSnap.data()!.role ?? 'member' : (isOwnerOfOrg ? 'owner' : 'member');
      await membershipRef.set({
        organizationId: orgId,
        organizationName: orgData.name ?? '',
        userId: targetUid,
        email: d.email ?? '',
        name: d.name ?? d.email ?? '',
        role,
        joinedAt: memberSnap.exists ? (memberSnap.data()!.joinedAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        lastAccessedAt: d.lastLoginAt ?? FieldValue.serverTimestamp(),
      });
      membershipsCreated += 1;
    }

    // Promote legacy organizationId → activeOrganizationId. Leaves the old
    // field in place for now (harmless), so mid-migration reads still work.
    if (!d.activeOrganizationId && d.organizationId) {
      await userDoc.ref.update({
        activeOrganizationId: d.organizationId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      userDocsCleaned += 1;
    }
  }

  return { usersScanned, orgsUpdated, membershipsCreated, userDocsCleaned };
});
