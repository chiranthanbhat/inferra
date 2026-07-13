import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, X, Loader2 } from 'lucide-react';
import { Wordmark } from '../components/ui';
import { useStore } from '../store/useStore';
import { useAuth } from '../lib/auth';
import { useOrganization } from '../lib/orgContext';
import { useToast } from '../lib/toast';
import { PLANS, PLAN_ORDER, planRank } from '../lib/plans';
import { completeOnboarding } from '../lib/db';
import { startCheckout } from '../lib/razorpayClient';
import type { PlanType } from '../types';

export function PlanSelection({ mode }: { mode: 'onboarding' | 'upgrade' }) {
  const user = useStore((s) => s.user);
  const organization = useStore((s) => s.organization);
  const closePlans = useStore((s) => s.closePlans);
  const { refreshProfile } = useAuth();
  const { refreshOrganization } = useOrganization();
  const toast = useToast();
  const [busy, setBusy] = useState<PlanType | null>(null);

  const currentPlan: PlanType = organization?.plan ?? 'free';
  const currentRank = planRank(currentPlan);

  const finish = async () => {
    if (user && !user.onboarded) await completeOnboarding(user.id).catch(() => {});
    await Promise.all([refreshProfile(), refreshOrganization()]);
    closePlans();
  };

  const choosePlan = async (plan: PlanType) => {
    if (!user || busy) return;

    if (plan === 'free') {
      setBusy('free');
      await finish();
      setBusy(null);
      return;
    }
    if (plan === 'enterprise') {
      window.open('mailto:sales@inferra.ai?subject=Enterprise%20plan', '_blank');
      return;
    }

    setBusy(plan);
    await startCheckout({
      plan,
      user: { name: user.name, email: user.email },
      onSuccess: async (confirmed) => {
        toast({ title: 'Subscription active', description: `You're now on the ${PLANS[confirmed].name} plan.`, variant: 'success' });
        await finish();
        setBusy(null);
      },
      onDismiss: () => setBusy(null),
      onError: (m) => { toast({ title: 'Checkout failed', description: m, variant: 'error' }); setBusy(null); },
    });
  };

  return (
    <div className="min-h-screen bg-bg p-6 overflow-y-auto">
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="relative max-w-6xl mx-auto py-10">
        <div className="flex items-center justify-between mb-8">
          <Wordmark size={32} />
          {mode === 'upgrade' && (
            <button onClick={closePlans} className="grid place-items-center w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] text-ink-3 hover:text-white transition">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">
            {mode === 'onboarding' ? 'Choose your plan' : 'Upgrade your plan'}
          </h1>
          <p className="text-ink-3 mt-2">
            {mode === 'onboarding'
              ? 'Start free — upgrade any time as you grow. No credit card required for Free.'
              : 'Unlock more requests and features. Changes apply immediately.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLAN_ORDER.map((id, i) => {
            const plan = PLANS[id];
            const isCurrent = currentPlan === id;
            const isDowngrade = planRank(id) < currentRank;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className={`glass-card rounded-2xl p-6 flex flex-col relative ${plan.highlighted ? 'ring-gradient' : ''}`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-6 px-2 py-0.5 rounded-md text-[0.62rem] font-semibold bg-gradient-to-r from-brand-400 to-accent-500 text-[#04211f]">
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-white">${plan.price}</span>
                  <span className="text-sm text-ink-3">/month</span>
                </div>
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check size={15} className="text-success-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => choosePlan(id)}
                  disabled={isCurrent || isDowngrade || busy !== null}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed ${
                    isCurrent
                      ? 'bg-white/[0.05] border border-white/[0.08] text-ink-3'
                      : isDowngrade
                        ? 'bg-white/[0.03] border border-white/[0.06] text-ink-3 opacity-60'
                        : plan.highlighted || id === 'free'
                          ? 'bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] hover:brightness-110'
                          : 'bg-white/[0.06] border border-white/[0.10] text-white hover:bg-white/[0.10]'
                  }`}
                >
                  {busy === id ? (
                    <><Loader2 size={15} className="animate-spin" /> Processing…</>
                  ) : isCurrent ? (
                    'Current plan'
                  ) : isDowngrade ? (
                    'Included below'
                  ) : id === 'enterprise' ? (
                    'Contact sales'
                  ) : id === 'free' ? (
                    <>Continue free <ArrowRight size={15} /></>
                  ) : (
                    <>Choose {plan.name} <ArrowRight size={15} /></>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {mode === 'onboarding' && (
          <p className="text-center text-xs text-ink-3 mt-8">
            You can change or cancel your plan any time from Settings.
          </p>
        )}
      </div>
    </div>
  );
}
