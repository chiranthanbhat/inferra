import { motion } from 'framer-motion';
import {
  ShieldCheck, Brain, Wand2, GitBranch, FileCode2,
  DollarSign, Lock, BarChart3, Boxes,
} from 'lucide-react';

const features = [
  { icon: ShieldCheck, title: 'Security engine', description: 'Detect API keys, secrets, and PII before any request leaves your perimeter.', details: ['Secret detection', 'PII scanning', 'GDPR · HIPAA · SOC 2'] },
  { icon: Brain, title: 'Prompt intelligence', description: 'Score every prompt for quality, token waste, and structural weakness.', details: ['Quality scoring', 'Waste detection', 'Auto-optimization'] },
  { icon: Wand2, title: 'Optimization', description: 'Rewrite prompts for clarity and information density — not lossy compression.', details: ['Redundancy removal', 'Context tightening', '30–60% fewer tokens'] },
  { icon: GitBranch, title: 'Smart routing', description: 'Route each request to the optimal model on cost, speed, quality, and fit.', details: ['Multi-model', 'Quality matching', 'Automatic fallback'] },
  { icon: FileCode2, title: 'Model-aware rewrite', description: "Tune the final prompt for each model's strengths and formatting.", details: ['GPT', 'Claude', 'Gemini · DeepSeek'] },
  { icon: DollarSign, title: 'Cost intelligence', description: 'Real-time visibility into cost per prompt, team, and department.', details: ['Cost breakdown', 'Savings tracking', 'Budget alerts'] },
  { icon: Lock, title: 'Governance', description: 'Enterprise controls for compliance, policy enforcement, and approvals.', details: ['Policy engine', 'Audit logging', 'Role-based access'] },
  { icon: BarChart3, title: 'Team analytics', description: 'Track AI adoption, productivity, and ROI across teams and departments.', details: ['Usage dashboards', 'Team comparison', 'Trend analysis'] },
  { icon: Boxes, title: 'Procurement advisor', description: 'Analyze usage to recommend which AI subscriptions to keep or consolidate.', details: ['Subscription analysis', 'Vendor comparison', 'Annual projections'] },
];

export function Features() {
  return (
    <section id="features" className="relative py-28 md:py-36">
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <p className="eyebrow mb-4">Platform</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.08]">
            Everything you need to govern AI spend.
          </h2>
          <p className="mt-5 text-lg text-ink-2 leading-relaxed">
            One control plane between your apps and every provider — analysis, optimization,
            security, routing, and cost intelligence in a single pass.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
                className="group glass-card panel-hover rounded-2xl p-6"
              >
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-brand-300 mb-5 group-hover:border-brand-500/40 transition-colors">
                  <Icon size={19} />
                </span>
                <h3 className="text-[1.02rem] font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm text-ink-3 leading-relaxed mb-4">{f.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {f.details.map((d) => (
                    <span key={d} className="text-[0.7rem] text-ink-2 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.05]">
                      {d}
                    </span>
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
