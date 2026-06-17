// ============================================
// INFERRA COST INTELLIGENCE ENGINE - LAYER 7
// Comprehensive cost analysis and savings calculation
// ============================================

import type { 
  AIModel, 
  CostIntelligence, 
  CostBreakdown, 
  SavingsBreakdown, 
  TotalSavings 
} from '../../types';
import { AI_MODELS, getModelById, getModelCost } from '../models';

export function calculateCostIntelligence(
  originalPrompt: string,
  optimizedPrompt: string,
  userSelectedModelId: string | undefined,
  routedModel: AIModel,
  _estimatedInputTokens: number,
  estimatedOutputTokens: number
): CostIntelligence {
  // Get the original model (user selected or default expensive)
  const originalModel = userSelectedModelId 
    ? getModelById(userSelectedModelId) || getMostExpensiveModel()
    : getMostExpensiveModel();

  const originalInputTokens = Math.ceil(originalPrompt.length / 4);
  const optimizedInputTokens = Math.ceil(optimizedPrompt.length / 4);

  // Calculate Original Cost (user's selected model, original prompt)
  const originalCost = calculateCostBreakdown(
    originalModel,
    originalInputTokens,
    estimatedOutputTokens
  );

  // Calculate Optimized Cost (same model, optimized prompt)
  const optimizedCost = calculateCostBreakdown(
    originalModel,
    optimizedInputTokens,
    estimatedOutputTokens
  );

  // Calculate Routed Cost (Inferra selected model, optimized prompt)
  const routedCost = calculateCostBreakdown(
    routedModel,
    optimizedInputTokens,
    estimatedOutputTokens
  );

  // Calculate Savings
  const promptSavings = calculateSavings(originalCost.totalCost, optimizedCost.totalCost);
  const routingSavings = calculateSavings(optimizedCost.totalCost, routedCost.totalCost);
  const totalSavings = calculateTotalSavings(originalCost.totalCost, routedCost.totalCost);

  return {
    originalCost,
    optimizedCost,
    promptSavings,
    routedCost,
    routingSavings,
    totalSavings,
  };
}

function calculateCostBreakdown(
  model: AIModel,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const inputCost = (inputTokens / 1000) * model.inputCostPer1k;
  const outputCost = (outputTokens / 1000) * model.outputCostPer1k;
  const totalCost = inputCost + outputCost;

  return {
    model: model.displayName,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCost,
    outputCost,
    totalCost,
    estimatedLatency: model.avgLatencyMs,
  };
}

function calculateSavings(originalCost: number, newCost: number): SavingsBreakdown {
  const costSaved = Math.max(0, originalCost - newCost);
  const percentSaved = originalCost > 0 ? Math.round((costSaved / originalCost) * 100) : 0;

  return {
    tokensSaved: 0, // Calculated at call site
    costSaved,
    percentSaved,
  };
}

function calculateTotalSavings(originalCost: number, finalCost: number): TotalSavings {
  const totalSaved = Math.max(0, originalCost - finalCost);
  const percentSaved = originalCost > 0 ? Math.round((totalSaved / originalCost) * 100) : 0;
  
  // Project annual savings (assuming 1000 requests/month)
  const monthlyProjection = totalSaved * 1000;
  const annualProjection = monthlyProjection * 12;

  return {
    originalCost,
    finalCost,
    totalSaved,
    percentSaved,
    annualProjection,
  };
}

function getMostExpensiveModel(): AIModel {
  return AI_MODELS.reduce((max, m) => {
    const maxCost = max.inputCostPer1k + max.outputCostPer1k;
    const currentCost = m.inputCostPer1k + m.outputCostPer1k;
    return currentCost > maxCost ? m : max;
  });
}

// Cost projection functions
export function projectMonthlyCost(
  avgCostPerRequest: number,
  requestsPerDay: number
): number {
  return avgCostPerRequest * requestsPerDay * 30;
}

export function projectAnnualCost(monthlyCost: number): number {
  return monthlyCost * 12;
}

export function calculateROI(
  monthlySavings: number,
  subscriptionCost: number
): { roi: number; paybackDays: number } {
  const roi = subscriptionCost > 0 ? ((monthlySavings - subscriptionCost) / subscriptionCost) * 100 : 0;
  const paybackDays = monthlySavings > 0 ? Math.ceil((subscriptionCost / monthlySavings) * 30) : 999;
  
  return { roi, paybackDays };
}

// Model cost comparison
export function compareModelCosts(
  inputTokens: number,
  outputTokens: number
): { modelId: string; displayName: string; cost: number; savings: number }[] {
  const costs = AI_MODELS.map(model => ({
    modelId: model.id,
    displayName: model.displayName,
    cost: getModelCost(model, inputTokens, outputTokens),
    savings: 0,
  }));

  // Sort by cost ascending
  costs.sort((a, b) => a.cost - b.cost);

  // Calculate savings relative to most expensive
  const maxCost = costs[costs.length - 1].cost;
  for (const item of costs) {
    item.savings = maxCost - item.cost;
  }

  return costs;
}

// Budget analysis
export function analyzeBudgetUsage(
  currentSpend: number,
  budget: number,
  daysElapsed: number,
  totalDays: number
): {
  percentUsed: number;
  projectedSpend: number;
  onTrack: boolean;
  recommendation: string;
} {
  const percentUsed = budget > 0 ? (currentSpend / budget) * 100 : 0;
  const dailySpend = daysElapsed > 0 ? currentSpend / daysElapsed : 0;
  const projectedSpend = dailySpend * totalDays;
  const onTrack = projectedSpend <= budget;

  let recommendation = '';
  if (percentUsed > 90) {
    recommendation = 'Budget nearly exhausted. Consider upgrading or reducing usage.';
  } else if (projectedSpend > budget * 1.2) {
    recommendation = 'Projected to exceed budget by ' + Math.round((projectedSpend / budget - 1) * 100) + '%. Recommend enabling cost optimization.';
  } else if (projectedSpend < budget * 0.5) {
    recommendation = 'Significantly under budget. Usage efficiency is good.';
  } else {
    recommendation = 'Budget usage is on track.';
  }

  return { percentUsed, projectedSpend, onTrack, recommendation };
}
