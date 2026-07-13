// ============================================
// FIREBASE INITIALIZATION
// App + Auth + Firestore + Functions. All config comes from VITE_* env vars.
// Never hardcode real keys here. See .env.example / PRODUCTION_SETUP.md.
// ============================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getStorage } from 'firebase/storage';
import { friendlyAuthError, logAuthError, isBenignAuthError } from './authErrors';

// True only when a real project is configured. Lets the UI show a clear
// "not configured" state in local dev instead of throwing cryptic errors.
export const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID,
);

/** Minimum password length enforced by the sign-up form. Firebase Auth accepts 6+, we require 8+. */
export const MIN_PASSWORD_LENGTH = 8;

// When unconfigured (local dev without env), fall back to inert placeholders so
// the SDK initialises without throwing `auth/invalid-api-key` at import time.
// AuthProvider never attaches a listener while unconfigured, so these are never used.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'inferra-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'inferra-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'inferra-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// App Check (reCAPTCHA v3). Activates only when a real project + site key are
// configured — see PRODUCTION_SETUP.md. Pair with ENFORCE_APPCHECK=true on the
// Cloud Functions side to reject tokens-less callable traffic.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (firebaseConfigured && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    /* double-init under HMR — harmless */
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1');
export const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type AuthResult = {
  user: FirebaseUser | null;
  error: string | null;
  /**
   * True when the account was created but the verification email did NOT go out.
   * The caller (sign-up UI) should nudge the user to click Resend on the verify page.
   * Non-fatal: authentication itself succeeded.
   */
  verificationSendFailed?: boolean;
};

function friendly(error: unknown): string {
  return friendlyAuthError(error);
}

/** Sign in with Google via popup. Cancellations are surfaced as a friendly message but not logged. */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    if (!isBenignAuthError(error)) logAuthError({ action: 'signInGoogle' }, error);
    return { user: null, error: friendly(error) };
  }
}

/** Sign in with email + password. */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    logAuthError({ action: 'signInEmail', email }, error);
    return { user: null, error: friendly(error) };
  }
}

/**
 * Create an account, set the display name, and dispatch a verification email.
 * The Firebase account creation and the verification-email send are separate
 * failure modes; we distinguish them so the UI can react correctly:
 *   • account create failed → `error` set, `user` null
 *   • account created but verification send failed →
 *     `user` populated, `error` null, `verificationSendFailed: true`
 * Network errors on verification send are treated as non-fatal transient (the
 * user can hit "Resend" on the verify page); auth/quota-exceeded or auth/too-many-
 * requests are surfaced through the flag so the UI can show a targeted message.
 */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<AuthResult> {
  let result: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>;
  try {
    result = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: unknown) {
    logAuthError({ action: 'signUp', email }, error);
    return { user: null, error: friendly(error) };
  }

  if (name) {
    try {
      await updateProfile(result.user, { displayName: name });
    } catch (error: unknown) {
      // Non-fatal — the profile can still be filled in later.
      logAuthError({ action: 'signUp', email, extra: { step: 'updateProfile' } }, error);
    }
  }

  let verificationSendFailed = false;
  try {
    await sendEmailVerification(result.user);
  } catch (error: unknown) {
    const code = (error as { code?: string } | null)?.code ?? '';
    // Transient network hiccups are non-fatal AND non-flag-raising — Firebase
    // will retry on Resend and there's no useful signal to surface.
    if (code !== 'auth/network-request-failed') {
      verificationSendFailed = true;
      logAuthError({ action: 'verifyEmail', email, extra: { step: 'initialSend' } }, error);
    }
  }

  return { user: result.user, error: null, verificationSendFailed };
}

/** Sign the current user out. */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: unknown) {
    logAuthError({ action: 'signOut' }, error);
    return { error: friendly(error) };
  }
}

/**
 * Send a password-reset email. To avoid user enumeration, the calling UI
 * should render the same confirmation regardless of the return value —
 * callers can still log the raw error via the returned string in dev.
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: unknown) {
    logAuthError({ action: 'resetPassword', email }, error);
    return { error: friendly(error) };
  }
}

/** Re-send the verification email to the currently signed-in user. */
export async function resendVerification(): Promise<{ error: string | null }> {
  try {
    if (!auth.currentUser) return { error: 'You are not signed in.' };
    await sendEmailVerification(auth.currentUser);
    return { error: null };
  } catch (error: unknown) {
    logAuthError({ action: 'verifyEmail', email: auth.currentUser?.email ?? undefined, extra: { step: 'resend' } }, error);
    return { error: friendly(error) };
  }
}

/** Subscribe to Firebase Auth state changes. Returns the unsubscribe fn. */
export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export type { FirebaseUser };
