import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator as CalcIcon, DollarSign, Sparkles, TrendingDown } from 'lucide-react';
import { Card, Button } from '../ui';
import { formatCurrency } from '../../lib/utils';
import { useStore } from '../../store/useStore';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', dot: 'bg-emerald-400' },
  { id: 'anthropic', name: 'Anthropic', dot: 'bg-orange-400' },
  { id: 'google', name: 'Google', dot: 'bg-sky-400' },
  { id: 'mixed', name: 'Multiple', dot: 'bg-brand-400' },
];

// Savings rates by provider (based on how much routing + optimization helps)
const SAVINGS_BY_PROVIDER: Record<string, number> = {
  'openai': 55,
  'anthropic': 50,
  'google': 40,
  'mixed': 60,
};

// Monthly spend presets
const SPEND_PRESETS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];

export function Calculator() {
  const [monthlySpend, setMonthlySpend] = useState(2000);
  const [provider, setProvider] = useState('mixed');
  const [customSpend, setCustomSpend] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const { setCurrentView, isAuthenticated } = useStore();

  const actualSpend = useCustom && customSpend ? parseInt(customSpend) || 0 : monthlySpend;
  const savingsRate = SAVINGS_BY_PROVIDER[provider];
  const projectedSpend = actualSpend * (1 - savingsRate / 100);
  const monthlySavings = actualSpend - projectedSpend;
  const annualSavings = monthlySavings * 12;

  // Auth-aware CTA: existing sessions go straight to the dashboard.
  const handleGetStarted = () => {
    setCurrentView(isAuthenticated ? 'dashboard' : 'auth');
  };

  return (
    <section id="calculator" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 grid-bg" />
      
      <div className="relative max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-brand-200 text-sm font-medium mb-6">
            <CalcIcon size={13} />
            Savings calculator
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
            How much could
            <span className="text-gradient-brand"> you save?</span>
          </h2>
          <p className="text-lg text-ink-2">
            Enter your current monthly AI spend — find it in your OpenAI, Anthropic, or Google billing.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card variant="gradient" padding="lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Inputs */}
              <div className="space-y-6">
                {/* Monthly Spend */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-2 mb-3">
                    <DollarSign size={16} className="text-brand-300" />
                    What's your current monthly AI spend?
                  </label>

                  {/* Preset buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {SPEND_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => { setMonthlySpend(amount); setUseCustom(false); }}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all tabular ${
                          !useCustom && monthlySpend === amount
                            ? 'bg-brand-500/20 text-brand-200 border border-brand-500/40'
                            : 'bg-white/[0.04] text-ink-3 border border-white/[0.07] hover:bg-white/[0.07]'
                        }`}
                      >
                        ${amount >= 1000 ? `${amount/1000}K` : amount}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 text-lg">$</span>
                    <input
                      type="number"
                      placeholder="Enter exact amount..."
                      value={customSpend}
                      onChange={(e) => { setCustomSpend(e.target.value); setUseCustom(true); }}
                      onFocus={() => setUseCustom(true)}
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white placeholder-ink-3 tabular focus:outline-none focus:border-brand-500/50 transition"
                    />
                  </div>

                  <p className="text-xs text-ink-3 mt-2">
                    Find this in your OpenAI billing dashboard, Anthropic console, or Google Cloud billing.
                  </p>
                </div>

                {/* Provider */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-2 mb-3">
                    Which AI provider do you primarily use?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all ${
                          provider === p.id
                            ? 'bg-brand-500/15 border border-brand-500/40'
                            : 'bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                        <span className={`text-sm font-medium ${provider === p.id ? 'text-brand-200' : 'text-ink-2'}`}>
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Why these inputs */}
                <div className="p-4 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                  <p className="eyebrow mb-2">Why we ask this</p>
                  <p className="text-sm text-ink-3 leading-relaxed">
                    We know exactly what each model costs. From your spend and provider we estimate your
                    request volume and how much Inferra's routing and optimization would save.
                  </p>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div className="p-6 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-ink-3" />
                    <span className="text-sm text-ink-3">Current monthly spend</span>
                  </div>
                  <p className="text-3xl font-bold text-white tabular">{formatCurrency(actualSpend)}</p>
                </div>

                <div className="p-6 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-success-400" />
                    <span className="text-sm text-ink-3">With Inferra</span>
                  </div>
                  <p className="text-3xl font-bold text-success-400 tabular">{formatCurrency(projectedSpend)}</p>
                  <p className="text-xs text-ink-3 mt-1">Smart routing + prompt optimization</p>
                </div>

                <div className="ring-gradient p-6 bg-gradient-to-r from-brand-500/15 to-accent-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={18} className="text-brand-300" />
                    <span className="text-sm text-ink-2">Your savings</span>
                  </div>
                  <div className="flex items-baseline gap-8">
                    <div>
                      <p className="text-3xl font-bold text-white tabular">{formatCurrency(monthlySavings)}</p>
                      <p className="text-xs text-ink-3">per month</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-gradient-brand tabular">{formatCurrency(annualSavings)}</p>
                      <p className="text-xs text-ink-3">per year</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-success-500/15 text-success-400 text-xs font-semibold rounded-full border border-success-500/25 tabular">
                      {savingsRate}% savings
                    </span>
                    <span className="text-xs text-ink-3">based on average customer results</span>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={handleGetStarted}>
                  Start saving now
                  <Sparkles size={18} />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
