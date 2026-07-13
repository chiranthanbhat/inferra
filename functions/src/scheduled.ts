import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, Timestamp, FieldValue, nextMonthlyReset } from './util';

/**
 * Safety-net monthly reset. The metered request path already resets an
 * organization's counter lazily on first use after the reset date; this
 * scheduled job catches inactive orgs so their usage rolls over even when no
 * request has been made. Runs daily.
 */
export const monthlyReset = onSchedule('every day 00:30', async () => {
  const nowTs = Timestamp.now();
  const due = await db
    .collection('organizations')
    .where('monthlyResetDate', '<=', nowTs)
    .limit(500)
    .get();

  if (due.empty) return;

  const next = Timestamp.fromDate(nextMonthlyReset());
  let batch = db.batch();
  let n = 0;
  for (const doc of due.docs) {
    const data = doc.data();
    if ((data.planLimits?.requestsPerMonth ?? 0) < 0) continue; // unlimited plans never reset
    batch.update(doc.ref, {
      'usage.requestsUsed': 0,
      monthlyResetDate: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (++n % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`[monthlyReset] processed ${due.size} organizations`);
});

/**
 * Invitation expiry sweeper. Accept/resend already check expiry lazily; this
 * job flips stale `pending` invitations to `expired` so lists stay accurate
 * and pending invites stop counting against the org's seat limit.
 */
export const expireInvitations = onSchedule('every day 01:00', async () => {
  const nowTs = Timestamp.now();
  const due = await db
    .collection('invitations')
    .where('status', '==', 'pending')
    .where('expiresAt', '<=', nowTs)
    .limit(500)
    .get();

  if (due.empty) return;

  let batch = db.batch();
  let n = 0;
  for (const doc of due.docs) {
    batch.update(doc.ref, { status: 'expired', updatedAt: FieldValue.serverTimestamp() });
    if (++n % 450 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`[expireInvitations] expired ${due.size} invitations`);
});
