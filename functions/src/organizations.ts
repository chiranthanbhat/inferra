// ============================================
// ORGANIZATION CALLABLES
// Server-authoritative mutations on the Organization document. Each callable
// re-checks permissions via assertOrgPermission (never trusts a role sent by
// the client) and writes an audit-log entry on success.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, assertVerified, assertOrgPermission, writeAudit } from './util';

interface OrgSettingsPatch {
  defaultModel?: string;
  defaultPriority?: 'cost' | 'speed' | 'quality' | 'balanced';
  enableOptimization?: boolean;
  enableRouting?: boolean;
  enableGovernance?: boolean;
  piiPolicy?: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy?: 'block' | 'warn' | 'allow';
  enabledProviders?: Record<string, boolean>;
}

const SETTINGS_KEYS: (keyof OrgSettingsPatch)[] = [
  'defaultModel', 'defaultPriority',
  'enableOptimization', 'enableRouting', 'enableGovernance',
  'piiPolicy', 'secretPolicy', 'enabledProviders',
];

/**
 * Update organization settings. Requires `settings.update` (manager+). The
 * server enforces both membership and permission, then writes the fields
 * one-by-one so extra keys sent by a malicious client are ignored.
 */
export const updateOrganizationSettings = onCall<{ organizationId: string; patch: OrgSettingsPatch }>(
  async (request) => {
    const uid = assertVerified(request);
    const { organizationId, patch } = request.data ?? ({} as any);
    if (!organizationId || typeof organizationId !== 'string') {
      throw new HttpsError('invalid-argument', 'organizationId is required.');
    }
    if (!patch || typeof patch !== 'object') {
      throw new HttpsError('invalid-argument', 'patch is required.');
    }

    const actor = await assertOrgPermission(uid, organizationId, 'settings.update');

    const cleaned: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of SETTINGS_KEYS) {
      if (patch[key] !== undefined) cleaned[`settings.${key}`] = patch[key];
    }
    if (Object.keys(cleaned).length === 1) {
      throw new HttpsError('invalid-argument', 'No allowed settings fields provided.');
    }

    await db.doc(`organizations/${organizationId}`).update(cleaned);
    await writeAudit(organizationId, uid, 'organization.settings.updated',
      { keys: Object.keys(cleaned).filter((k) => k.startsWith('settings.')) },
      { actorEmail: actor.email, actorName: actor.name },
    );
    return { ok: true };
  },
);

/**
 * Rename an organization. Owner/admin only (via `org.update`). Refreshes the
 * `organizationName` mirror on every member's memberships subcollection so
 * every user's switcher stays consistent.
 */
export const renameOrganization = onCall<{ organizationId: string; name: string }>(
  async (request) => {
    const uid = assertVerified(request);
    const { organizationId, name } = request.data ?? ({} as any);
    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.');
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) throw new HttpsError('invalid-argument', 'name is required.');
    if (trimmed.length > 80) throw new HttpsError('invalid-argument', 'Name is too long.');

    const actor = await assertOrgPermission(uid, organizationId, 'org.update');

    await db.doc(`organizations/${organizationId}`).update({
      name: trimmed,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Refresh the name-mirror on every member's memberships doc so the org
    // switcher renders the new name everywhere without a full reload.
    const members = await db.collection(`organizations/${organizationId}/members`).get();
    let batch = db.batch();
    let opsInBatch = 0;
    for (const memberDoc of members.docs) {
      const membershipRef = db.doc(`users/${memberDoc.id}/memberships/${organizationId}`);
      batch.set(membershipRef, { organizationName: trimmed }, { merge: true });
      opsInBatch += 1;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();

    await writeAudit(organizationId, uid, 'organization.updated', { name: trimmed },
      { actorEmail: actor.email, actorName: actor.name });
    return { ok: true };
  },
);

/**
 * Delete an organization. Owner-only. Refuses to delete an org that still has
 * an active paid subscription — the customer must cancel first. Marks the org
 * `status: 'deleted'` (soft-delete) rather than physically removing docs, so
 * audit trails + usage history remain queryable.
 */
export const deleteOrganization = onCall<{ organizationId: string; confirmation: string }>(
  async (request) => {
    const uid = assertVerified(request);
    const { organizationId, confirmation } = request.data ?? ({} as any);
    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.');

    const actor = await assertOrgPermission(uid, organizationId, 'org.delete');

    const orgRef = db.doc(`organizations/${organizationId}`);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
    const org = orgSnap.data()!;

    if (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'pending') {
      throw new HttpsError('failed-precondition', 'Cancel the active subscription before deleting the organization.');
    }
    if (confirmation !== org.name) {
      throw new HttpsError('failed-precondition', 'Confirmation string does not match the organization name.');
    }

    await orgRef.update({
      status: 'deleted',
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Point every member's `activeOrganizationId` away from the deleted org if
    // it was their current context. Best-effort; members will see the switcher
    // on next load.
    const members = await db.collection(`organizations/${organizationId}/members`).get();
    let batch = db.batch();
    let opsInBatch = 0;
    for (const memberDoc of members.docs) {
      const userRef = db.doc(`users/${memberDoc.id}`);
      const userSnap = await userRef.get();
      if (userSnap.exists && userSnap.data()!.activeOrganizationId === organizationId) {
        batch.update(userRef, { activeOrganizationId: '', updatedAt: FieldValue.serverTimestamp() });
        opsInBatch += 1;
      }
      const membershipRef = db.doc(`users/${memberDoc.id}/memberships/${organizationId}`);
      batch.delete(membershipRef);
      opsInBatch += 1;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();

    await writeAudit(organizationId, uid, 'organization.deleted', { name: org.name },
      { actorEmail: actor.email, actorName: actor.name });
    return { ok: true };
  },
);

/**
 * Transfer ownership to another existing member. Owner-only. Demotes the
 * previous owner to `admin` and promotes the target to `owner`, updating the
 * org doc's `ownerId` in the same transaction.
 */
export const transferOwnership = onCall<{ organizationId: string; toUserId: string }>(
  async (request) => {
    const uid = assertVerified(request);
    const { organizationId, toUserId } = request.data ?? ({} as any);
    if (!organizationId || !toUserId) {
      throw new HttpsError('invalid-argument', 'organizationId and toUserId are required.');
    }
    if (toUserId === uid) throw new HttpsError('invalid-argument', 'You are already the owner.');

    const actor = await assertOrgPermission(uid, organizationId, 'org.transferOwnership');

    await db.runTransaction(async (tx) => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const orgSnap = await tx.get(orgRef);
      if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');

      const oldOwnerMemberRef = db.doc(`organizations/${organizationId}/members/${uid}`);
      const newOwnerMemberRef = db.doc(`organizations/${organizationId}/members/${toUserId}`);
      const oldOwnerMembershipRef = db.doc(`users/${uid}/memberships/${organizationId}`);
      const newOwnerMembershipRef = db.doc(`users/${toUserId}/memberships/${organizationId}`);

      const newOwnerMember = await tx.get(newOwnerMemberRef);
      if (!newOwnerMember.exists) throw new HttpsError('not-found', 'Target user is not a member.');

      tx.update(orgRef, { ownerId: toUserId, updatedAt: FieldValue.serverTimestamp() });
      tx.update(oldOwnerMemberRef, { role: 'admin' });
      tx.update(newOwnerMemberRef, { role: 'owner' });
      tx.update(oldOwnerMembershipRef, { role: 'admin' });
      tx.update(newOwnerMembershipRef, { role: 'owner' });
    });

    await writeAudit(organizationId, uid, 'organization.ownershipTransferred',
      { toUserId },
      { actorEmail: actor.email, actorName: actor.name });
    return { ok: true };
  },
);
