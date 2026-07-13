// ============================================
// MONITORING / OBSERVABILITY
// Zero-dependency error pipeline with three pluggable outputs:
//   1. console (always — Cloud Logging picks this up in hosted contexts)
//   2. HTTP beacon → VITE_MONITORING_ENDPOINT (any ingest URL: Sentry tunnel,
//      Cloud Function, Logtail, …). Fire-and-forget, never blocks the UI.
//   3. window.__inferraMonitor adapter — drop in a Sentry/PostHog glue script
//      at deploy time without rebuilding the app.
//
// Server-side note: Cloud Functions already emit structured console.error which
// Google Cloud Logging captures + alerts on natively — no extra wiring needed.
// ============================================

import { setAuthErrorSink } from './authErrors';

interface MonitorEvent {
  kind: 'exception' | 'unhandledrejection' | 'auth' | 'boundary';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  url: string;
  ts: string;
  release?: string;
}

declare global {
  interface Window {
    __inferraMonitor?: { capture: (event: MonitorEvent) => void };
  }
}

const ENDPOINT: string = (import.meta.env.VITE_MONITORING_ENDPOINT as string) || '';
const RELEASE: string = (import.meta.env.VITE_RELEASE as string) || 'dev';

// Burst guard: identical messages within a window are dropped so a render loop
// can't flood the ingest endpoint (or the console).
const recent = new Map<string, number>();
const DEDUPE_MS = 30_000;
const MAX_PER_MINUTE = 20;
let sentThisMinute = 0;
let minuteStart = Date.now();

function shouldSend(message: string): boolean {
  const now = Date.now();
  if (now - minuteStart > 60_000) { minuteStart = now; sentThisMinute = 0; }
  if (sentThisMinute >= MAX_PER_MINUTE) return false;
  const last = recent.get(message) ?? 0;
  if (now - last < DEDUPE_MS) return false;
  recent.set(message, now);
  if (recent.size > 100) recent.clear();
  sentThisMinute += 1;
  return true;
}

/** Report an error to every configured output. Never throws. */
export function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
  kind: MonitorEvent['kind'] = 'exception',
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error ?? 'unknown'));
    if (!shouldSend(`${kind}:${err.message}`)) return;

    const event: MonitorEvent = {
      kind,
      message: err.message,
      stack: err.stack?.slice(0, 4000),
      context,
      url: typeof location !== 'undefined' ? location.pathname : '',
      ts: new Date().toISOString(),
      release: RELEASE,
    };

    // 1. console — always.
    // eslint-disable-next-line no-console
    console.error(`[inferra:${kind}]`, err.message, context);

    // 2. adapter — deploy-time glue (Sentry, PostHog, …).
    window.__inferraMonitor?.capture(event);

    // 3. beacon — fire-and-forget ingest.
    if (ENDPOINT) {
      const body = JSON.stringify(event);
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
      else void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
    }
  } catch {
    /* monitoring must never break the app */
  }
}

let initialized = false;

/** Install global handlers + route the auth-error sink into the pipeline. Idempotent. */
export function initMonitoring(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (e) => {
    captureException(e.error ?? e.message, { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    captureException(e.reason, { source: 'unhandledrejection' }, 'unhandledrejection');
  });

  // Auth failures (benign cancellations already filtered upstream). Emails are
  // masked here so no raw PII ever leaves the browser via the beacon.
  setAuthErrorSink((code, context) => {
    const masked = context.email ? context.email.replace(/^(.).*(@.*)$/, '$1***$2') : undefined;
    captureException(
      new Error(`auth error: ${code || 'unknown'}`),
      { action: context.action, email: masked, extra: context.extra },
      'auth',
    );
  });
}
