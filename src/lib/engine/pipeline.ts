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
import { optimizePrompt as optimizePromptV2 } from './optimizer';
import { selectModel, createRoutingDecision } from './routing';
import { calculateCostIntelligence } from './cost';
import { analyzeGovernance } from './governance';
import { rewritePromptForModel } from './modelRewriter';
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

  // ==================== LAYER 2: CHARACTERIZATION ====================
  const characterization = characterizePrompt(workingPrompt, systemPrompt);

  // ==================== LAYER 3: PROMPT INTELLIGENCE ====================
  const intelligence = analyzePromptIntelligence(workingPrompt);

  // ==================== LAYER 4: OPTIMIZATION ====================
  let optimization = optimizePromptV2(workingPrompt);
  
  if (!fullConfig.enableOptimization) {
    // Skip optimization, use original prompt
    optimization = {
      originalPrompt: workingPrompt,
      optimizedPrompt: workingPrompt,
      originalTokens: characterization.estimatedInputTokens,
      optimizedTokens: characterization.estimatedInputTokens,
      tokensSaved: 0,
      tokenReductionPercent: 0,
      optimizationScore: 0,
      optimizations: [],
    };
  }

  // ==================== LAYER 5: MODEL SELECTION ====================
  let modelSelection = selectModel(characterization, preferences);
  
  if (!fullConfig.enableRouting && userSelectedModel) {
    // Use user's selected model
    const { getModelById } = await import('../models');
    const userModel = getModelById(userSelectedModel);
    if (userModel) {
      modelSelection = {
        ...modelSelection,
        recommendedModel: userModel,
        reason: 'User-selected model (routing disabled)',
        confidence: 100,
      };
    }
  }

  // ==================== LAYER 6: MODEL-AWARE PROMPT REWRITING ====================
  // This is where Inferra rewrites the prompt SPECIFICALLY for the selected model
  const modelAwarePrompt = rewritePromptForModel(
    optimization.optimizedPrompt,
    modelSelection.recommendedModel
  );

  // ==================== LAYER 7: COST INTELLIGENCE ====================
  const costIntelligence = calculateCostIntelligence(
    prompt,
    modelAwarePrompt.modelOptimizedPrompt,
    userSelectedModel,
    modelSelection.recommendedModel,
    characterization.estimatedInputTokens,
    characterization.estimatedOutputTokens
  );

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
    selectedModel: modelSelection.recommendedModel,
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
