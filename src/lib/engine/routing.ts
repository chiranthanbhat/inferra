// ============================================
// INFERRA ROUTING ENGINE - LAYER 5 & 10
// Smart model selection and request routing
// ============================================

import type { 
  AIModel, 
  TaskType, 
  PromptCharacterization, 
  ModelSelection, 
  ModelAlternative, 
  SelectionFactor,
  RoutingDecision,
  RequestPreferences 
} from '../../types';
import { AI_MODELS, getModelCost } from '../models';

// Task-to-model affinity scores
const TASK_MODEL_AFFINITY: Record<TaskType, Record<string, number>> = {
  'simple-qa': {
    'gpt-4o-mini': 95, 'claude-3-5-haiku': 92, 'gemini-1.5-flash': 90, 'gemini-2.0-flash': 88,
    'mistral-small': 85, 'deepseek-chat': 88, 'llama-3.3-70b': 80,
  },
  'complex-reasoning': {
    'o1': 98, 'o1-mini': 92, 'o3-mini': 94, 'deepseek-reasoner': 93, 'claude-3-opus': 90,
    'claude-3-5-sonnet': 88, 'gpt-4o': 86, 'gemini-1.5-pro': 84,
  },
  'code': {
    'claude-3-5-sonnet': 97, 'deepseek-chat': 92, 'codestral': 90, 'gpt-4o': 88,
    'o3-mini': 87, 'qwen-2.5-72b': 85, 'gpt-4-turbo': 84, 'mistral-large': 82,
  },
  'creative': {
    'claude-3-opus': 96, 'claude-3-5-sonnet': 94, 'gpt-4o': 90, 'gpt-4-turbo': 88,
    'grok-2': 85, 'gemini-1.5-pro': 82,
  },
  'summarization': {
    'claude-3-5-haiku': 95, 'gemini-1.5-flash': 93, 'gpt-4o-mini': 92, 'gemini-2.0-flash': 90,
    'gemini-1.5-pro': 88, 'mistral-small': 85, 'deepseek-chat': 85,
  },
  'translation': {
    'gpt-4o': 93, 'claude-3-5-sonnet': 91, 'gemini-1.5-pro': 89, 'mistral-large': 87,
    'qwen-2.5-72b': 86, 'mistral-small': 82,
  },
  'data-extraction': {
    'gpt-4o-mini': 95, 'claude-3-5-haiku': 93, 'gemini-1.5-flash': 92, 'deepseek-chat': 88,
    'gemini-2.0-flash': 87, 'mistral-small': 82,
  },
  'conversation': {
    'gpt-4o-mini': 92, 'claude-3-5-haiku': 90, 'grok-2': 88, 'gemini-2.0-flash': 85,
    'deepseek-chat': 84, 'llama-3.3-70b': 82,
  },
  'analysis': {
    'claude-3-5-sonnet': 95, 'gpt-4o': 93, 'claude-3-opus': 92, 'gemini-1.5-pro': 90,
    'deepseek-reasoner': 88, 'gpt-4-turbo': 86,
  },
  'math': {
    'o1': 99, 'deepseek-reasoner': 95, 'o1-mini': 94, 'o3-mini': 93, 'qwen-2.5-72b': 88,
    'claude-3-5-sonnet': 85, 'gpt-4o': 84,
  },
};

export function selectModel(
  characterization: PromptCharacterization,
  preferences?: RequestPreferences
): ModelSelection {
  const priority = preferences?.prioritize || 'balanced';
  
  // Filter models based on preferences
  let candidates = AI_MODELS;
  if (preferences?.preferredModels?.length) {
    candidates = candidates.filter(m => preferences.preferredModels!.includes(m.id));
  }
  if (preferences?.excludedModels?.length) {
    candidates = candidates.filter(m => !preferences.excludedModels!.includes(m.id));
  }

  // Score each model
  const scoredModels = candidates.map(model => {
    const scores = scoreModel(model, characterization, priority);
    const estimatedCost = getModelCost(
      model,
      characterization.estimatedInputTokens,
      characterization.estimatedOutputTokens
    );
    
    return {
      model,
      totalScore: scores.total,
      scores,
      estimatedCost,
      estimatedLatency: model.avgLatencyMs,
      estimatedQuality: model.qualityScore,
    };
  });

  // Filter by constraints
  let filteredModels = scoredModels;
  if (preferences?.maxCost) {
    filteredModels = filteredModels.filter(m => m.estimatedCost <= preferences.maxCost!);
  }
  if (preferences?.maxLatency) {
    filteredModels = filteredModels.filter(m => m.estimatedLatency <= preferences.maxLatency!);
  }
  if (preferences?.minQuality) {
    filteredModels = filteredModels.filter(m => m.estimatedQuality >= preferences.minQuality!);
  }

  // Fallback if all filtered out
  if (filteredModels.length === 0) {
    filteredModels = scoredModels;
  }

  // Sort by score
  filteredModels.sort((a, b) => b.totalScore - a.totalScore);

  const selected = filteredModels[0];
  const alternatives: ModelAlternative[] = filteredModels.slice(1, 4).map(alt => ({
    model: alt.model,
    score: alt.totalScore,
    reason: generateAlternativeReason(alt.model, selected.model, alt.estimatedCost, selected.estimatedCost),
    costDifference: alt.estimatedCost - selected.estimatedCost,
    qualityDifference: alt.model.qualityScore - selected.model.qualityScore,
  }));

  // Build selection factors
  const factors: SelectionFactor[] = [
    {
      name: 'Task Fit',
      weight: 0.3,
      score: selected.scores.taskFit,
      description: `High affinity for ${characterization.taskCategory} tasks`,
    },
    {
      name: 'Cost Efficiency',
      weight: priority === 'cost' ? 0.4 : 0.2,
      score: selected.scores.costEfficiency,
      description: `Estimated cost: $${selected.estimatedCost.toFixed(4)}`,
    },
    {
      name: 'Speed',
      weight: priority === 'speed' ? 0.4 : 0.2,
      score: selected.scores.speed,
      description: `Expected latency: ~${selected.estimatedLatency}ms`,
    },
    {
      name: 'Quality',
      weight: priority === 'quality' ? 0.4 : 0.2,
      score: selected.scores.quality,
      description: `Quality score: ${selected.model.qualityScore}/100`,
    },
  ];

  const confidence = calculateConfidence(selected.totalScore, filteredModels);
  const reason = generateSelectionReason(selected.model, characterization, priority);

  return {
    recommendedModel: selected.model,
    confidence,
    reason,
    alternatives,
    factors,
    comparison: {
      models: filteredModels.slice(0, 5).map(m => m.model),
      costs: filteredModels.slice(0, 5).map(m => m.estimatedCost),
      qualities: filteredModels.slice(0, 5).map(m => m.model.qualityScore),
      speeds: filteredModels.slice(0, 5).map(m => m.model.avgLatencyMs),
      recommendation: reason,
    },
  };
}

function scoreModel(
  model: AIModel,
  characterization: PromptCharacterization,
  priority: 'cost' | 'speed' | 'quality' | 'balanced'
): { taskFit: number; costEfficiency: number; speed: number; quality: number; total: number } {
  // Task fit
  const taskAffinity = TASK_MODEL_AFFINITY[characterization.taskCategory] || {};
  const taskFit = taskAffinity[model.id] || 50;

  // Cost efficiency (inverse)
  const estimatedCost = getModelCost(model, characterization.estimatedInputTokens, characterization.estimatedOutputTokens);
  const maxCost = 0.5;
  const costEfficiency = Math.max(0, 100 - (estimatedCost / maxCost) * 100);

  // Speed (inverse)
  const maxLatency = 20000;
  const speed = Math.max(0, 100 - (model.avgLatencyMs / maxLatency) * 100);

  // Quality
  const quality = model.qualityScore;

  // Weighted total
  let weights = { taskFit: 0.25, cost: 0.25, speed: 0.25, quality: 0.25 };
  
  switch (priority) {
    case 'cost':
      weights = { taskFit: 0.2, cost: 0.5, speed: 0.15, quality: 0.15 };
      break;
    case 'speed':
      weights = { taskFit: 0.2, cost: 0.15, speed: 0.5, quality: 0.15 };
      break;
    case 'quality':
      weights = { taskFit: 0.2, cost: 0.1, speed: 0.1, quality: 0.6 };
      break;
  }

  // Adjustments for complexity
  if (characterization.complexity === 'high' || characterization.complexity === 'very-high') {
    weights.quality *= 1.3;
    weights.cost *= 0.8;
  }

  // Adjustments for reasoning
  if (characterization.requiresReasoning) {
    if (['o1', 'o1-mini', 'o3-mini', 'deepseek-reasoner'].includes(model.id)) {
      weights.quality *= 1.2;
    }
  }

  const total = 
    taskFit * weights.taskFit +
    costEfficiency * weights.cost +
    speed * weights.speed +
    quality * weights.quality;

  return { taskFit, costEfficiency, speed, quality, total };
}

function calculateConfidence(selectedScore: number, allModels: { totalScore: number }[]): number {
  if (allModels.length < 2) return 95;
  const secondBest = allModels[1].totalScore;
  const gap = selectedScore - secondBest;
  return Math.min(98, Math.max(60, 70 + gap * 1.5));
}

function generateSelectionReason(model: AIModel, characterization: PromptCharacterization, priority: string): string {
  const taskNames: Record<TaskType, string> = {
    'simple-qa': 'simple Q&A',
    'complex-reasoning': 'complex reasoning',
    'code': 'code generation',
    'creative': 'creative writing',
    'summarization': 'summarization',
    'translation': 'translation',
    'data-extraction': 'data extraction',
    'conversation': 'conversation',
    'analysis': 'analysis',
    'math': 'mathematical problems',
  };

  const reasons: string[] = [`Best fit for ${taskNames[characterization.taskCategory]}`];

  switch (priority) {
    case 'cost': reasons.push('most cost-effective'); break;
    case 'speed': reasons.push(`fastest response (~${model.avgLatencyMs}ms)`); break;
    case 'quality': reasons.push(`highest quality (${model.qualityScore}/100)`); break;
  }

  if (model.strengths.length > 0) {
    reasons.push(model.strengths[0].toLowerCase());
  }

  return `${model.displayName} selected: ${reasons.join(', ')}.`;
}

function generateAlternativeReason(alt: AIModel, selected: AIModel, altCost: number, selectedCost: number): string {
  if (altCost > selectedCost * 1.5) {
    return `${Math.round((altCost / selectedCost - 1) * 100)}% more expensive`;
  }
  if (alt.avgLatencyMs > selected.avgLatencyMs * 1.5) {
    return `${Math.round((alt.avgLatencyMs / selected.avgLatencyMs - 1) * 100)}% slower`;
  }
  if (alt.qualityScore < selected.qualityScore - 5) {
    return `Lower quality (${alt.qualityScore} vs ${selected.qualityScore})`;
  }
  return 'Slightly lower overall score';
}

export function createRoutingDecision(
  selection: ModelSelection,
  characterization: PromptCharacterization
): RoutingDecision {
  const estimatedCost = getModelCost(
    selection.recommendedModel,
    characterization.estimatedInputTokens,
    characterization.estimatedOutputTokens
  );

  return {
    selectedModel: selection.recommendedModel,
    selectedProvider: selection.recommendedModel.provider,
    routingPath: `inferra → ${selection.recommendedModel.provider} → ${selection.recommendedModel.name}`,
    factors: selection.factors.map(f => ({
      name: f.name,
      weight: f.weight,
      value: f.score,
      impact: f.score > 70 ? 'positive' : f.score < 40 ? 'negative' : 'neutral',
    })),
    fallbackModel: selection.alternatives[0]?.model,
    estimatedCost,
    estimatedLatency: selection.recommendedModel.avgLatencyMs,
    estimatedQuality: selection.recommendedModel.qualityScore,
    confidence: selection.confidence,
  };
}
