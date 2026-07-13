// ============================================
// AUTH ERROR MAPPING
// Central Firebase-Auth error → user-facing message dictionary + a pluggable
// error sink so we can route auth failures to a real monitoring pipeline later
// (Sentry, Cloud Logging, PostHog, …) without touching call sites.
// ============================================

/**
 * Any code we want a specific, friendly message for. Missing codes fall through
 * to the message on the error or a generic fallback.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists with that email.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists using a different sign-in method. Sign in with your original method to link them.',
  'auth/requires-recent-login': 'For security, please sign in again to complete this action.',
  'auth/operation-not-allowed': 'This sign-in method is disabled for this project.',
  'auth/unauthorized-domain': 'This domain is not authorised for sign-in. Contact support.',
  'auth/quota-exceeded': 'We could not send email right now. Please try again shortly.',
  'auth/expired-action-code': 'That link has expired. Request a new one.',
  'auth/invalid-action-code': 'That link is invalid or has already been used.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/internal-error': 'Something went wrong on our side. Please try again.',
};

/**
 * Turn a raw Firebase-Auth error (or any thrown value) into a message safe to
 * render in the UI. Never leaks stack traces or PII.
 */
export function friendlyAuthError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  const msg = (error as { message?: string } | null)?.message;
  if (typeof msg === 'string' && msg && !msg.includes('Firebase:')) return msg;
  return 'Something went wrong. Please try again.';
}

/**
 * True if the code indicates a benign, user-driven cancellation (not something
 * we should log or surface as an error).
 */
export function isBenignAuthError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

/**
 * Auth-error observability sink. Today it forwards to console.warn (dev-visible,
 * not user-visible); later this can be swapped for Sentry, Datadog, etc. without
 * changing any call site. Benign cancellations are dropped.
 */
export interface AuthErrorContext {
  action: 'signInEmail' | 'signInGoogle' | 'signUp' | 'resetPassword' | 'verifyEmail' | 'reload' | 'signOut' | 'provisionProfile';
  email?: string;
  extra?: Record<string, unknown>;
}

type SinkFn = (code: string, context: AuthErrorContext, error: unknown) => void;

let sink: SinkFn = (code, context, error) => {
  // eslint-disable-next-line no-console
  console.warn(`[auth] ${context.action} failed (${code || 'unknown'})`, {
    email: context.email ? maskEmail(context.email) : undefined,
    extra: context.extra,
    message: (error as { message?: string } | null)?.message,
  });
};

/** Swap the observability sink (call once at bootstrap when Sentry etc. is wired). */
export function setAuthErrorSink(next: SinkFn): void {
  sink = next;
}

/** Report an auth error. Benign cancellations are dropped. Safe to call always. */
export function logAuthError(context: AuthErrorContext, error: unknown): void {
  if (isBenignAuthError(error)) return;
  const code = (error as { code?: string } | null)?.code ?? '';
  try {
    sink(code, context, error);
  } catch {
    /* the observability sink must never break auth flows */
  }
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***';
  return `${user[0] ?? '*'}***@${domain}`;
}
