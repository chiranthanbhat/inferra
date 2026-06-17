import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out Inferra',
    features: [
      '100 AI requests/month',
      'Prompt optimization',
      'Smart routing',
      'Cost comparison',
      'Basic analytics',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$19',
    period: '/month',
    description: 'For growing teams',
    features: [
      '1,000 AI requests/month',
      'Everything in Free',
      'Cost intelligence',
      'Team analytics',
      'Priority support',
      'API access',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Scale',
    price: '$79',
    period: '/month',
    description: 'For serious AI operations',
    features: [
      '5,000 AI requests/month',
      'Everything in Growth',
      'Advanced routing',
      'Governance engine',
      'AI procurement advisor',
      'Team management',
      'Cost forecasting',
      'Custom rules',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$999',
    period: '/month',
    description: 'For large organizations',
    features: [
      'Unlimited requests',
      'Unlimited users & teams',
      'Everything in Scale',
      'Custom integrations',
      'Audit logs',
      'Compliance reporting',
      'Dedicated support',
      'SLA guarantees',
      'On-premise option',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export function Pricing() {
  const { initializeDemoData, setCurrentView } = useStore();

  const handleGetStarted = () => {
    initializeDemoData();
    setCurrentView('dashboard');
  };

  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-green-500/30 text-green-300 text-sm font-medium mb-6">
            <Sparkles size={14} />
            Save 30-70% on AI Spend
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Pays for itself
            <br />
            <span className="gradient-text">in the first week</span>
          </h2>
          <p className="text-lg text-gray-400">
            Most companies save 10-50x what they pay for Inferra. Start with a free trial and see your savings.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative rounded-2xl p-6 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-purple-600/20 to-purple-900/20 border-2 border-purple-500/50'
                  : 'glass-card'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">{plan.description}</p>

              <Button
                variant={plan.highlighted ? 'primary' : 'secondary'}
                className="w-full mt-6"
                onClick={handleGetStarted}
              >
                {plan.cta}
              </Button>

              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className={`mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-purple-400' : 'text-gray-500'}`} />
                    <span className="text-sm text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
