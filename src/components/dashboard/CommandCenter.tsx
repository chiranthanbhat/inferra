import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Zap, Shield, GitBranch, DollarSign, AlertTriangle, CheckCircle,
  Sparkles, ChevronDown, RotateCcw, Lock, Brain, Cpu, Wand2,
  ScanSearch, Route, TrendingDown, ArrowDown, ArrowRight, MessageSquare,
  Building2, Users,
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea, Badge } from '../ui';
import { useStore } from '../../store/useStore';
import { useTeamAccess } from '../../lib/teamAccess';
import { ChatContinuation } from './ChatContinuation';
import { UpgradeGate } from './UpgradeGate';
import { saveChatSession, getTeamsByIds } from '../../lib/db';
import { runInferraPipeline } from '../../lib/engine/pipeline';
import { AI_MODELS } from '../../lib/models';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/utils';
import type { InferraPipelineResult, Team } from '../../types';

const EXAMPLE_PROMPTS = [
  { label: 'Bloated prompt', prompt: 'I would really like you to please very carefully, thoroughly, comprehensively and extensively analyze, evaluate, assess, review and examine our business. Please carefully and thoroughly look at customer acquisition, pricing, retention, growth, risks, roadmap planning, operations, finance and competition. I really want you to thoroughly analyze all of these areas in great detail. Make sure to comprehensively review everything. Then please provide an executive summary, detailed recommendations, a roadmap, KPIs and key milestones. Keep it professional in tone for executives. Thank you so much in advance!' },
  { label: 'Simple Q&A', prompt: 'What is the capital of France?' },
  { label: 'Code generation', prompt: 'Write a Python function to calculate the factorial of a number recursively with proper error handling.' },
  { label: 'Summarization', prompt: 'Please help me summarize the key points: AI is transforming healthcare through early disease detection using machine learning algorithms that can analyze medical images with accuracy rivaling expert radiologists.' },
  { label: 'Complex analysis', prompt: 'I would like you to analyze and compare the economic policies of Keynesian and Austrian schools of thought. Could you please explain their effectiveness during different economic conditions in detail?' },
  { label: 'PII test', prompt: 'My email is john.doe@example.com and my phone is 555-123-4567. My SSN is 123-45-6789. Please help me write a professional bio.' },
  { label: 'Secret test', prompt: 'Here is my API key: sk-1234567890abcdefghijklmnopqrstuv. And my password is SuperSecret123! How do I store these securely?' },
];

const PIPELINE_STEPS = [
  { icon: Brain, label: 'Intent' },
  { icon: ScanSearch, label: 'Complexity' },
  { icon: GitBranch, label: 'Candidates' },
  { icon: Route, label: 'Model selection' },
  { icon: Cpu, label: 'Model engineering' },
  { icon: Wand2, label: 'Optimization' },
  { icon: DollarSign, label: 'Cost recalc' },
  { icon: Send, label: 'Route' },
];

export function CommandCenter() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [priority, setPriority] = useState<'cost' | 'speed' | 'quality' | 'balanced'>('balanced');
  const [result, setResult] = useState<InferraPipelineResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'cost' | 'analysis' | 'security' | 'routing'>('pipeline');
  const [limitGate, setLimitGate] = useState(false);
  const { addRequestToHistory, organization, activeChat, startChat, user, commandTeamId, setCommandTeamId } = useStore();
  const { myMemberships } = useTeamAccess();
  const organizationName = organization?.name ?? 'Organization';
  const [myTeams, setMyTeams] = useState<Team[]>([]);

  // Load the teams the signed-in user belongs to so every request can be
  // attributed to one (usage then accumulates for that team, server-verified).
  useEffect(() => {
    let cancelled = false;
    const ids = myMemberships.map((m) => m.teamId);
    if (ids.length === 0) { setMyTeams([]); return; }
    getTeamsByIds(ids)
      .then((t) => { if (!cancelled) setMyTeams(t.filter((x) => x.status === 'active')); })
      .catch(() => { if (!cancelled) setMyTeams([]); });
    return () => { cancelled = true; };
  }, [myMemberships]);

  // Default the attribution to the user's first team once loaded.
  useEffect(() => {
    if (!commandTeamId && myTeams.length > 0) setCommandTeamId(myTeams[0].id);
    if (commandTeamId && myTeams.length > 0 && !myTeams.some((t) => t.id === commandTeamId)) {
      setCommandTeamId(myTeams[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeams]);

  const activeTeam = myTeams.find((t) => t.id === commandTeamId) ?? null;

  // Accept a routed result → open the live chat. Block when the monthly limit
  // is already exhausted (the server enforces it too; this avoids a wasted call).
  const handleAccept = (r: InferraPipelineResult) => {
    const limit = organization?.planLimits.requestsPerMonth ?? 100;
    const used = organization?.usage.requestsUsed ?? 0;
    const overLimit = !!organization && limit >= 0 && used >= limit;
    if (overLimit) {
      setLimitGate(true);
      return;
    }
    const session = startChat(r);
    if (user && organization) void saveChatSession(user.id, organization.id, session).catch(() => {});
  };

  const handleProcess = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 400));

    const pipelineResult = await runInferraPipeline(
      prompt,
      undefined,
      selectedModel || undefined,
      { prioritize: priority },
      {
        piiPolicy: organization?.settings?.piiPolicy || 'sanitize',
        secretPolicy: organization?.settings?.secretPolicy || 'block',
        enableOptimization: organization?.settings?.enableOptimization ?? true,
        enableRouting: organization?.settings?.enableRouting ?? true,
        enableGovernance: organization?.settings?.enableGovernance ?? true,
      },
    );

    setResult(pipelineResult);
    setActiveTab('pipeline');
    setIsProcessing(false);
    if (pipelineResult.success) addRequestToHistory(prompt, pipelineResult);
  };

  const handleReset = () => {
    setPrompt('');
    setResult(null);
    setActiveTab('pipeline');
  };

  // Chat continuation takes over the workspace once a request is accepted.
  if (activeChat) return <ChatContinuation />;

  // Monthly request limit reached → upsell instead of opening the chat.
  if (limitGate) {
    return <UpgradeGate plan={organization?.plan ?? 'free'} onCancel={() => setLimitGate(false)} />;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Input Panel */}
      <div className="space-y-4">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-500/15 border border-brand-500/25 text-brand-300">
                <Zap size={15} />
              </span>
              Command Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Request context: Organization → Team. Usage accumulates for the
                selected team (server re-verifies membership on execute). */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="eyebrow mb-2">Request context</p>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-ink-2">
                  <Building2 size={13} className="text-brand-300" /> {organizationName}
                </span>
                <ArrowRight size={14} className="text-ink-3 flex-shrink-0" />
                {myTeams.length > 0 ? (
                  <div className="relative">
                    <select
                      value={commandTeamId ?? ''}
                      onChange={(e) => setCommandTeamId(e.target.value || null)}
                      className="appearance-none bg-black/30 border border-white/[0.08] rounded-lg pl-8 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    >
                      {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: activeTeam?.color ?? '#4DEEEA' }} />
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-ink-3">
                    <Users size={13} /> No team — attributed to you
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setPrompt(ex.prompt)}
                    className="px-3 py-1.5 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-ink-2 rounded-lg transition border border-white/[0.06]"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt… Inferra detects intent, picks the best model, then rewrites the prompt for that model."
              className="h-40"
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block eyebrow mb-2">Your current model (optional)</label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-brand-500/50"
                  >
                    <option value="">No baseline — compare to premium</option>
                    {AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName} — ${(model.inputCostPer1k + model.outputCostPer1k).toFixed(4)}/1K
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                </div>
                <p className="mt-1.5 text-[0.66rem] text-ink-3 leading-tight">
                  Baseline only — Inferra always routes to the best model and optimizes for it.
                </p>
              </div>

              <div>
                <label className="block eyebrow mb-2">Routing priority</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['cost', 'speed', 'quality', 'balanced'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-2 px-1 rounded-lg text-[0.7rem] font-medium transition ${
                        priority === p
                          ? 'bg-brand-500/20 text-brand-200 border border-brand-500/40'
                          : 'bg-white/[0.04] text-ink-3 hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleProcess} disabled={!prompt.trim() || isProcessing} isLoading={isProcessing} className="flex-1">
                {isProcessing ? 'Processing…' : (<><Send size={16} />Analyze & Route</>)}
              </Button>
              <Button variant="ghost" onClick={handleReset}><RotateCcw size={16} /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Panel */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card variant="glass" className="h-[520px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-4">
                    <Cpu size={26} className="text-ink-3" />
                  </div>
                  <h4 className="font-semibold text-ink-2 mb-2">Ready to route</h4>
                  <p className="text-sm text-ink-3 max-w-xs">
                    Enter a prompt to watch Inferra detect intent, select a model, and optimize the prompt for it.
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Status */}
              <div className={`rounded-xl p-4 border ${result.blocked ? 'bg-error-500/10 border-error-500/25' : 'bg-success-500/10 border-success-500/25'}`}>
                <div className="flex items-center gap-3">
                  {result.blocked ? <AlertTriangle size={22} className="text-error-400" /> : <CheckCircle size={22} className="text-success-400" />}
                  <div>
                    <p className={`font-semibold ${result.blocked ? 'text-error-300' : 'text-success-300'}`}>
                      {result.blocked ? 'Request blocked' : 'Routed & optimized'}
                    </p>
                    <p className={`text-sm ${result.blocked ? 'text-error-400/80' : 'text-success-400/80'}`}>
                      {result.blocked ? result.blockReason : `Processed in ${result.processingTimeMs}ms`}
                    </p>
                  </div>
                </div>
              </div>

              {!result.blocked && (
                <>
                  {/* Requested → Selected → Optimized-for routing summary */}
                  <RoutingSummary result={result} />

                  {/* Selected model + quick economics */}
                  <div className="grid grid-cols-4 gap-3">
                    <Stat icon={<Cpu size={16} className="text-brand-300" />} value={result.selectedModel.displayName} label="Selected model" small />
                    <Stat icon={<DollarSign size={16} className="text-ink-3" />} value={formatCurrency(result.costIntelligence.originalCost.totalCost, 4)} label="Original cost" />
                    <Stat icon={<Sparkles size={16} className="text-accent-400" />} value={formatCurrency(result.costIntelligence.routedCost.totalCost, 4)} label="Inferra cost" />
                    <Stat icon={<TrendingDown size={16} className="text-success-400" />} value={formatPercent(result.costIntelligence.totalSavings.percentSaved)} label="Saved" accent />
                  </div>

                  {/* Accept & continue into the routed model's chat */}
                  <div className="ring-gradient bg-gradient-to-br from-brand-500/[0.10] to-accent-500/[0.06] rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-brand-300" /> Continue to chat
                      </p>
                      <p className="text-xs text-ink-3 mt-0.5">
                        Opens a live session on {result.selectedModel.displayName} — the optimized prompt is sent automatically.
                      </p>
                    </div>
                    <Button onClick={() => handleAccept(result)} className="flex-shrink-0">
                      Accept &amp; Continue <ArrowRight size={16} />
                    </Button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1.5 border-b border-white/[0.07] pb-2 overflow-x-auto hide-scrollbar">
                    {(['pipeline', 'cost', 'analysis', 'security', 'routing'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                          activeTab === tab ? 'bg-brand-500/15 text-brand-200' : 'text-ink-3 hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  <Card variant="glass" padding="none">
                    <div className="p-6 max-h-[460px] overflow-y-auto">
                      {activeTab === 'pipeline' && <PipelineTab result={result} originalPrompt={prompt} />}
                      {activeTab === 'cost' && <CostTab result={result} />}
                      {activeTab === 'analysis' && <AnalysisTab result={result} />}
                      {activeTab === 'security' && <SecurityTab result={result} />}
                      {activeTab === 'routing' && <RoutingTab result={result} />}
                    </div>
                  </Card>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ───────────────────── Requested → Selected → Optimized-for summary ───────────────────── */

function RoutingSummary({ result }: { result: InferraPipelineResult }) {
  const requested = result.requestedModel;
  const selected = result.selectedModel;
  const optimizedFor = result.modelAwarePrompt.targetModel;
  const rerouted = !!requested && requested.id !== selected.id;
  const savings = result.costIntelligence.totalSavings.percentSaved;

  return (
    <div className="ring-gradient bg-gradient-to-br from-brand-500/12 to-accent-500/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow">Requested</p>
          <p className="text-sm font-semibold text-ink-2 truncate">{requested ? requested.displayName : 'Auto-select'}</p>
        </div>
        <ArrowRight size={16} className="text-brand-300 flex-shrink-0" />
        <div className="min-w-0">
          <p className="eyebrow">Inferra selected</p>
          <p className="text-sm font-semibold text-white truncate">
            {selected.displayName} <span className="text-ink-3 font-normal capitalize">· {selected.provider}</span>
          </p>
        </div>
        {rerouted && <Badge variant="primary" size="sm">Re-routed</Badge>}
        <div className="ml-auto text-right">
          <p className="eyebrow">Expected savings</p>
          <p className="text-lg font-bold text-success-400 tabular leading-none">{formatPercent(savings)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-xs text-brand-200">
          <Wand2 size={12} /> Optimized for {optimizedFor.displayName}
        </span>
        {rerouted && requested && (
          <span className="text-xs text-ink-3">not {requested.displayName} — the prompt targets the model that runs it</span>
        )}
      </div>

      <p className="text-sm text-ink-2 leading-relaxed">{result.routingExplanation || result.modelSelection.reason}</p>
    </div>
  );
}

function Metric({ label, value, suffix = '', sub, tone = 'text-white' }: { label: string; value: number; suffix?: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-black/25 border border-white/[0.05] rounded-lg px-2.5 py-2 text-center">
      <p className={`text-base font-bold tabular ${tone}`}>{value}{suffix}</p>
      <p className="text-[0.62rem] text-ink-3 leading-tight mt-0.5">{label}{sub ? ` ${sub}` : ''}</p>
    </div>
  );
}

function Stat({ icon, value, label, accent, small }: { icon: React.ReactNode; value: string; label: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`font-bold text-white tabular ${small ? 'text-[0.8rem] leading-tight truncate' : 'text-lg'} ${accent ? 'text-success-400' : ''}`}>{value}</p>
      <p className="text-[0.65rem] text-ink-3 mt-0.5">{label}</p>
    </div>
  );
}

/* ───────────────────── Pipeline tab — the new linear story ───────────────────── */

function PipelineTab({ result, originalPrompt }: { result: InferraPipelineResult; originalPrompt: string }) {
  const profile = result.optimizationProfile;
  const opt = result.optimization;
  const origTokens = opt.originalTokens;
  const optTokens = opt.optimizedTokens;
  const savedPct = opt.tokenReductionPercent;
  const candidates = result.modelSelection.comparison?.models?.slice(0, 5) ?? [];

  return (
    <div className="space-y-5">
      {/* Step rail */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar pb-1">
        {PIPELINE_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex flex-col items-center gap-1.5 w-[68px] text-center">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500/12 border border-brand-500/25 text-brand-300">
                  <Icon size={15} />
                </span>
                <span className="text-[0.6rem] text-ink-3 leading-tight">{s.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <div className="w-3 h-px bg-white/15 flex-shrink-0 mb-4" />}
            </div>
          );
        })}
      </div>

      {/* Routing decision */}
      <div className="ring-gradient bg-gradient-to-br from-brand-500/12 to-accent-500/8 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 text-white">
            <Cpu size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[0.7rem] text-ink-3">Selected model</p>
            <p className="text-base font-semibold text-white">
              {result.selectedModel.displayName} <span className="text-ink-3 font-normal capitalize">· {result.selectedModel.provider}</span>
            </p>
          </div>
          <Badge variant="primary" size="md">{Math.round(result.modelSelection.confidence)}% confident</Badge>
        </div>
        {profile && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-xs text-brand-200">
            <Wand2 size={12} /> {profile.label}
          </div>
        )}
        <p className="mt-3 text-sm text-ink-2 leading-relaxed">{result.routingExplanation || result.modelSelection.reason}</p>
        {candidates.length > 1 && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <p className="eyebrow mb-2">Candidates considered</p>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((m) => {
                const win = m.id === result.selectedModel.id;
                return (
                  <span key={m.id} className={`px-2 py-0.5 rounded-md text-[0.7rem] border ${win ? 'bg-brand-500/20 text-brand-200 border-brand-500/40 font-medium' : 'bg-white/[0.03] text-ink-3 border-white/[0.06]'}`}>
                    {m.displayName}{win ? ' ✓' : ''}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Original prompt */}
      <PromptBlock
        index={1}
        title="Original prompt"
        tone="neutral"
        text={originalPrompt}
        badge={`${origTokens} tokens`}
      />

      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-xs text-brand-200">
          <ArrowDown size={13} />
          {profile ? `${profile.label} for ${result.selectedModel.displayName}` : 'Model-specific engineering'}
        </div>
      </div>

      {/* Model-specific prompt */}
      <PromptBlock
        index={2}
        title="Model-specific prompt"
        tone="brand"
        text={result.modelAwarePrompt.modelOptimizedPrompt}
        badge={`${optTokens} tokens · −${savedPct}%`}
      />

      {/* Optimization scoring */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Optimization scoring</p>
          {opt.validationPassed === false ? (
            <Badge variant="danger" size="sm">Optimization failed</Badge>
          ) : (
            <Badge variant="success" size="sm">Validated</Badge>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Metric label="Original" value={origTokens} sub="tokens" />
          <Metric label="Optimized" value={optTokens} sub="tokens" tone="text-accent-400" />
          <Metric label="Removed" value={opt.tokensSaved} sub="tokens" tone="text-success-400" />
          <Metric label="Compression" value={savedPct} suffix="%" tone="text-gradient-brand" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Quality" value={opt.qualityScore ?? opt.optimizationScore} suffix="/100" />
          <Metric label="Intent kept" value={opt.intentScore ?? 100} suffix="/100" />
          <Metric label="Confidence" value={opt.confidenceScore ?? 0} suffix="/100" />
        </div>
        {opt.validationMessage && (
          <p className="mt-3 text-xs text-error-300 flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{opt.validationMessage}
          </p>
        )}
      </div>

      {/* Structured reconstruction */}
      {opt.sections && opt.sections.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="eyebrow mb-3">Structured reconstruction</p>
          <div className="space-y-3">
            {opt.sections.map((sec) => (
              <div key={sec.title}>
                <p className="text-[0.72rem] font-semibold text-brand-200 uppercase tracking-wide mb-1.5">{sec.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sec.items.map((it, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-ink-2">{it}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modifications */}
      {result.modelAwarePrompt.modifications.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="eyebrow mb-3">How it was rewritten for {result.selectedModel.displayName}</p>
          <div className="space-y-2">
            {result.modelAwarePrompt.modifications.map((mod, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle size={13} className="text-brand-300 flex-shrink-0 mt-0.5" />
                <span className="text-ink-2">{mod.description}</span>
                <span className="text-ink-3">— {mod.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <h5 className="text-sm font-semibold text-white mb-1.5 flex items-center gap-2">
            <Brain size={14} className="text-brand-300" /> Why this profile?
          </h5>
          <p className="text-sm text-ink-3 leading-relaxed">{profile.description}</p>
        </div>
      )}
    </div>
  );
}

function PromptBlock({ index, title, text, badge, tone }: { index: number; title: string; text: string; badge: string; tone: 'neutral' | 'brand' }) {
  return (
    <div className={`rounded-xl p-4 border ${tone === 'brand' ? 'bg-brand-500/[0.07] border-brand-500/25' : 'bg-white/[0.03] border-white/[0.07]'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`grid place-items-center w-5 h-5 rounded-full text-[0.65rem] font-bold ${tone === 'brand' ? 'bg-brand-500/30 text-brand-200' : 'bg-white/10 text-ink-2'}`}>{index}</span>
          <span className={`text-sm font-semibold ${tone === 'brand' ? 'text-brand-200' : 'text-ink-2'}`}>{title}</span>
        </div>
        <Badge variant={tone === 'brand' ? 'primary' : 'default'} size="sm">{badge}</Badge>
      </div>
      <div className="bg-black/30 rounded-lg p-3 max-h-32 overflow-y-auto">
        <p className="text-sm text-ink-2 font-mono whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

/* ───────────────────── Cost tab ───────────────────── */

function CostTab({ result }: { result: InferraPipelineResult }) {
  const { originalCost, routedCost, totalSavings } = result.costIntelligence;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-ink-2 font-medium">Original cost <span className="text-ink-3">· {originalCost.model}, original prompt</span></span>
            <span className="text-2xl font-bold text-white tabular">{formatCurrency(originalCost.totalCost, 4)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-ink-3 tabular">
            <span>{formatNumber(originalCost.inputTokens)} input</span>
            <span>{formatNumber(originalCost.outputTokens)} output</span>
            <span>{formatNumber(originalCost.totalTokens)} total</span>
          </div>
        </div>

        <div className="flex justify-center"><ArrowDown size={16} className="text-ink-3" /></div>

        <div className="bg-brand-500/[0.07] border border-brand-500/25 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-brand-200 font-medium">Inferra cost <span className="text-ink-3">· {routedCost.model}, optimized prompt</span></span>
            <span className="text-2xl font-bold text-white tabular">{formatCurrency(routedCost.totalCost, 4)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-ink-3 tabular">{formatNumber(routedCost.totalTokens)} tokens</span>
            <Badge variant="success" size="sm">−{formatPercent(totalSavings.percentSaved)} vs original</Badge>
          </div>
        </div>
      </div>

      <div className="ring-gradient bg-gradient-to-r from-brand-500/12 to-accent-500/8 rounded-xl p-6 text-center">
        <p className="eyebrow mb-3">Savings</p>
        <div className="flex items-center justify-center gap-4">
          <div>
            <p className="text-3xl font-bold text-white tabular">{formatCurrency(totalSavings.totalSaved, 4)}</p>
            <p className="text-xs text-ink-3">this request</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-3xl font-bold text-gradient-brand tabular">{formatPercent(totalSavings.percentSaved)}</p>
            <p className="text-xs text-ink-3">reduction</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-3xl font-bold text-success-400 tabular">{formatCurrency(totalSavings.annualProjection)}</p>
            <p className="text-xs text-ink-3">annual projection</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Analysis tab ───────────────────── */

function AnalysisTab({ result }: { result: InferraPipelineResult }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-3 flex items-center gap-2"><Brain size={13} className="text-brand-300" /> Intent & complexity</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Task type" value={result.characterization.taskCategory.replace('-', ' ')} />
          <Field label="Complexity" value={result.characterization.complexity} />
          <Field label="Intent" value={result.characterization.intent} />
          <Field label="Est. tokens" value={formatNumber(result.characterization.estimatedInputTokens + result.characterization.estimatedOutputTokens)} />
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3 flex items-center gap-2"><Sparkles size={13} className="text-brand-300" /> Prompt intelligence</p>
        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
          <Score value={result.intelligence.qualityScore} label="Quality" tone="text-success-400" />
          <Score value={result.intelligence.wasteScore} label="Waste" tone="text-error-400" />
          <Score value={result.intelligence.optimizationScore} label="Optimization" tone="text-accent-400" />
        </div>
        {result.intelligence.issues.length > 0 && (
          <div className="space-y-2">
            {result.intelligence.issues.slice(0, 3).map((issue, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'default'} size="sm">{issue.severity}</Badge>
                <span className="text-ink-3">{issue.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow mb-3 flex items-center gap-2"><Wand2 size={13} className="text-brand-300" /> Model-specific optimization</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Score value={result.optimization.originalTokens} label="Original" tone="text-white" raw />
          <Score value={result.optimization.optimizedTokens} label="Optimized" tone="text-success-400" raw />
          <Score value={result.optimization.tokenReductionPercent} label="Reduction" tone="text-brand-300" suffix="%" minus raw />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
      <p className="text-ink-3 text-xs">{label}</p>
      <p className="text-white font-medium capitalize">{value}</p>
    </div>
  );
}
function Score({ value, label, tone, suffix = '', minus, raw }: { value: number; label: string; tone: string; suffix?: string; minus?: boolean; raw?: boolean }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 text-center">
      <p className={`${raw ? 'text-lg' : 'text-2xl'} font-bold tabular ${tone}`}>{minus ? '−' : ''}{value}{suffix}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  );
}

/* ───────────────────── Security tab ───────────────────── */

function SecurityTab({ result }: { result: InferraPipelineResult }) {
  const { security } = result;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-success-400 tabular">{security.securityScore}</p>
          <p className="text-xs text-ink-3">Security score</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className={`text-3xl font-bold tabular ${security.riskScore > 50 ? 'text-error-400' : security.riskScore > 20 ? 'text-warning-400' : 'text-success-400'}`}>{security.riskScore}</p>
          <p className="text-xs text-ink-3">Risk score</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className={`rounded-xl p-4 border ${security.hasSecrets ? 'bg-error-500/10 border-error-500/20' : 'bg-success-500/10 border-success-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Lock size={16} className={security.hasSecrets ? 'text-error-400' : 'text-success-400'} />
            <span className={`text-sm font-medium ${security.hasSecrets ? 'text-error-300' : 'text-success-300'}`}>{security.hasSecrets ? 'Secrets detected' : 'No secrets detected'}</span>
          </div>
          {security.hasSecrets && <div className="flex flex-wrap gap-2">{security.secretTypes.map((t) => <Badge key={t} variant="danger" size="sm">{t}</Badge>)}</div>}
        </div>
        <div className={`rounded-xl p-4 border ${security.hasPII ? 'bg-warning-500/10 border-warning-500/20' : 'bg-success-500/10 border-success-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className={security.hasPII ? 'text-warning-400' : 'text-success-400'} />
            <span className={`text-sm font-medium ${security.hasPII ? 'text-warning-300' : 'text-success-300'}`}>{security.hasPII ? 'PII detected' : 'No PII detected'}</span>
          </div>
          {security.hasPII && <div className="flex flex-wrap gap-2">{security.piiTypes.map((t) => <Badge key={t} variant="warning" size="sm">{t}</Badge>)}</div>}
        </div>
        {security.complianceViolations.length > 0 && (
          <div className="bg-warning-500/10 border border-warning-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-warning-400" />
              <span className="text-sm font-medium text-warning-300">Compliance warnings</span>
            </div>
            <div className="space-y-2">
              {security.complianceViolations.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant={v.severity === 'critical' ? 'danger' : 'warning'} size="sm">{v.framework.toUpperCase()}</Badge>
                  <span className="text-ink-3">{v.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── Routing tab ───────────────────── */

function RoutingTab({ result }: { result: InferraPipelineResult }) {
  const { modelSelection, routing } = result;
  return (
    <div className="space-y-6">
      <div className="ring-gradient bg-gradient-to-r from-brand-500/12 to-accent-500/8 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-xl font-bold text-white">
            {modelSelection.recommendedModel.displayName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-white">{modelSelection.recommendedModel.displayName}</p>
            <p className="text-sm text-ink-3 capitalize">{modelSelection.recommendedModel.provider}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-300 tabular">{Math.round(routing.confidence)}%</p>
            <p className="text-xs text-ink-3">confidence</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-2">{result.routingExplanation || modelSelection.reason}</p>
      </div>

      <div>
        <p className="eyebrow mb-3 flex items-center gap-2"><GitBranch size={13} className="text-brand-300" /> Routing factors</p>
        <div className="space-y-3">
          {modelSelection.factors.map((factor) => (
            <div key={factor.name} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ink-2">{factor.name}</span>
                <span className="text-sm font-medium text-white tabular">{Math.round(factor.score)}/100</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full" style={{ width: `${factor.score}%` }} />
              </div>
              <p className="text-xs text-ink-3 mt-1">{factor.description}</p>
            </div>
          ))}
        </div>
      </div>

      {modelSelection.alternatives.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Alternatives considered</p>
          <div className="space-y-2">
            {modelSelection.alternatives.map((alt) => (
              <div key={alt.model.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{alt.model.displayName}</p>
                  <p className="text-xs text-ink-3">{alt.reason}</p>
                </div>
                <span className="text-sm text-ink-3 tabular">{Math.round(alt.score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
