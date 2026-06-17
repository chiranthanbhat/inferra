// ============================================
// INFERRA COMPLETE TYPE SYSTEM
// Production-ready types for the entire platform
// ============================================

// ==================== USER & AUTH ====================

export interface User {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  teamIds: string[];
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  plan: PlanType;
  planLimits: PlanLimits;
  usage: OrganizationUsage;
  settings: OrganizationSettings;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PlanType = 'free' | 'growth' | 'scale' | 'enterprise';

export interface PlanLimits {
  requestsPerMonth: number;
  usersLimit: number;
  teamsLimit: number;
}

export interface OrganizationUsage {
  requestsUsed: number;
  totalSpend: number;
  totalSavings: number;
  tokensProcessed: number;
}

export interface OrganizationSettings {
  defaultModel: string;
  enableOptimization: boolean;
  enableRouting: boolean;
  enableGovernance: boolean;
  piiPolicy: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy: 'block' | 'warn' | 'allow';
  customRules?: RoutingRule[];
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  memberIds: string[];
  budget?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AI MODELS ====================

export type AIProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'xai' 
  | 'deepseek' 
  | 'mistral' 
  | 'openrouter'
  | 'opensource';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  displayName: string;
  contextWindow: number;
  maxOutput: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  qualityScore: number;
  capabilities: ModelCapability[];
  strengths: string[];
  bestFor: TaskType[];
  promptStyle: PromptStyle;
}

export type ModelCapability = 
  | 'text-generation'
  | 'code-generation'
  | 'reasoning'
  | 'math'
  | 'creative-writing'
  | 'summarization'
  | 'translation'
  | 'analysis'
  | 'vision'
  | 'function-calling'
  | 'long-context';

export type TaskType =
  | 'simple-qa'
  | 'complex-reasoning'
  | 'code'
  | 'creative'
  | 'summarization'
  | 'translation'
  | 'data-extraction'
  | 'conversation'
  | 'analysis'
  | 'math';

export type PromptStyle = 
  | 'instruction-following'
  | 'deep-reasoning'
  | 'long-context'
  | 'cost-efficient'
  | 'conversational';

// ==================== REQUEST PIPELINE ====================

export interface InferraRequest {
  id: string;
  organizationId: string;
  userId: string;
  teamId?: string;
  originalPrompt: string;
  systemPrompt?: string;
  userSelectedModel?: string;
  preferences: RequestPreferences;
  createdAt: Date;
}

export interface RequestPreferences {
  prioritize: 'cost' | 'speed' | 'quality' | 'balanced';
  maxCost?: number;
  maxLatency?: number;
  minQuality?: number;
  preferredModels?: string[];
  excludedModels?: string[];
}

// ==================== LAYER 1: SECURITY ====================

export interface SecurityAnalysis {
  securityScore: number;  // 0-100, higher is safer
  riskScore: number;      // 0-100, higher is riskier
  
  // API Keys & Secrets
  hasSecrets: boolean;
  secretTypes: SecretType[];
  secretLocations: SecretLocation[];
  
  // PII Detection
  hasPII: boolean;
  piiTypes: PIIType[];
  piiLocations: PIILocation[];
  
  // Compliance
  complianceViolations: ComplianceViolation[];
  
  // Actions
  blocked: boolean;
  blockReason?: string;
  sanitizedPrompt?: string;
}

export type SecretType = 
  | 'api-key'
  | 'password'
  | 'token'
  | 'private-key'
  | 'aws-credentials'
  | 'database-url'
  | 'oauth-secret'
  | 'ssh-key'
  | 'certificate';

export interface SecretLocation {
  type: SecretType;
  start: number;
  end: number;
  pattern: string;
  confidence: number;
}

export type PIIType = 
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit-card'
  | 'address'
  | 'name'
  | 'date-of-birth'
  | 'ip-address'
  | 'medical'
  | 'financial'
  | 'passport'
  | 'drivers-license';

export interface PIILocation {
  type: PIIType;
  start: number;
  end: number;
  value: string;
  masked: string;
  confidence: number;
}

export interface ComplianceViolation {
  framework: 'gdpr' | 'hipaa' | 'pci-dss' | 'sox' | 'ccpa' | 'ferpa';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dataTypes: string[];
}

// ==================== LAYER 2: CHARACTERIZATION ====================

export interface PromptCharacterization {
  intent: IntentType;
  complexity: ComplexityLevel;
  complexityScore: number;  // 0-100
  contextNeeds: ContextNeeds;
  outputType: OutputType;
  taskCategory: TaskType;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  keywords: string[];
  detectedLanguage: string;
  containsCode: boolean;
  containsMath: boolean;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  requiresAccuracy: boolean;
}

export type IntentType = 
  | 'question'
  | 'instruction'
  | 'generation'
  | 'analysis'
  | 'transformation'
  | 'conversation'
  | 'coding';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'very-high';

export interface ContextNeeds {
  requiresExternalKnowledge: boolean;
  requiresLongContext: boolean;
  requiresMultiStep: boolean;
  estimatedSteps: number;
}

export type OutputType = 
  | 'text'
  | 'code'
  | 'json'
  | 'list'
  | 'table'
  | 'analysis'
  | 'creative';

// ==================== LAYER 3: PROMPT INTELLIGENCE ====================

export interface PromptIntelligence {
  qualityScore: number;      // 0-100
  wasteScore: number;        // 0-100, higher = more waste
  optimizationScore: number; // 0-100, how much can be optimized
  
  issues: PromptIssue[];
  recommendations: string[];
  
  tokenAnalysis: {
    totalTokens: number;
    instructionTokens: number;
    contextTokens: number;
    redundantTokens: number;
    fillerTokens: number;
  };
}

export interface PromptIssue {
  type: PromptIssueType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: { start: number; end: number };
  suggestion?: string;
  tokenImpact: number;
}

export type PromptIssueType = 
  | 'redundancy'
  | 'verbosity'
  | 'duplicate-instruction'
  | 'excessive-context'
  | 'poor-structure'
  | 'missing-context'
  | 'filler-words'
  | 'repeated-examples';

// ==================== LAYER 4: OPTIMIZATION ====================

export interface PromptOptimization {
  originalPrompt: string;
  optimizedPrompt: string;
  
  originalTokens: number;
  optimizedTokens: number;
  tokensSaved: number;
  tokenReductionPercent: number;
  
  optimizationScore: number;
  optimizations: OptimizationAction[];
}

export interface OptimizationAction {
  type: string;
  description: string;
  tokensSaved: number;
  before?: string;
  after?: string;
}

// ==================== LAYER 5: MODEL SELECTION ====================

export interface ModelSelection {
  recommendedModel: AIModel;
  confidence: number;  // 0-100
  reason: string;
  
  alternatives: ModelAlternative[];
  
  factors: SelectionFactor[];
  
  comparison: ModelComparison;
}

export interface ModelAlternative {
  model: AIModel;
  score: number;
  reason: string;
  costDifference: number;
  qualityDifference: number;
}

export interface SelectionFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface ModelComparison {
  models: AIModel[];
  costs: number[];
  qualities: number[];
  speeds: number[];
  recommendation: string;
}

// ==================== LAYER 6: MODEL-AWARE ENGINEERING ====================

export interface ModelAwarePrompt {
  originalPrompt: string;
  modelOptimizedPrompt: string;
  targetModel: AIModel;
  
  modifications: PromptModification[];
  
  expectedImprovements: {
    qualityIncrease: number;
    tokenReduction: number;
    costSavings: number;
  };
}

export interface PromptModification {
  type: 'structure' | 'instruction' | 'format' | 'context' | 'examples';
  description: string;
  reason: string;
}

// ==================== LAYER 7: COST INTELLIGENCE ====================

export interface CostIntelligence {
  // Original Cost (User's selected model)
  originalCost: CostBreakdown;
  
  // Optimized Prompt Cost (Same model, optimized prompt)
  optimizedCost: CostBreakdown;
  promptSavings: SavingsBreakdown;
  
  // Routed Cost (Inferra selected model)
  routedCost: CostBreakdown;
  routingSavings: SavingsBreakdown;
  
  // Total Savings
  totalSavings: TotalSavings;
}

export interface CostBreakdown {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  estimatedLatency: number;
}

export interface SavingsBreakdown {
  tokensSaved: number;
  costSaved: number;
  percentSaved: number;
}

export interface TotalSavings {
  originalCost: number;
  finalCost: number;
  totalSaved: number;
  percentSaved: number;
  annualProjection: number;
}

// ==================== LAYER 8: GOVERNANCE ====================

export interface GovernanceAnalysis {
  governanceScore: number;  // 0-100
  complianceScore: number;  // 0-100
  
  violations: GovernanceViolation[];
  warnings: GovernanceWarning[];
  
  approved: boolean;
  requiresReview: boolean;
  reviewReason?: string;
}

export interface GovernanceViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  policy: string;
  action: 'blocked' | 'flagged' | 'sanitized';
}

export interface GovernanceWarning {
  type: string;
  description: string;
  recommendation: string;
}

// ==================== LAYER 9: ANALYTICS ====================

export interface RequestAnalytics {
  totalRequests: number;
  totalTokens: number;
  totalSpend: number;
  totalSavings: number;
  avgCostPerRequest: number;
  avgLatency: number;
  
  byModel: Record<string, ModelAnalytics>;
  byUser: Record<string, UserAnalytics>;
  byTeam: Record<string, TeamAnalytics>;
  byTask: Record<string, TaskAnalytics>;
  
  timeline: TimelineEntry[];
}

export interface ModelAnalytics {
  modelId: string;
  requests: number;
  tokens: number;
  spend: number;
  avgLatency: number;
}

export interface UserAnalytics {
  userId: string;
  requests: number;
  tokens: number;
  spend: number;
  savings: number;
}

export interface TeamAnalytics {
  teamId: string;
  requests: number;
  tokens: number;
  spend: number;
  savings: number;
  memberCount: number;
}

export interface TaskAnalytics {
  taskType: TaskType;
  requests: number;
  avgCost: number;
  avgQuality: number;
}

export interface TimelineEntry {
  date: string;
  requests: number;
  spend: number;
  savings: number;
  tokens: number;
}

// ==================== LAYER 10: ROUTING ====================

export interface RoutingDecision {
  selectedModel: AIModel;
  selectedProvider: AIProvider;
  
  routingPath: string;
  
  factors: RoutingFactor[];
  
  fallbackModel?: AIModel;
  
  estimatedCost: number;
  estimatedLatency: number;
  estimatedQuality: number;
  
  confidence: number;
}

export interface RoutingFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  condition: RuleCondition;
  action: RuleAction;
}

export interface RuleCondition {
  type: 'keyword' | 'user' | 'team' | 'complexity' | 'task' | 'time' | 'cost';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'in';
  value: string | number | string[];
}

export interface RuleAction {
  type: 'route-to' | 'block' | 'require-approval' | 'apply-limit';
  target?: string;
  limit?: number;
}

// ==================== COMPLETE PIPELINE RESULT ====================

export interface InferraPipelineResult {
  requestId: string;
  timestamp: Date;
  processingTimeMs: number;
  
  // Layer Results
  security: SecurityAnalysis;
  characterization: PromptCharacterization;
  intelligence: PromptIntelligence;
  optimization: PromptOptimization;
  modelSelection: ModelSelection;
  modelAwarePrompt: ModelAwarePrompt;
  costIntelligence: CostIntelligence;
  governance: GovernanceAnalysis;
  routing: RoutingDecision;
  
  // Final Output
  finalPrompt: string;
  selectedModel: AIModel;
  
  // Status
  success: boolean;
  blocked: boolean;
  blockReason?: string;
  
  // Response (if executed)
  response?: AIResponse;
}

export interface AIResponse {
  id: string;
  content: string;
  model: AIModel;
  usage: TokenUsage;
  cost: number;
  latencyMs: number;
  finishReason: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ==================== PRICING ====================

export interface PricingPlan {
  id: PlanType;
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
}

// ==================== ADMIN ====================

export interface AdminStats {
  totalUsers: number;
  totalOrganizations: number;
  totalRequests: number;
  totalRevenue: number;
  activeSubscriptions: Record<PlanType, number>;
  dailyActiveUsers: number;
  requestsToday: number;
  revenueToday: number;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
