import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, assertVerified, isAdmin } from './util';
import { PLAN_LIMITS, PAID_PLANS, type PlanType } from './plans';

/**
 * Internal admin metrics. Restricted to users with `isAdmin: true`.
 * Iteration 3: adds ARR, real revenue (from the `invoices` collection),
 * token volume, provider distribution, top organizations, failed payments
 * and a simple system-health signal (provider failure rate, last 24h).
 *
 * Computed from Firestore scans — fine for early scale; move to scheduled
 * rollups / BigQuery once collections grow past ~50k docs.
 */
export const getAdminMetrics = onCall(async (request) => {
  const uid = assertVerified(request);
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', 'Admin access required.');

  const now = Date.now();
  const dayMs = 86_400_000;
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const [usersSnap, orgsSnap, analyticsSnap, invoicesSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('organizations').get(),
    db.collection('analytics').get(),
    db.collection('invoices').orderBy('createdAt', 'desc').limit(500).get().catch(() => null),
  ]);

  // ---- users / activity ----
  let activeUsers = 0;
  let dailyActiveUsers = 0;
  let monthlyActiveUsers = 0;
  usersSnap.forEach((doc) => {
    const d = doc.data();
    const lastActive = d.lastActiveAt?.toDate?.()?.getTime() ?? d.lastLoginAt?.toDate?.()?.getTime() ?? 0;
    if (now - lastActive < 30 * dayMs) { activeUsers++; monthlyActiveUsers++; }
    if (now - lastActive < dayMs) dailyActiveUsers++;
  });

  // ---- organizations / subscriptions / MRR·ARR ----
  const subscriptionsByPlan: Record<PlanType, number> = { free: 0, starter: 0, growth: 0, enterprise: 0 };
  let mrr = 0;
  let paidOrgs = 0;
  let trialingOrgs = 0;
  let cancelledRecently = 0;
  const orgNames: Record<string, string> = {};
  orgsSnap.forEach((doc) => {
    const d = doc.data();
    if (d.status === 'deleted') return;
    orgNames[doc.id] = d.name ?? doc.id;
    const plan = (d.plan ?? 'free') as PlanType;
    subscriptionsByPlan[plan] = (subscriptionsByPlan[plan] ?? 0) + 1;
    if ((d.subscriptionStatus === 'active' || d.subscriptionStatus === 'trialing') && plan !== 'free') {
      paidOrgs += 1;
      if (d.subscriptionStatus === 'trialing') trialingOrgs += 1;
      else mrr += PLAN_LIMITS[plan].price;
    }
    if (d.subscriptionStatus === 'cancelled') cancelledRecently += 1;
  });

  // ---- platform usage (daily analytics rollups) ----
  let requestVolume = 0;
  let totalTokens = 0;
  let costSavingsGenerated = 0;
  let requestsToday = 0;
  let failures24h = 0;
  let requests24h = 0;
  const modelUsage: Record<string, number> = {};
  const providerUsage: Record<string, number> = {};
  const orgUsage: Record<string, number> = {};
  analyticsSnap.forEach((doc) => {
    const d = doc.data();
    requestVolume += d.requests ?? 0;
    totalTokens += d.tokens ?? 0;
    costSavingsGenerated += d.savings ?? 0;
    if (doc.id === today) {
      requestsToday = d.requests ?? 0;
      failures24h = d.failures ?? 0;
      requests24h = d.requests ?? 0;
    }
    for (const [model, count] of Object.entries(d.modelUsage ?? {})) {
      modelUsage[model] = (modelUsage[model] ?? 0) + (count as number);
    }
    for (const [provider, count] of Object.entries(d.providerUsage ?? {})) {
      providerUsage[provider] = (providerUsage[provider] ?? 0) + (count as number);
    }
    for (const [org, count] of Object.entries(d.orgUsage ?? {})) {
      orgUsage[org] = (orgUsage[org] ?? 0) + (count as number);
    }
  });

  // ---- revenue + failed payments (invoices) ----
  let revenueAllTime = 0;
  let revenueThisMonth = 0;
  let failedPayments = 0;
  let failedPaymentsThisMonth = 0;
  invoicesSnap?.forEach((doc) => {
    const d = doc.data();
    const created: Date | null = d.createdAt?.toDate?.() ?? null;
    const inMonth = created ? created.toISOString().slice(0, 7) === monthPrefix : false;
    if (d.status === 'paid') {
      revenueAllTime += d.amount ?? 0;
      if (inMonth) revenueThisMonth += d.amount ?? 0;
    } else if (d.status === 'failed') {
      failedPayments += 1;
      if (inMonth) failedPaymentsThisMonth += 1;
    }
  });

  // ---- top organizations by request volume ----
  const topOrganizations = Object.entries(orgUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, requests]) => ({ id, name: orgNames[id] ?? id, requests }));

  // ---- system health: provider failure rate over the last day ----
  const failureRate = requests24h + failures24h > 0 ? failures24h / (requests24h + failures24h) : 0;
  const systemHealth: 'healthy' | 'degraded' | 'critical' =
    failureRate < 0.02 ? 'healthy' : failureRate < 0.15 ? 'degraded' : 'critical';

  const totalOrganizations = orgsSnap.size;
  const conversionRate = totalOrganizations ? paidOrgs / totalOrganizations : 0;
  const churnRate = paidOrgs + cancelledRecently ? cancelledRecently / (paidOrgs + cancelledRecently) : 0;

  return {
    totalUsers: usersSnap.size,
    activeUsers,
    dailyActiveUsers,
    monthlyActiveUsers,
    totalOrganizations,
    mrr,
    arr: mrr * 12,
    revenueThisMonth,
    revenueAllTime,
    requestVolume,
    requestsToday,
    totalTokens,
    costSavingsGenerated,
    subscriptionsByPlan,
    trialingOrgs,
    modelUsage,
    providerUsage,
    topOrganizations,
    failedPayments,
    failedPaymentsThisMonth,
    systemHealth,
    failureRate,
    conversionRate,
    churnRate,
    paidPlans: PAID_PLANS,
  };
});
