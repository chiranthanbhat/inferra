// ============================================
// INFERRA AI MODEL REGISTRY
// Complete database of supported AI models with real pricing
// ============================================

import type { AIModel } from '../types';

export const AI_MODELS: AIModel[] = [
  // ==================== OPENAI ====================
  {
    id: 'gpt-4o',
    name: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutput: 16384,
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.01,
    avgLatencyMs: 800,
    qualityScore: 94,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'creative-writing', 'analysis', 'vision', 'function-calling'],
    strengths: ['Multimodal', 'Fast', 'Well-balanced', 'Great instruction following'],
    bestFor: ['complex-reasoning', 'code', 'analysis', 'conversation'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'gpt-4o-mini',
    name: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutput: 16384,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 350,
    qualityScore: 82,
    capabilities: ['text-generation', 'code-generation', 'summarization', 'function-calling'],
    strengths: ['Very cheap', 'Fast', 'Good for simple tasks', 'High throughput'],
    bestFor: ['simple-qa', 'summarization', 'data-extraction', 'conversation'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'gpt-4-turbo',
    name: 'gpt-4-turbo',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutput: 4096,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    avgLatencyMs: 1200,
    qualityScore: 92,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'creative-writing', 'analysis', 'vision'],
    strengths: ['High quality', 'Large context', 'Strong reasoning'],
    bestFor: ['complex-reasoning', 'code', 'analysis', 'creative'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'openai',
    displayName: 'OpenAI o1',
    contextWindow: 200000,
    maxOutput: 100000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.06,
    avgLatencyMs: 20000,
    qualityScore: 99,
    capabilities: ['reasoning', 'math', 'code-generation', 'analysis'],
    strengths: ['Best reasoning', 'Chain of thought', 'Complex problems', 'PhD-level'],
    bestFor: ['complex-reasoning', 'math', 'code'],
    promptStyle: 'deep-reasoning'
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    provider: 'openai',
    displayName: 'OpenAI o1-mini',
    contextWindow: 128000,
    maxOutput: 65536,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.012,
    avgLatencyMs: 10000,
    qualityScore: 90,
    capabilities: ['reasoning', 'math', 'code-generation'],
    strengths: ['Good reasoning', 'Cost-effective', 'Faster than o1'],
    bestFor: ['code', 'math', 'complex-reasoning'],
    promptStyle: 'deep-reasoning'
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    displayName: 'OpenAI o3-mini',
    contextWindow: 200000,
    maxOutput: 100000,
    inputCostPer1k: 0.0011,
    outputCostPer1k: 0.0044,
    avgLatencyMs: 8000,
    qualityScore: 92,
    capabilities: ['reasoning', 'math', 'code-generation', 'analysis'],
    strengths: ['Latest reasoning', 'Very cost-effective', 'Strong STEM'],
    bestFor: ['code', 'math', 'complex-reasoning', 'analysis'],
    promptStyle: 'deep-reasoning'
  },

  // ==================== ANTHROPIC ====================
  {
    id: 'claude-3-5-sonnet',
    name: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxOutput: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 900,
    qualityScore: 96,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'creative-writing', 'analysis', 'vision'],
    strengths: ['Excellent coding', 'Great writing', 'Deep reasoning', 'Accurate'],
    bestFor: ['code', 'creative', 'analysis', 'complex-reasoning'],
    promptStyle: 'deep-reasoning'
  },
  {
    id: 'claude-3-5-haiku',
    name: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutput: 8192,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    avgLatencyMs: 300,
    qualityScore: 85,
    capabilities: ['text-generation', 'code-generation', 'summarization'],
    strengths: ['Very fast', 'Cheap', 'Good quality for price', 'Long context'],
    bestFor: ['simple-qa', 'summarization', 'conversation', 'data-extraction'],
    promptStyle: 'deep-reasoning'
  },
  {
    id: 'claude-3-opus',
    name: 'claude-3-opus-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    maxOutput: 4096,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    avgLatencyMs: 2500,
    qualityScore: 97,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'creative-writing', 'analysis', 'vision'],
    strengths: ['Highest quality', 'Best creative writing', 'Deep analysis'],
    bestFor: ['creative', 'complex-reasoning', 'analysis'],
    promptStyle: 'deep-reasoning'
  },

  // ==================== GOOGLE ====================
  {
    id: 'gemini-2.0-flash',
    name: 'gemini-2.0-flash-exp',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxOutput: 8192,
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    avgLatencyMs: 400,
    qualityScore: 88,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'vision', 'function-calling', 'long-context'],
    strengths: ['Massive context', 'Very fast', 'Multimodal', 'Real-time'],
    bestFor: ['simple-qa', 'conversation', 'summarization', 'analysis'],
    promptStyle: 'long-context'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2000000,
    maxOutput: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 1000,
    qualityScore: 91,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'analysis', 'vision', 'long-context'],
    strengths: ['2M token context', 'Multimodal', 'Good reasoning'],
    bestFor: ['analysis', 'summarization', 'complex-reasoning'],
    promptStyle: 'long-context'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'gemini-1.5-flash',
    provider: 'google',
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1000000,
    maxOutput: 8192,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    avgLatencyMs: 250,
    qualityScore: 78,
    capabilities: ['text-generation', 'summarization', 'translation', 'long-context'],
    strengths: ['Extremely cheap', 'Very fast', 'Large context'],
    bestFor: ['simple-qa', 'summarization', 'translation', 'data-extraction'],
    promptStyle: 'long-context'
  },

  // ==================== XAI ====================
  {
    id: 'grok-2',
    name: 'grok-2-1212',
    provider: 'xai',
    displayName: 'Grok 2',
    contextWindow: 131072,
    maxOutput: 32768,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.01,
    avgLatencyMs: 700,
    qualityScore: 88,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'creative-writing'],
    strengths: ['Real-time knowledge', 'Conversational', 'Good humor'],
    bestFor: ['conversation', 'analysis', 'creative'],
    promptStyle: 'conversational'
  },
  {
    id: 'grok-2-vision',
    name: 'grok-2-vision-1212',
    provider: 'xai',
    displayName: 'Grok 2 Vision',
    contextWindow: 32768,
    maxOutput: 8192,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.01,
    avgLatencyMs: 800,
    qualityScore: 86,
    capabilities: ['text-generation', 'vision', 'analysis'],
    strengths: ['Image understanding', 'Real-time', 'Conversational'],
    bestFor: ['analysis', 'conversation'],
    promptStyle: 'conversational'
  },

  // ==================== DEEPSEEK ====================
  {
    id: 'deepseek-chat',
    name: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek V3',
    contextWindow: 64000,
    maxOutput: 8192,
    inputCostPer1k: 0.00014,
    outputCostPer1k: 0.00028,
    avgLatencyMs: 500,
    qualityScore: 87,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'math'],
    strengths: ['Extremely cheap', 'Strong coding', 'Good math', 'Fast'],
    bestFor: ['code', 'math', 'simple-qa', 'conversation'],
    promptStyle: 'cost-efficient'
  },
  {
    id: 'deepseek-reasoner',
    name: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek R1',
    contextWindow: 64000,
    maxOutput: 8192,
    inputCostPer1k: 0.00055,
    outputCostPer1k: 0.00219,
    avgLatencyMs: 6000,
    qualityScore: 94,
    capabilities: ['reasoning', 'math', 'code-generation', 'analysis'],
    strengths: ['Strong reasoning', 'Very cheap for reasoning', 'Transparent thinking'],
    bestFor: ['complex-reasoning', 'math', 'code'],
    promptStyle: 'deep-reasoning'
  },

  // ==================== MISTRAL ====================
  {
    id: 'mistral-large',
    name: 'mistral-large-latest',
    provider: 'mistral',
    displayName: 'Mistral Large',
    contextWindow: 128000,
    maxOutput: 8192,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.006,
    avgLatencyMs: 800,
    qualityScore: 86,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'function-calling'],
    strengths: ['Good value', 'Strong coding', 'Multilingual', 'Function calling'],
    bestFor: ['code', 'translation', 'conversation'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'mistral-small',
    name: 'mistral-small-latest',
    provider: 'mistral',
    displayName: 'Mistral Small',
    contextWindow: 32000,
    maxOutput: 8192,
    inputCostPer1k: 0.0002,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 350,
    qualityScore: 75,
    capabilities: ['text-generation', 'summarization', 'translation'],
    strengths: ['Very cheap', 'Fast', 'Good for simple tasks'],
    bestFor: ['simple-qa', 'summarization', 'translation'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'codestral',
    name: 'codestral-latest',
    provider: 'mistral',
    displayName: 'Codestral',
    contextWindow: 32000,
    maxOutput: 8192,
    inputCostPer1k: 0.0003,
    outputCostPer1k: 0.0009,
    avgLatencyMs: 450,
    qualityScore: 88,
    capabilities: ['code-generation', 'text-generation'],
    strengths: ['Optimized for code', 'Fast', 'Cheap', '80+ languages'],
    bestFor: ['code'],
    promptStyle: 'instruction-following'
  },

  // ==================== OPEN SOURCE (via OpenRouter) ====================
  {
    id: 'llama-3.3-70b',
    name: 'meta-llama/llama-3.3-70b-instruct',
    provider: 'openrouter',
    displayName: 'Llama 3.3 70B',
    contextWindow: 128000,
    maxOutput: 4096,
    inputCostPer1k: 0.00035,
    outputCostPer1k: 0.0004,
    avgLatencyMs: 1000,
    qualityScore: 86,
    capabilities: ['text-generation', 'code-generation', 'reasoning'],
    strengths: ['Open source', 'No data retention', 'Good quality'],
    bestFor: ['conversation', 'code', 'simple-qa'],
    promptStyle: 'instruction-following'
  },
  {
    id: 'qwen-2.5-72b',
    name: 'qwen/qwen-2.5-72b-instruct',
    provider: 'openrouter',
    displayName: 'Qwen 2.5 72B',
    contextWindow: 131072,
    maxOutput: 8192,
    inputCostPer1k: 0.00035,
    outputCostPer1k: 0.0004,
    avgLatencyMs: 900,
    qualityScore: 87,
    capabilities: ['text-generation', 'code-generation', 'reasoning', 'math'],
    strengths: ['Strong math', 'Multilingual', 'Long context'],
    bestFor: ['code', 'math', 'analysis'],
    promptStyle: 'instruction-following'
  }
];

// Helper Functions
export const getModelById = (id: string): AIModel | undefined => {
  return AI_MODELS.find(m => m.id === id);
};

export const getModelsByProvider = (provider: string): AIModel[] => {
  return AI_MODELS.filter(m => m.provider === provider);
};

export const getModelsByCapability = (capability: string): AIModel[] => {
  return AI_MODELS.filter(m => m.capabilities.includes(capability as any));
};

export const getCheapestModel = (): AIModel => {
  return AI_MODELS.reduce((min, m) => 
    (m.inputCostPer1k + m.outputCostPer1k) < (min.inputCostPer1k + min.outputCostPer1k) ? m : min
  );
};

export const getFastestModel = (): AIModel => {
  return AI_MODELS.reduce((min, m) => m.avgLatencyMs < min.avgLatencyMs ? m : min);
};

export const getHighestQualityModel = (): AIModel => {
  return AI_MODELS.reduce((max, m) => m.qualityScore > max.qualityScore ? m : max);
};

export const getModelCost = (model: AIModel, inputTokens: number, outputTokens: number): number => {
  return (inputTokens / 1000) * model.inputCostPer1k + (outputTokens / 1000) * model.outputCostPer1k;
};

export const getProviderDisplayName = (provider: string): string => {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    deepseek: 'DeepSeek',
    mistral: 'Mistral',
    openrouter: 'OpenRouter',
    opensource: 'Open Source'
  };
  return names[provider] || provider;
};
