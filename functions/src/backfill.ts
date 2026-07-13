import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, assertVerified, isAdmin } from './util';

/**
 * One-shot migration: populate `email_lower` on every users/{uid} doc and every
 * organizations/{orgId}/members/{uid} doc that predates the field. Idempotent
 * (skips docs already populated) and batched at 400 writes per commit so it
 * stays under Firestore's 500-op batch limit with headroom.
 *
 * Admin-only. Invoke once from the Firebase console or a local shell after
 * deploying this iteration:
 *
 *   const call = httpsCallable(functions, 'backfillEmailLower');
 *   await call({});
 */
export const backfillEmailLower = onCall(async (request) => {
  const uid = assertVerified(request);
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', 'Admin access required.');

  let usersScanned = 0;
  let usersUpdated = 0;
  let membersScanned = 0;
  let membersUpdated = 0;

  // ---- users ----
  {
    const snap = await db.collection('users').get();
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of snap.docs) {
      usersScanned += 1;
      const data = doc.data();
      const email = typeof data.email === 'string' ? data.email.trim() : '';
      if (!email) continue;
      const desired = email.toLowerCase();
      if (data.email_lower === desired) continue;
      batch.update(doc.ref, { email_lower: desired, updatedAt: FieldValue.serverTimestamp() });
      opsInBatch += 1;
      usersUpdated += 1;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();
  }

  // ---- members (collection group) ----
  {
    const snap = await db.collectionGroup('members').get();
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of snap.docs) {
      membersScanned += 1;
      const data = doc.data();
      const email = typeof data.email === 'string' ? data.email.trim() : '';
      if (!email) continue;
      const desired = email.toLowerCase();
      if (data.email_lower === desired) continue;
      batch.update(doc.ref, { email_lower: desired });
      opsInBatch += 1;
      membersUpdated += 1;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) await batch.commit();
  }

  return { usersScanned, usersUpdated, membersScanned, membersUpdated };
});
