import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import {
  ArrowRight, Play, ScanSearch, Wand2, ShieldCheck, Route, Cpu,
  Check, TrendingDown, Gauge, Sparkle,
} from 'lucide-react';
import { Button } from '../ui';
import { useStore } from '../../store/useStore';

const providers = ['GPT-5', 'Claude', 'Gemini', 'Grok', 'DeepSeek'];

export function Hero() {
  const { setCurrentView, isAuthenticated } = useStore();
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auth-aware CTA: existing sessions continue straight to the workspace.
  const handleGetStarted = () => {
    setCurrentView(isAuthenticated ? 'dashboard' : 'auth');
  };

  // Mouse-reactive ambient lighting (very low intensity)
  const onMove = (e: React.MouseEvent) => {
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <section
      ref={sectionRef}
      onMouseMove={onMove}
      className="relative min-h-screen overflow-hidden pt-36 pb-24"
    >
      {/* Structured backdrop, not blobs */}
      <div className="absolute inset-0 grid-bg" />
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(480px circle at var(--mx, 70%) var(--my, 20%), rgba(77,238,234,0.10), transparent 60%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          {/* ── Editorial column ── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 rounded-full glass text-sm"
            >
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-200 text-[0.7rem] font-semibold tracking-wide">
                <Sparkle size={11} /> NEW
              </span>
              <span className="text-ink-2">Know before you spend.</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.06 }}
              className="font-display mt-7 text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-bold leading-[1.04] tracking-tight text-white text-balance"
            >
              Every AI request, optimized
              <br />
              <span className="text-gradient">before it costs you money.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-7 max-w-xl text-lg text-ink-2 leading-relaxed text-pretty"
            >
              Inferra analyzes, optimizes, and secures every request — then routes it to
              the best model across{' '}
              <span className="text-white font-medium">GPT, Claude, Gemini, Grok, DeepSeek</span>{' '}
              and any future model. You see the cost, latency, and risk before a token is spent.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.26 }}
              className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3.5"
            >
              <Button size="lg" onClick={handleGetStarted} className="group">
                {isAuthenticated ? 'Continue to Workspace' : 'Start Free'}
                <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                className="group"
              >
                <span className="grid place-items-center w-5 h-5 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                  <Play size={9} className="fill-white text-white ml-0.5" />
                </span>
                Watch Demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12"
            >
              <p className="eyebrow mb-4">Routes intelligently across</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {providers.map((p) => (
                  <span key={p} className="text-ink-3 hover:text-ink-2 transition-colors text-sm font-medium tracking-tight">
                    {p}
                  </span>
                ))}
                <span className="text-ink-3 text-sm">+ any future model</span>
              </div>
            </motion.div>
          </div>

          {/* ── Live routing console ── */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <RoutingConsole />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Live console ───────────────────────── */

type Scenario = {
  prompt: string;
  task: string;
  model: string;
  provider: string;
  original: number;
  optimized: number;
  latency: number;
  quality: number;
  candidates: { name: string; score: number; win?: boolean }[];
};

const scenarios: Scenario[] = [
  {
    prompt: 'Summarize this 14-page vendor contract into 5 risk bullets.',
    task: 'Summarization · Long context',
    model: 'Claude Haiku 4.5', provider: 'Anthropic',
    original: 0.214, optimized: 0.021, latency: 480, quality: 96,
    candidates: [
      { name: 'GPT-5', score: 91 },
      { name: 'Claude Haiku 4.5', score: 96, win: true },
      { name: 'Gemini Flash', score: 88 },
    ],
  },
  {
    prompt: 'Classify 5,000 support tickets by intent and urgency.',
    task: 'Classification · High volume',
    model: 'DeepSeek-V3', provider: 'Open source',
    original: 1.640, optimized: 0.088, latency: 210, quality: 94,
    candidates: [
      { name: 'GPT-5', score: 95 },
      { name: 'DeepSeek-V3', score: 94, win: true },
      { name: 'Gemini Flash', score: 90 },
    ],
  },
  {
    prompt: 'Write production unit tests for this auth module.',
    task: 'Code generation · Reasoning',
    model: 'GPT-5', provider: 'OpenAI',
    original: 0.092, optimized: 0.058, latency: 1320, quality: 98,
    candidates: [
      { name: 'GPT-5', score: 98, win: true },
      { name: 'Claude Sonnet', score: 97 },
      { name: 'Gemini Pro', score: 92 },
    ],
  },
];

const stages = [
  { icon: ScanSearch, label: 'Analysis', sub: 'Intent + complexity' },
  { icon: Wand2, label: 'Optimization', sub: '−38% tokens' },
  { icon: ShieldCheck, label: 'Security', sub: 'PII · secrets · policy' },
  { icon: Route, label: 'Routing', sub: 'Best model fit' },
];

function RoutingConsole() {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState(0);
  const s = scenarios[idx];

  // Stage sweep, then advance the scenario
  useEffect(() => {
    setActive(0);
    const sweeps = stages.map((_, i) =>
      setTimeout(() => setActive(i + 1), 500 + i * 520),
    );
    const next = setTimeout(() => setIdx((p) => (p + 1) % scenarios.length), 5200);
    return () => { sweeps.forEach(clearTimeout); clearTimeout(next); };
  }, [idx]);

  const savings = Math.round(((s.original - s.optimized) / s.original) * 100);

  return (
    <div className="ring-gradient glass-card rounded-[20px] p-5 sm:p-6 glow-soft">
      {/* window chrome */}
      <div className="flex items-center justify-between pb-4 hairline-b">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-error-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-success-400/60" />
          <span className="ml-3 text-xs text-ink-3 font-mono">inferra · routing engine</span>
        </div>
        <span className="flex items-center gap-1.5 text-[0.7rem] text-success-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse-soft" />
          live
        </span>
      </div>

      {/* incoming prompt */}
      <div className="mt-4">
        <p className="eyebrow mb-2">Incoming request</p>
        <div className="rounded-xl bg-black/30 border border-white/[0.06] px-4 py-3 min-h-[60px]">
          <motion.p
            key={s.prompt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-ink-2 leading-snug"
          >
            <span className="text-brand-300 font-mono mr-1.5">›</span>
            {s.prompt}
          </motion.p>
          <p className="mt-1.5 text-[0.7rem] text-ink-3">{s.task}</p>
        </div>
      </div>

      {/* pipeline */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {stages.map((st, i) => {
          const done = active > i;
          const Icon = st.icon;
          return (
            <div
              key={st.label}
              className={`relative rounded-xl border px-2.5 py-3 transition-all duration-500 ${
                done
                  ? 'border-brand-500/40 bg-brand-500/[0.08]'
                  : 'border-white/[0.06] bg-white/[0.015]'
              }`}
            >
              <Icon
                size={16}
                className={`transition-colors duration-500 ${done ? 'text-brand-300' : 'text-ink-3'}`}
              />
              <p className={`mt-2 text-[0.72rem] font-medium transition-colors ${done ? 'text-white' : 'text-ink-3'}`}>
                {st.label}
              </p>
              <p className="text-[0.62rem] text-ink-3 leading-tight mt-0.5">{st.sub}</p>
              {done && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-2 right-2 grid place-items-center w-3.5 h-3.5 rounded-full bg-brand-500"
                >
                  <Check size={9} className="text-white" />
                </motion.span>
              )}
            </div>
          );
        })}
      </div>

      {/* decision */}
      <div className="mt-4 rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 text-white">
              <Cpu size={17} />
            </span>
            <div>
              <p className="text-[0.7rem] text-ink-3">Routed to</p>
              <motion.p key={s.model} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold text-white">
                {s.model} <span className="text-ink-3 font-normal">· {s.provider}</span>
              </motion.p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end text-success-400 text-sm font-semibold">
              <TrendingDown size={14} /> {savings}% saved
            </div>
            <p className="text-[0.7rem] text-ink-3">
              <span className="line-through">${s.original.toFixed(3)}</span> → <span className="text-white">${s.optimized.toFixed(3)}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Metric icon={<Gauge size={13} />} label="Latency" value={s.latency} suffix="ms" />
          <Metric icon={<Sparkle size={13} />} label="Quality" value={s.quality} suffix="/100" />
          <Metric icon={<TrendingDown size={13} />} label="Cost/1k" value={s.optimized * 1000} prefix="$" decimals={2} />
        </div>
      </div>

      {/* candidates */}
      <div className="mt-4">
        <p className="eyebrow mb-2.5">Model scoring</p>
        <div className="space-y-1.5">
          {s.candidates.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className={`w-28 text-xs truncate ${c.win ? 'text-white font-medium' : 'text-ink-3'}`}>{c.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  key={`${s.model}-${c.name}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${c.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${c.win ? 'bg-gradient-to-r from-brand-500 to-accent-500' : 'bg-white/15'}`}
                />
              </div>
              <span className={`w-7 text-right text-xs tabular ${c.win ? 'text-brand-300 font-semibold' : 'text-ink-3'}`}>{c.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon, label, value, prefix = '', suffix = '', decimals = 0,
}: { icon: React.ReactNode; label: string; value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9, ease: 'easeOut',
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return controls.stop;
  }, [value, decimals, mv]);
  return (
    <div className="rounded-lg bg-black/25 border border-white/[0.05] px-2.5 py-2">
      <div className="flex items-center gap-1 text-ink-3 text-[0.65rem] mb-1">{icon}{label}</div>
      <p className="text-sm font-semibold text-white tabular">{prefix}{display}{suffix}</p>
    </div>
  );
}
