// ============================================
// WORKSPACE TEAMS — server engine
// Collections (normalized):
//   teams/{teamId}                    team identity + status + memberCount
//   team_members/{teamId_userId}      membership rows with PER-TEAM roles
//   team_permissions/{teamId}         resource grants + custom permission ids
//   team_settings/{teamId}            team-scoped defaults (priority, budget)
//   team_activity/{id}                per-team activity feed
//   organizations/{orgId}/customPermissions/{id}   owner-defined permissions
//
// Authorization: org `teams.manage` (manager+) OR being the manager of the
// specific team. Permission/custom-permission mutations are stricter (admin+ /
// owner). Every mutation writes an audit log AND a team_activity entry.
// ============================================

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes, createHash } from 'crypto';
import { db, FieldValue, assertVerified, assertOrgPermission, readMembership, writeAudit, rateLimit } from './util';
import { hasPermission, roleRank, type MemberRole } from './permissions';

type TeamRole = 'manager' | 'member' | 'viewer';
const TEAM_ROLES: TeamRole[] = ['manager', 'member', 'viewer'];

// Mirror of src/lib/resources.ts keys — grants with unknown keys are rejected.
const RESOURCE_KEYS = [
  'dashboard', 'analytics', 'routing', 'optimization', 'commandCenter', 'chat',
  'integrations', 'billing', 'settings', 'teams', 'auditLogs', 'providers', 'promptLibrary',
] as const;

const DEFAULT_TEAM_GRANTS: Record<string, boolean> = {
  dashboard: true, analytics: true, commandCenter: true, chat: true,
  routing: true, optimization: true, promptLibrary: true,
};

const memberDocId = (teamId: string, userId: string) => `${teamId}_${userId}`;

/* ───────────────────────── shared guards ───────────────────────── */

/**
 * Caller must hold org `teams.manage` OR be the manager of this specific team.
 * Returns actor info for audit tagging.
 */
async function assertTeamManage(uid: string, orgId: string, teamId?: string) {
  const membership = await readMembership(uid, orgId);
  if (!membership) throw new HttpsError('permission-denied', 'You are not a member of this organization.');
  if (membership.status === 'suspended') throw new HttpsError('permission-denied', 'Your access is suspended.');
  const role = membership.role as MemberRole;
  if (hasPermission(role, 'teams.manage')) return { role, email: membership.email, name: membership.name, viaTeam: false };

  if (teamId) {
    const tm = await db.doc(`team_members/${memberDocId(teamId, uid)}`).get();
    if (tm.exists && tm.data()!.teamRole === 'manager') {
      return { role, email: membership.email, name: membership.name, viaTeam: true };
    }
  }
  throw new HttpsError('permission-denied', 'You need team-management permission to do that.');
}

async function getTeamOrThrow(orgId: string, teamId: string) {
  const ref = db.doc(`teams/${teamId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.organizationId !== orgId) {
    throw new HttpsError('not-found', 'Team not found.');
  }
  return { ref, data: snap.data()! };
}

async function logActivity(teamId: string, orgId: string, actorId: string, actorName: string, eventType: string, details: Record<string, unknown> = {}) {
  await db.collection('team_activity').add({
    teamId, organizationId: orgId, actorId, actorName, eventType, details,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});
}

const trimmed = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ───────────────────────── team lifecycle ───────────────────────── */

export const createTeam = onCall<{ organizationId: string; name: string; description?: string; color?: string; icon?: string; managerId?: string }>(
  async (request) => {
    const uid = assertVerified(request);
    rateLimit(uid, 30);
    const { organizationId } = request.data ?? ({} as any);
    const name = trimmed(request.data?.name, 40);
    if (!organizationId || !name) throw new HttpsError('invalid-argument', 'organizationId and name are required.');

    const actor = await assertOrgPermission(uid, organizationId, 'teams.manage');

    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
    const teamsLimit: number = orgSnap.data()!.planLimits?.teamsLimit ?? 1;

    const existing = await db.collection('teams')
      .where('organizationId', '==', organizationId)
      .get();
    const live = existing.docs.filter((d) => d.data().status !== 'deleted');
    if (teamsLimit >= 0 && live.length >= teamsLimit) {
      throw new HttpsError('resource-exhausted', `Your plan allows ${teamsLimit} team${teamsLimit === 1 ? '' : 's'}. Upgrade to create more.`);
    }
    if (live.some((d) => (d.data().name_lower ?? '') === name.toLowerCase())) {
      throw new HttpsError('already-exists', 'A team with that name already exists.');
    }

    // Manager defaults to the caller; an explicit manager must be an org member.
    const managerId: string = request.data?.managerId || uid;
    const managerMembership = await readMembership(managerId, organizationId);
    if (!managerMembership) throw new HttpsError('failed-precondition', 'The chosen manager is not a member of this organization.');

    const teamRef = db.collection('teams').doc();
    const batch = db.batch();
    batch.set(teamRef, {
      organizationId,
      name,
      name_lower: name.toLowerCase(),
      description: trimmed(request.data?.description, 200),
      color: trimmed(request.data?.color, 12) || '#4DEEEA',
      icon: trimmed(request.data?.icon, 24) || 'users',
      managerId,
      status: 'active',
      memberCount: 1,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`team_members/${memberDocId(teamRef.id, managerId)}`), {
      teamId: teamRef.id,
      organizationId,
      userId: managerId,
      email: managerMembership.email ?? '',
      name: managerMembership.name ?? managerMembership.email ?? '',
      teamRole: 'manager',
      addedBy: uid,
      addedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`team_permissions/${teamRef.id}`), {
      teamId: teamRef.id,
      organizationId,
      grants: DEFAULT_TEAM_GRANTS,
      customGrants: [],
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`team_settings/${teamRef.id}`), {
      teamId: teamRef.id,
      organizationId,
      defaultPriority: 'balanced',
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.created', { teamId: teamRef.id, name }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(teamRef.id, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.created', { name }),
    ]);
    return { ok: true, teamId: teamRef.id };
  },
);

export const updateTeam = onCall<{ organizationId: string; teamId: string; patch: { name?: string; description?: string; color?: string; icon?: string } }>(
  async (request) => {
    const uid = assertVerified(request);
    const { organizationId, teamId, patch } = request.data ?? ({} as any);
    if (!organizationId || !teamId || !patch) throw new HttpsError('invalid-argument', 'organizationId, teamId and patch are required.');

    const actor = await assertTeamManage(uid, organizationId, teamId);
    const team = await getTeamOrThrow(organizationId, teamId);

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (patch.name !== undefined) {
      const name = trimmed(patch.name, 40);
      if (!name) throw new HttpsError('invalid-argument', 'Team name cannot be empty.');
      const dup = await db.collection('teams')
        .where('organizationId', '==', organizationId)
        .where('name_lower', '==', name.toLowerCase())
        .get();
      if (dup.docs.some((d) => d.id !== teamId)) throw new HttpsError('already-exists', 'A team with that name already exists.');
      update.name = name;
      update.name_lower = name.toLowerCase();
    }
    if (patch.description !== undefined) update.description = trimmed(patch.description, 200);
    if (patch.color !== undefined) update.color = trimmed(patch.color, 12);
    if (patch.icon !== undefined) update.icon = trimmed(patch.icon, 24);

    await team.ref.update(update);
    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.updated', { teamId, keys: Object.keys(patch) }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.updated', { keys: Object.keys(patch) }),
    ]);
    return { ok: true };
  },
);

export const archiveTeam = onCall<{ organizationId: string; teamId: string; archived: boolean }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId, archived } = request.data ?? ({} as any);
  if (!organizationId || !teamId || typeof archived !== 'boolean') {
    throw new HttpsError('invalid-argument', 'organizationId, teamId and archived are required.');
  }
  const actor = await assertOrgPermission(uid, organizationId, 'teams.manage');
  const team = await getTeamOrThrow(organizationId, teamId);

  await team.ref.update({ status: archived ? 'archived' : 'active', updatedAt: FieldValue.serverTimestamp() });
  const eventType = archived ? 'team.archived' : 'team.unarchived';
  await Promise.allSettled([
    writeAudit(organizationId, uid, eventType, { teamId, name: team.data.name }, { actorEmail: actor.email, actorName: actor.name }),
    logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', eventType, {}),
  ]);
  return { ok: true };
});

export const deleteTeam = onCall<{ organizationId: string; teamId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId } = request.data ?? ({} as any);
  if (!organizationId || !teamId) throw new HttpsError('invalid-argument', 'organizationId and teamId are required.');

  const actor = await assertOrgPermission(uid, organizationId, 'teams.manage');
  const team = await getTeamOrThrow(organizationId, teamId);

  // Remove the team + memberships + permissions + settings. The activity feed
  // is retained (history), as are audit logs.
  const members = await db.collection('team_members').where('teamId', '==', teamId).get();
  let batch = db.batch();
  let n = 0;
  for (const m of members.docs) {
    batch.delete(m.ref);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  batch.delete(db.doc(`team_permissions/${teamId}`));
  batch.delete(db.doc(`team_settings/${teamId}`));
  batch.delete(team.ref);
  await batch.commit();

  await Promise.allSettled([
    writeAudit(organizationId, uid, 'team.deleted', { teamId, name: team.data.name, members: members.size }, { actorEmail: actor.email, actorName: actor.name }),
    logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.deleted', { name: team.data.name }),
  ]);
  return { ok: true };
});

export const duplicateTeam = onCall<{ organizationId: string; teamId: string; name?: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId } = request.data ?? ({} as any);
  if (!organizationId || !teamId) throw new HttpsError('invalid-argument', 'organizationId and teamId are required.');

  const actor = await assertOrgPermission(uid, organizationId, 'teams.manage');
  const source = await getTeamOrThrow(organizationId, teamId);
  const perms = await db.doc(`team_permissions/${teamId}`).get();
  const settings = await db.doc(`team_settings/${teamId}`).get();

  const name = trimmed(request.data?.name, 40) || `${source.data.name} (copy)`;
  const dup = await db.collection('teams')
    .where('organizationId', '==', organizationId)
    .where('name_lower', '==', name.toLowerCase())
    .get();
  if (!dup.empty) throw new HttpsError('already-exists', 'A team with that name already exists.');

  const membership = await readMembership(uid, organizationId);
  const teamRef = db.collection('teams').doc();
  const batch = db.batch();
  batch.set(teamRef, {
    ...source.data,
    name,
    name_lower: name.toLowerCase(),
    managerId: uid,        // the duplicator manages the copy; members are NOT copied
    status: 'active',
    memberCount: 1,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`team_members/${memberDocId(teamRef.id, uid)}`), {
    teamId: teamRef.id, organizationId, userId: uid,
    email: membership?.email ?? '', name: membership?.name ?? '',
    teamRole: 'manager', addedBy: uid, addedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`team_permissions/${teamRef.id}`), {
    teamId: teamRef.id, organizationId,
    grants: perms.exists ? (perms.data()!.grants ?? DEFAULT_TEAM_GRANTS) : DEFAULT_TEAM_GRANTS,
    customGrants: perms.exists ? (perms.data()!.customGrants ?? []) : [],
    updatedBy: uid, updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`team_settings/${teamRef.id}`), {
    ...(settings.exists ? settings.data()! : {}),
    teamId: teamRef.id, organizationId, updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  await Promise.allSettled([
    writeAudit(organizationId, uid, 'team.duplicated', { fromTeamId: teamId, teamId: teamRef.id, name }, { actorEmail: actor.email, actorName: actor.name }),
    logActivity(teamRef.id, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.duplicated', { from: source.data.name }),
  ]);
  return { ok: true, teamId: teamRef.id };
});

export const transferTeamManager = onCall<{ organizationId: string; teamId: string; toUserId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId, toUserId } = request.data ?? ({} as any);
  if (!organizationId || !teamId || !toUserId) throw new HttpsError('invalid-argument', 'organizationId, teamId and toUserId are required.');

  const actor = await assertTeamManage(uid, organizationId, teamId);
  const team = await getTeamOrThrow(organizationId, teamId);
  if (team.data.managerId === toUserId) return { ok: true, unchanged: true };

  const targetOrg = await readMembership(toUserId, organizationId);
  if (!targetOrg) throw new HttpsError('failed-precondition', 'The new manager must be a member of this organization.');

  const newMgrRef = db.doc(`team_members/${memberDocId(teamId, toUserId)}`);
  const oldMgrRef = db.doc(`team_members/${memberDocId(teamId, team.data.managerId)}`);
  const newMgrSnap = await newMgrRef.get();

  const batch = db.batch();
  if (newMgrSnap.exists) {
    batch.update(newMgrRef, { teamRole: 'manager' });
  } else {
    batch.set(newMgrRef, {
      teamId, organizationId, userId: toUserId,
      email: targetOrg.email ?? '', name: targetOrg.name ?? '',
      teamRole: 'manager', addedBy: uid, addedAt: FieldValue.serverTimestamp(),
    });
    batch.update(team.ref, { memberCount: FieldValue.increment(1) });
  }
  const oldSnap = await oldMgrRef.get();
  if (oldSnap.exists) batch.update(oldMgrRef, { teamRole: 'member' });
  batch.update(team.ref, { managerId: toUserId, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();

  await Promise.allSettled([
    writeAudit(organizationId, uid, 'team.managerTransferred', { teamId, toUserId }, { actorEmail: actor.email, actorName: actor.name }),
    logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.managerTransferred', { toUserId }),
  ]);
  return { ok: true };
});

/* ───────────────────────── membership (bulk-first) ───────────────────────── */

function cleanUserIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && x.length > 0))].slice(0, 100);
}

export const addTeamMembers = onCall<{ organizationId: string; teamId: string; userIds: string[]; teamRole?: TeamRole }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId } = request.data ?? ({} as any);
  const userIds = cleanUserIds(request.data?.userIds);
  const teamRole: TeamRole = TEAM_ROLES.includes(request.data?.teamRole as TeamRole) ? (request.data!.teamRole as TeamRole) : 'member';
  if (!organizationId || !teamId || userIds.length === 0) {
    throw new HttpsError('invalid-argument', 'organizationId, teamId and userIds are required.');
  }
  if (teamRole === 'manager') throw new HttpsError('invalid-argument', 'Use transferTeamManager to assign the manager.');

  const actor = await assertTeamManage(uid, organizationId, teamId);
  const team = await getTeamOrThrow(organizationId, teamId);
  if (team.data.status !== 'active') throw new HttpsError('failed-precondition', 'This team is archived.');

  const added: string[] = [];
  const batch = db.batch();
  for (const userId of userIds) {
    const orgMembership = await readMembership(userId, organizationId);
    if (!orgMembership) continue; // silently skip non-members (bulk-tolerant)
    const ref = db.doc(`team_members/${memberDocId(teamId, userId)}`);
    if ((await ref.get()).exists) continue;
    batch.set(ref, {
      teamId, organizationId, userId,
      email: orgMembership.email ?? '', name: orgMembership.name ?? '',
      teamRole, addedBy: uid, addedAt: FieldValue.serverTimestamp(),
    });
    added.push(userId);
  }
  if (added.length > 0) {
    batch.update(team.ref, { memberCount: FieldValue.increment(added.length), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.memberAdded', { teamId, userIds: added, teamRole }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.memberAdded', { count: added.length }),
    ]);
  }
  return { ok: true, added: added.length, skipped: userIds.length - added.length };
});

export const removeTeamMembers = onCall<{ organizationId: string; teamId: string; userIds: string[] }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId } = request.data ?? ({} as any);
  const userIds = cleanUserIds(request.data?.userIds);
  if (!organizationId || !teamId || userIds.length === 0) {
    throw new HttpsError('invalid-argument', 'organizationId, teamId and userIds are required.');
  }
  const actor = await assertTeamManage(uid, organizationId, teamId);
  const team = await getTeamOrThrow(organizationId, teamId);
  if (userIds.includes(team.data.managerId)) {
    throw new HttpsError('failed-precondition', 'Transfer team management before removing the manager.');
  }

  const removed: string[] = [];
  const batch = db.batch();
  for (const userId of userIds) {
    const ref = db.doc(`team_members/${memberDocId(teamId, userId)}`);
    if (!(await ref.get()).exists) continue;
    batch.delete(ref);
    removed.push(userId);
  }
  if (removed.length > 0) {
    batch.update(team.ref, { memberCount: FieldValue.increment(-removed.length), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.memberRemoved', { teamId, userIds: removed }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.memberRemoved', { count: removed.length }),
    ]);
  }
  return { ok: true, removed: removed.length };
});

export const setTeamMemberRole = onCall<{ organizationId: string; teamId: string; userIds: string[]; teamRole: TeamRole }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId, teamRole } = request.data ?? ({} as any);
  const userIds = cleanUserIds(request.data?.userIds);
  if (!organizationId || !teamId || userIds.length === 0 || !TEAM_ROLES.includes(teamRole)) {
    throw new HttpsError('invalid-argument', 'organizationId, teamId, userIds and a valid teamRole are required.');
  }
  if (teamRole === 'manager') throw new HttpsError('invalid-argument', 'Use transferTeamManager to assign the manager.');

  const actor = await assertTeamManage(uid, organizationId, teamId);
  const team = await getTeamOrThrow(organizationId, teamId);
  if (userIds.includes(team.data.managerId)) {
    throw new HttpsError('failed-precondition', 'The team manager\'s role changes via transfer, not here.');
  }

  const changed: string[] = [];
  const batch = db.batch();
  for (const userId of userIds) {
    const ref = db.doc(`team_members/${memberDocId(teamId, userId)}`);
    if (!(await ref.get()).exists) continue;
    batch.update(ref, { teamRole });
    changed.push(userId);
  }
  if (changed.length > 0) {
    await batch.commit();
    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.memberRoleChanged', { teamId, userIds: changed, teamRole }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.memberRoleChanged', { count: changed.length, teamRole }),
    ]);
  }
  return { ok: true, changed: changed.length };
});

export const moveTeamMembers = onCall<{ organizationId: string; fromTeamId: string; toTeamId: string; userIds: string[] }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, fromTeamId, toTeamId } = request.data ?? ({} as any);
  const userIds = cleanUserIds(request.data?.userIds);
  if (!organizationId || !fromTeamId || !toTeamId || fromTeamId === toTeamId || userIds.length === 0) {
    throw new HttpsError('invalid-argument', 'organizationId, distinct fromTeamId/toTeamId and userIds are required.');
  }

  // Moving needs manage rights on BOTH teams (org teams.manage covers both).
  const actor = await assertTeamManage(uid, organizationId, fromTeamId);
  await assertTeamManage(uid, organizationId, toTeamId);
  const from = await getTeamOrThrow(organizationId, fromTeamId);
  const to = await getTeamOrThrow(organizationId, toTeamId);
  if (to.data.status !== 'active') throw new HttpsError('failed-precondition', 'The destination team is archived.');
  if (userIds.includes(from.data.managerId)) {
    throw new HttpsError('failed-precondition', 'Transfer team management before moving the manager.');
  }

  let moved = 0;
  const batch = db.batch();
  for (const userId of userIds) {
    const fromRef = db.doc(`team_members/${memberDocId(fromTeamId, userId)}`);
    const fromSnap = await fromRef.get();
    if (!fromSnap.exists) continue;
    const toRef = db.doc(`team_members/${memberDocId(toTeamId, userId)}`);
    if (!(await toRef.get()).exists) {
      batch.set(toRef, { ...fromSnap.data()!, teamId: toTeamId, teamRole: 'member', addedBy: uid, addedAt: FieldValue.serverTimestamp() });
      batch.update(to.ref, { memberCount: FieldValue.increment(1) });
    }
    batch.delete(fromRef);
    batch.update(from.ref, { memberCount: FieldValue.increment(-1) });
    moved += 1;
  }
  if (moved > 0) {
    await batch.commit();
    await Promise.allSettled([
      writeAudit(organizationId, uid, 'team.memberRemoved', { teamId: fromTeamId, movedTo: toTeamId, count: moved }, { actorEmail: actor.email, actorName: actor.name }),
      writeAudit(organizationId, uid, 'team.memberAdded', { teamId: toTeamId, movedFrom: fromTeamId, count: moved }, { actorEmail: actor.email, actorName: actor.name }),
      logActivity(fromTeamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.memberRemoved', { movedTo: to.data.name, count: moved }),
      logActivity(toTeamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.memberAdded', { movedFrom: from.data.name, count: moved }),
    ]);
  }
  return { ok: true, moved };
});

/* ───────────────────────── permissions ───────────────────────── */

export const setTeamPermissions = onCall<{ organizationId: string; teamId: string; grants: Record<string, boolean>; customGrants?: string[] }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId, grants } = request.data ?? ({} as any);
  if (!organizationId || !teamId || !grants || typeof grants !== 'object') {
    throw new HttpsError('invalid-argument', 'organizationId, teamId and grants are required.');
  }

  // Resource grants shape what teams can reach — org admin+ only.
  const membership = await readMembership(uid, organizationId);
  if (!membership || membership.status === 'suspended' || roleRank(membership.role as MemberRole) < roleRank('admin')) {
    throw new HttpsError('permission-denied', 'Only organization admins and owners can change team permissions.');
  }
  const actor = { role: membership.role as MemberRole, email: membership.email, name: membership.name };
  await getTeamOrThrow(organizationId, teamId);

  const cleanGrants: Record<string, boolean> = {};
  for (const key of RESOURCE_KEYS) {
    if (typeof grants[key] === 'boolean') cleanGrants[key] = grants[key];
  }

  const requestedCustom = Array.isArray(request.data?.customGrants)
    ? [...new Set(request.data!.customGrants!.filter((x) => typeof x === 'string'))].slice(0, 50)
    : [];
  const validCustom: string[] = [];
  for (const id of requestedCustom) {
    const snap = await db.doc(`organizations/${organizationId}/customPermissions/${id}`).get();
    if (snap.exists) validCustom.push(id);
  }

  await db.doc(`team_permissions/${teamId}`).set({
    teamId, organizationId,
    grants: cleanGrants,
    customGrants: validCustom,
    updatedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await Promise.allSettled([
    writeAudit(organizationId, uid, 'team.permissionsChanged', { teamId, granted: Object.keys(cleanGrants).filter((k) => cleanGrants[k]), customGrants: validCustom }, { actorEmail: actor.email, actorName: actor.name }),
    logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.permissionsChanged', {}),
  ]);
  return { ok: true };
});

export const createCustomPermission = onCall<{ organizationId: string; name: string; description?: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId } = request.data ?? ({} as any);
  const name = trimmed(request.data?.name, 60);
  if (!organizationId || !name) throw new HttpsError('invalid-argument', 'organizationId and name are required.');

  // Owner-only, per spec.
  const actor = await assertOrgPermission(uid, organizationId, 'org.transferOwnership');

  const existing = await db.collection(`organizations/${organizationId}/customPermissions`).get();
  if (existing.size >= 50) throw new HttpsError('resource-exhausted', 'Custom permission limit reached (50).');
  if (existing.docs.some((d) => (d.data().name as string)?.toLowerCase() === name.toLowerCase())) {
    throw new HttpsError('already-exists', 'A custom permission with that name already exists.');
  }

  const ref = await db.collection(`organizations/${organizationId}/customPermissions`).add({
    organizationId, name,
    description: trimmed(request.data?.description, 200),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(organizationId, uid, 'permission.customCreated', { permissionId: ref.id, name }, { actorEmail: actor.email, actorName: actor.name });
  return { ok: true, permissionId: ref.id };
});

export const deleteCustomPermission = onCall<{ organizationId: string; permissionId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, permissionId } = request.data ?? ({} as any);
  if (!organizationId || !permissionId) throw new HttpsError('invalid-argument', 'organizationId and permissionId are required.');

  const actor = await assertOrgPermission(uid, organizationId, 'org.transferOwnership');
  await db.doc(`organizations/${organizationId}/customPermissions/${permissionId}`).delete();

  // Strip the permission from every team that referenced it.
  const holders = await db.collection('team_permissions')
    .where('organizationId', '==', organizationId)
    .where('customGrants', 'array-contains', permissionId)
    .get();
  let batch = db.batch();
  let n = 0;
  for (const doc of holders.docs) {
    batch.update(doc.ref, { customGrants: FieldValue.arrayRemove(permissionId) });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n > 0) await batch.commit();

  await writeAudit(organizationId, uid, 'permission.customDeleted', { permissionId, teamsAffected: holders.size }, { actorEmail: actor.email, actorName: actor.name });
  return { ok: true };
});

/* ───────────────────────── team settings ───────────────────────── */

const PROVIDER_KEYS = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'openrouter', 'opensource'] as const;

interface TeamSettingsPatch {
  defaultPriority?: string;
  defaultModel?: string;
  allowedProviders?: Record<string, boolean>;
  piiPolicy?: string;
  secretPolicy?: string;
  monthlyBudget?: number;
  monthlyRequestLimit?: number;
  notifyUsageThreshold?: boolean;
  notifyMemberChanges?: boolean;
  notes?: string;
}

export const updateTeamSettings = onCall<{ organizationId: string; teamId: string; patch: TeamSettingsPatch }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId, teamId, patch } = request.data ?? ({} as any);
  if (!organizationId || !teamId || !patch) throw new HttpsError('invalid-argument', 'organizationId, teamId and patch are required.');

  const actor = await assertTeamManage(uid, organizationId, teamId);
  await getTeamOrThrow(organizationId, teamId);

  const update: Record<string, unknown> = { teamId, organizationId, updatedAt: FieldValue.serverTimestamp() };
  if (['cost', 'speed', 'quality', 'balanced'].includes(patch.defaultPriority as string)) update.defaultPriority = patch.defaultPriority;
  if (typeof patch.defaultModel === 'string') update.defaultModel = patch.defaultModel.slice(0, 60);
  if (patch.allowedProviders && typeof patch.allowedProviders === 'object') {
    const clean: Record<string, boolean> = {};
    for (const k of PROVIDER_KEYS) if (typeof patch.allowedProviders[k] === 'boolean') clean[k] = patch.allowedProviders[k];
    update.allowedProviders = clean;
  }
  if (['block', 'sanitize', 'warn', 'allow'].includes(patch.piiPolicy as string)) update.piiPolicy = patch.piiPolicy;
  if (['block', 'warn', 'allow'].includes(patch.secretPolicy as string)) update.secretPolicy = patch.secretPolicy;
  if (typeof patch.monthlyBudget === 'number' && patch.monthlyBudget >= 0) update.monthlyBudget = Math.min(patch.monthlyBudget, 1_000_000);
  if (typeof patch.monthlyRequestLimit === 'number' && patch.monthlyRequestLimit >= 0) update.monthlyRequestLimit = Math.min(Math.floor(patch.monthlyRequestLimit), 10_000_000);
  if (typeof patch.notifyUsageThreshold === 'boolean') update.notifyUsageThreshold = patch.notifyUsageThreshold;
  if (typeof patch.notifyMemberChanges === 'boolean') update.notifyMemberChanges = patch.notifyMemberChanges;
  if (typeof patch.notes === 'string') update.notes = patch.notes.slice(0, 500);

  await db.doc(`team_settings/${teamId}`).set(update, { merge: true });
  await logActivity(teamId, organizationId, uid, actor.name ?? actor.email ?? 'Someone', 'team.updated', { settings: true });
  return { ok: true };
});

/* ───────────────────────── org API key (Settings → API) ───────────────────────── */

export const rotateApiKey = onCall<{ organizationId: string }>(async (request) => {
  const uid = assertVerified(request);
  const { organizationId } = request.data ?? ({} as any);
  if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId is required.');

  const actor = await assertOrgPermission(uid, organizationId, 'org.transferOwnership'); // owner only
  const orgSnap = await db.doc(`organizations/${organizationId}`).get();
  if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
  if (orgSnap.data()!.plan !== 'enterprise') {
    throw new HttpsError('failed-precondition', 'API access is an Enterprise feature. Upgrade to generate keys.');
  }

  const secret = randomBytes(24).toString('hex');
  const key = `inf_live_${secret}`;
  const prefix = key.slice(0, 16);
  const hash = createHash('sha256').update(key).digest('hex');

  await orgSnap.ref.update({
    apiKey: { prefix, hash, rotatedAt: FieldValue.serverTimestamp(), rotatedBy: uid },
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAudit(organizationId, uid, 'organization.apiKeyRotated', { prefix }, { actorEmail: actor.email, actorName: actor.name });

  // The full key is returned exactly once — only the hash is stored.
  return { ok: true, apiKey: key, prefix };
});
