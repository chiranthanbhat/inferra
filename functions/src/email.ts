// ============================================
// EMAIL SYSTEM
// Emails are queued as documents in the `mail` collection using the schema of
// the official "Trigger Email" Firebase extension (firestore-send-email). The
// extension (configured with your SMTP/SendGrid credentials) picks each doc up
// and delivers it — no SMTP secrets ever live in this codebase.
//
// NOTE on auth emails: password-reset and email-verification messages are sent
// by Firebase Authentication itself (customisable in Console → Authentication
// → Templates). We intentionally do NOT duplicate them here.
// ============================================

import { db, FieldValue } from './util';

const FROM_NAME = 'Inferra';
const APP_URL = process.env.APP_URL || 'https://app.inferra.ai';

/** Queue an email document for the Trigger Email extension. Best-effort. */
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  try {
    await db.collection('mail').add({
      to,
      message: {
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Never fail the calling operation because an email couldn't be queued.
    console.error('[email] queue failed', to, subject, e);
  }
}

/* ───────────────────────── shared layout ───────────────────────── */

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="border-radius:10px;background:linear-gradient(135deg,#4DEEEA,#56c5f7)">
         <a href="${cta.url}" style="display:inline-block;padding:12px 28px;color:#04211f;font-weight:600;text-decoration:none;font-family:Segoe UI,Arial,sans-serif;font-size:14px">${cta.label}</a>
       </td></tr></table>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#05070A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070A;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
        <tr><td style="padding-bottom:24px;font-family:Segoe UI,Arial,sans-serif;font-size:18px;font-weight:700;color:#F8FAFC">
          <span style="color:#4DEEEA">◆</span> ${FROM_NAME}
        </td></tr>
        <tr><td style="background:#0A0F14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px">
          <h1 style="margin:0 0 16px;font-family:Segoe UI,Arial,sans-serif;font-size:20px;color:#F8FAFC">${title}</h1>
          <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.7;color:#B7C0CC">${bodyHtml}</div>
          ${button}
        </td></tr>
        <tr><td style="padding-top:20px;font-family:Segoe UI,Arial,sans-serif;font-size:11px;color:#74828f" align="center">
          Sent by ${FROM_NAME} · AI traffic control &amp; cost intelligence
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

/* ───────────────────────── templates ───────────────────────── */

export function emailInvitation(
  inviterName: string,
  orgName: string,
  role: string,
  expiresDays: number,
  inviteUrl?: string,
  teamName?: string,
) {
  const teamLine = teamName
    ? `<p>You'll join the <strong style="color:#F8FAFC">${teamName}</strong> team.</p>`
    : '';
  return {
    subject: `Join ${orgName} on Inferra`,
    html: layout(
      `You're invited to join ${orgName}`,
      `<p><strong style="color:#F8FAFC">${inviterName}</strong> invited you to join
       <strong style="color:#F8FAFC">${orgName}</strong> on Inferra as
       <strong style="color:#4DEEEA">${role}</strong>.</p>
       ${teamLine}
       <p>Click below to accept. You must sign up or sign in with <em>this exact email
       address</em> — the invitation is locked to it. It expires in ${expiresDays} days.</p>`,
      { label: 'Accept invitation', url: inviteUrl || APP_URL },
    ),
  };
}

export function emailWelcome(name: string, orgName: string) {
  return {
    subject: `Welcome to ${orgName} on Inferra`,
    html: layout(
      `Welcome aboard, ${name}!`,
      `<p>You're now a member of <strong style="color:#F8FAFC">${orgName}</strong>.</p>
       <p>Head to the Command Center to route your first request — Inferra analyses,
       optimizes and routes every prompt to the best-value model automatically.</p>`,
      { label: 'Go to dashboard', url: APP_URL },
    ),
  };
}

export function emailSubscriptionUpdate(orgName: string, planName: string, status: string) {
  return {
    subject: `Your Inferra subscription is ${status}`,
    html: layout(
      'Subscription update',
      `<p>The subscription for <strong style="color:#F8FAFC">${orgName}</strong> is now
       <strong style="color:#4DEEEA">${status}</strong> on the
       <strong style="color:#F8FAFC">${planName}</strong> plan.</p>
       <p>You can manage billing any time from Settings → Subscription.</p>`,
      { label: 'Manage billing', url: `${APP_URL}` },
    ),
  };
}

export function emailPaymentFailed(orgName: string) {
  return {
    subject: `Action needed: payment failed for ${orgName}`,
    html: layout(
      'Payment failed',
      `<p>The latest subscription payment for <strong style="color:#F8FAFC">${orgName}</strong>
       did not go through. Razorpay will retry automatically; to avoid interruption,
       please check your payment method.</p>`,
      { label: 'Update payment', url: APP_URL },
    ),
  };
}

export function emailQuotaReached(orgName: string, limit: number) {
  return {
    subject: `${orgName} has reached its monthly request limit`,
    html: layout(
      'Monthly limit reached',
      `<p><strong style="color:#F8FAFC">${orgName}</strong> has used all
       <strong style="color:#4DEEEA">${limit.toLocaleString()}</strong> requests for this month.
       Requests are paused until the cycle resets — or upgrade for more capacity.</p>`,
      { label: 'Upgrade plan', url: APP_URL },
    ),
  };
}
