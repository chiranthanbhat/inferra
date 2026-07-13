// ============================================
// RAZORPAY CHECKOUT (client)
// Loads the Razorpay checkout script on demand and opens the subscription
// checkout. The subscription is created server-side (createSubscription) so the
// browser only ever receives a subscription_id + the public key_id.
// ============================================

import { createSubscription, confirmSubscription } from './functions';
import type { PlanType } from '../types';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface CheckoutOptions {
  plan: PlanType;
  user: { name: string; email: string };
  onSuccess: (plan: PlanType) => void;
  onDismiss?: () => void;
  onError?: (message: string) => void;
}

/**
 * Full upgrade flow: create the subscription server-side, open Razorpay
 * checkout, then confirm the payment signature server-side on success.
 */
export async function startCheckout({ plan, user, onSuccess, onDismiss, onError }: CheckoutOptions): Promise<void> {
  const ok = await loadScript();
  if (!ok) {
    onError?.('Could not load the secure checkout. Check your connection and try again.');
    return;
  }

  let checkout;
  try {
    checkout = await createSubscription(plan);
  } catch (e: any) {
    onError?.(e?.message || 'Could not start checkout. Please try again.');
    return;
  }

  const rzp = new window.Razorpay({
    key: checkout.razorpayKeyId,
    subscription_id: checkout.subscriptionId,
    name: 'Inferra',
    description: `Inferra ${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription`,
    prefill: { name: user.name, email: user.email },
    theme: { color: '#4DEEEA' },
    handler: async (resp: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
      try {
        const { plan: confirmedPlan } = await confirmSubscription(resp);
        onSuccess(confirmedPlan);
      } catch (e: any) {
        onError?.(e?.message || 'Payment received but confirmation failed. It will sync shortly.');
      }
    },
    modal: { ondismiss: () => onDismiss?.() },
  });

  rzp.on('payment.failed', (resp: any) => {
    onError?.(resp?.error?.description || 'Payment failed. Please try a different method.');
  });

  rzp.open();
}
