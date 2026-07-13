import { motion } from 'framer-motion';
import {
  ShieldCheck, ScanSearch, Wand2, GitBranch, FileCode2,
  DollarSign, CheckCircle2, Brain, ArrowRight,
} from 'lucide-react';

const layers = [
  { n: '01', icon: ShieldCheck, title: 'Security scan', desc: 'Detect API keys, secrets, PII, and policy violations before anything leaves your perimeter.' },
  { n: '02', icon: Brain, title: 'Intent & complexity', desc: 'Classify task type, reasoning depth, context needs, and output requirements.' },
  { n: '03', icon: ScanSearch, title: 'Prompt intelligence', desc: 'Score quality, detect token waste, redundancy, and weak structure.' },
  { n: '04', icon: Wand2, title: 'Optimization', desc: 'Rewrite for clarity and information density — improvement, not lossy compression.' },
  { n: '05', icon: GitBranch, title: 'Model routing', desc: 'Score every model on quality, reasoning, speed, cost, and context fit. Pick the winner.' },
  { n: '06', icon: FileCode2, title: 'Model-aware rewrite', desc: 'Tune the final prompt for the selected model — GPT, Claude, Gemini, DeepSeek.' },
  { n: '07', icon: DollarSign, title: 'Cost intelligence', desc: 'Compute original, optimized, and routed cost with annualized savings projections.' },
  { n: '08', icon: CheckCircle2, title: 'Governance & dispatch', desc: 'Final compliance check, audit log, and delivery to the optimal model.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 md:py-36">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header — asymmetric */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 items-end mb-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
          >
            <p className="eyebrow mb-4">The pipeline</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.08]">
              Eight layers run before<br />a single token is spent.
            </h2>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-ink-2 text-lg leading-relaxed max-w-md"
          >
            Inferra sits between your application and every model provider. Each request
            passes through a deterministic pipeline — so you know the cost, latency, quality,
            and risk before it ships.
          </motion.p>
        </div>

        {/* Layer grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-white/[0.06] border border-white/[0.06]">
          {layers.map((l, i) => {
            const Icon = l.icon;
            return (
              <motion.div
                key={l.n}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: (i % 4) * 0.07 }}
                className="group relative bg-surface/80 p-6 hover:bg-surface-2 transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-brand-300 group-hover:border-brand-500/40 group-hover:text-brand-200 transition-colors">
                    <Icon size={18} />
                  </span>
                  <span className="font-mono text-xs text-ink-3">{l.n}</span>
                </div>
                <h3 className="text-[0.95rem] font-semibold text-white mb-1.5">{l.title}</h3>
                <p className="text-[0.82rem] text-ink-3 leading-relaxed">{l.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Outcome strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="ring-gradient glass-card rounded-2xl mt-8 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 text-white">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-white font-semibold">Better output, lower cost — every time.</p>
              <p className="text-ink-3 text-sm">Representative request, summarization workload.</p>
            </div>
          </div>
          <div className="flex items-center gap-8 sm:gap-12">
            <Stat label="Original" value="$0.214" muted strike />
            <ArrowRight size={18} className="text-ink-3" />
            <Stat label="Inferra" value="$0.021" />
            <Stat label="Saved" value="90%" accent />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent, muted, strike }: { label: string; value: string; accent?: boolean; muted?: boolean; strike?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold tabular ${accent ? 'text-gradient-brand' : muted ? 'text-ink-3' : 'text-white'} ${strike ? 'line-through decoration-ink-3/40' : ''}`}>{value}</p>
      <p className="text-[0.7rem] text-ink-3 mt-1">{label}</p>
    </div>
  );
}
