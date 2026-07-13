// ============================================
// FIRESTORE DATA LAYER (client reads + safe writes)
// Server-authoritative mutations (usage increment, plan changes) live in
// Cloud Functions — never trust the client for limits or billing.
// ============================================

import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, orderBy, limit as qlimit, getDocs,
  serverTimestamp, Timestamp, writeBatch, runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { getPlan } from './plans';
import { AI_MODELS } from './models';
import type {
  User, Organization, PlanType, ChatSession, ChatMessage, ChatSummary,
  UsageRecord, OrgMember, OrgMembership, AuditLog, AuditEventType, MemberRole,
  OrganizationSettings, OrganizationNotifications, OrganizationBranding,
  MemberStatus, Invitation, InvitationStatus, AppNotification, NotificationType, Invoice,
  Team, TeamMember, TeamRole, TeamPermissions, TeamActivity, TeamSettings, CustomPermission,
} from '../types';
import type { FirebaseUser } from './firebase';

const toDate = (v: any): Date => (v instanceof Timestamp ? v.toDate() : v ? new Date(v) : new Date());
const toOptionalDate = (v: any): Date | undefined => (v == null ? undefined : toDate(v));

function nextMonthlyReset(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/** Default settings applied on org creation. Everything is user-editable later. */
const DEFAULT_SETTINGS: OrganizationSettings = {
  defaultModel: 'gpt-4o-mini',
  defaultPriority: 'balanced',
  enableOptimization: true,
  enableRouting: true,
  enableGovernance: true,
  piiPolicy: 'sanitize',
  secretPolicy: 'block',
};

const DEFAULT_NOTIFICATIONS: OrganizationNotifications = {
  budgetAlerts: true,
  securityAlerts: true,
  weeklyReports: false,
  usageAlertThresholds: [50, 80, 90, 95, 100],
};

/* ───────────────────────── user + organization provisioning ───────────────────────── */

function mapUser(uid: string, d: any): User {
  return {
    id: uid,
    email: d.email ?? '',
    name: d.name ?? d.email?.split('@')[0] ?? 'User',
    photoURL: d.photoURL ?? undefined,
    emailVerified: !!d.emailVerified,
    onboarded: !!d.onboarded,
    // Prefer the new field, fall back to the legacy field so Iteration-1 docs still load.
    activeOrganizationId: d.activeOrganizationId ?? d.organizationId ?? '',
    isAdmin: !!d.isAdmin,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    lastLoginAt: toDate(d.lastLoginAt),
  };
}

function mapOrg(id: string, d: any): Organization {
  return {
    id,
    name: d.name,
    ownerId: d.ownerId,
    logo: d.logo ? { ...d.logo, updatedAt: toDate(d.logo.updatedAt) } : undefined,
    timezone: d.timezone,
    country: d.country,
    branding: (d.branding as OrganizationBranding) ?? undefined,
    plan: (d.plan ?? 'free') as PlanType,
    planLimits: d.planLimits ?? { requestsPerMonth: 100, usersLimit: 1, teamsLimit: 1 },
    usage: d.usage ?? { requestsUsed: 0, totalSpend: 0, totalSavings: 0, tokensProcessed: 0 },
    subscriptionStatus: d.subscriptionStatus ?? 'none',
    razorpayCustomerId: d.razorpayCustomerId,
    razorpaySubscriptionId: d.razorpaySubscriptionId,
    monthlyResetDate: toDate(d.monthlyResetDate),
    trialEndsAt: toOptionalDate(d.trialEndsAt),
    apiKey: d.apiKey ? { prefix: d.apiKey.prefix ?? '', rotatedAt: toOptionalDate(d.apiKey.rotatedAt) } : undefined,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(d.notifications ?? {}) },
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

function mapMembership(orgId: string, d: any): OrgMembership {
  return {
    organizationId: orgId,
    organizationName: d.organizationName ?? '',
    userId: d.userId,
    email: d.email ?? '',
    name: d.name ?? '',
    role: (d.role ?? 'member') as MemberRole,
    joinedAt: toDate(d.joinedAt),
    lastAccessedAt: toOptionalDate(d.lastAccessedAt),
  };
}

/**
 * Read the user's profile, creating it (+ a personal org) on first login.
 * New users always start on the FREE plan with free limits — the only place
 * that can change is the Razorpay webhook (server-side).
 *
 * The provisioning path runs inside a Firestore transaction so opening the app
 * in two tabs during first-ever login can't produce duplicate user/org/member
 * docs. It's also self-healing: if the user doc points at a deleted org, we
 * re-provision a fresh one under a new id (client rules only allow orgs the
 * signed-in user owns, so we never clobber someone else's data).
 *
 * Billing (plan/limits/usage/subscription/razorpay/monthlyResetDate) lives on
 * the Organization document as of Iteration 2 — the User doc no longer carries
 * any of those fields.
 *
 * `monthlyResetDate` uses a client-computed timestamp — the scheduled
 * `monthlyReset` Cloud Function is the durable source of truth for rollovers,
 * so drift here is corrected within 24h.
 */
export async function ensureUserProfile(fb: FirebaseUser): Promise<{ user: User; organization: Organization; memberships: OrgMembership[] }> {
  const userRef = doc(db, 'users', fb.uid);

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists()) {
      // First-ever login: create user + org + owner member + membership mirror atomically.
      const orgId = `org_${fb.uid}`;
      const orgRef = doc(db, 'organizations', orgId);
      const memberRef = doc(db, 'organizations', orgId, 'members', fb.uid);
      const membershipRef = doc(db, 'users', fb.uid, 'memberships', orgId);
      const free = getPlan('free');
      const email = (fb.email ?? '').trim();
      const emailLower = email.toLowerCase();
      const displayName = fb.displayName || email.split('@')[0] || 'User';
      const orgName = `${displayName}'s Organization`;

      tx.set(orgRef, {
        name: orgName,
        ownerId: fb.uid,
        plan: 'free',
        planLimits: { requestsPerMonth: free.requestsLimit, usersLimit: free.usersLimit, teamsLimit: free.teamsLimit },
        usage: { requestsUsed: 0, totalSpend: 0, totalSavings: 0, tokensProcessed: 0 },
        subscriptionStatus: 'none',
        monthlyResetDate: Timestamp.fromDate(nextMonthlyReset()),
        settings: DEFAULT_SETTINGS,
        notifications: DEFAULT_NOTIFICATIONS,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      tx.set(memberRef, {
        userId: fb.uid,
        email,
        email_lower: emailLower,
        name: displayName,
        role: 'owner',
        joinedAt: serverTimestamp(),
      });

      tx.set(membershipRef, {
        organizationId: orgId,
        organizationName: orgName,
        userId: fb.uid,
        email,
        name: displayName,
        role: 'owner',
        joinedAt: serverTimestamp(),
        lastAccessedAt: serverTimestamp(),
      });

      tx.set(userRef, {
        email,
        email_lower: emailLower,
        name: displayName,
        photoURL: fb.photoURL ?? null,
        emailVerified: fb.emailVerified,
        onboarded: false,
        activeOrganizationId: orgId,
        isAdmin: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      return;
    }

    // Returning user: touch lastLoginAt and sync the fields we're allowed to.
    const data = userSnap.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      lastLoginAt: serverTimestamp(),
      emailVerified: fb.emailVerified,
      updatedAt: serverTimestamp(),
    };
    if (fb.photoURL && data.photoURL !== fb.photoURL) patch.photoURL = fb.photoURL;
    if (!data.email_lower && typeof data.email === 'string') {
      patch.email_lower = (data.email as string).trim().toLowerCase();
    }
    // Iteration-1 → Iteration-2 backfill: promote legacy `organizationId` to
    // `activeOrganizationId` so the new context can find it.
    if (!data.activeOrganizationId && typeof data.organizationId === 'string') {
      patch.activeOrganizationId = data.organizationId;
    }
    tx.update(userRef, patch);
  });

  // Re-read post-transaction. If the user doc points at a non-existent org
  // (deleted / partial write from an older version), re-provision inline.
  const userSnap = await getDoc(userRef);
  const rawUser = userSnap.data();
  if (!rawUser) throw new Error('User profile disappeared after provisioning.');

  const activeOrgId: string =
    (rawUser.activeOrganizationId as string) ||
    (rawUser.organizationId as string) ||
    `org_${fb.uid}`;

  let orgSnap = await getDoc(doc(db, 'organizations', activeOrgId));
  if (!orgSnap.exists()) {
    await selfHealMissingOrg(fb, activeOrgId);
    orgSnap = await getDoc(doc(db, 'organizations', activeOrgId));
  }
  const rawOrg = orgSnap.data();
  if (!rawOrg) throw new Error('Organization could not be provisioned.');

  const user = mapUser(fb.uid, rawUser);
  const organization = mapOrg(activeOrgId, rawOrg);
  const memberships = await listMemberships(fb.uid);

  // Invariant: the ACTIVE org must have the user listed as a member. If not
  // (only possible if data was tampered with), refuse to load rather than
  // grant access.
  if (!memberships.some((m) => m.organizationId === activeOrgId)) {
    throw new Error('You are not a member of this organization.');
  }

  return { user, organization, memberships };
}

/**
 * Recreate a missing organization + owner member + membership mirror for a
 * returning user whose user doc still references a now-missing org. Runs at
 * FREE plan under the same rules that gate first-login provisioning.
 */
async function selfHealMissingOrg(fb: FirebaseUser, orgId: string): Promise<void> {
  const free = getPlan('free');
  const email = (fb.email ?? '').trim();
  const emailLower = email.toLowerCase();
  const displayName = fb.displayName || email.split('@')[0] || 'User';
  const orgName = `${displayName}'s Organization`;

  await setDoc(doc(db, 'organizations', orgId), {
    name: orgName,
    ownerId: fb.uid,
    plan: 'free',
    planLimits: { requestsPerMonth: free.requestsLimit, usersLimit: free.usersLimit, teamsLimit: free.teamsLimit },
    usage: { requestsUsed: 0, totalSpend: 0, totalSavings: 0, tokensProcessed: 0 },
    subscriptionStatus: 'none',
    monthlyResetDate: Timestamp.fromDate(nextMonthlyReset()),
    settings: DEFAULT_SETTINGS,
    notifications: DEFAULT_NOTIFICATIONS,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'organizations', orgId, 'members', fb.uid), {
    userId: fb.uid,
    email,
    email_lower: emailLower,
    name: displayName,
    role: 'owner',
    joinedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'users', fb.uid, 'memberships', orgId), {
    organizationId: orgId,
    organizationName: orgName,
    userId: fb.uid,
    email,
    name: displayName,
    role: 'owner',
    joinedAt: serverTimestamp(),
    lastAccessedAt: serverTimestamp(),
  });
}

export async function refreshUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? mapUser(uid, snap.data()) : null;
}

/* ───────────────────────── organizations + memberships ───────────────────────── */

/** Read one organization by id. Rules enforce that the caller is a member. */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId));
  return snap.exists() ? mapOrg(orgId, snap.data()) : null;
}

/**
 * List every organization the current user belongs to, newest-first. Reads
 * come from the mirror subcollection (`users/{uid}/memberships`) so this is a
 * single indexed query rather than a collection-group scan.
 */
export async function listMemberships(uid: string): Promise<OrgMembership[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'memberships'));
  return snap.docs
    .map((d) => mapMembership(d.id, d.data()))
    .sort((a, b) => {
      const la = a.lastAccessedAt?.getTime() ?? a.joinedAt.getTime();
      const lb = b.lastAccessedAt?.getTime() ?? b.joinedAt.getTime();
      return lb - la;
    });
}

/** Read a single membership doc — for the caller's own role within an org. */
export async function getMembership(uid: string, orgId: string): Promise<OrgMembership | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'memberships', orgId));
  return snap.exists() ? mapMembership(orgId, snap.data()) : null;
}

/**
 * Switch the user's active organization. Verifies membership first, then
 * updates `users/{uid}.activeOrganizationId` + the membership's
 * `lastAccessedAt`. Emits an `organization.switched` audit log.
 */
export async function switchActiveOrganization(uid: string, orgId: string): Promise<void> {
  const membershipRef = doc(db, 'users', uid, 'memberships', orgId);
  const membershipSnap = await getDoc(membershipRef);
  if (!membershipSnap.exists()) throw new Error('You are not a member of this organization.');

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    activeOrganizationId: orgId,
    updatedAt: serverTimestamp(),
  });
  batch.update(membershipRef, { lastAccessedAt: serverTimestamp() });
  await batch.commit();

  await writeAuditLog(orgId, uid, 'organization.switched', { orgId });
}

/**
 * Persist a partial patch to `organizations/{orgId}.settings.*`. Rules enforce
 * that the caller has settings.update permission. Emits an audit log.
 */
export async function updateOrgSettings(orgId: string, uid: string, settings: Partial<OrganizationSettings>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(settings)) patch[`settings.${k}`] = v;
  await updateDoc(doc(db, 'organizations', orgId), patch);
  await writeAuditLog(orgId, uid, 'organization.settings.updated', { keys: Object.keys(settings) });
}

/** Rename an organization + update the name mirror on every existing membership doc. */
export async function updateOrgName(orgId: string, uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Organization name cannot be empty.');
  await updateDoc(doc(db, 'organizations', orgId), { name: trimmed, updatedAt: serverTimestamp() });
  // Refresh the current caller's membership mirror. Other members' mirrors are
  // written server-side by the org-updated audit trigger (functions layer).
  await updateDoc(doc(db, 'users', uid, 'memberships', orgId), { organizationName: trimmed });
  await writeAuditLog(orgId, uid, 'organization.updated', { name: trimmed });
}

export async function updateOrgProfile(orgId: string, uid: string, patch: { timezone?: string; country?: string }): Promise<void> {
  const now = serverTimestamp();
  const update: Record<string, unknown> = { updatedAt: now };
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.country !== undefined) update.country = patch.country;
  await updateDoc(doc(db, 'organizations', orgId), update);
  await writeAuditLog(orgId, uid, 'organization.updated', patch);
}

export async function updateOrgBranding(orgId: string, uid: string, branding: OrganizationBranding): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), { branding, updatedAt: serverTimestamp() });
  await writeAuditLog(orgId, uid, 'organization.branding.updated', { ...branding });
}

export async function updateOrgNotifications(orgId: string, uid: string, notifications: Partial<OrganizationNotifications>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [k, v] of Object.entries(notifications)) patch[`notifications.${k}`] = v;
  await updateDoc(doc(db, 'organizations', orgId), patch);
  await writeAuditLog(orgId, uid, 'organization.notifications.updated', { keys: Object.keys(notifications) });
}

/**
 * Best-effort client audit-log writer. Server-side callables use the
 * `writeAudit` helper in functions/src/util.ts (Admin SDK bypasses rules); this
 * one is for client-driven events (settings changes, switch). Rules on the
 * `auditLogs` collection restrict client writes to the caller's own uid + org.
 */
export async function writeAuditLog(orgId: string, actorId: string, eventType: AuditEventType, details: Record<string, unknown> = {}): Promise<void> {
  const email = typeof details.actorEmail === 'string' ? details.actorEmail : undefined;
  const payload = {
    organizationId: orgId,
    actorId,
    actorEmail: email,
    eventType,
    action: eventType, // legacy field, kept in sync
    details,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(collection(db, 'auditLogs')), payload).catch(() => {
    /* audit-log write failure must never break the primary action */
  });
}

/** Mark the post-signup plan-selection step complete (plan itself is set by the webhook for paid tiers). */
export async function completeOnboarding(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { onboarded: true, updatedAt: serverTimestamp() });
}


/* ───────────────────────── usage / request history ───────────────────────── */

export async function getUsageRecords(orgId: string, max = 100): Promise<UsageRecord[]> {
  const q = query(
    collection(db, 'usage'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id,
      userId: d.userId, organizationId: d.organizationId,
      teamId: d.teamId ?? null, provider: d.provider,
      selectedModel: d.selectedModel, routedModel: d.routedModel,
      originalTokens: d.originalTokens ?? 0, optimizedTokens: d.optimizedTokens ?? 0,
      cost: d.cost ?? 0, savings: d.savings ?? 0, latencyMs: d.latencyMs ?? 0,
      createdAt: toDate(d.createdAt),
    };
  });
}

/* ───────────────────────── chat storage (chats + messages) ───────────────────────── */

function chatTitleFrom(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 47) + '…' : t || 'New chat';
}

export async function listChats(uid: string, max = 50): Promise<ChatSummary[]> {
  const q = query(
    collection(db, 'chats'),
    where('userId', '==', uid),
    orderBy('updatedAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id, userId: d.userId, organizationId: d.organizationId,
      title: d.title ?? 'Chat', model: d.model,
      messageCount: d.messageCount ?? 0, totalCost: d.totalCost ?? 0,
      cumulativeSavings: d.cumulativeSavings ?? 0,
      createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt),
    };
  });
}

/** Rebuild a full ChatSession (doc + messages) so it can be continued. */
export async function getChatSession(chatId: string): Promise<ChatSession | null> {
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();

  const msgsSnap = await getDocs(query(collection(ref, 'messages'), orderBy('createdAt', 'asc')));
  const messages: ChatMessage[] = msgsSnap.docs.map((m) => {
    const x = m.data();
    return {
      id: m.id, role: x.role, content: x.content,
      inputTokens: x.inputTokens ?? 0, outputTokens: x.outputTokens ?? 0,
      cost: x.cost ?? 0, baselineCost: x.baselineCost ?? 0,
      isError: x.isError ?? false, createdAt: toDate(x.createdAt),
    };
  });

  const origin = d.originResult;
  const model = AI_MODELS.find((mm) => mm.id === d.model) ?? origin.selectedModel;
  const baseline = AI_MODELS.find((mm) => mm.id === d.baselineModel) ?? origin.requestedModel ?? model;
  const requested = d.requestedModel ? AI_MODELS.find((mm) => mm.id === d.requestedModel) : undefined;

  return {
    id: chatId, model, baselineModel: baseline, requestedModel: requested,
    originResult: origin, messages,
    totalInputTokens: d.totalInputTokens ?? 0, totalOutputTokens: d.totalOutputTokens ?? 0,
    totalCost: d.totalCost ?? 0, cumulativeSavings: d.cumulativeSavings ?? 0,
    createdAt: toDate(d.createdAt),
  };
}

/** Persist a freshly created session (chat doc + its first message). */
export async function saveChatSession(uid: string, orgId: string, session: ChatSession): Promise<void> {
  const batch = writeBatch(db);
  const chatRef = doc(db, 'chats', session.id);
  batch.set(chatRef, {
    userId: uid,
    organizationId: orgId,
    title: chatTitleFrom(session.messages[0]?.content ?? 'New chat'),
    model: session.model.id,
    baselineModel: session.baselineModel.id,
    requestedModel: session.requestedModel?.id ?? null,
    originResult: JSON.parse(JSON.stringify(session.originResult)),
    messageCount: session.messages.length,
    totalInputTokens: session.totalInputTokens,
    totalOutputTokens: session.totalOutputTokens,
    totalCost: session.totalCost,
    cumulativeSavings: session.cumulativeSavings,
    createdAt: Timestamp.fromDate(session.createdAt),
    updatedAt: serverTimestamp(),
  });
  session.messages.forEach((m) => batch.set(doc(collection(chatRef, 'messages'), m.id), serializeMessage(m)));
  await batch.commit();
}

export async function appendChatMessage(chatId: string, message: ChatMessage, totals: {
  totalInputTokens: number; totalOutputTokens: number; totalCost: number; cumulativeSavings: number; messageCount: number;
}): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  const batch = writeBatch(db);
  batch.set(doc(collection(chatRef, 'messages'), message.id), serializeMessage(message));
  batch.update(chatRef, { ...totals, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  await updateDoc(doc(db, 'chats', chatId), { title: title.trim() || 'Untitled', updatedAt: serverTimestamp() });
}

export async function deleteChat(chatId: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  const msgs = await getDocs(collection(chatRef, 'messages'));
  const batch = writeBatch(db);
  msgs.docs.forEach((m) => batch.delete(m.ref));
  batch.delete(chatRef);
  await batch.commit();
}

function serializeMessage(m: ChatMessage) {
  return {
    role: m.role, content: m.content,
    inputTokens: m.inputTokens, outputTokens: m.outputTokens,
    cost: m.cost, baselineCost: m.baselineCost,
    isError: m.isError ?? false,
    createdAt: Timestamp.fromDate(m.createdAt),
  };
}

/* ───────────────────────── workspace teams ───────────────────────── */

function mapTeam(id: string, d: any): Team {
  return {
    id,
    organizationId: d.organizationId,
    name: d.name ?? 'Team',
    description: d.description ?? '',
    color: d.color ?? '#4DEEEA',
    icon: d.icon ?? 'users',
    managerId: d.managerId ?? '',
    status: (d.status ?? 'active') as Team['status'],
    memberCount: d.memberCount ?? 0,
    createdBy: d.createdBy ?? '',
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

/** Org-wide team list — OWNERS/ADMINS ONLY (security rules reject it for scoped users). */
export async function listTeams(orgId: string): Promise<Team[]> {
  const snap = await getDocs(query(collection(db, 'teams'), where('organizationId', '==', orgId)));
  return snap.docs
    .map((dd) => mapTeam(dd.id, dd.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scoped team fetch: members/managers resolve their visible teams from their
 * own membership rows, then read each team by id (per-doc reads pass the
 * `inTeam` rule; a broad list query would not).
 */
export async function getTeamsByIds(ids: string[]): Promise<Team[]> {
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'teams', id)).catch(() => null)));
  return snaps
    .filter((s): s is NonNullable<typeof s> => !!s && s.exists())
    .map((s) => mapTeam(s.id, s.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const snap = await getDocs(query(collection(db, 'team_members'), where('teamId', '==', teamId)));
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id,
      teamId: d.teamId,
      organizationId: d.organizationId,
      userId: d.userId,
      email: d.email ?? '',
      name: d.name ?? d.email ?? '',
      teamRole: (d.teamRole ?? 'member') as TeamRole,
      addedBy: d.addedBy ?? '',
      addedAt: toDate(d.addedAt),
    };
  });
}

/** Every team-membership row for one user in one org (drives access scoping). */
export async function listMyTeamMemberships(orgId: string, uid: string): Promise<TeamMember[]> {
  const snap = await getDocs(query(
    collection(db, 'team_members'),
    where('organizationId', '==', orgId),
    where('userId', '==', uid),
  ));
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id, teamId: d.teamId, organizationId: d.organizationId, userId: d.userId,
      email: d.email ?? '', name: d.name ?? '',
      teamRole: (d.teamRole ?? 'member') as TeamRole,
      addedBy: d.addedBy ?? '', addedAt: toDate(d.addedAt),
    };
  });
}

function mapTeamPermissions(id: string, d: any): TeamPermissions {
  return {
    teamId: id,
    organizationId: d.organizationId,
    grants: d.grants ?? {},
    customGrants: d.customGrants ?? [],
    updatedBy: d.updatedBy,
    updatedAt: toOptionalDate(d.updatedAt),
  };
}

export async function getTeamPermissions(teamId: string): Promise<TeamPermissions | null> {
  const snap = await getDoc(doc(db, 'team_permissions', teamId));
  return snap.exists() ? mapTeamPermissions(snap.id, snap.data()) : null;
}

export async function listTeamPermissionsFor(teamIds: string[]): Promise<TeamPermissions[]> {
  const results = await Promise.all(teamIds.map((id) => getTeamPermissions(id).catch(() => null)));
  return results.filter((p): p is TeamPermissions => p !== null);
}

export async function getTeamSettings(teamId: string): Promise<TeamSettings | null> {
  const snap = await getDoc(doc(db, 'team_settings', teamId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    teamId,
    organizationId: d.organizationId,
    defaultPriority: d.defaultPriority,
    defaultModel: d.defaultModel,
    allowedProviders: d.allowedProviders,
    piiPolicy: d.piiPolicy,
    secretPolicy: d.secretPolicy,
    monthlyBudget: d.monthlyBudget,
    monthlyRequestLimit: d.monthlyRequestLimit,
    notifyUsageThreshold: d.notifyUsageThreshold,
    notifyMemberChanges: d.notifyMemberChanges,
    notes: d.notes,
    updatedAt: toOptionalDate(d.updatedAt),
  };
}

export async function listTeamActivity(opts: { teamId?: string; orgId?: string }, max = 30): Promise<TeamActivity[]> {
  const base = collection(db, 'team_activity');
  const q = opts.teamId
    ? query(base, where('teamId', '==', opts.teamId), orderBy('createdAt', 'desc'), qlimit(max))
    : query(base, where('organizationId', '==', opts.orgId ?? ''), orderBy('createdAt', 'desc'), qlimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id, teamId: d.teamId, organizationId: d.organizationId,
      actorId: d.actorId ?? '', actorName: d.actorName ?? 'Someone',
      eventType: d.eventType ?? 'team.updated', details: d.details ?? {},
      createdAt: toDate(d.createdAt),
    };
  });
}

export async function listCustomPermissions(orgId: string): Promise<CustomPermission[]> {
  const snap = await getDocs(collection(db, 'organizations', orgId, 'customPermissions'));
  return snap.docs
    .map((dd) => {
      const d = dd.data();
      return {
        id: dd.id, organizationId: d.organizationId ?? orgId,
        name: d.name ?? '', description: d.description ?? '',
        createdBy: d.createdBy ?? '', createdAt: toDate(d.createdAt),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ───────────────────────── org members + audit logs ───────────────────────── */

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const snap = await getDocs(collection(db, 'organizations', orgId, 'members'));
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      userId: d.userId,
      email: d.email,
      email_lower: d.email_lower,
      name: d.name,
      role: (d.role ?? 'member') as MemberRole,
      status: (d.status ?? 'active') as MemberStatus,
      joinedAt: toDate(d.joinedAt),
      lastActiveAt: toOptionalDate(d.lastActiveAt),
      invitedBy: d.invitedBy ?? undefined,
    };
  });
}

/* ───────────────────────── invitations ───────────────────────── */

function mapInvitation(id: string, d: any): Invitation {
  // A pending invite past its expiry renders as expired even before the
  // server sweeper flips the stored status.
  const expiresAt = toDate(d.expiresAt);
  const rawStatus = (d.status ?? 'pending') as InvitationStatus;
  const status: InvitationStatus =
    rawStatus === 'pending' && Date.now() >= expiresAt.getTime() ? 'expired' : rawStatus;
  return {
    id,
    organizationId: d.organizationId,
    organizationName: d.organizationName ?? 'Organization',
    email: d.email ?? d.email_lower ?? '',
    role: (d.role ?? 'member') as Invitation['role'],
    teamId: d.teamId ?? null,
    teamName: d.teamName ?? null,
    teamRole: d.teamRole ?? null,
    status,
    invitedBy: d.invitedBy ?? '',
    invitedByName: d.invitedByName ?? '',
    invitedByEmail: d.invitedByEmail ?? '',
    resendCount: d.resendCount ?? 0,
    createdAt: toDate(d.createdAt),
    expiresAt,
    lastSentAt: toOptionalDate(d.lastSentAt),
  };
}

/** Invitations sent by an organization (manager+ view). */
export async function listOrgInvitations(orgId: string, max = 100): Promise<Invitation[]> {
  const q = query(
    collection(db, 'invitations'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => mapInvitation(dd.id, dd.data()));
}

/** Pending invitations addressed to the signed-in user's email. */
export async function listMyInvitations(email: string): Promise<Invitation[]> {
  const q = query(
    collection(db, 'invitations'),
    where('email_lower', '==', email.trim().toLowerCase()),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    qlimit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => mapInvitation(dd.id, dd.data())).filter((i) => i.status === 'pending');
}

/* ───────────────────────── notifications ───────────────────────── */

export async function listNotifications(uid: string, max = 30): Promise<AppNotification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id,
      userId: d.userId,
      organizationId: d.organizationId,
      type: d.type as NotificationType,
      title: d.title ?? '',
      body: d.body ?? '',
      read: !!d.read,
      createdAt: toDate(d.createdAt),
    };
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}

export async function markAllNotificationsRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
  await batch.commit();
}

/* ───────────────────────── invoices ───────────────────────── */

export async function listInvoices(orgId: string, max = 24): Promise<Invoice[]> {
  const q = query(
    collection(db, 'invoices'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    return {
      id: dd.id,
      subscriptionId: d.subscriptionId ?? '',
      organizationId: d.organizationId ?? null,
      plan: d.plan ?? null,
      amount: d.amount ?? 0,
      currency: d.currency ?? 'USD',
      method: d.method ?? null,
      status: (d.status ?? 'paid') as Invoice['status'],
      errorDescription: d.errorDescription ?? null,
      createdAt: toDate(d.createdAt),
    };
  });
}

export async function listAuditLogs(orgId: string, max = 100): Promise<AuditLog[]> {
  const q = query(
    collection(db, 'auditLogs'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    qlimit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((dd) => {
    const d = dd.data();
    const eventType = (d.eventType ?? d.action ?? 'organization.updated') as AuditEventType;
    return {
      id: dd.id,
      organizationId: d.organizationId,
      actorId: d.actorId ?? d.userId ?? 'system',
      actorEmail: d.actorEmail,
      actorName: d.actorName,
      eventType,
      action: d.action ?? eventType,
      details: d.details ?? {},
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
      createdAt: toDate(d.createdAt),
    };
  });
}
