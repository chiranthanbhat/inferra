import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator as CalcIcon, DollarSign, Sparkles, TrendingDown } from 'lucide-react';
import { Card, Button } from '../ui';
import { formatCurrency } from '../../lib/utils';
import { useStore } from '../../store/useStore';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🟢' },
  { id: 'anthropic', name: 'Anthropic (Claude)', icon: '🟠' },
  { id: 'google', name: 'Google (Gemini)', icon: '🔵' },
  { id: 'mixed', name: 'Multiple Providers', icon: '🟣' },
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
  const { initializeDemoData, setCurrentView } = useStore();

  const actualSpend = useCustom && customSpend ? parseInt(customSpend) || 0 : monthlySpend;
  const savingsRate = SAVINGS_BY_PROVIDER[provider];
  const projectedSpend = actualSpend * (1 - savingsRate / 100);
  const monthlySavings = actualSpend - projectedSpend;
  const annualSavings = monthlySavings * 12;

  const handleGetStarted = () => {
    initializeDemoData();
    setCurrentView('dashboard');
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-green-500/30 text-green-300 text-sm font-medium mb-6">
            <CalcIcon size={14} />
            Savings Calculator
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            How much could
            <span className="gradient-text"> you save?</span>
          </h2>
          <p className="text-lg text-gray-400">
            Enter your current monthly AI spend. Check your OpenAI, Anthropic, or Google billing dashboard.
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
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    <DollarSign size={16} className="text-green-400" />
                    What's your current monthly AI spend?
                  </label>
                  
                  {/* Preset buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {SPEND_PRESETS.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => { setMonthlySpend(amount); setUseCustom(false); }}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                          !useCustom && monthlySpend === amount
                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        ${amount >= 1000 ? `${amount/1000}K` : amount}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                    <input
                      type="number"
                      placeholder="Enter exact amount..."
                      value={customSpend}
                      onChange={(e) => { setCustomSpend(e.target.value); setUseCustom(true); }}
                      onFocus={() => setUseCustom(true)}
                      className="w-full bg-navy-800/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition"
                    />
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    💡 Find this in your OpenAI billing dashboard, Anthropic console, or Google Cloud billing
                  </p>
                </div>

                {/* Provider */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                    Which AI provider do you primarily use?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProvider(p.id)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          provider === p.id
                            ? 'bg-purple-500/30 border border-purple-500/50'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-lg mr-2">{p.icon}</span>
                        <span className={`text-sm font-medium ${provider === p.id ? 'text-purple-300' : 'text-gray-300'}`}>
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Why these inputs */}
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Why we ask this</p>
                  <p className="text-sm text-gray-400">
                    We know exactly how much each AI model costs. By knowing your monthly spend and provider, 
                    we can calculate how many requests you're making and how much Inferra's routing would save.
                  </p>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div className="p-6 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign size={18} className="text-red-400" />
                    <span className="text-sm text-gray-400">Current Monthly Spend</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{formatCurrency(actualSpend)}</p>
                </div>

                <div className="p-6 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-green-400" />
                    <span className="text-sm text-gray-400">With Inferra</span>
                  </div>
                  <p className="text-3xl font-bold text-green-400">{formatCurrency(projectedSpend)}</p>
                  <p className="text-xs text-gray-500 mt-1">Smart routing + prompt optimization</p>
                </div>

                <div className="p-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={18} className="text-purple-400" />
                    <span className="text-sm text-gray-300">Your Savings</span>
                  </div>
                  <div className="flex items-baseline gap-6">
                    <div>
                      <p className="text-3xl font-bold text-white">{formatCurrency(monthlySavings)}</p>
                      <p className="text-xs text-gray-500">per month</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold gradient-text">{formatCurrency(annualSavings)}</p>
                      <p className="text-xs text-gray-500">per year</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                      {savingsRate}% savings
                    </span>
                    <span className="text-xs text-gray-500">based on average customer results</span>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={handleGetStarted}>
                  Start Saving Now
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
