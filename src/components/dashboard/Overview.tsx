import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import {
  DollarSign, TrendingDown, Activity, Gauge, ArrowDownRight, ArrowUpRight,
  ShieldCheck, GitBranch, Cpu, Eye, KeyRound, FileWarning, Zap, CalendarClock, Crown,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { formatCurrency, formatNumber, formatLatency, cn } from '../../lib/utils';
import { usageSnapshot } from '../../lib/subscription';

/* deterministic pseudo-random so the demo looks alive but stable */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const BRAND = '#4deeea';
const ACCENT = '#7dd3fc';
const modelPalette = [BRAND, ACCENT, '#34d399', '#fbbf24', '#74828f'];

export function Overview() {
  const { stats, organization, requestHistory, openPlans } = useStore();

  const savingsPercent = stats.totalSpend + stats.totalSavings > 0
    ? (stats.totalSavings / (stats.totalSpend + stats.totalSavings)) * 100 : 0;

  const sub = usageSnapshot(organization);
  const usagePercent = sub.percent;

  // ── derived series ──
  const { spendSeries, trafficSeries, modelMix, perf } = useMemo(() => {
    const rnd = seeded(42);
    const spendSeries = Array.from({ length: 14 }, (_, i) => {
      const base = 3 + rnd() * 2.4;
      return {
        d: `D${i + 1}`,
        original: +(base * (2.6 + rnd() * 0.5)).toFixed(2),
        optimized: +base.toFixed(2),
      };
    });
    const trafficSeries = Array.from({ length: 24 }, (_, i) => ({
      h: `${i}:00`,
      requests: Math.round(40 + Math.sin(i / 3.4) * 26 + rnd() * 22),
      blocked: Math.round(rnd() * 4),
    }));
    const modelMix = [
      { name: 'Claude Haiku', value: 34 },
      { name: 'GPT-5', value: 24 },
      { name: 'Gemini Flash', value: 19 },
      { name: 'DeepSeek-V3', value: 15 },
      { name: 'Open source', value: 8 },
    ];
    const perf = [
      { name: 'Claude Haiku 4.5', vendor: 'Anthropic', share: 34, latency: 480, quality: 96 },
      { name: 'GPT-5', vendor: 'OpenAI', share: 24, latency: 1320, quality: 98 },
      { name: 'Gemini Flash', vendor: 'Google', share: 19, latency: 210, quality: 90 },
      { name: 'DeepSeek-V3', vendor: 'Open source', share: 15, latency: 360, quality: 94 },
    ];
    return { spendSeries, trafficSeries, modelMix, perf };
  }, []);

  const kpis = [
    { title: 'Total spend', raw: stats.totalSpend, format: (n: number) => formatCurrency(n), delta: '-32%', good: true, icon: DollarSign,
      data: spendSeries.map((s) => ({ v: s.optimized })) },
    { title: 'Total savings', raw: stats.totalSavings, format: (n: number) => formatCurrency(n), delta: `${Math.round(savingsPercent)}% saved`, good: true, icon: TrendingDown,
      data: spendSeries.map((s) => ({ v: s.original - s.optimized })) },
    { title: 'Requests', raw: stats.totalRequests, format: (n: number) => formatNumber(Math.round(n)), delta: '+12%', good: true, icon: Activity,
      data: trafficSeries.filter((_, i) => i % 2 === 0).map((s) => ({ v: s.requests })) },
    { title: 'Avg latency', raw: stats.avgLatency, format: (n: number) => formatLatency(n), delta: '-18%', good: true, icon: Gauge,
      data: trafficSeries.filter((_, i) => i % 2 === 0).map((s) => ({ v: 60 - s.blocked * 4 })) },
  ];

  const recent = requestHistory.length > 0 ? null : demoRecent;

  return (
    <div className="space-y-5">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.title}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="glass-card panel-hover rounded-2xl p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] text-brand-300">
                  <Icon size={16} />
                </span>
                <span className={`flex items-center gap-0.5 text-xs font-medium ${k.good ? 'text-success-400' : 'text-error-400'}`}>
                  {k.good ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{k.delta}
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold text-white tabular tracking-tight">
                <AnimatedNumber value={k.raw} format={k.format} />
              </p>
              <p className="text-xs text-ink-3 mt-0.5">{k.title}</p>
              <div className="h-9 -mx-1 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={k.data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id={`spark${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={BRAND} strokeWidth={1.5} fill={`url(#spark${i})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── subscription ── */}
      <SubscriptionCard totalSavings={stats.totalSavings} onUpgrade={() => openPlans('upgrade')} />

      {/* ── traffic + routing ── */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
        <Panel title="AI Traffic Monitor" sub="Requests per hour · last 24h" icon={Activity} delay={0.1}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficSeries} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="traffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="h" tick={{ fill: '#7a859f', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: '#7a859f', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(77,238,234,0.3)' }} />
                <Area type="monotone" dataKey="requests" stroke={BRAND} strokeWidth={2} fill="url(#traffic)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Routing Distribution" sub="Share of routed traffic" icon={GitBranch} delay={0.16}>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modelMix} dataKey="value" innerRadius={42} outerRadius={60} paddingAngle={2} stroke="none">
                    {modelMix.map((_, i) => <Cell key={i} fill={modelPalette[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-content-center text-center">
                <p className="text-lg font-semibold text-white tabular leading-none">5</p>
                <p className="text-[0.6rem] text-ink-3">models</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {modelMix.map((m, i) => (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-sm" style={{ background: modelPalette[i] }} />
                  <span className="text-ink-2 flex-1 truncate">{m.name}</span>
                  <span className="text-white font-medium tabular">{m.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── cost intelligence + model performance ── */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
        <Panel title="Cost Intelligence" sub="Original vs optimized spend · 14d" icon={DollarSign} delay={0.2}>
          <div className="flex items-center gap-4 mb-3 text-xs">
            <Legend label="Original" swatch="rgba(255,255,255,0.18)" />
            <Legend label="Optimized" swatch={ACCENT} />
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendSeries} margin={{ top: 4, right: 6, left: -18, bottom: 0 }} barGap={-6}>
                <XAxis dataKey="d" tick={{ fill: '#7a859f', fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#7a859f', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<ChartTip prefix="$" />} cursor={{ fill: 'rgba(77,238,234,0.06)' }} />
                <Bar dataKey="original" radius={[3, 3, 0, 0]} fill="rgba(255,255,255,0.14)" />
                <Bar dataKey="optimized" radius={[3, 3, 0, 0]} fill={ACCENT} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Model Performance" sub="Quality · latency · share" icon={Cpu} delay={0.26}>
          <div className="space-y-3">
            {perf.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-white font-medium truncate">{p.name}</span>
                  <span className="text-xs text-ink-3 tabular">{formatLatency(p.latency)} · Q{p.quality}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${p.share * 2.6}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── governance + plan usage ── */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Governance Center" sub="Last 24h" icon={ShieldCheck} delay={0.3} className="lg:col-span-2">
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { icon: Eye, label: 'PII redacted', value: 128, tone: 'text-accent-400' },
              { icon: KeyRound, label: 'Secrets blocked', value: 14, tone: 'text-error-400' },
              { icon: FileWarning, label: 'Policy flags', value: 7, tone: 'text-warning-400' },
              { icon: ShieldCheck, label: 'Risk score', value: 98, tone: 'text-success-400', suffix: '/100' },
            ].map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.label} className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-4">
                  <Icon size={16} className={g.tone} />
                  <p className="mt-3 text-xl font-semibold text-white tabular">{g.value}{g.suffix || ''}</p>
                  <p className="text-[0.7rem] text-ink-3 mt-0.5">{g.label}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Plan Usage" sub={`${organization?.plan ?? 'growth'} plan`} icon={Activity} delay={0.34}>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white tabular">{formatNumber(sub.used)}</span>
            <span className="text-xs text-ink-3 tabular">{sub.unlimited ? '/ ∞' : `/ ${formatNumber(sub.limit)}`}</span>
          </div>
          {!sub.unlimited && (
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-3">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${Math.min(usagePercent, 100)}%` }}
                transition={{ duration: 1 }}
                className={`h-full rounded-full ${usagePercent > 90 ? 'bg-error-500' : usagePercent > 70 ? 'bg-warning-500' : 'bg-gradient-to-r from-brand-500 to-accent-500'}`}
              />
            </div>
          )}
          <p className="text-xs text-ink-3 mt-2">{sub.unlimited ? `${sub.resetLabel}` : `${Math.round(usagePercent)}% of monthly quota used · ${sub.resetLabel}`}</p>
          <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-sm font-semibold text-white tabular">{formatCurrency(stats.avgCostPerRequest, 4)}</p>
              <p className="text-[0.65rem] text-ink-3">Cost / request</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white tabular">{formatNumber(stats.totalTokens)}</p>
              <p className="text-[0.65rem] text-ink-3">Tokens processed</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── recent requests ── */}
      <Panel title="Recent Requests" sub="Most recent routed traffic" icon={Activity} delay={0.38}
        action={<button onClick={() => useStore.getState().setDashboardTab('requests')} className="text-xs text-brand-300 hover:text-brand-200 transition">View all →</button>}
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-left text-[0.65rem] font-semibold text-ink-3 uppercase tracking-wider">
                <th className="pb-3 pr-4 font-semibold">Task</th>
                <th className="pb-3 pr-4 font-semibold">Routed to</th>
                <th className="pb-3 pr-4 font-semibold text-right">Tokens</th>
                <th className="pb-3 pr-4 font-semibold text-right">Cost</th>
                <th className="pb-3 pr-4 font-semibold text-right">Saved</th>
                <th className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(recent ?? requestHistory.slice(0, 6).map((r) => ({
                task: r.result.characterization.taskCategory.replace('-', ' '),
                model: r.result.selectedModel.displayName,
                tokens: r.result.costIntelligence.routedCost.totalTokens,
                cost: r.result.costIntelligence.routedCost.totalCost,
                saved: r.result.costIntelligence.totalSavings.totalSaved,
              }))).map((r, i) => (
                <tr key={i} className="text-sm group hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-4 capitalize text-ink-2">{r.task}</td>
                  <td className="py-3 pr-4">
                    <span className="px-2 py-0.5 rounded-md bg-brand-500/12 text-brand-300 text-xs font-medium border border-brand-500/20">{r.model}</span>
                  </td>
                  <td className="py-3 pr-4 text-right text-ink-3 tabular">{formatNumber(r.tokens)}</td>
                  <td className="py-3 pr-4 text-right text-white font-medium tabular">{formatCurrency(r.cost, 4)}</td>
                  <td className="py-3 pr-4 text-right text-success-400 tabular">{formatCurrency(r.saved, 4)}</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-500/12 text-success-400 text-xs font-medium border border-success-500/20">
                      <span className="w-1 h-1 rounded-full bg-success-400" /> Success
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ── subscription card ── */

function SubscriptionCard({ totalSavings, onUpgrade }: { totalSavings: number; onUpgrade: () => void }) {
  const organization = useStore((s) => s.organization);
  if (!organization) return null;
  const u = usageSnapshot(organization);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
      className="glass-card rounded-2xl p-5 grid gap-5 md:grid-cols-[1.1fr_1.4fr_1fr] items-center"
    >
      {/* plan identity */}
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500/25 to-accent-500/15 border border-brand-500/25 text-brand-200">
          <Crown size={19} />
        </span>
        <div>
          <p className="text-[0.62rem] uppercase tracking-wide text-ink-3">Current plan</p>
          <p className="text-lg font-semibold text-white">{u.planName}</p>
          <p className="text-[0.66rem] text-ink-3">{u.unlimited ? 'Unlimited requests' : `${u.limit.toLocaleString()} requests / mo`}</p>
        </div>
      </div>

      {/* usage */}
      <div>
        <div className="flex items-center justify-between text-xs text-ink-3 mb-1.5">
          <span className="inline-flex items-center gap-1.5"><Zap size={12} className="text-brand-300" /> Monthly usage</span>
          <span className="tabular text-ink-2">{u.unlimited ? `${u.used.toLocaleString()} · ∞` : `${u.used.toLocaleString()} / ${u.limit.toLocaleString()}`}</span>
        </div>
        {!u.unlimited && (
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${u.percent}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-full rounded-full', u.percent >= 100 ? 'bg-error-400' : u.percent >= 80 ? 'bg-warning-400' : 'bg-gradient-to-r from-brand-400 to-accent-500')}
            />
          </div>
        )}
        <div className="flex items-center justify-between text-[0.66rem] text-ink-3 mt-1.5">
          <span className="tabular">{u.unlimited ? 'No limit' : `${u.remaining.toLocaleString()} remaining`}</span>
          <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> {u.resetLabel}</span>
        </div>
      </div>

      {/* savings + renewal + cta */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-wide text-ink-3">Total savings</p>
          <p className="text-lg font-semibold text-success-400 tabular">{formatCurrency(totalSavings)}</p>
          <p className="text-[0.62rem] text-ink-3">Renews {u.renewalLabel}</p>
        </div>
        {!u.unlimited && (
          <button onClick={onUpgrade}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] text-xs font-semibold hover:brightness-110 transition flex-shrink-0">
            <Zap size={13} /> Upgrade
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ── shared bits ── */

const demoRecent = [
  { task: 'summarization', model: 'Claude Haiku 4.5', tokens: 4210, cost: 0.0021, saved: 0.0193 },
  { task: 'classification', model: 'DeepSeek-V3', tokens: 1180, cost: 0.0009, saved: 0.0152 },
  { task: 'code generation', model: 'GPT-5', tokens: 8640, cost: 0.0584, saved: 0.0341 },
  { task: 'extraction', model: 'Gemini Flash', tokens: 2050, cost: 0.0006, saved: 0.0088 },
  { task: 'rewrite', model: 'Claude Haiku 4.5', tokens: 1530, cost: 0.0008, saved: 0.0061 },
  { task: 'q & a', model: 'Gemini Flash', tokens: 980, cost: 0.0004, saved: 0.0039 },
];

function Panel({
  title, sub, icon: Icon, children, delay = 0, className, action,
}: {
  title: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode; delay?: number; className?: string; action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass-card rounded-2xl p-5 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] text-brand-300">
            <Icon size={14} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">{title}</h3>
            {sub && <p className="text-[0.7rem] text-ink-3 mt-1 capitalize">{sub}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function Legend({ label, swatch }: { label: string; color?: string; swatch: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-3">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}

function ChartTip({ active, payload, label, prefix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg glass px-3 py-2 text-xs shadow-xl">
      <p className="text-ink-3 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-white tabular flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color || p.stroke }} />
          <span className="capitalize text-ink-2">{p.dataKey}:</span> {prefix}{p.value}
        </p>
      ))}
    </div>
  );
}
