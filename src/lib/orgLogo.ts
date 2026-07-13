// ============================================
// ORGANIZATION LOGO UPLOAD
// Logos live in Firebase Storage — never inline in Firestore. This module
// validates the file (type + size), uploads it under a deterministic path,
// then patches the org document with a reference to the storage object.
// ============================================

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { writeAuditLog } from './db';
import type { OrganizationLogo } from '../types';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);
const MAX_BYTES = 512 * 1024; // 512KB — well above any reasonable logo

export interface UploadResult { logo: OrganizationLogo }

/**
 * Validate + upload a new logo. `existingPath` (if present) is deleted after
 * the new upload succeeds so we don't leak old blobs.
 */
export async function uploadOrgLogo(orgId: string, uid: string, file: File, existingPath?: string): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Logo must be PNG, JPEG, SVG, or WebP.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Logo is too large (max ${(MAX_BYTES / 1024).toFixed(0)}KB).`);
  }

  const ext = file.type === 'image/svg+xml' ? 'svg' : file.name.split('.').pop()?.toLowerCase() || 'png';
  const storagePath = `org-logos/${orgId}/logo-${Date.now()}.${ext}`;
  const objectRef = ref(storage, storagePath);

  const snapshot = await uploadBytes(objectRef, file, {
    contentType: file.type,
    customMetadata: { orgId, uploadedBy: uid },
  });
  const url = await getDownloadURL(snapshot.ref);

  const logo: OrganizationLogo = {
    url,
    storagePath,
    updatedAt: new Date(),
  };

  await updateDoc(doc(db, 'organizations', orgId), {
    logo: { url, storagePath, updatedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog(orgId, uid, 'organization.logo.updated', { storagePath });

  // Fire-and-forget cleanup of the previous object. Rules allow the owner to
  // delete their own org's blobs.
  if (existingPath && existingPath !== storagePath) {
    deleteObject(ref(storage, existingPath)).catch(() => { /* stale delete — non-fatal */ });
  }

  return { logo };
}

/** Remove the org's logo entirely. */
export async function removeOrgLogo(orgId: string, uid: string, existingPath?: string): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    logo: null,
    updatedAt: serverTimestamp(),
  });
  if (existingPath) {
    deleteObject(ref(storage, existingPath)).catch(() => { /* stale delete — non-fatal */ });
  }
  await writeAuditLog(orgId, uid, 'organization.logo.updated', { removed: true });
}
