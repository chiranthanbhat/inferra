// ============================================
// TEAM INVITATIONS
// Full lifecycle: invite → (accept | reject | cancel | expire), with resend.
// Every mutation re-checks org permissions server-side, audits, notifies, and
// emails. Duplicate prevention + seat limits + 7-day expiry are enforced here
// — the client can't bypass any of it (rules make `invitations` read-only).
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';
import { db, Timestamp, FieldValue, assertVerified, assertOrgPermission, readMembership, writeAudit, rateLimit } from './util';
import { roleRank, hasPermission, type MemberRole } from './permissions';
import { sendEmail, emailInvitation, emailWelcome } from './email';
import { notify, notifyRoles } from './notifications';

export const INVITE_EXPIRY_DAYS = 7;
const MAX_RESENDS = 5;

type InvitableRole = Exclude<MemberRole, 'owner'>;
const INVITABLE_ROLES: InvitableRole[] = ['admin', 'manager', 'member', 'viewer'];

const normEmail = (e: unknown): string => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const isEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function expiresAt(): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000));
}

function isExpired(inv: FirebaseFirestore.DocumentData): boolean {
  const exp = inv.expiresAt?.toDate?.()?.getTime() ?? 0;
  return Date.now() >= exp;
}

/** Lazily flip a pending-but-past-expiry invitation to `expired`. */
async function lazyExpire(ref: FirebaseFirestore.DocumentReference, inv: FirebaseFirestore.DocumentData): Promise<boolean> {
  if (inv.status === 'pending' && isExpired(inv)) {
    await ref.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
    return true;
  }
  return false;
}

/* ───────────────────────── invite ───────────────────────── */

export const inviteMember = onCall<{ organizationId: string; email: string; role: InvitableRole; teamId?: string; teamRole?: 'member' | 'viewer' }>(
  async (request) => {
    const uid = assertVerified(request);
    rateLimit(uid, 30);

    const { organizationId, teamId } = request.data ?? ({} as any);
    const email = normEmail(request.data?.email);
    const role = request.data?.role;
    const teamRole = request.data?.teamRole === 'viewer' ? 'viewer' : 'member';

    if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.');
    if (!isEmail(email)) throw new HttpsError('invalid-argument', 'A valid email address is required.');
    if (!INVITABLE_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'Role must be admin, manager, member or viewer.');

    // Authorization: org-wide inviters (admin+) may invite anyone anywhere.
    // A TEAM MANAGER may invite too — but only INTO the team they manage, and
    // only at member/viewer org rank (spec: managers act within their teams).
    const membership = await readMembership(uid, organizationId);
    if (!membership || membership.status === 'suspended') {
      throw new HttpsError('permission-denied', 'You are not an active member of this organization.');
    }
    const actorRole = membership.role as MemberRole;
    const actor = { role: actorRole, email: membership.email, name: membership.name };
    const orgWideInviter = hasPermission(actorRole, 'members.invite');

    let team: { id: string; name: string } | null = null;
    if (teamId) {
      const teamSnap = await db.doc(`teams/${teamId}`).get();
      if (!teamSnap.exists || teamSnap.data()!.organizationId !== organizationId) {
        throw new HttpsError('not-found', 'Team not found.');
      }
      if (teamSnap.data()!.status !== 'active') throw new HttpsError('failed-precondition', 'That team is archived.');
      team = { id: teamId, name: teamSnap.data()!.name as string };
    }

    if (!orgWideInviter) {
      if (!team) throw new HttpsError('permission-denied', 'You can only invite people into a team you manage.');
      const tm = await db.doc(`team_members/${team.id}_${uid}`).get();
      if (!tm.exists || tm.data()!.teamRole !== 'manager') {
        throw new HttpsError('permission-denied', 'Only the manager of this team (or an org admin) can invite to it.');
      }
      if (role !== 'member' && role !== 'viewer') {
        throw new HttpsError('permission-denied', 'Team managers can invite members and viewers only.');
      }
    }

    // An actor may only grant a role strictly below their own.
    if (roleRank(role) >= roleRank(actor.role)) {
      throw new HttpsError('permission-denied', `As ${actor.role}, you can only invite roles below your own.`);
    }
    if (actor.email && normEmail(actor.email) === email) {
      throw new HttpsError('invalid-argument', 'You are already a member of this organization.');
    }

    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
    const org = orgSnap.data()!;

    // ---- seat limit (counts active members + pending invitations) ----
    const usersLimit: number = org.planLimits?.usersLimit ?? 1;
    const [membersSnap, pendingSnap] = await Promise.all([
      db.collection(`organizations/${organizationId}/members`).get(),
      db.collection('invitations')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'pending')
        .get(),
    ]);
    const livePending = pendingSnap.docs.filter((d) => !isExpired(d.data()));
    if (usersLimit >= 0 && membersSnap.size + livePending.length >= usersLimit) {
      throw new HttpsError('resource-exhausted', `Your plan allows ${usersLimit} member${usersLimit === 1 ? '' : 's'}. Upgrade to invite more.`);
    }

    // ---- duplicate prevention ----
    const alreadyMember = membersSnap.docs.some((m) => normEmail(m.data().email) === email);
    if (alreadyMember) throw new HttpsError('already-exists', 'That person is already a member of this organization.');
    const alreadyInvited = livePending.some((d) => d.data().email_lower === email);
    if (alreadyInvited) throw new HttpsError('already-exists', 'An invitation for that email is already pending.');

    // ---- create ----
    const token = randomBytes(24).toString('hex');
    const inviteRef = await db.collection('invitations').add({
      organizationId,
      organizationName: org.name ?? 'Organization',
      email,
      email_lower: email,
      role,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      teamRole: team ? teamRole : null,
      status: 'pending',
      token,
      invitedBy: uid,
      invitedByName: actor.name ?? actor.email ?? 'A teammate',
      invitedByEmail: actor.email ?? '',
      resendCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSentAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });

    // ---- side effects: deep-link email + in-app notification ----
    const inviteUrl = `${process.env.APP_URL || 'https://app.inferra.ai'}/?invite=${inviteRef.id}&token=${token}`;
    const tpl = emailInvitation(
      actor.name ?? actor.email ?? 'A teammate',
      org.name ?? 'an organization',
      role,
      INVITE_EXPIRY_DAYS,
      inviteUrl,
      team?.name,
    );
    await sendEmail(email, tpl.subject, tpl.html);

    const existing = await db.collection('users').where('email_lower', '==', email).limit(1).get();
    if (!existing.empty) {
      await notify(existing.docs[0].id, organizationId, 'invitation.received',
        `Invitation to ${org.name}`,
        `${actor.name ?? actor.email ?? 'A teammate'} invited you to join ${org.name} as ${role}.`);
    }

    await writeAudit(organizationId, uid, 'member.invited', { email, role, invitationId: inviteRef.id },
      { actorEmail: actor.email, actorName: actor.name });

    return { ok: true, invitationId: inviteRef.id };
  },
);

/* ───────────────────────── accept ───────────────────────── */

export const acceptInvitation = onCall<{ invitationId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { invitationId } = request.data ?? ({} as any);
  if (!invitationId) throw new HttpsError('invalid-argument', 'invitationId is required.');

  const callerEmail = normEmail(request.auth?.token?.email);
  const inviteRef = db.doc(`invitations/${invitationId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = inviteSnap.data()!;

  if (inv.email_lower !== callerEmail) {
    // Spec-exact rejection: name the invited address so the user knows which
    // account to sign in with.
    throw new HttpsError('permission-denied', `This invitation was sent to ${inv.email_lower}. Please sign in using that email.`);
  }
  if (inv.status !== 'pending') throw new HttpsError('failed-precondition', `This invitation is ${inv.status}.`);
  if (await lazyExpire(inviteRef, inv)) throw new HttpsError('failed-precondition', 'This invitation has expired.');

  const orgId: string = inv.organizationId;
  const orgRef = db.doc(`organizations/${orgId}`);

  const userSnap = await db.doc(`users/${uid}`).get();
  const u = userSnap.data() ?? {};
  const memberName = (u.name as string) || callerEmail;

  // Transaction: seat check + member doc + membership mirror + team join +
  // invite status. Firestore requires ALL reads before ANY write, so every
  // tx.get is hoisted to the top.
  await db.runTransaction(async (tx) => {
    const memberRef = db.doc(`organizations/${orgId}/members/${uid}`);
    const teamRef = inv.teamId ? db.doc(`teams/${inv.teamId}`) : null;
    const teamMemberRef = inv.teamId ? db.doc(`team_members/${inv.teamId}_${uid}`) : null;

    // ---- reads ----
    const orgTx = await tx.get(orgRef);
    const memberTx = await tx.get(memberRef);
    const membersCount = (await tx.get(db.collection(`organizations/${orgId}/members`))).size;
    const teamSnap = teamRef ? await tx.get(teamRef) : null;
    const teamMemberSnap = teamMemberRef ? await tx.get(teamMemberRef) : null;

    // ---- validations ----
    if (!orgTx.exists || orgTx.data()!.status === 'deleted') {
      throw new HttpsError('failed-precondition', 'This organization no longer exists.');
    }
    const org = orgTx.data()!;
    if (memberTx.exists) throw new HttpsError('already-exists', 'You are already a member of this organization.');
    const usersLimit: number = org.planLimits?.usersLimit ?? 1;
    if (usersLimit >= 0 && membersCount >= usersLimit) {
      throw new HttpsError('resource-exhausted', 'This organization has no seats left. Ask an admin to upgrade the plan.');
    }

    // ---- writes ----
    tx.set(memberRef, {
      userId: uid,
      email: callerEmail,
      email_lower: callerEmail,
      name: memberName,
      role: inv.role,
      status: 'active',
      joinedAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp(),
      invitedBy: inv.invitedBy ?? null,
    });
    tx.set(db.doc(`users/${uid}/memberships/${orgId}`), {
      organizationId: orgId,
      organizationName: org.name ?? 'Organization',
      userId: uid,
      email: callerEmail,
      name: memberName,
      role: inv.role,
      joinedAt: FieldValue.serverTimestamp(),
      lastAccessedAt: FieldValue.serverTimestamp(),
    });

    // Team-targeted invitation → join the assigned team with the stored team
    // role, atomically with the org join. A deleted/archived team never blocks
    // the org join — the invitation still works.
    if (teamRef && teamMemberRef && teamSnap?.exists
        && teamSnap.data()!.status === 'active'
        && teamSnap.data()!.organizationId === orgId
        && !teamMemberSnap?.exists) {
      tx.set(teamMemberRef, {
        teamId: inv.teamId,
        organizationId: orgId,
        userId: uid,
        email: callerEmail,
        name: memberName,
        teamRole: inv.teamRole === 'viewer' ? 'viewer' : 'member',
        addedBy: inv.invitedBy ?? 'invitation',
        addedAt: FieldValue.serverTimestamp(),
      });
      tx.update(teamRef, { memberCount: FieldValue.increment(1) });
    }

    tx.update(inviteRef, {
      status: 'accepted',
      acceptedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Side effects (outside the transaction, best-effort).
  const orgName: string = inv.organizationName ?? 'your new organization';
  const welcome = emailWelcome(memberName, orgName);
  await Promise.allSettled([
    sendEmail(callerEmail, welcome.subject, welcome.html),
    notify(inv.invitedBy, orgId, 'member.joined', 'Invitation accepted', `${memberName} joined ${orgName} as ${inv.role}.`),
    notifyRoles(orgId, ['owner', 'admin'], 'member.joined', 'New member', `${memberName} joined ${orgName} as ${inv.role}.`, inv.invitedBy),
    writeAudit(orgId, uid, 'member.joined', { role: inv.role, invitationId, email: callerEmail }),
  ]);

  return { ok: true, organizationId: orgId };
});

/* ───────────────────────── reject ───────────────────────── */

export const rejectInvitation = onCall<{ invitationId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { invitationId } = request.data ?? ({} as any);
  if (!invitationId) throw new HttpsError('invalid-argument', 'invitationId is required.');

  const callerEmail = normEmail(request.auth?.token?.email);
  const inviteRef = db.doc(`invitations/${invitationId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = inviteSnap.data()!;

  if (inv.email_lower !== callerEmail) throw new HttpsError('permission-denied', 'This invitation was sent to a different email address.');
  if (inv.status !== 'pending') throw new HttpsError('failed-precondition', `This invitation is ${inv.status}.`);

  await inviteRef.update({ status: 'rejected', updatedAt: FieldValue.serverTimestamp() });
  await Promise.allSettled([
    notify(inv.invitedBy, inv.organizationId, 'member.left', 'Invitation declined', `${callerEmail} declined the invitation to ${inv.organizationName}.`),
    writeAudit(inv.organizationId, uid, 'member.invitationRejected', { invitationId, email: callerEmail }),
  ]);
  return { ok: true };
});

/* ───────────────────────── invitation administration guard ───────────────────────── */

/**
 * Who may cancel/resend an invitation: org-wide inviters (admin+), or — for a
 * team-targeted invitation — the manager of that team.
 */
async function assertInvitationAdmin(uid: string, inv: FirebaseFirestore.DocumentData) {
  const membership = await readMembership(uid, inv.organizationId);
  if (!membership || membership.status === 'suspended') {
    throw new HttpsError('permission-denied', 'You are not an active member of this organization.');
  }
  const role = membership.role as MemberRole;
  if (hasPermission(role, 'members.invite')) {
    return { role, email: membership.email, name: membership.name };
  }
  if (inv.teamId) {
    const tm = await db.doc(`team_members/${inv.teamId}_${uid}`).get();
    if (tm.exists && tm.data()!.teamRole === 'manager') {
      return { role, email: membership.email, name: membership.name };
    }
  }
  throw new HttpsError('permission-denied', 'You do not have permission to manage this invitation.');
}

/* ───────────────────────── cancel ───────────────────────── */

export const cancelInvitation = onCall<{ invitationId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { invitationId } = request.data ?? ({} as any);
  if (!invitationId) throw new HttpsError('invalid-argument', 'invitationId is required.');

  const inviteRef = db.doc(`invitations/${invitationId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = inviteSnap.data()!;

  const actor = await assertInvitationAdmin(uid, inv);
  if (inv.status !== 'pending') throw new HttpsError('failed-precondition', `This invitation is ${inv.status}.`);

  await inviteRef.update({ status: 'cancelled', cancelledBy: uid, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(inv.organizationId, uid, 'member.invitationCancelled', { invitationId, email: inv.email_lower },
    { actorEmail: actor.email, actorName: actor.name });
  return { ok: true };
});

/* ───────────────────────── resend ───────────────────────── */

export const resendInvitation = onCall<{ invitationId: string }>(async (request) => {
  const uid = assertVerified(request);
  rateLimit(uid, 10);
  const { invitationId } = request.data ?? ({} as any);
  if (!invitationId) throw new HttpsError('invalid-argument', 'invitationId is required.');

  const inviteRef = db.doc(`invitations/${invitationId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = inviteSnap.data()!;

  const actor = await assertInvitationAdmin(uid, inv);
  if (inv.status !== 'pending' && inv.status !== 'expired') {
    throw new HttpsError('failed-precondition', `This invitation is ${inv.status}.`);
  }
  if ((inv.resendCount ?? 0) >= MAX_RESENDS) {
    throw new HttpsError('resource-exhausted', 'This invitation has been resent too many times. Cancel it and create a new one.');
  }

  // Resending revives an expired invite with a fresh expiry window.
  await inviteRef.update({
    status: 'pending',
    resendCount: FieldValue.increment(1),
    lastSentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt(),
  });

  const inviteUrl = `${process.env.APP_URL || 'https://app.inferra.ai'}/?invite=${invitationId}&token=${inv.token}`;
  const tpl = emailInvitation(
    actor.name ?? actor.email ?? 'A teammate',
    inv.organizationName ?? 'an organization',
    inv.role,
    INVITE_EXPIRY_DAYS,
    inviteUrl,
    inv.teamName ?? undefined,
  );
  await sendEmail(inv.email_lower, tpl.subject, tpl.html);

  await writeAudit(inv.organizationId, uid, 'member.invitationResent', { invitationId, email: inv.email_lower },
    { actorEmail: actor.email, actorName: actor.name });
  return { ok: true };
});

/* ───────────────────────── public preview (deep link, pre-auth) ───────────────────────── */

/**
 * Token-gated invitation preview for the sign-up/sign-in screen. Deliberately
 * UNAUTHENTICATED — the invitee doesn't have an account yet. The random token
 * from the email link is the credential; without it nothing is returned, so
 * invitation ids alone leak nothing.
 */
export const previewInvitation = onCall<{ invitationId: string; token: string }>(async (request) => {
  const { invitationId, token } = request.data ?? ({} as any);
  if (!invitationId || !token) throw new HttpsError('invalid-argument', 'invitationId and token are required.');

  const snap = await db.doc(`invitations/${invitationId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invitation not found.');
  const inv = snap.data()!;
  if (inv.token !== token) throw new HttpsError('permission-denied', 'Invalid invitation link.');

  const expired = inv.status === 'pending' && isExpired(inv);
  return {
    email: inv.email_lower as string,
    organizationName: (inv.organizationName ?? 'an organization') as string,
    role: inv.role as string,
    teamName: (inv.teamName ?? null) as string | null,
    status: (expired ? 'expired' : inv.status) as string,
    invitedByName: (inv.invitedByName ?? '') as string,
  };
});
