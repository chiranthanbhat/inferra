// ============================================
// ENVIRONMENT DIAGNOSTICS
// Runs once on boot. Validates every subsystem the app depends on and prints a
// compact status table to the console (dev) or stashes it on `window` (prod
// support tool). Never blocks the app — failures are informational.
// ============================================

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

function hasEnv(key: string): boolean {
  const v = import.meta.env[key as keyof ImportMetaEnv];
  return typeof v === 'string' && v.length > 0;
}

function optionalEnv(key: string): string | undefined {
  const v = import.meta.env[key as keyof ImportMetaEnv];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function checkFirebase(): CheckResult[] {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const missing = keys.filter((k) => !hasEnv(k));
  return [{
    name: 'Firebase (Auth · Firestore · Functions · Storage)',
    ok: missing.length === 0,
    detail: missing.length === 0
      ? `project=${optionalEnv('VITE_FIREBASE_PROJECT_ID') ?? '?'}`
      : `missing: ${missing.join(', ')}`,
  }];
}

function checkFunctionsRegion(): CheckResult {
  const region = optionalEnv('VITE_FIREBASE_FUNCTIONS_REGION') ?? 'us-central1 (default)';
  return { name: 'Cloud Functions region', ok: true, detail: region };
}

function checkRazorpay(): CheckResult {
  const paid = ['VITE_RAZORPAY_PLAN_STARTER', 'VITE_RAZORPAY_PLAN_GROWTH', 'VITE_RAZORPAY_PLAN_ENTERPRISE'];
  const configured = paid.filter(hasEnv);
  return {
    name: 'Razorpay plan ids',
    ok: configured.length === paid.length,
    detail: configured.length === paid.length
      ? 'all configured'
      : `${configured.length}/${paid.length} configured — paid checkout will fail for unset tiers`,
  };
}

function checkStorage(): CheckResult {
  const bucket = optionalEnv('VITE_FIREBASE_STORAGE_BUCKET');
  return {
    name: 'Firebase Storage bucket',
    ok: !!bucket,
    detail: bucket ?? 'not configured — org logos will fail to upload',
  };
}

function checkDevAuth(): CheckResult {
  const flag = import.meta.env.VITE_DEV_AUTH === 'true';
  return {
    name: 'Dev auth mode',
    ok: !flag || !import.meta.env.PROD,
    detail: flag
      ? (import.meta.env.PROD ? 'FLAG ENABLED IN PROD BUILD — will be ignored' : 'active (dev bypass)')
      : 'disabled',
  };
}

export interface EnvReport {
  ok: boolean;
  checks: CheckResult[];
  generatedAt: string;
}

/** Compute the report without side effects — useful for a diagnostics UI. */
export function buildEnvReport(): EnvReport {
  const checks: CheckResult[] = [
    ...checkFirebase(),
    checkFunctionsRegion(),
    checkStorage(),
    checkRazorpay(),
    checkDevAuth(),
  ];
  return {
    ok: checks.every((c) => c.ok),
    checks,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Boot-time hook. Prints the report (compact table in dev; single line in
 * prod) and stashes it on `window.__inferraEnv` for support diagnostics.
 */
export function runEnvironmentChecks(): EnvReport {
  const report = buildEnvReport();
  try {
    (window as unknown as { __inferraEnv: EnvReport }).__inferraEnv = report;
  } catch {
    /* window unavailable in SSR contexts — non-fatal */
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[inferra] environment ${report.ok ? 'OK' : 'HAS WARNINGS'}`);
    for (const c of report.checks) {
      // eslint-disable-next-line no-console
      console.log(`${c.ok ? '✓' : '⚠'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
  } else if (!report.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      '[inferra] some environment checks failed. Inspect window.__inferraEnv for details.',
    );
  }

  return report;
}
