// ============================================
// INFERRA CHAT CONTINUATION ENGINE
// Turns a completed pipeline result into a live chat session that
// continues on the routed model. Token + cost + savings math reuse
// the same cost model as the pipeline. Replies are sandbox-simulated
// (no provider key is wired in this build) — swap generateAssistantReply
// for a real provider call to go live.
// ============================================

import { v4 as uuidv4 } from 'uuid';
import type {
  AIModel,
  AIProvider,
  ChatMessage,
  ChatSession,
  InferraPipelineResult,
  PromptCharacterization,
} from '../../types';
import { AI_MODELS, getModelCost } from '../models';

const est = (s: string) => Math.max(1, Math.ceil(s.trim().length / 4));

function mostExpensiveModel(): AIModel {
  return AI_MODELS.reduce((max, m) =>
    m.inputCostPer1k + m.outputCostPer1k > max.inputCostPer1k + max.outputCostPer1k ? m : max
  );
}

export function makeUserMessage(content: string, model: AIModel, baseline: AIModel): ChatMessage {
  const inputTokens = est(content);
  return {
    id: uuidv4(),
    role: 'user',
    content,
    inputTokens,
    outputTokens: 0,
    cost: getModelCost(model, inputTokens, 0),
    baselineCost: getModelCost(baseline, inputTokens, 0),
    createdAt: new Date(),
  };
}

export function makeAssistantMessage(
  content: string,
  model: AIModel,
  baseline: AIModel,
  opts?: { outputTokens?: number; isError?: boolean }
): ChatMessage {
  // Prefer the provider's reported token count; fall back to a length estimate.
  const outputTokens = opts?.outputTokens && opts.outputTokens > 0 ? opts.outputTokens : est(content);
  return {
    id: uuidv4(),
    role: 'assistant',
    content,
    inputTokens: 0,
    outputTokens,
    cost: getModelCost(model, 0, outputTokens),
    baselineCost: getModelCost(baseline, 0, outputTokens),
    createdAt: new Date(),
    isError: opts?.isError,
  };
}

// Build a session from a finished pipeline run. The optimized prompt is
// auto-seeded as the first user message — the user never copy/pastes it.
export function createChatSession(result: InferraPipelineResult): ChatSession {
  const model = result.selectedModel;
  const baseline = result.requestedModel ?? mostExpensiveModel();
  const first = makeUserMessage(result.finalPrompt, model, baseline);

  return {
    id: uuidv4(),
    model,
    baselineModel: baseline,
    requestedModel: result.requestedModel,
    originResult: result,
    messages: [first],
    totalInputTokens: first.inputTokens,
    totalOutputTokens: 0,
    totalCost: first.cost,
    // seed with the optimization+routing win already realized on the first prompt,
    // then each turn adds the incremental routing saving (baseline vs routed).
    cumulativeSavings:
      result.costIntelligence.totalSavings.totalSaved + Math.max(0, first.baselineCost - first.cost),
    createdAt: new Date(),
  };
}

/* ───────────────────────── sandbox reply generation ───────────────────────── */

const OPENER: Record<AIProvider, string> = {
  anthropic: "Here's a clear, structured take.",
  openai: 'Got it — here is a direct answer.',
  google: 'Sure — organized below.',
  deepseek: 'Concise solution:',
  xai: "Alright, let's get into it.",
  mistral: 'Here is a focused response.',
  openrouter: 'Here is the response.',
  opensource: 'Here is the response.',
};

function trim(text: string, n = 88): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

// Simulated, model-flavored reply. Deterministic enough to feel real; clearly a
// sandbox response (the UI labels it as such). Replace with a provider API call to go live.
export function generateAssistantReply(
  model: AIModel,
  userText: string,
  ch?: PromptCharacterization
): string {
  const head = OPENER[model.provider] ?? 'Here is the response.';
  const isCode =
    ch?.containsCode ||
    ch?.taskCategory === 'code' ||
    /\b(code|function|python|javascript|typescript|api|sql|regex|algorithm)\b/i.test(userText);

  if (isCode) {
    return `${head}

\`\`\`python
def factorial(n: int) -> int:
    if n < 0:
        raise ValueError("n must be non-negative")
    return 1 if n <= 1 else n * factorial(n - 1)
\`\`\`

It validates the input and handles the base case. Want tests, an iterative version, or a port to another language?`;
  }

  return `${head}

• Objective — ${trim(userText)}
• I'd break this into the key drivers, weigh the trade-offs, then land on a recommendation.
• Concrete next steps you can act on immediately, with the reasoning made explicit.

Want me to expand any section or change the format?`;
}

/* ───────────────────────── persistence (survives reload) ───────────────────────── */

const KEY = 'inferra_active_chat_v1';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function savePersistedChat(chat: ChatSession | null): void {
  try {
    if (chat) localStorage.setItem(KEY, JSON.stringify(chat));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadPersistedChat(): ChatSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw, (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(v) : v)) as ChatSession;
  } catch {
    return null;
  }
}
