import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { hasPermission, type MemberRole, type Permission } from './permissions';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
export { Timestamp, FieldValue };

export function assertAuth(request: CallableRequest<any>): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  return request.auth.uid;
}

/**
 * Same as assertAuth, but additionally requires a verified email. Any callable
 * that produces a billable event or writes org-visible state (executeRequest,
 * subscription flows, invites, etc.) MUST use this to keep unverified accounts
 * from consuming quota or spamming teammates.
 */
export function assertVerified(request: CallableRequest<any>): string {
  const uid = assertAuth(request);
  if (request.auth?.token?.email_verified !== true) {
    throw new HttpsError('failed-precondition', 'Please verify your email to continue.');
  }
  return uid;
}

export function nextMonthlyReset(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

/**
 * Reset the monthly request counter if the reset date has passed. Returns the
 * effective (possibly reset) usage figures. Runs on every metered request.
 */
export async function ensureMonthlyReset(
  uid: string,
  data: FirebaseFirestore.DocumentData,
): Promise<{ requestsUsed: number; monthlyResetDate: Date }> {
  const resetAt: Date = data.monthlyResetDate?.toDate?.() ?? new Date(0);
  const limit: number = data.requestsLimit ?? 100;

  if (limit >= 0 && Date.now() >= resetAt.getTime()) {
    const next = nextMonthlyReset();
    await db.doc(`users/${uid}`).update({
      requestsUsed: 0,
      monthlyResetDate: Timestamp.fromDate(next),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { requestsUsed: 0, monthlyResetDate: next };
  }
  return { requestsUsed: data.requestsUsed ?? 0, monthlyResetDate: resetAt };
}

/**
 * Append an immutable audit-log entry. Every organization-scoped side-effect
 * MUST call this — analytics / compliance / support all depend on a complete
 * trail. `eventType` must be one of the values enumerated in src/types
 * (AuditEventType) so downstream filters can index the field.
 */
export async function writeAudit(
  organizationId: string,
  actorId: string,
  eventType: string,
  details: Record<string, any> = {},
  extras: { actorEmail?: string; actorName?: string; ipAddress?: string; userAgent?: string } = {},
): Promise<void> {
  const payload: Record<string, any> = {
    organizationId,
    actorId,
    eventType,
    action: eventType, // legacy alias kept in the same doc for older readers
    details,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (extras.actorEmail) payload.actorEmail = extras.actorEmail;
  if (extras.actorName) payload.actorName = extras.actorName;
  if (extras.ipAddress) payload.ipAddress = extras.ipAddress;
  if (extras.userAgent) payload.userAgent = extras.userAgent;

  await db.collection('auditLogs').add(payload);
}

/**
 * Best-effort per-instance rate limiter (token bucket). Caps abusive bursts on
 * a single warm instance; pair with Firestore counters or App Check for hard
 * global limits. Throws `resource-exhausted` when exceeded.
 */
const buckets = new Map<string, { count: number; windowStart: number }>();
export function rateLimit(uid: string, maxPerMinute = 60): void {
  const now = Date.now();
  const b = buckets.get(uid);
  if (!b || now - b.windowStart > 60_000) {
    buckets.set(uid, { count: 1, windowStart: now });
    return;
  }
  b.count += 1;
  if (b.count > maxPerMinute) {
    throw new HttpsError('resource-exhausted', 'Too many requests. Please slow down.');
  }
}

export async function isAdmin(uid: string): Promise<boolean> {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists && snap.data()?.isAdmin === true;
}

/**
 * Read the caller's membership doc within an organization. Returns `null` if
 * the caller isn't a member. Prefer `assertOrgPermission` in most callables —
 * this is exposed for cases that need the raw role (e.g. audit-log tagging).
 */
export async function readMembership(uid: string, orgId: string): Promise<{ role: string; email?: string; name?: string; status?: string } | null> {
  const snap = await db.doc(`organizations/${orgId}/members/${uid}`).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { role: (d.role ?? 'member') as string, email: d.email, name: d.name, status: (d.status ?? 'active') as string };
}

/**
 * Enforce that the caller has `permission` inside `orgId`. Throws
 * `permission-denied` otherwise. Uses the shared permission table from
 * ./permissions so client + server can never drift.
 */
export async function assertOrgPermission(uid: string, orgId: string, permission: Permission): Promise<{ role: MemberRole; email?: string; name?: string }> {
  const membership = await readMembership(uid, orgId);
  if (!membership) throw new HttpsError('permission-denied', 'You are not a member of this organization.');
  if (membership.status === 'suspended') {
    throw new HttpsError('permission-denied', 'Your access to this organization is suspended. Contact an administrator.');
  }
  const role = membership.role as MemberRole;
  if (!hasPermission(role, permission)) throw new HttpsError('permission-denied', 'You do not have permission to perform this action.');
  return { role, email: membership.email, name: membership.name };
}
