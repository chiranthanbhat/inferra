// ============================================
// CHAT CONTINUATION MATH TESTS
// The money math behind the live chat: per-message cost on the routed model,
// baseline cost for savings, provider-token preference, and session seeding.
// ============================================

import { describe, it, expect } from 'vitest';
import { makeUserMessage, makeAssistantMessage, createChatSession } from '../../src/lib/engine/chat';
import { AI_MODELS, getModelCost } from '../../src/lib/models';
import type { InferraPipelineResult } from '../../src/types';

const cheap = AI_MODELS.find((m) => m.id === 'gpt-4o-mini')!;
const pricey = AI_MODELS.find((m) => m.id === 'claude-3-opus') ?? AI_MODELS.reduce((a, b) =>
  a.inputCostPer1k + a.outputCostPer1k > b.inputCostPer1k + b.outputCostPer1k ? a : b);

describe('message factories', () => {
  it('user message: estimates input tokens at ~len/4 and prices both models', () => {
    const text = 'x'.repeat(400); // → 100 tokens
    const m = makeUserMessage(text, cheap, pricey);
    expect(m.inputTokens).toBe(100);
    expect(m.outputTokens).toBe(0);
    expect(m.cost).toBeCloseTo(getModelCost(cheap, 100, 0), 10);
    expect(m.baselineCost).toBeCloseTo(getModelCost(pricey, 100, 0), 10);
    expect(m.baselineCost).toBeGreaterThan(m.cost); // savings exist by construction
  });

  it('assistant message: prefers the provider-reported token count over the estimate', () => {
    const m = makeAssistantMessage('short', cheap, pricey, { outputTokens: 777 });
    expect(m.outputTokens).toBe(777);
    expect(m.cost).toBeCloseTo(getModelCost(cheap, 0, 777), 10);
  });

  it('assistant message: falls back to the length estimate when the provider is silent', () => {
    const text = 'y'.repeat(200); // → 50 tokens
    const m = makeAssistantMessage(text, cheap, pricey);
    expect(m.outputTokens).toBe(50);
  });

  it('error replies carry the isError flag', () => {
    expect(makeAssistantMessage('boom', cheap, pricey, { isError: true }).isError).toBe(true);
    expect(makeAssistantMessage('fine', cheap, pricey).isError).toBeUndefined();
  });

  it('never emits zero tokens for non-empty content', () => {
    expect(makeUserMessage('hi', cheap, pricey).inputTokens).toBeGreaterThan(0);
  });
});

describe('createChatSession', () => {
  const makeResult = (overrides: Partial<InferraPipelineResult> = {}): InferraPipelineResult => ({
    finalPrompt: 'Optimized prompt body '.repeat(10),
    selectedModel: cheap,
    requestedModel: pricey,
    costIntelligence: { totalSavings: { totalSaved: 0.5 } },
    ...overrides,
  }) as unknown as InferraPipelineResult;

  it('auto-seeds the optimized prompt as the first user message', () => {
    const s = createChatSession(makeResult());
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe('user');
    expect(s.messages[0].content).toBe(makeResult().finalPrompt);
    expect(s.model.id).toBe(cheap.id);
    expect(s.baselineModel.id).toBe(pricey.id);
  });

  it('seeds cumulativeSavings with the pipeline win plus the first message routing delta', () => {
    const s = createChatSession(makeResult());
    const first = s.messages[0];
    const expected = 0.5 + Math.max(0, first.baselineCost - first.cost);
    expect(s.cumulativeSavings).toBeCloseTo(expected, 10);
    expect(s.totalCost).toBeCloseTo(first.cost, 10);
    expect(s.totalInputTokens).toBe(first.inputTokens);
    expect(s.totalOutputTokens).toBe(0);
  });

  it('falls back to the most expensive model as baseline when nothing was requested', () => {
    const s = createChatSession(makeResult({ requestedModel: undefined }));
    const maxRate = Math.max(...AI_MODELS.map((m) => m.inputCostPer1k + m.outputCostPer1k));
    expect(s.baselineModel.inputCostPer1k + s.baselineModel.outputCostPer1k).toBe(maxRate);
  });
});
