// ============================================
// INFERRA MODEL-AWARE PROMPT REWRITER - LAYER 6
// COMPRESSES prompts for each model - NEVER adds content
// ============================================

import type { AIModel, ModelAwarePrompt, PromptModification } from '../../types';

interface RewriteConfig {
  style: string;
  patterns: [string, string, string][];
}

const MODEL_CONFIGS: Record<string, RewriteConfig> = {
  'instruction-following': {
    style: 'instruction-following',
    patterns: [
      ['Can you please ', '', 'Removed politeness'],
      ['Could you please ', '', 'Removed politeness'],
      ['Would you please ', '', 'Removed politeness'],
      ['please ', '', 'Removed politeness'],
      ['kindly ', '', 'Removed politeness'],
    ],
  },
  'deep-reasoning': {
    style: 'deep-reasoning',
    patterns: [
      ['please ', '', 'Removed politeness'],
      ['kindly ', '', 'Removed politeness'],
      ['basically ', '', 'Removed filler'],
      ['essentially ', '', 'Removed filler'],
      ['actually ', '', 'Removed filler'],
      ['really ', '', 'Removed filler'],
      ['very ', '', 'Removed filler'],
      ['just ', '', 'Removed filler'],
      ['simply ', '', 'Removed filler'],
    ],
  },
  'long-context': {
    style: 'long-context',
    patterns: [
      ['please ', '', 'Removed politeness'],
      ['kindly ', '', 'Removed politeness'],
      ['basically ', '', 'Removed filler'],
      ['essentially ', '', 'Removed filler'],
      ['actually ', '', 'Removed filler'],
      ['really ', '', 'Removed filler'],
      ['very ', '', 'Removed filler'],
      ['just ', '', 'Removed filler'],
      ['simply ', '', 'Removed filler'],
    ],
  },
  'cost-efficient': {
    style: 'cost-efficient',
    patterns: [
      ['please ', '', 'Removed politeness'],
      ['kindly ', '', 'Removed politeness'],
      ['thank you', '', 'Removed politeness'],
      ['thanks', '', 'Removed politeness'],
      ['basically ', '', 'Removed filler'],
      ['essentially ', '', 'Removed filler'],
      ['actually ', '', 'Removed filler'],
      ['really ', '', 'Removed filler'],
      ['very ', '', 'Removed filler'],
      ['just ', '', 'Removed filler'],
      ['simply ', '', 'Removed filler'],
      ['in order to', 'to', 'Compressed phrase'],
      ['due to the fact that', 'because', 'Compressed phrase'],
      ['at this point in time', 'now', 'Compressed phrase'],
      ['in the event that', 'if', 'Compressed phrase'],
      ['for the purpose of', 'for', 'Compressed phrase'],
      ['with regard to', 'about', 'Compressed phrase'],
      ['it is important to note that ', '', 'Removed filler'],
      ['it should be noted that ', '', 'Removed filler'],
    ],
  },
  'conversational': {
    style: 'conversational',
    patterns: [
      ['please ', '', 'Removed politeness'],
      ['kindly ', '', 'Removed politeness'],
      ['basically ', '', 'Removed filler'],
      ['essentially ', '', 'Removed filler'],
      ['actually ', '', 'Removed filler'],
    ],
  },
};

// Provider-level compression patterns (applied after model-specific)
const PROVIDER_COMPRESSIONS: [string, string, string][] = [
  ['please ', '', 'Removed politeness'],
  ['kindly ', '', 'Removed politeness'],
  ['thank you', '', 'Removed politeness'],
  ['thanks', '', 'Removed politeness'],
  ['basically ', '', 'Removed filler'],
  ['essentially ', '', 'Removed filler'],
  ['actually ', '', 'Removed filler'],
  ['really ', '', 'Removed filler'],
  ['very ', '', 'Removed filler'],
  ['just ', '', 'Removed filler'],
  ['simply ', '', 'Removed filler'],
  ['in order to', 'to', 'Compressed phrase'],
  ['due to the fact that', 'because', 'Compressed phrase'],
  ['it is important to note that ', '', 'Removed filler'],
  ['it should be noted that ', '', 'Removed filler'],
];

/**
 * Rewrite a prompt specifically optimized for the target model
 * COMPRESSES only - NEVER adds content
 */
export function rewritePromptForModel(
  optimizedPrompt: string,
  targetModel: AIModel
): ModelAwarePrompt {
  const config = MODEL_CONFIGS[targetModel.promptStyle] || MODEL_CONFIGS['instruction-following'];
  const modifications: PromptModification[] = [];
  
  let rewrittenPrompt = optimizedPrompt;

  // Apply model-specific compression patterns
  for (const [search, replace, desc] of config.patterns) {
    const before = rewrittenPrompt;
    // Case-insensitive replace
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    rewrittenPrompt = rewrittenPrompt.replace(regex, replace);
    if (before !== rewrittenPrompt) {
      modifications.push({
        type: 'instruction',
        description: desc,
        reason: `Optimized for ${targetModel.promptStyle}`,
      });
    }
  }

  // Apply provider-level compression
  for (const [search, replace, desc] of PROVIDER_COMPRESSIONS) {
    const before = rewrittenPrompt;
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    rewrittenPrompt = rewrittenPrompt.replace(regex, replace);
    if (before !== rewrittenPrompt) {
      modifications.push({
        type: 'format',
        description: desc,
        reason: `Optimized for ${targetModel.provider}`,
      });
    }
  }

  // Clean up
  rewrittenPrompt = rewrittenPrompt
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Calculate improvements
  const originalTokens = Math.ceil(optimizedPrompt.length / 4);
  const rewrittenTokens = Math.ceil(rewrittenPrompt.length / 4);
  const tokenReduction = Math.max(0, originalTokens - rewrittenTokens);
  const qualityIncrease = modifications.length * 2;

  return {
    originalPrompt: optimizedPrompt,
    modelOptimizedPrompt: rewrittenPrompt,
    targetModel,
    modifications,
    expectedImprovements: {
      qualityIncrease: Math.min(20, qualityIncrease),
      tokenReduction,
      costSavings: tokenReduction * 0.00001,
    },
  };
}

/**
 * Get explanation for model-specific optimizations
 */
export function getModelOptimizationExplanation(model: AIModel): string {
  const explanations: Record<string, string> = {
    'instruction-following': `${model.displayName} excels at direct instructions. Politeness removed.`,
    'deep-reasoning': `${model.displayName} performs best with concise, clear prompts. Filler removed.`,
    'long-context': `${model.displayName} handles massive context. Unnecessary words removed.`,
    'cost-efficient': `${model.displayName} is cost-optimized. All filler, politeness, and verbose phrases removed.`,
    'conversational': `${model.displayName} excels at conversation. Politeness reduced.`,
  };
  return explanations[model.promptStyle] || `Optimized for ${model.displayName}.`;
}
