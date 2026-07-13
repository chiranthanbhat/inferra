import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ArrowLeft, Wand2, Route, Coins, TrendingDown, ArrowRight,
  Cpu, Sparkles, ShieldCheck,
} from 'lucide-react';
import { Badge } from '../ui';
import { useStore } from '../../store/useStore';
import { makeUserMessage, makeAssistantMessage } from '../../lib/engine/chat';
import { PROVIDER_META } from '../../lib/providers';
import { executeRequest, UsageLimitError } from '../../lib/functions';
import { appendChatMessage } from '../../lib/db';
import { useToast } from '../../lib/toast';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/utils';
import type { AIProvider, ChatMessage, InferraPipelineResult } from '../../types';

const PROVIDER_STYLE: Record<AIProvider, { badge: string; dot: string; avatar: string }> = {
  anthropic:  { badge: 'bg-warning-500/15 text-warning-400 border-warning-500/30', dot: 'bg-warning-400', avatar: 'from-warning-500/80 to-warning-600/80' },
  openai:     { badge: 'bg-success-500/15 text-success-400 border-success-500/30', dot: 'bg-success-400', avatar: 'from-success-500/80 to-success-600/80' },
  google:     { badge: 'bg-accent-500/15 text-accent-300 border-accent-500/30', dot: 'bg-accent-400', avatar: 'from-accent-400/80 to-accent-600/80' },
  deepseek:   { badge: 'bg-brand-500/15 text-brand-300 border-brand-500/30', dot: 'bg-brand-400', avatar: 'from-brand-400/80 to-accent-500/80' },
  xai:        { badge: 'bg-white/[0.06] text-ink-2 border-white/15', dot: 'bg-ink-2', avatar: 'from-white/20 to-white/5' },
  mistral:    { badge: 'bg-error-500/15 text-error-400 border-error-500/30', dot: 'bg-error-400', avatar: 'from-error-500/80 to-error-600/80' },
  openrouter: { badge: 'bg-brand-500/15 text-brand-300 border-brand-500/30', dot: 'bg-brand-400', avatar: 'from-brand-400/80 to-accent-500/80' },
  opensource: { badge: 'bg-white/[0.06] text-ink-2 border-white/15', dot: 'bg-ink-2', avatar: 'from-white/20 to-white/5' },
};

export function ChatContinuation() {
  const { activeChat, pushChatMessage, endChat, user, setUsageCounters } = useStore();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist a message to Firestore with the latest running totals (best-effort).
  const persist = async (msg: ChatMessage) => {
    const c = useStore.getState().activeChat;
    if (!c || !user) return;
    try {
      await appendChatMessage(c.id, msg, {
        messageCount: c.messages.length,
        totalInputTokens: c.totalInputTokens,
        totalOutputTokens: c.totalOutputTokens,
        totalCost: c.totalCost,
        cumulativeSavings: c.cumulativeSavings,
      });
    } catch {
      /* offline / not configured — local state still holds the conversation */
    }
  };

  // Auto-reply whenever the latest message is a pending user message
  // (covers the auto-sent optimized first prompt and every follow-up). The reply
  // is generated SERVER-SIDE by the metered `executeRequest` Cloud Function — the
  // browser never holds a provider key. `cancelled` keeps it StrictMode-safe.
  useEffect(() => {
    if (!activeChat) return;
    const last = activeChat.messages[activeChat.messages.length - 1];
    if (!last || last.role !== 'user') return;

    const chat = activeChat;
    const model = chat.model;
    const baseline = chat.baselineModel;
    const isFirst = chat.messages.length === 1;
    const history = chat.messages.map((m) => ({ role: m.role, content: m.content }));

    let cancelled = false;
    setIsGenerating(true);
    (async () => {
      try {
        const reply = await executeRequest({
          model: {
            id: model.id,
            provider: model.provider,
            name: model.name,
            inputCostPer1k: model.inputCostPer1k,
            outputCostPer1k: model.outputCostPer1k,
          },
          history,
          // Attribute every turn to the Command Center's selected team so usage
          // accumulates for that team (server re-verifies membership).
          meta: isFirst
            ? {
                requestedModelId: chat.requestedModel?.id,
                originalTokens: chat.originResult.optimization.originalTokens,
                optimizedTokens: chat.originResult.optimization.optimizedTokens,
                estCost: chat.originResult.costIntelligence.routedCost.totalCost,
                estSavings: chat.originResult.costIntelligence.totalSavings.totalSaved,
                teamId: useStore.getState().commandTeamId ?? undefined,
              }
            : { teamId: useStore.getState().commandTeamId ?? undefined },
        });
        if (cancelled) return;
        setUsageCounters(reply.requestsUsed, reply.requestsLimit);
        const msg = makeAssistantMessage(reply.content, model, baseline, { outputTokens: reply.outputTokens });
        pushChatMessage(msg);
        void persist(msg);
      } catch (e: any) {
        if (cancelled) return;
        const isLimit = e instanceof UsageLimitError;
        if (isLimit) {
          setLimitHit(true);
          toast({ title: 'Monthly limit reached', description: e.message, variant: 'warning' });
        }
        const text = isLimit ? e.message : `Request failed: ${e?.message || e}`;
        const msg = makeAssistantMessage(text, model, baseline, { isError: true });
        pushChatMessage(msg);
        void persist(msg);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeChat?.messages.length, isGenerating]);

  if (!activeChat) return null;
  const chat = activeChat;
  const style = PROVIDER_STYLE[chat.model.provider] ?? PROVIDER_STYLE.opensource;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating || limitHit) return;
    const msg = makeUserMessage(text, chat.model, chat.baselineModel);
    pushChatMessage(msg);
    void persist(msg);
    setInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-5 h-[calc(100vh-8.5rem)] min-h-[560px]">
      {/* ───────────── Left: routing / cost / optimization ───────────── */}
      <div className="space-y-4 overflow-y-auto pr-1 hide-scrollbar">
        <button
          onClick={endChat}
          className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-white transition"
        >
          <ArrowLeft size={13} /> New analysis
        </button>
        <RoutingCard result={chat.originResult} />
        <CostCard result={chat.originResult} />
        <OptimizationCard result={chat.originResult} />
      </div>

      {/* ───────────── Right: live chat ───────────── */}
      <div className="glass-card rounded-2xl flex flex-col overflow-hidden">
        {/* Header: active model + live tracking */}
        <div className="p-4 border-b border-white/[0.07]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br ${style.avatar} text-white`}>
                <Cpu size={17} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{chat.model.displayName}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[0.62rem] font-medium border ${style.badge}`}>
                    <span className={`w-1 h-1 rounded-full ${style.dot} animate-pulse-soft`} /> Active
                  </span>
                </div>
                <p className="text-[0.66rem] text-ink-3 mt-0.5 capitalize">{chat.model.provider} · continuing the routed conversation</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success-500/10 border border-success-500/25 text-[0.62rem] text-success-400">
              <ShieldCheck size={11} /> Live · {PROVIDER_META[chat.model.provider].label}
            </span>
          </div>

          {/* live tracking strip */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <TrackChip icon={<Sparkles size={12} className="text-accent-400" />} label="Tokens"
              value={formatNumber(chat.totalInputTokens + chat.totalOutputTokens)}
              sub={`${formatNumber(chat.totalInputTokens)} in · ${formatNumber(chat.totalOutputTokens)} out`} />
            <TrackChip icon={<Coins size={12} className="text-brand-300" />} label="Live cost"
              value={formatCurrency(chat.totalCost, 4)} sub={`on ${chat.model.displayName}`} />
            <TrackChip icon={<TrendingDown size={12} className="text-success-400" />} label="Saved"
              value={formatCurrency(chat.cumulativeSavings, 4)} sub="vs baseline" accent />
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.messages.map((m, i) => (
            <ChatBubble key={m.id} message={m} provider={chat.model.provider} isFirst={i === 0} />
          ))}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-ink-3"
              >
                <span className={`grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br ${style.avatar} text-white flex-shrink-0`}>
                  <Cpu size={13} />
                </span>
                <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-ink-3 animate-pulse-soft" style={{ animationDelay: `${d * 0.18}s` }} />
                  ))}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-white/[0.07]">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Message ${chat.model.displayName}…`}
              rows={1}
              className="flex-1 resize-none bg-black/30 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-ink-3 focus:outline-none focus:border-brand-500/50 max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-[#04211f] disabled:opacity-40 disabled:cursor-not-allowed transition hover:brightness-110 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[0.62rem] text-ink-3 mt-1.5 text-center">
            The optimized prompt was sent automatically — keep chatting and Inferra keeps routing on {chat.model.displayName}.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── chat bubble ───────────────────────── */

function ChatBubble({ message, provider, isFirst }: { message: ChatMessage; provider: AIProvider; isFirst: boolean }) {
  const style = PROVIDER_STYLE[provider] ?? PROVIDER_STYLE.opensource;
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <span className={`grid place-items-center w-7 h-7 rounded-lg flex-shrink-0 ${isUser ? 'bg-white/[0.06] border border-white/10 text-ink-2' : `bg-gradient-to-br ${style.avatar} text-white`}`}>
        {isUser ? <span className="text-[0.6rem] font-semibold">You</span> : <Cpu size={13} />}
      </span>
      <div className={`min-w-0 max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {isFirst && isUser && (
          <span className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-500/12 border border-brand-500/25 text-[0.6rem] text-brand-200">
            <Wand2 size={10} /> Optimized prompt · auto-sent
          </span>
        )}
        <div className={`rounded-2xl px-3.5 py-2.5 border ${
          isUser
            ? 'bg-brand-500/[0.10] border-brand-500/20 text-white rounded-tr-sm'
            : message.isError
              ? 'bg-error-500/[0.10] border-error-500/30 text-error-200 rounded-tl-sm'
              : 'bg-white/[0.03] border-white/[0.07] text-ink-2 rounded-tl-sm'
        }`}>
          <MessageContent content={message.content} />
        </div>
        <span className="mt-1 text-[0.6rem] text-ink-3 tabular">
          {message.inputTokens > 0 ? `${formatNumber(message.inputTokens)} in` : `${formatNumber(message.outputTokens)} out`} · {formatCurrency(message.cost, 4)}
        </span>
      </div>
    </motion.div>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split('```');
  return (
    <div className="space-y-2">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="bg-black/40 border border-white/[0.07] rounded-lg p-3 overflow-x-auto text-xs text-brand-200 font-mono leading-relaxed">
            <code>{p.replace(/^[a-z]+\n/, '')}</code>
          </pre>
        ) : (
          p.trim() && <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{p.trim()}</p>
        )
      )}
    </div>
  );
}

function TrackChip({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[0.6rem] text-ink-3">{icon}{label}</div>
      <p className={`text-sm font-semibold tabular mt-0.5 ${accent ? 'text-success-400' : 'text-white'}`}>{value}</p>
      <p className="text-[0.58rem] text-ink-3 truncate">{sub}</p>
    </div>
  );
}

/* ───────────────────────── left analysis cards ───────────────────────── */

function CardShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="grid place-items-center w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.07] text-brand-300">{icon}</span>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      {children}
    </div>
  );
}

function RoutingCard({ result }: { result: InferraPipelineResult }) {
  const requested = result.requestedModel;
  const selected = result.selectedModel;
  const rerouted = !!requested && requested.id !== selected.id;
  return (
    <CardShell title="Routing analysis" icon={<Route size={13} />}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <div>
          <p className="eyebrow">Requested</p>
          <p className="text-xs font-medium text-ink-2">{requested ? requested.displayName : 'Auto-select'}</p>
        </div>
        <ArrowRight size={13} className="text-brand-300" />
        <div>
          <p className="eyebrow">Selected</p>
          <p className="text-xs font-semibold text-white">{selected.displayName}</p>
        </div>
        {rerouted && <Badge variant="primary" size="sm">Re-routed</Badge>}
        <span className="ml-auto text-xs text-ink-3 tabular">{Math.round(result.modelSelection.confidence)}%</span>
      </div>
      <p className="text-xs text-ink-3 leading-relaxed">{result.routingExplanation || result.modelSelection.reason}</p>
    </CardShell>
  );
}

function CostCard({ result }: { result: InferraPipelineResult }) {
  const { originalCost, routedCost, totalSavings } = result.costIntelligence;
  return (
    <CardShell title="Cost breakdown" icon={<Coins size={13} />}>
      <div className="space-y-2">
        <Row label={`Original · ${originalCost.model}`} value={formatCurrency(originalCost.totalCost, 4)} />
        <Row label={`Inferra · ${routedCost.model}`} value={formatCurrency(routedCost.totalCost, 4)} strong />
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-xs text-ink-3">Saved on first prompt</span>
          <Badge variant="success" size="sm">−{formatPercent(totalSavings.percentSaved)}</Badge>
        </div>
        <p className="text-[0.62rem] text-ink-3">Projected {formatCurrency(totalSavings.annualProjection)}/yr at 1k req/mo.</p>
      </div>
    </CardShell>
  );
}

function OptimizationCard({ result }: { result: InferraPipelineResult }) {
  const opt = result.optimization;
  return (
    <CardShell title="Optimization details" icon={<Wand2 size={13} />}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Mini label="Original" value={`${opt.originalTokens}`} sub="tokens" />
        <Mini label="Optimized" value={`${opt.optimizedTokens}`} sub="tokens" tone="text-accent-400" />
        <Mini label="Reduced" value={`${opt.tokenReductionPercent}%`} tone="text-success-400" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Quality" value={`${opt.qualityScore ?? opt.optimizationScore}`} sub="/100" />
        <Mini label="Intent" value={`${opt.intentScore ?? 100}`} sub="/100" />
        <Mini label="Confidence" value={`${opt.confidenceScore ?? 0}`} sub="/100" />
      </div>
      {opt.sections && opt.sections.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          {opt.sections.map((s) => (
            <div key={s.title}>
              <p className="text-[0.62rem] font-semibold text-brand-200 uppercase tracking-wide mb-1">{s.title}</p>
              <div className="flex flex-wrap gap-1">
                {s.items.slice(0, 8).map((it, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[0.65rem] text-ink-2">{it}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-ink-3 truncate">{label}</span>
      <span className={`text-xs tabular ${strong ? 'text-white font-semibold' : 'text-ink-2'}`}>{value}</span>
    </div>
  );
}

function Mini({ label, value, sub, tone = 'text-white' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2 py-2 text-center">
      <p className={`text-sm font-bold tabular ${tone}`}>{value}<span className="text-[0.55rem] text-ink-3 font-normal">{sub ? ` ${sub}` : ''}</span></p>
      <p className="text-[0.58rem] text-ink-3 mt-0.5">{label}</p>
    </div>
  );
}
