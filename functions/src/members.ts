// ============================================
// MEMBER MANAGEMENT
// Remove / change role / suspend / leave. Ownership transfer lives in
// organizations.ts (transferOwnership). All role math flows through the shared
// permission engine (./permissions) so client + server can never disagree.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, assertVerified, assertOrgPermission, writeAudit } from './util';
import { roleRank, canChangeRole, type MemberRole } from './permissions';
import { notify, notifyRoles } from './notifications';

async function getMemberOrThrow(orgId: string, userId: string) {
  const ref = db.doc(`organizations/${orgId}/members/${userId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'That user is not a member of this organization.');
  return { ref, data: snap.data()! };
}

/** Delete the member doc + the user's membership mirror, and clear activeOrganizationId if needed. */
async function detachMember(orgId: string, userId: string): Promise<void> {
  const batch = db.batch();
  batch.delete(db.doc(`organizations/${orgId}/members/${userId}`));
  batch.delete(db.doc(`users/${userId}/memberships/${orgId}`));
  await batch.commit();

  const userRef = db.doc(`users/${userId}`);
  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()!.activeOrganizationId === orgId) {
    // Point them at any other org they belong to (or blank → onboarding self-heal).
    const remaining = await db.collection(`users/${userId}/memberships`).limit(1).get();
    await userRef.update({
      activeOrganizationId: remaining.empty ? '' : remaining.docs[0].id,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/* ───────────────────────── remove member ───────────────────────── */

export const removeMember = onCall<{ organizationId: string; userId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, userId } = request.data ?? ({} as any);
  if (!organizationId || !userId) throw new HttpsError('invalid-argument', 'organizationId and userId are required.');
  if (userId === uid) throw new HttpsError('invalid-argument', 'Use "Leave organization" to remove yourself.');

  const actor = await assertOrgPermission(uid, organizationId, 'members.remove');
  const target = await getMemberOrThrow(organizationId, userId);

  const targetRole = target.data.role as MemberRole;
  if (targetRole === 'owner') throw new HttpsError('permission-denied', 'The owner cannot be removed. Transfer ownership first.');
  if (roleRank(targetRole) >= roleRank(actor.role)) {
    throw new HttpsError('permission-denied', 'You can only remove members with a role below your own.');
  }

  await detachMember(organizationId, userId);

  await Promise.allSettled([
    notify(userId, organizationId, 'member.removed', 'Removed from organization',
      `You were removed from the organization by ${actor.name ?? actor.email ?? 'an administrator'}.`),
    writeAudit(organizationId, uid, 'member.removed',
      { userId, email: target.data.email, role: targetRole },
      { actorEmail: actor.email, actorName: actor.name }),
  ]);
  return { ok: true };
});

/* ───────────────────────── change role ───────────────────────── */

export const changeMemberRole = onCall<{ organizationId: string; userId: string; role: MemberRole }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, userId, role } = request.data ?? ({} as any);
  if (!organizationId || !userId || !role) {
    throw new HttpsError('invalid-argument', 'organizationId, userId and role are required.');
  }
  if (userId === uid) throw new HttpsError('invalid-argument', 'You cannot change your own role.');

  const actor = await assertOrgPermission(uid, organizationId, 'members.updateRole');
  const target = await getMemberOrThrow(organizationId, userId);
  const before = target.data.role as MemberRole;

  // Shared engine: target's old AND new role must both be strictly below the
  // actor, and `owner` can never be assigned here (transferOwnership only).
  if (!canChangeRole(actor.role, before, role)) {
    throw new HttpsError('permission-denied', 'You cannot make that role change.');
  }
  if (before === role) return { ok: true, unchanged: true };

  const batch = db.batch();
  batch.update(target.ref, { role });
  batch.set(db.doc(`users/${userId}/memberships/${organizationId}`), { role }, { merge: true });
  await batch.commit();

  await Promise.allSettled([
    notify(userId, organizationId, 'member.roleChanged', 'Your role changed',
      `Your role was changed from ${before} to ${role} by ${actor.name ?? actor.email ?? 'an administrator'}.`),
    writeAudit(organizationId, uid, 'member.roleChanged',
      { userId, email: target.data.email, from: before, to: role },
      { actorEmail: actor.email, actorName: actor.name }),
  ]);
  return { ok: true };
});

/* ───────────────────────── suspend / reactivate ───────────────────────── */

export const setMemberStatus = onCall<{ organizationId: string; userId: string; status: 'active' | 'suspended' }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, userId, status } = request.data ?? ({} as any);
  if (!organizationId || !userId || !['active', 'suspended'].includes(status)) {
    throw new HttpsError('invalid-argument', 'organizationId, userId and a valid status are required.');
  }
  if (userId === uid) throw new HttpsError('invalid-argument', 'You cannot suspend yourself.');

  const actor = await assertOrgPermission(uid, organizationId, 'members.remove');
  const target = await getMemberOrThrow(organizationId, userId);
  const targetRole = target.data.role as MemberRole;
  if (targetRole === 'owner') throw new HttpsError('permission-denied', 'The owner cannot be suspended.');
  if (roleRank(targetRole) >= roleRank(actor.role)) {
    throw new HttpsError('permission-denied', 'You can only suspend members with a role below your own.');
  }

  await target.ref.update({ status, updatedAt: FieldValue.serverTimestamp() });

  await Promise.allSettled([
    notify(userId, organizationId, 'member.roleChanged',
      status === 'suspended' ? 'Account suspended' : 'Account reactivated',
      status === 'suspended'
        ? 'Your access to this organization has been suspended by an administrator.'
        : 'Your access to this organization has been restored.'),
    writeAudit(organizationId, uid, status === 'suspended' ? 'member.suspended' : 'member.reactivated',
      { userId, email: target.data.email },
      { actorEmail: actor.email, actorName: actor.name }),
  ]);
  return { ok: true };
});

/* ───────────────────────── leave organization ───────────────────────── */

export const leaveOrganization = onCall<{ organizationId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId } = request.data ?? ({} as any);
  if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.');

  const me = await getMemberOrThrow(organizationId, uid);
  if ((me.data.role as MemberRole) === 'owner') {
    throw new HttpsError('failed-precondition', 'Owners must transfer ownership before leaving the organization.');
  }

  await detachMember(organizationId, uid);

  await Promise.allSettled([
    notifyRoles(organizationId, ['owner', 'admin'], 'member.left', 'Member left',
      `${me.data.name ?? me.data.email ?? 'A member'} left the organization.`, uid),
    writeAudit(organizationId, uid, 'member.left', { email: me.data.email, role: me.data.role }),
  ]);
  return { ok: true };
});
