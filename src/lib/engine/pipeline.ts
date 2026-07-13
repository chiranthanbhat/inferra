// ============================================
// INFERRA PIPELINE - COMPLETE PROCESSING ENGINE
// Orchestrates all 10 layers of the Inferra pipeline
// ============================================

import type { 
  InferraPipelineResult,
  RequestPreferences,
  AIModel
} from '../../types';
import { analyzeSecurityLayer } from './security';
import { characterizePrompt } from './characterization';
import { analyzePromptIntelligence } from './intelligence';
import { selectModel, createRoutingDecision } from './routing';
import { calculateCostIntelligence } from './cost';
import { analyzeGovernance } from './governance';
import { optimizeForModel, buildRoutingExplanation } from './modelOptimizer';
import { v4 as uuidv4 } from 'uuid';

interface PipelineConfig {
  piiPolicy: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy: 'block' | 'warn' | 'allow';
  enableOptimization: boolean;
  enableRouting: boolean;
  enableGovernance: boolean;
}

const DEFAULT_CONFIG: PipelineConfig = {
  piiPolicy: 'sanitize',
  secretPolicy: 'block',
  enableOptimization: true,
  enableRouting: true,
  enableGovernance: true,
};

export async function runInferraPipeline(
  prompt: string,
  systemPrompt?: string,
  userSelectedModel?: string,
  preferences?: RequestPreferences,
  config: Partial<PipelineConfig> = {}
): Promise<InferraPipelineResult> {
  const startTime = Date.now();
  const requestId = uuidv4();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // ==================== LAYER 1: SECURITY ====================
  const security = analyzeSecurityLayer(prompt, {
    piiPolicy: fullConfig.piiPolicy,
    secretPolicy: fullConfig.secretPolicy,
  });

  // Check for blocking
  if (security.blocked) {
    return createBlockedResult(requestId, startTime, security, prompt, 'Security violation: ' + security.blockReason);
  }

  // Use sanitized prompt if available
  const workingPrompt = security.sanitizedPrompt || prompt;

  // ==================== STAGE 1: INTENT DETECTION + COMPLEXITY ANALYSIS ====================
  const characterization = characterizePrompt(workingPrompt, systemPrompt);

  // Prompt intelligence — informs (but no longer performs) optimization
  const intelligence = analyzePromptIntelligence(workingPrompt);

  // ==================== STAGE 2: INFERRA ROUTING ENGINE → FINAL MODEL SELECTION ====================
  // The routing engine ALWAYS decides the final model from intent, complexity, and cost.
  // A user-selected model is treated as the *requested* baseline only — it never overrides
  // routing, and we never optimize for it unless routing independently lands on the same model.
  const modelSelection = selectModel(characterization, preferences);
  const selectedModel = modelSelection.recommendedModel; // the FINAL routed model that runs the request

  // Resolve the user's requested model (used purely as the cost-comparison baseline).
  let requestedModel: AIModel | undefined;
  if (userSelectedModel) {
    const { getModelById } = await import('../models');
    requestedModel = getModelById(userSelectedModel) || undefined;
  }

  // ==================== STAGE 3: MODEL-SPECIFIC PROMPT ENGINEERING + OPTIMIZATION ====================
  // Each model has its own optimization profile — the FINAL routed model drives the rewrite.
  let optimization, modelAwarePrompt, optimizationProfile;
  if (fullConfig.enableOptimization) {
    const engineered = optimizeForModel(workingPrompt, selectedModel, characterization);
    optimization = engineered.optimization;
    modelAwarePrompt = engineered.modelAwarePrompt;
    optimizationProfile = engineered.profile;
  } else {
    const tokens = Math.ceil(workingPrompt.length / 4);
    optimization = {
      originalPrompt: workingPrompt,
      optimizedPrompt: workingPrompt,
      originalTokens: tokens,
      optimizedTokens: tokens,
      tokensSaved: 0,
      tokenReductionPercent: 0,
      optimizationScore: 0,
      optimizations: [],
    };
    modelAwarePrompt = {
      originalPrompt: workingPrompt,
      modelOptimizedPrompt: workingPrompt,
      targetModel: selectedModel,
      modifications: [],
      expectedImprovements: { qualityIncrease: 0, tokenReduction: 0, costSavings: 0 },
    };
    optimizationProfile = undefined;
  }

  // ==================== STAGE 4: COST RECALCULATION ====================
  // Re-price using the model-specific optimized prompt on the selected model.
  const costIntelligence = calculateCostIntelligence(
    prompt,
    modelAwarePrompt.modelOptimizedPrompt,
    userSelectedModel,
    selectedModel,
    characterization.estimatedInputTokens,
    characterization.estimatedOutputTokens
  );

  const routingExplanation = optimizationProfile
    ? buildRoutingExplanation(selectedModel, characterization, preferences?.prioritize || 'balanced', optimizationProfile, requestedModel)
    : modelSelection.reason;

  // ==================== LAYER 8: GOVERNANCE ====================
  const governance = analyzeGovernance(
    workingPrompt,
    security,
    costIntelligence.routedCost.totalCost,
    costIntelligence.routedCost.totalTokens,
    modelSelection.recommendedModel.id
  );

  // Check governance blocking
  if (fullConfig.enableGovernance && !governance.approved) {
    const blockingViolations = governance.violations.filter(v => v.action === 'blocked');
    if (blockingViolations.length > 0) {
      return createBlockedResult(
        requestId, 
        startTime, 
        security, 
        prompt, 
        'Governance violation: ' + blockingViolations.map(v => v.description).join('; '),
        characterization,
        intelligence,
        optimization,
        modelSelection,
        modelAwarePrompt,
        costIntelligence,
        governance
      );
    }
  }

  // ==================== LAYER 10: ROUTING ====================
  const routing = createRoutingDecision(modelSelection, characterization);

  // ==================== FINAL RESULT ====================
  const processingTimeMs = Date.now() - startTime;

  return {
    requestId,
    timestamp: new Date(),
    processingTimeMs,
    security,
    characterization,
    intelligence,
    optimization,
    modelSelection,
    modelAwarePrompt,
    costIntelligence,
    governance,
    routing,
    finalPrompt: modelAwarePrompt.modelOptimizedPrompt,
    selectedModel,
    requestedModel,
    optimizationProfile,
    routingExplanation,
    success: true,
    blocked: false,
  };
}

function createBlockedResult(
  requestId: string,
  startTime: number,
  security: any,
  originalPrompt: string,
  blockReason: string,
  characterization?: any,
  intelligence?: any,
  optimization?: any,
  modelSelection?: any,
  modelAwarePrompt?: any,
  costIntelligence?: any,
  governance?: any
): InferraPipelineResult {
  const processingTimeMs = Date.now() - startTime;
  
  // Create minimal fallback objects for blocked requests
  const defaultModel: AIModel = {
    id: 'blocked',
    name: 'blocked',
    provider: 'openai',
    displayName: 'Blocked',
    contextWindow: 0,
    maxOutput: 0,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    avgLatencyMs: 0,
    qualityScore: 0,
    capabilities: [],
    strengths: [],
    bestFor: [],
    promptStyle: 'instruction-following',
  };

  return {
    requestId,
    timestamp: new Date(),
    processingTimeMs,
    security,
    characterization: characterization || {
      intent: 'question',
      complexity: 'low',
      complexityScore: 0,
      contextNeeds: { requiresExternalKnowledge: false, requiresLongContext: false, requiresMultiStep: false, estimatedSteps: 1 },
      outputType: 'text',
      taskCategory: 'conversation',
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      keywords: [],
      detectedLanguage: 'english',
      containsCode: false,
      containsMath: false,
      requiresReasoning: false,
      requiresCreativity: false,
      requiresAccuracy: false,
    },
    intelligence: intelligence || {
      qualityScore: 0,
      wasteScore: 0,
      optimizationScore: 0,
      issues: [],
      recommendations: [],
      tokenAnalysis: { totalTokens: 0, instructionTokens: 0, contextTokens: 0, redundantTokens: 0, fillerTokens: 0 },
    },
    optimization: optimization || {
      originalPrompt,
      optimizedPrompt: originalPrompt,
      originalTokens: 0,
      optimizedTokens: 0,
      tokensSaved: 0,
      tokenReductionPercent: 0,
      optimizationScore: 0,
      optimizations: [],
    },
    modelSelection: modelSelection || {
      recommendedModel: defaultModel,
      confidence: 0,
      reason: 'Request blocked',
      alternatives: [],
      factors: [],
      comparison: { models: [], costs: [], qualities: [], speeds: [], recommendation: '' },
    },
    modelAwarePrompt: modelAwarePrompt || {
      originalPrompt,
      modelOptimizedPrompt: originalPrompt,
      targetModel: defaultModel,
      modifications: [],
      expectedImprovements: { qualityIncrease: 0, tokenReduction: 0, costSavings: 0 },
    },
    costIntelligence: costIntelligence || {
      originalCost: { model: '', inputTokens: 0, outputTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0, estimatedLatency: 0 },
      optimizedCost: { model: '', inputTokens: 0, outputTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0, estimatedLatency: 0 },
      promptSavings: { tokensSaved: 0, costSaved: 0, percentSaved: 0 },
      routedCost: { model: '', inputTokens: 0, outputTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0, estimatedLatency: 0 },
      routingSavings: { tokensSaved: 0, costSaved: 0, percentSaved: 0 },
      totalSavings: { originalCost: 0, finalCost: 0, totalSaved: 0, percentSaved: 0, annualProjection: 0 },
    },
    governance: governance || {
      governanceScore: 0,
      complianceScore: 0,
      violations: [],
      warnings: [],
      approved: false,
      requiresReview: false,
    },
    routing: {
      selectedModel: defaultModel,
      selectedProvider: 'openai',
      routingPath: 'blocked',
      factors: [],
      estimatedCost: 0,
      estimatedLatency: 0,
      estimatedQuality: 0,
      confidence: 0,
    },
    finalPrompt: originalPrompt,
    selectedModel: defaultModel,
    success: false,
    blocked: true,
    blockReason,
  };
}

// Export a simplified function for quick analysis without full pipeline
export function quickAnalyze(prompt: string): {
  taskType: string;
  complexity: string;
  estimatedTokens: number;
  estimatedCost: number;
  recommendedModel: string;
  securityRisk: 'low' | 'medium' | 'high';
} {
  const security = analyzeSecurityLayer(prompt, { piiPolicy: 'warn', secretPolicy: 'warn' });
  const characterization = characterizePrompt(prompt);
  const modelSelection = selectModel(characterization);
  
  const { getModelCost } = require('../models');
  const estimatedCost = getModelCost(
    modelSelection.recommendedModel,
    characterization.estimatedInputTokens,
    characterization.estimatedOutputTokens
  );

  return {
    taskType: characterization.taskCategory,
    complexity: characterization.complexity,
    estimatedTokens: characterization.estimatedInputTokens + characterization.estimatedOutputTokens,
    estimatedCost,
    recommendedModel: modelSelection.recommendedModel.displayName,
    securityRisk: security.riskScore > 50 ? 'high' : security.riskScore > 20 ? 'medium' : 'low',
  };
}
