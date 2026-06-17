// ============================================
// INFERRA GOVERNANCE ENGINE - LAYER 8
// Enterprise governance, compliance, and policy enforcement
// ============================================

import type { 
  GovernanceAnalysis, 
  GovernanceViolation, 
  GovernanceWarning,
  SecurityAnalysis 
} from '../../types';

interface GovernancePolicy {
  maxCostPerRequest: number;
  maxTokensPerRequest: number;
  blockedKeywords: string[];
  requiredApprovalKeywords: string[];
  allowedModels: string[];
  blockedModels: string[];
  workingHoursOnly: boolean;
  workingHours: { start: number; end: number };
}

const DEFAULT_POLICY: GovernancePolicy = {
  maxCostPerRequest: 1.0,
  maxTokensPerRequest: 50000,
  blockedKeywords: ['confidential', 'internal only', 'do not share', 'proprietary'],
  requiredApprovalKeywords: ['budget', 'salary', 'revenue', 'acquisition'],
  allowedModels: [],
  blockedModels: [],
  workingHoursOnly: false,
  workingHours: { start: 9, end: 17 },
};

export function analyzeGovernance(
  prompt: string,
  securityAnalysis: SecurityAnalysis,
  estimatedCost: number,
  estimatedTokens: number,
  selectedModelId: string,
  policy: Partial<GovernancePolicy> = {}
): GovernanceAnalysis {
  const fullPolicy = { ...DEFAULT_POLICY, ...policy };
  const violations: GovernanceViolation[] = [];
  const warnings: GovernanceWarning[] = [];

  const lowerPrompt = prompt.toLowerCase();

  // Check blocked keywords
  for (const keyword of fullPolicy.blockedKeywords) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      violations.push({
        type: 'blocked-keyword',
        severity: 'high',
        description: `Blocked keyword detected: "${keyword}"`,
        policy: 'Content Policy',
        action: 'blocked',
      });
    }
  }

  // Check keywords requiring approval
  for (const keyword of fullPolicy.requiredApprovalKeywords) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      warnings.push({
        type: 'approval-required',
        description: `Sensitive keyword detected: "${keyword}"`,
        recommendation: 'Consider reviewing this request before sending',
      });
    }
  }

  // Check cost limits
  if (estimatedCost > fullPolicy.maxCostPerRequest) {
    violations.push({
      type: 'cost-limit-exceeded',
      severity: 'medium',
      description: `Estimated cost ($${estimatedCost.toFixed(4)}) exceeds limit ($${fullPolicy.maxCostPerRequest})`,
      policy: 'Cost Policy',
      action: 'flagged',
    });
  }

  // Check token limits
  if (estimatedTokens > fullPolicy.maxTokensPerRequest) {
    violations.push({
      type: 'token-limit-exceeded',
      severity: 'medium',
      description: `Estimated tokens (${estimatedTokens}) exceeds limit (${fullPolicy.maxTokensPerRequest})`,
      policy: 'Usage Policy',
      action: 'flagged',
    });
  }

  // Check model restrictions
  if (fullPolicy.blockedModels.length > 0 && fullPolicy.blockedModels.includes(selectedModelId)) {
    violations.push({
      type: 'blocked-model',
      severity: 'high',
      description: `Model "${selectedModelId}" is blocked by policy`,
      policy: 'Model Policy',
      action: 'blocked',
    });
  }

  if (fullPolicy.allowedModels.length > 0 && !fullPolicy.allowedModels.includes(selectedModelId)) {
    violations.push({
      type: 'model-not-allowed',
      severity: 'high',
      description: `Model "${selectedModelId}" is not in allowed list`,
      policy: 'Model Policy',
      action: 'blocked',
    });
  }

  // Check working hours
  if (fullPolicy.workingHoursOnly) {
    const hour = new Date().getHours();
    if (hour < fullPolicy.workingHours.start || hour >= fullPolicy.workingHours.end) {
      warnings.push({
        type: 'outside-working-hours',
        description: 'Request made outside working hours',
        recommendation: 'Ensure this request is authorized for off-hours usage',
      });
    }
  }

  // Include security findings as governance issues
  if (securityAnalysis.blocked) {
    violations.push({
      type: 'security-violation',
      severity: 'critical',
      description: securityAnalysis.blockReason || 'Security policy violation',
      policy: 'Security Policy',
      action: 'blocked',
    });
  }

  if (securityAnalysis.hasPII) {
    warnings.push({
      type: 'pii-detected',
      description: `PII types detected: ${securityAnalysis.piiTypes.join(', ')}`,
      recommendation: 'Ensure PII handling complies with data protection policies',
    });
  }

  if (securityAnalysis.complianceViolations.length > 0) {
    for (const cv of securityAnalysis.complianceViolations) {
      if (cv.severity === 'critical' || cv.severity === 'high') {
        violations.push({
          type: 'compliance-violation',
          severity: cv.severity,
          description: `${cv.framework.toUpperCase()}: ${cv.description}`,
          policy: 'Compliance Policy',
          action: cv.severity === 'critical' ? 'blocked' : 'flagged',
        });
      } else {
        warnings.push({
          type: 'compliance-warning',
          description: `${cv.framework.toUpperCase()}: ${cv.description}`,
          recommendation: 'Review for compliance requirements',
        });
      }
    }
  }

  // Calculate scores
  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const highCount = violations.filter(v => v.severity === 'high').length;
  const mediumCount = violations.filter(v => v.severity === 'medium').length;

  const governanceScore = Math.max(0, 100 - (criticalCount * 40) - (highCount * 20) - (mediumCount * 10) - (warnings.length * 5));
  const complianceScore = Math.max(0, 100 - (securityAnalysis.complianceViolations.length * 15) - (securityAnalysis.riskScore * 0.5));

  const hasBlockingViolation = violations.some(v => v.action === 'blocked');
  const approved = !hasBlockingViolation && criticalCount === 0;
  const requiresReview = warnings.length > 2 || highCount > 0 || violations.some(v => v.action === 'flagged');

  let reviewReason: string | undefined;
  if (requiresReview) {
    const reasons: string[] = [];
    if (highCount > 0) reasons.push('high-severity violations');
    if (warnings.length > 2) reasons.push('multiple warnings');
    if (violations.some(v => v.action === 'flagged')) reasons.push('flagged content');
    reviewReason = `Manual review recommended: ${reasons.join(', ')}`;
  }

  return {
    governanceScore,
    complianceScore,
    violations,
    warnings,
    approved,
    requiresReview,
    reviewReason,
  };
}

// Audit logging helper
export function createAuditEntry(
  userId: string,
  organizationId: string,
  action: string,
  details: {
    prompt?: string;
    model?: string;
    cost?: number;
    violations?: GovernanceViolation[];
    approved?: boolean;
  }
): {
  userId: string;
  organizationId: string;
  action: string;
  details: typeof details;
  timestamp: Date;
  ipAddress?: string;
} {
  return {
    userId,
    organizationId,
    action,
    details,
    timestamp: new Date(),
  };
}
