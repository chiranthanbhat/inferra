import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp, FieldValue, assertVerified, assertOrgPermission, rateLimit, nextMonthlyReset, writeAudit } from './util';
import { callProvider, type Provider, type Turn } from './providers';
import { notifyRoles } from './notifications';
import { sendEmail, emailQuotaReached } from './email';

interface ModelDescriptor {
  id: string;
  provider: Provider;
  name: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

interface ExecuteInput {
  model: ModelDescriptor;
  history: Turn[];
  organizationId?: string;
  meta?: {
    requestedModelId?: string;
    originalTokens?: number;
    optimizedTokens?: number;
    estSavings?: number;
    /** Team the request is attributed to (Command Center context). */
    teamId?: string;
  };
}

/**
 * Metered provider execution. Iteration 2 moves the request budget onto the
 * Organization document — quota is reserved against `org.usage.requestsUsed`
 * inside a Firestore transaction. Membership + `requests.execute` permission
 * are re-checked server-side. Provider keys live only on the server; failed
 * provider calls refund the reserved slot.
 */
export const executeRequest = onCall<ExecuteInput>(
  {
    secrets: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'XAI_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY'],
    // Reject callable traffic without a valid App Check token once the client
    // ships with VITE_APPCHECK_SITE_KEY. Deploy-time flag (functions/.env).
    enforceAppCheck: process.env.ENFORCE_APPCHECK === 'true',
  },
  async (request) => {
    const uid = assertVerified(request);
    rateLimit(uid, 60);

    const { model, history, meta, organizationId: overrideOrgId } = request.data || ({} as ExecuteInput);
    if (!model?.id || !model?.provider || !model?.name) throw new HttpsError('invalid-argument', 'Missing model descriptor.');
    if (!Array.isArray(history) || history.length === 0) throw new HttpsError('invalid-argument', 'Conversation history is required.');
    if (history.length > 100) throw new HttpsError('invalid-argument', 'Conversation too long.');

    // ---- Payload validation / DoS cap ----
    // Reject malformed turns and oversized prompts BEFORE reserving quota or
    // calling a provider — an enormous prompt is a cost/latency amplification
    // vector even within the platform's 10MB callable limit. Caps: 24k chars per
    // message, 200k chars total (~50k tokens) — comfortably above real chat use.
    const MAX_MSG_CHARS = 24_000;
    const MAX_TOTAL_CHARS = 200_000;
    let totalChars = 0;
    for (const turn of history) {
      if (!turn || (turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.content !== 'string') {
        throw new HttpsError('invalid-argument', 'Malformed conversation turn.');
      }
      if (turn.content.length > MAX_MSG_CHARS) throw new HttpsError('invalid-argument', 'A message exceeds the maximum length.');
      totalChars += turn.content.length;
    }
    if (totalChars > MAX_TOTAL_CHARS) throw new HttpsError('invalid-argument', 'Conversation exceeds the maximum size.');

    // Resolve the org: caller may pass one explicitly (multi-org UX) or we
    // fall back to their active org.
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'Account not found.');
    const userData = userSnap.data()!;
    const orgId: string = overrideOrgId || (userData.activeOrganizationId as string) || (userData.organizationId as string);
    if (!orgId) throw new HttpsError('failed-precondition', 'No active organization.');

    const actor = await assertOrgPermission(uid, orgId, 'requests.execute');

    // Team attribution (Command Center context): only trust it if the caller is
    // actually a member of that team in this org — never spoofable from the client.
    let attributedTeamId: string | null = null;
    if (meta?.teamId) {
      const tmSnap = await db.doc(`team_members/${meta.teamId}_${uid}`).get();
      if (tmSnap.exists && tmSnap.data()!.organizationId === orgId) attributedTeamId = meta.teamId;
    }

    const orgRef = db.doc(`organizations/${orgId}`);

    // Provider governance (Settings → Providers): explicitly disabled providers
    // are blocked org-wide, before any quota is reserved.
    const orgGate = await orgRef.get();
    if (orgGate.exists && orgGate.data()!.settings?.enabledProviders?.[model.provider] === false) {
      throw new HttpsError('failed-precondition', `The ${model.provider} provider is disabled for this organization.`);
    }

    // ---- Atomic reserve-a-request against the ORGANIZATION quota ----
    const reserve = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orgRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Organization not found.');
      const data = snap.data()!;
      const limit: number = data.planLimits?.requestsPerMonth ?? 100;
      let used: number = data.usage?.requestsUsed ?? 0;
      const resetAt: Date = data.monthlyResetDate?.toDate?.() ?? new Date(0);

      const update: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
        'usage.lastRequestAt': FieldValue.serverTimestamp(),
      };
      if (limit >= 0 && Date.now() >= resetAt.getTime()) {
        used = 0;
        update['usage.requestsUsed'] = 0;
        update.monthlyResetDate = Timestamp.fromDate(nextMonthlyReset());
      }
      if (limit >= 0 && used >= limit) {
        return { allowed: false as const, limit, used };
      }
      update['usage.requestsUsed'] = FieldValue.increment(1);
      tx.update(orgRef, update);
      return { allowed: true as const, limit, used: used + 1 };
    });

    if (!reserve.allowed) {
      // Quota exhausted → notify org billing roles once per cycle (deduped by a
      // marker on the org doc keyed to the current month).
      void quotaReachedAlert(orgId, reserve.limit).catch(() => {});
      throw new HttpsError('resource-exhausted', 'Monthly request limit reached. Upgrade your plan to continue.');
    }

    // ---- EXECUTE: call the provider (outside the transaction). REFUND on failure. ----
    const started = Date.now();
    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    let reply;
    try {
      reply = await callProvider(model.provider, model.name, history);
    } catch (err) {
      await Promise.allSettled([
        orgRef.update({ 'usage.requestsUsed': FieldValue.increment(-1) }), // refund the reserved slot
        db.doc(`analytics/${day}`).set(
          { date: day, failures: FieldValue.increment(1), [`providerFailures.${model.provider}`]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        ),
      ]);
      throw err;
    }
    const latencyMs = Date.now() - started;

    const cost = (reply.inputTokens / 1000) * model.inputCostPer1k + (reply.outputTokens / 1000) * model.outputCostPer1k;
    const savings = Math.max(0, meta?.estSavings ?? 0);

    // ---- FINALIZE: usage record + rollups + org totals + activity (best-effort) ----
    const rollup = {
      requests: FieldValue.increment(1),
      inputTokens: FieldValue.increment(reply.inputTokens),
      outputTokens: FieldValue.increment(reply.outputTokens),
      cost: FieldValue.increment(cost),
      savings: FieldValue.increment(savings),
      latencyMsTotal: FieldValue.increment(latencyMs),
      [`byModel.${model.id}`]: FieldValue.increment(1),
      [`byProvider.${model.provider}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await Promise.allSettled([
      db.collection('usage').add({
        userId: uid,
        organizationId: orgId,
        teamId: attributedTeamId,
        provider: model.provider,
        selectedModel: meta?.requestedModelId || model.id,
        routedModel: model.id,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        originalTokens: meta?.originalTokens ?? reply.inputTokens,
        optimizedTokens: meta?.optimizedTokens ?? reply.inputTokens,
        cost,
        savings,
        latencyMs,
        createdAt: FieldValue.serverTimestamp(),
      }),
      // Per-org daily + monthly rollups (drives usage reports without scans).
      db.doc(`organizations/${orgId}/usageDaily/${day}`).set({ date: day, ...rollup }, { merge: true }),
      db.doc(`organizations/${orgId}/usageMonthly/${month}`).set({ month, ...rollup }, { merge: true }),
      // Global platform analytics (admin dashboard).
      db.doc(`analytics/${day}`).set(
        {
          date: day,
          requests: FieldValue.increment(1),
          tokens: FieldValue.increment(reply.inputTokens + reply.outputTokens),
          inputTokens: FieldValue.increment(reply.inputTokens),
          outputTokens: FieldValue.increment(reply.outputTokens),
          cost: FieldValue.increment(cost),
          savings: FieldValue.increment(savings),
          latencyMsTotal: FieldValue.increment(latencyMs),
          [`modelUsage.${model.id}`]: FieldValue.increment(1),
          [`providerUsage.${model.provider}`]: FieldValue.increment(1),
          [`orgUsage.${orgId}`]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      orgRef.update({
        'usage.totalSpend': FieldValue.increment(cost),
        'usage.totalSavings': FieldValue.increment(savings),
        'usage.tokensProcessed': FieldValue.increment(reply.inputTokens + reply.outputTokens),
      }),
      userRef.update({
        lastActiveAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
      db.doc(`organizations/${orgId}/members/${uid}`).update({ lastActiveAt: FieldValue.serverTimestamp() }),
      writeAudit(orgId, uid, 'request.executed',
        { model: model.id, provider: model.provider, cost, latencyMs },
        { actorEmail: actor.email, actorName: actor.name }),
      // Per-team activity feed entry when the request is attributed to a team.
      attributedTeamId
        ? db.collection('team_activity').add({
            teamId: attributedTeamId, organizationId: orgId,
            actorId: uid, actorName: actor.name ?? actor.email ?? 'Someone',
            eventType: 'team.requestExecuted',
            details: { model: model.id, cost, savings },
            createdAt: FieldValue.serverTimestamp(),
          })
        : Promise.resolve(),
    ]);

    // Usage-threshold warnings (50/80/100% by default; org-configurable).
    void usageThresholdAlert(orgId, reserve.used, reserve.limit).catch(() => {});

    return {
      content: reply.content,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      requestsUsed: reserve.used,
      requestsLimit: reserve.limit,
      latencyMs,
    };
  },
);

/* ───────────────────────── usage alerts ───────────────────────── */

/**
 * Fire a one-time in-app warning per threshold per month to owner+admin when
 * org usage crosses a configured percentage. Dedupe markers live on the org's
 * monthly rollup doc (`alerted.{pct}` = true).
 */
async function usageThresholdAlert(orgId: string, used: number, limit: number): Promise<void> {
  if (limit < 0 || limit === 0) return; // unlimited
  const orgSnap = await db.doc(`organizations/${orgId}`).get();
  if (!orgSnap.exists) return;
  const org = orgSnap.data()!;
  const thresholds: number[] = org.notifications?.usageAlertThresholds ?? [50, 80, 90, 95, 100];
  const pctNow = Math.floor((used / limit) * 100);

  const month = new Date().toISOString().slice(0, 7);
  const monthlyRef = db.doc(`organizations/${orgId}/usageMonthly/${month}`);

  for (const t of [...thresholds].sort((a, b) => a - b)) {
    if (pctNow < t) break;
    // Transaction so parallel requests can't double-fire the same threshold.
    const shouldFire = await db.runTransaction(async (tx) => {
      const snap = await tx.get(monthlyRef);
      if (snap.exists && snap.data()!.alerted?.[String(t)]) return false;
      tx.set(monthlyRef, { alerted: { ...(snap.data()?.alerted ?? {}), [String(t)]: true } }, { merge: true });
      return true;
    }).catch(() => false);

    if (shouldFire) {
      const isFull = t >= 100;
      await notifyRoles(orgId, ['owner', 'admin'],
        isFull ? 'usage.quotaReached' : 'usage.warning',
        isFull ? 'Monthly request limit reached' : `Usage at ${t}%`,
        isFull
          ? `${org.name} has used all ${limit.toLocaleString()} requests this month. Upgrade to continue routing.`
          : `${org.name} has used ${t}% of its ${limit.toLocaleString()} monthly requests.`);
      if (isFull) {
        const ownerSnap = await db.doc(`users/${org.ownerId}`).get();
        const ownerEmail = ownerSnap.data()?.email;
        if (ownerEmail) {
          const tpl = emailQuotaReached(org.name ?? 'Your organization', limit);
          await sendEmail(ownerEmail, tpl.subject, tpl.html);
        }
      }
    }
  }
}

/** Alert (once per month) when a request is BLOCKED because the quota is already spent. */
async function quotaReachedAlert(orgId: string, limit: number): Promise<void> {
  await usageThresholdAlert(orgId, limit, limit); // used == limit → fires the 100% path with dedupe
}
