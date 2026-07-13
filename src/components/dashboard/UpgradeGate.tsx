import { ArrowLeft, ArrowRight, Zap, Lock } from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';
import { getPlan, PLAN_ORDER, planRank } from '../../lib/plans';
import type { PlanType } from '../../types';

/**
 * Shown when a user hits their monthly request limit. The limit itself is
 * enforced server-side — this is just the upsell surface.
 */
export function UpgradeGate({ plan, onCancel }: { plan: PlanType; onCancel: () => void }) {
  const openPlans = useStore((s) => s.openPlans);
  const current = getPlan(plan);
  const nextPlanId = PLAN_ORDER[Math.min(planRank(plan) + 1, PLAN_ORDER.length - 1)];
  const next = getPlan(nextPlanId);

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-white transition mb-4">
        <ArrowLeft size={13} /> Back to result
      </button>

      <div className="glass-card rounded-2xl p-7 text-center">
        <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-warning-500/15 border border-warning-500/25 text-warning-400 mb-4">
          <Lock size={22} />
        </span>
        <h3 className="text-lg font-semibold text-white">Monthly request limit reached</h3>
        <p className="text-sm text-ink-3 mt-2 leading-relaxed">
          You've used all {current.requestsLimit.toLocaleString()} requests on the{' '}
          <span className="text-ink-2 font-medium">{current.name}</span> plan this month.
          Upgrade your plan to continue routing and chatting.
        </p>

        {next.id !== current.id && (
          <div className="ring-gradient rounded-xl p-4 mt-5 text-left bg-gradient-to-br from-brand-500/[0.08] to-accent-500/[0.05]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Zap size={14} className="text-brand-300" /> {next.name}
                </p>
                <p className="text-xs text-ink-3 mt-0.5">
                  {next.requestsLimit < 0 ? 'Unlimited' : next.requestsLimit.toLocaleString()} requests/month
                </p>
              </div>
              <p className="text-lg font-bold text-white">
                ${next.price}<span className="text-xs text-ink-3 font-normal">/mo</span>
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <Button onClick={() => openPlans('upgrade')} className="w-full">
            Upgrade to {next.name} <ArrowRight size={16} />
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => openPlans('upgrade')}>
              Compare plans
            </Button>
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Maybe later
            </Button>
          </div>
        </div>
        <p className="text-[0.66rem] text-ink-3 mt-3">Your limit resets at the start of next month.</p>
      </div>
    </div>
  );
}
