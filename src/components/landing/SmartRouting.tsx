import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, DollarSign, Sparkle } from 'lucide-react';

type Model = { name: string; vendor: string; cost: number; speed: number; quality: number };

const models: Model[] = [
  { name: 'GPT-5', vendor: 'OpenAI', cost: 5, speed: 3, quality: 5 },
  { name: 'Claude Sonnet 4.6', vendor: 'Anthropic', cost: 4, speed: 4, quality: 5 },
  { name: 'Claude Haiku 4.5', vendor: 'Anthropic', cost: 2, speed: 5, quality: 4 },
  { name: 'Gemini Flash', vendor: 'Google', cost: 1, speed: 5, quality: 4 },
  { name: 'DeepSeek-V3', vendor: 'Open source', cost: 1, speed: 4, quality: 4 },
];

const tasks = [
  { id: 'summarize', label: 'Summarize', winner: 'Claude Haiku 4.5', why: 'Long-context summary — high quality at a fraction of the cost.' },
  { id: 'classify', label: 'Classify', winner: 'DeepSeek-V3', why: 'High-volume classification — open-source economics, ample quality.' },
  { id: 'reason', label: 'Reason / code', winner: 'GPT-5', why: 'Deep reasoning — top accuracy justifies the premium tokens.' },
  { id: 'draft', label: 'Draft copy', winner: 'Gemini Flash', why: 'Fast, cheap generation where latency matters most.' },
];

function Dots({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < value ? tone : 'bg-white/10'}`} />
      ))}
    </div>
  );
}

export function SmartRouting() {
  const [task, setTask] = useState(tasks[0]);

  return (
    <section id="routing" className="relative py-28 md:py-36">
      <div className="absolute inset-0 dot-bg opacity-[0.4]" style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, #000, transparent)' }} />
      <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-center">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
        >
          <p className="eyebrow mb-4">Smart routing</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.08]">
            One prompt.<br />Every model.<br />
            <span className="text-gradient-brand">The right call.</span>
          </h2>
          <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-md">
            Inferra scores each candidate on cost, speed, and quality for the specific task —
            then routes automatically. No hard-coded vendor lock-in.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setTask(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  task.id === t.id
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-200'
                    : 'bg-white/[0.03] border-white/[0.07] text-ink-3 hover:text-white hover:border-white/15'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={task.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-5 text-sm text-ink-3 leading-relaxed"
            >
              <span className="text-white font-medium">{task.winner}</span> — {task.why}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Comparison panel */}
        <motion.div
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}
          className="ring-gradient glass-card rounded-2xl p-5 sm:p-6"
        >
          <div className="flex items-center justify-between pb-4 hairline-b">
            <p className="text-sm font-semibold text-white">Candidate models</p>
            <span className="flex items-center gap-1.5 text-[0.7rem] text-brand-300">
              <Sparkle size={11} /> scoring for {task.label.toLowerCase()}
            </span>
          </div>

          {/* header row */}
          <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr] gap-3 px-2 mt-3 mb-1 text-[0.62rem] uppercase tracking-wider text-ink-3">
            <span>Model</span>
            <span className="flex items-center gap-1"><DollarSign size={10} />Cost</span>
            <span className="flex items-center gap-1"><Zap size={10} />Speed</span>
            <span className="flex items-center gap-1"><Sparkle size={10} />Quality</span>
          </div>

          <div className="space-y-1.5">
            {models.map((m) => {
              const win = m.name === task.winner;
              return (
                <motion.div
                  key={m.name}
                  layout
                  className={`grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr] gap-3 items-center rounded-xl px-2 py-3 border transition-colors duration-300 ${
                    win ? 'bg-brand-500/[0.1] border-brand-500/40' : 'bg-white/[0.015] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`grid place-items-center w-6 h-6 rounded-md text-[0.7rem] font-semibold shrink-0 ${win ? 'bg-brand-500 text-white' : 'bg-white/[0.06] text-ink-2'}`}>
                      {win ? <Check size={13} /> : m.vendor[0]}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${win ? 'text-white font-semibold' : 'text-ink-2'}`}>{m.name}</p>
                      <p className="text-[0.66rem] text-ink-3 truncate">{m.vendor}</p>
                    </div>
                  </div>
                  {/* lower cost dots = cheaper, render inverse so more dots = cheaper */}
                  <Dots value={6 - m.cost} tone={win ? 'bg-accent-400' : 'bg-white/25'} />
                  <Dots value={m.speed} tone={win ? 'bg-accent-400' : 'bg-white/25'} />
                  <Dots value={m.quality} tone={win ? 'bg-brand-400' : 'bg-white/25'} />
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-500/15 to-accent-500/10 border border-brand-500/25 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 text-white">
                <Check size={16} />
              </span>
              <div>
                <p className="text-[0.7rem] text-ink-3">Inferra routes to</p>
                <p className="text-sm font-semibold text-white">{task.winner}</p>
              </div>
            </div>
            <span className="text-[0.72rem] text-ink-3 hidden sm:block">decided in &lt;40ms</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
