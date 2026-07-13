// ============================================
// IN-APP NOTIFICATIONS (server writes, client reads)
// One document per notification in `notifications/`. Clients may only read
// their own and flip the `read` flag (enforced in firestore.rules). Every
// notable org event fans out through notify()/notifyRoles().
// ============================================

import { db, FieldValue } from './util';

export type NotificationType =
  | 'invitation.received'
  | 'member.joined'
  | 'member.left'
  | 'member.removed'
  | 'member.roleChanged'
  | 'usage.warning'
  | 'usage.quotaReached'
  | 'subscription.activated'
  | 'subscription.paymentFailed'
  | 'subscription.cancelled'
  | 'subscription.expiring';

/** Write a single notification for one user. Best-effort — never throws. */
export async function notify(
  userId: string,
  organizationId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  try {
    await db.collection('notifications').add({
      userId,
      organizationId,
      type,
      title,
      body,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[notify] failed', userId, type, e);
  }
}

/**
 * Fan a notification out to every member of an org holding one of `roles`
 * (e.g. billing alerts → owner + admin). Optionally skip one uid (the actor).
 */
export async function notifyRoles(
  organizationId: string,
  roles: string[],
  type: NotificationType,
  title: string,
  body: string,
  skipUid?: string,
): Promise<void> {
  try {
    const members = await db.collection(`organizations/${organizationId}/members`).get();
    const writes: Promise<void>[] = [];
    members.forEach((m) => {
      const d = m.data();
      if (skipUid && m.id === skipUid) return;
      if (!roles.includes(d.role)) return;
      writes.push(notify(m.id, organizationId, type, title, body));
    });
    await Promise.allSettled(writes);
  } catch (e) {
    console.error('[notifyRoles] failed', organizationId, type, e);
  }
}
