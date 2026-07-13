# Inferra — Production Setup & Deployment

Inferra is a React + Vite frontend backed by Firebase (Auth + Firestore + Cloud
Functions) with Razorpay billing. Provider API keys live **only** on the server;
the browser never sees them. Usage limits and billing are enforced server-side.

```
Frontend (Vite)  ─► Firebase Auth ─► Firestore
       │                                 ▲
       └─► Cloud Functions (callable) ───┘  ← provider keys, metering, Razorpay
                     │
                     └─► AI providers (OpenAI / Anthropic / Google / …)
```

---

## 1. Prerequisites

- Node 20+, npm
- A Firebase project (Blaze plan — required for Cloud Functions + outbound network)
- A Razorpay account (live or test mode)
- `npm i -g firebase-tools` and `firebase login`

---

## 2. Frontend env

```bash
cp .env.example .env.local
```

Fill in the `VITE_FIREBASE_*` values from **Firebase Console → Project Settings →
Your apps (Web)**, and the `VITE_RAZORPAY_PLAN_*` ids (created in step 5).

`npm install && npm run dev` should now boot with real auth.

---

## 3. Firebase setup

1. **Auth** → Console → Authentication → Sign-in method → enable **Google** and
   **Email/Password**. Add your domains under *Authorized domains*.
   New sign-ups enforce an 8-character password minimum in the UI; Firebase's
   own minimum is 6, so existing shorter passwords keep working.
2. **Firestore** → create the database (production mode).
3. Set the project id in `.firebaserc` (replace `YOUR_FIREBASE_PROJECT_ID`).
4. Deploy rules + indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### Make yourself an admin
The Admin Console (`isAdmin`) is gated by a flag on the user doc. After your first
sign-in, in the Firestore console set `users/<your-uid>.isAdmin = true`.

---

## 4. Cloud Functions (provider proxy + billing + metering)

```bash
cd functions
npm install
```

Set **secret** values (provider + Razorpay secret keys):
```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set GOOGLE_API_KEY
firebase functions:secrets:set XAI_API_KEY
firebase functions:secrets:set DEEPSEEK_API_KEY
firebase functions:secrets:set MISTRAL_API_KEY
firebase functions:secrets:set OPENROUTER_API_KEY
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```
Provide only the providers you actually use — the rest will report
"provider not configured" if a model routes to them.

Non-secret config (the Razorpay **plan ids**) can go in `functions/.env`:
```
RAZORPAY_PLAN_STARTER=plan_xxx
RAZORPAY_PLAN_GROWTH=plan_xxx
RAZORPAY_PLAN_ENTERPRISE=plan_xxx
```

Deploy:
```bash
firebase deploy --only functions
```

Functions deployed:
| Function | Type | Purpose |
|---|---|---|
| `executeRequest` | callable | Metered provider call: reserve → execute → finalize (refund on failure) |
| `createSubscription` | callable | Start a Razorpay subscription (trial-aware via `TRIAL_DAYS`) |
| `confirmSubscription` | callable | Verify checkout signature, unlock plan |
| `cancelSubscription` | callable | Cancel at cycle end |
| `getAdminMetrics` | callable | Admin-only metrics (MRR/ARR, revenue, providers, top orgs, health) |
| `inviteMember` / `acceptInvitation` / `rejectInvitation` / `cancelInvitation` / `resendInvitation` | callable | Invitation lifecycle (7-day expiry, dedupe, seat limits) |
| `removeMember` / `changeMemberRole` / `setMemberStatus` / `leaveOrganization` | callable | Member lifecycle (suspend/reactivate; permission-engine enforced) |
| `updateOrganizationSettings` / `renameOrganization` / `deleteOrganization` / `transferOwnership` | callable | Org administration |
| `razorpayWebhook` | HTTPS | Razorpay → Firestore reconciliation + invoice records + billing alerts |
| `monthlyReset` | scheduled | Daily usage rollover safety-net |
| `expireInvitations` | scheduled | Daily invitation-expiry sweeper |

### Email delivery (Trigger Email extension)
Transactional emails (invitations, welcome, subscription updates, payment
failures, quota alerts) are queued as documents in the `mail` collection.
Install the official **Trigger Email** extension
(`firebase ext:install firebase/firestore-send-email`) and point it at the
`mail` collection with your SMTP/SendGrid credentials — no email secrets live
in this codebase. Password-reset + verification emails are sent by Firebase
Auth itself (Console → Authentication → Templates).

Non-secret function config (`functions/.env`): `TRIAL_DAYS` (free-trial days on
first subscription, 0 = off) and `APP_URL` (used in email CTAs).
| `backfillEmailLower` | callable (admin) | One-shot migration to populate `email_lower` on legacy user + member docs |

### One-shot: backfill `email_lower`
Iteration 1 (Authentication) added a lowercased-email field for case-insensitive
invite lookups. After deploying, invoke the migration **once** as an admin:

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';
await httpsCallable(getFunctions(), 'backfillEmailLower')({});
```
The function is idempotent — re-running it is safe.

---

## 5. Razorpay setup

1. **Dashboard → Subscriptions → Plans** → create one plan per paid tier
   (Starter $19, Growth $79, Enterprise $999 — or INR equivalents). Copy each
   `plan_id` into both `.env.local` (`VITE_RAZORPAY_PLAN_*`) and `functions/.env`
   (`RAZORPAY_PLAN_*`).
2. **Dashboard → Settings → Webhooks** → add a webhook:
   - URL: `https://<region>-<project>.cloudfunctions.net/razorpayWebhook`
   - Secret: the same value you set as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `subscription.activated`, `subscription.charged`,
     `subscription.pending`, `subscription.halted`, `subscription.cancelled`,
     `subscription.completed`, `payment.failed`
3. Get **Key Id / Key Secret** from **Settings → API Keys**.

Upgrade flow: Pricing/Plan selection → `createSubscription` → Razorpay Checkout →
`confirmSubscription` (instant unlock) → `razorpayWebhook` (durable source of truth).

---

## 6. Deploy the frontend (Railway)

```bash
npm run build          # outputs dist/
```

- Connect the repo to Railway. `railway.json` is included:
  build `npm ci && npm run build`, start `npm run start` (serves `dist/` on `$PORT`).
- Add the `VITE_*` env vars in Railway’s **Variables** tab (same as `.env.local`).
- Add your Railway domain to Firebase **Authorized domains**.

(Alternatively `firebase deploy --only hosting` uses the included `firebase.json`.)

---

## 7. Firestore data model

```
users/{uid}
  email, name, photoURL, emailVerified, onboarded, isAdmin
  organizationId, role, teamIds
  currentPlan, requestsUsed, requestsLimit (-1 = unlimited)
  subscriptionStatus, razorpayCustomerId, razorpaySubscriptionId
  monthlyResetDate, createdAt, updatedAt, lastLoginAt, lastActiveAt

organizations/{orgId}
  name, ownerId, plan, planLimits, usage, settings
  razorpayCustomerId, razorpaySubscriptionId, createdAt, updatedAt
  members/{uid}: { userId, email, name, role, joinedAt }

usage/{id}      (server-written)  userId, organizationId, selectedModel,
                                  routedModel, originalTokens, optimizedTokens,
                                  cost, savings, latencyMs, createdAt
analytics/{YYYY-MM-DD} (server)   requests, tokens, cost, savings, modelUsage{}
chats/{chatId}                    userId, organizationId, title, model, totals,
                                  originResult, createdAt, updatedAt
  messages/{id}                   role, content, tokens, cost, baselineCost, createdAt
auditLogs/{id}  (server-written)  organizationId, userId, action, details, createdAt
teams/{id}                        organizationId, name, memberIds, budget
```

Plan limits (server-authoritative, `functions/src/plans.ts`): Free 100, Starter
1,000, Growth 5,000, Enterprise unlimited requests/month.

---

## 8. Testing & hardening

```bash
npm test           # unit suite (permissions parity, route guards, plans, chat math)
npm run test:rules # Firestore rules suite — needs firebase-tools + Java (emulator)
```

- **Unit tests** (`tests/unit/`) run anywhere and gate the invariants that keep
  client and server honest: the permission engines must agree cell-for-cell,
  plan limits must match the commercial spec on both sides, and the route-guard
  ladder must never leak an unverified user into the dashboard.
- **Rules tests** (`tests/rules/`) exercise tenant isolation, server-only
  billing fields, the notifications read-flag whitelist, invitation visibility
  and the sealed mail queue against the real `firestore.rules` in the emulator.
- **App Check**: register the web app in Console → App Check (reCAPTCHA v3),
  put the site key in `VITE_APPCHECK_SITE_KEY`, deploy the client, then set
  `ENFORCE_APPCHECK=true` in `functions/.env` and redeploy functions.
- **Monitoring**: browser errors (window errors, unhandled rejections, render
  crashes, auth failures with masked emails) flow through
  `src/lib/monitoring.ts` — console always, plus an optional JSON beacon to
  `VITE_MONITORING_ENDPOINT` and a `window.__inferraMonitor` adapter for
  drop-in Sentry glue. Cloud Functions `console.error` output is captured by
  Google Cloud Logging automatically; set alerts there.
- **Builds**: `npm run build` is code-split with stable vendor chunks
  (react / firebase / recharts / framer-motion). `BUILD_SINGLEFILE=true npm run build`
  restores the old inline-everything single-file output for offline demos.

## 9. Security notes

- Provider keys are Cloud Functions **secrets** — never in the client bundle.
- Usage counters and plan/limit fields are **server-write-only** (Firestore rules);
  the client can only read them and edit profile/onboarding fields.
- `executeRequest` reserves a request inside a Firestore transaction, so the
  monthly limit cannot be raced or bypassed; failed provider calls are refunded.
- Razorpay webhook verifies the HMAC signature over the raw body.
- Add **Firebase App Check** before launch for an extra layer on callable functions.
- Wire `componentDidCatch` (ErrorBoundary) and the functions `console.error`
  calls to your monitoring (Sentry / Cloud Logging).
