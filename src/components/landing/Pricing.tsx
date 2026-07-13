import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';
import { planRelation } from '../../lib/plans';
import type { PlanType } from '../../types';

const plans: {
  id: PlanType;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out Inferra',
    features: [
      '100 AI requests/month',
      'Smart routing',
      'Prompt optimization',
      'Cost intelligence',
      'Basic dashboard',
      'Request history',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$19',
    period: '/month',
    description: 'For growing teams',
    features: [
      '1,000 AI requests/month',
      'Everything in Free',
      'Teams & collaboration',
      'Team dashboard',
      'Usage analytics',
      'Unlimited history',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$79',
    period: '/month',
    description: 'For serious AI operations',
    features: [
      '5,000 AI requests/month',
      'Everything in Starter',
      'Advanced analytics',
      'Team permissions & AI policies',
      'Advanced cost reports',
      'Audit logs',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$999',
    period: '/month',
    description: 'For large organizations',
    features: [
      'Unlimited requests',
      'Unlimited teams & members',
      'API access',
      'SSO & white-label',
      'Custom AI models',
      'Dedicated infrastructure',
      'Enterprise support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export function Pricing() {
  const { setCurrentView, isAuthenticated, organization } = useStore();
  const currentPlan: PlanType | null = isAuthenticated ? (organization?.plan ?? 'free') : null;

  // Auth-aware CTA: existing sessions go straight to the dashboard.
  const handleGetStarted = () => {
    setCurrentView(isAuthenticated ? 'dashboard' : 'auth');
  };

  return (
    <section id="pricing" className="py-28 md:py-36 relative">
      <div className="absolute inset-0 grid-bg opacity-50" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-brand-200 text-sm font-medium mb-6">
            <Sparkles size={13} />
            Most teams save 10–50× what they pay
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
            Pricing that pays for itself
            <br />
            <span className="text-gradient-brand">in the first week.</span>
          </h2>
          <p className="text-lg text-ink-2">
            Start free. Upgrade when you see the savings — there's no risk.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
            const relation = currentPlan ? planRelation(currentPlan, plan.id) : null;
            const isCurrent = relation === 'current';
            const ctaLabel = !currentPlan
              ? plan.cta
              : relation === 'current' ? 'Current plan'
              : relation === 'upgrade' ? 'Upgrade'
              : 'Downgrade';
            return (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                isCurrent
                  ? 'ring-2 ring-brand-400/60 glass-card glow-soft'
                  : plan.highlighted
                  ? 'ring-gradient glass-card glow-soft'
                  : 'glass-card panel-hover'
              }`}
            >
              {isCurrent ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-500/90 text-[#04211f] text-[0.7rem] font-semibold rounded-full shadow-[0_6px_18px_-6px_rgba(77,238,234,0.6)]">
                  Current plan
                </div>
              ) : plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-brand-400 to-accent-500 text-[#04211f] text-[0.7rem] font-semibold rounded-full shadow-[0_6px_18px_-6px_rgba(77,238,234,0.6)]">
                  Most popular
                </div>
              )}

              <h3 className="text-base font-semibold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white tabular tracking-tight">{plan.price}</span>
                <span className="text-ink-3 text-sm">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-ink-3">{plan.description}</p>

              <Button
                variant={isCurrent ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                className="w-full mt-6"
                disabled={isCurrent}
                onClick={handleGetStarted}
              >
                {ctaLabel}
              </Button>

              <div className="mt-6 pt-6 border-t border-white/[0.07] space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <Check size={15} className={`mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-brand-300' : 'text-ink-3'}`} />
                    <span className="text-sm text-ink-2">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
