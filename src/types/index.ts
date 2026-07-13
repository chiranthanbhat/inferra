// ============================================
// INFERRA COMPLETE TYPE SYSTEM
// Production-ready types for the entire platform
// ============================================

// ==================== USER & AUTH ====================

export interface User {
  id: string;                 // Firebase uid
  email: string;
  name: string;
  photoURL?: string;
  emailVerified: boolean;
  onboarded: boolean;          // has completed plan selection after signup

  // Multi-tenant: the org the user is currently working inside. Users may belong
  // to many orgs (listed in the `memberships` subcollection); this is just the
  // active one. Persisted so refresh/relaunch resumes the last-used context.
  activeOrganizationId: string;
  isAdmin: boolean;            // Inferra-platform-admin flag (NOT an org role)

  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

/**
 * A user's membership in a single organization. Written under both
 * `organizations/{orgId}/members/{uid}` (authoritative) AND
 * `users/{uid}/memberships/{orgId}` (mirror, so the client can list all orgs
 * for the switcher without a collection-group scan).
 */
export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  joinedAt: Date;
  lastAccessedAt?: Date;
}

export type SubscriptionStatus =
  | 'none'        // free, never subscribed
  | 'trialing'    // card authenticated, first charge delayed (trial window)
  | 'active'
  | 'authenticated'  // razorpay: created, awaiting first charge
  | 'pending'
  | 'halted'      // payment retries exhausted
  | 'past_due'
  | 'cancelled'
  | 'expired';

export interface Organization {
  id: string;
  name: string;
  ownerId: string;

  // Optional profile fields — filled in via Settings → Organization.
  logo?: OrganizationLogo;
  timezone?: string;   // IANA (e.g. "America/New_York")
  country?: string;    // ISO 3166-1 alpha-2 (e.g. "US")
  branding?: OrganizationBranding;

  // Billing (server-authoritative). Never write from the client.
  plan: PlanType;
  planLimits: PlanLimits;
  usage: OrganizationUsage;
  subscriptionStatus: SubscriptionStatus;
  razorpayCustomerId?: string;
  razorpaySubscriptionId?: string;
  monthlyResetDate: Date;
  trialEndsAt?: Date;          // set while subscriptionStatus === 'trialing'
  /** Enterprise API access — only a hash is stored; prefix shown for identification. */
  apiKey?: { prefix: string; rotatedAt?: Date };

  settings: OrganizationSettings;
  notifications: OrganizationNotifications;

  createdAt: Date;
  updatedAt: Date;
}

/** Logo stored in Firebase Storage; never inline. Sizes cached for the UI. */
export interface OrganizationLogo {
  url: string;
  storagePath: string;   // e.g. org-logos/{orgId}/{fileId}.png
  width?: number;
  height?: number;
  updatedAt: Date;
}

/** Optional brand palette. Consumed by future white-label surfaces. */
export interface OrganizationBranding {
  primaryColor?: string;   // hex
  accentColor?: string;    // hex
  faviconUrl?: string;
}

/** User-controlled toggles for the org's notification preferences. */
export interface OrganizationNotifications {
  budgetAlerts: boolean;
  securityAlerts: boolean;
  weeklyReports: boolean;
  usageAlertThresholds: number[];   // e.g. [50, 80, 90, 95, 100] (%)
}

export type PlanType = 'free' | 'starter' | 'growth' | 'enterprise';

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
  defaultPriority: 'cost' | 'speed' | 'quality' | 'balanced';
  enableOptimization: boolean;
  enableRouting: boolean;
  enableGovernance: boolean;
  piiPolicy: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy: 'block' | 'warn' | 'allow';
  /** Provider governance: a provider set to false is blocked org-wide (enforced server-side). */
  enabledProviders?: Partial<Record<AIProvider, boolean>>;
  customRules?: RoutingRule[];
}

// ==================== WORKSPACE TEAMS ====================
// Teams are first-class workspace entities (Linear/GitHub-orgs style): an org
// contains many teams; users belong to any number of teams with a PER-TEAM
// role that is independent of their organization role.

/** Role inside a single team — independent of the organization role. */
export type TeamRole = 'manager' | 'member' | 'viewer';

export type TeamStatus = 'active' | 'archived';

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  color: string;        // hex accent, e.g. '#4DEEEA'
  icon: string;         // lucide icon key from TEAM_ICONS
  managerId: string;    // uid of the team manager
  status: TeamStatus;
  memberCount: number;  // denormalized; maintained by Cloud Functions
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Normalized membership row — doc id is `${teamId}_${userId}`. */
export interface TeamMember {
  id: string;
  teamId: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  teamRole: TeamRole;
  addedBy: string;
  addedAt: Date;
}

/**
 * Resource keys — every page/surface declares one. Access is resolved from the
 * organization role AND the caller's team grants (see src/lib/resources.ts).
 */
export type ResourceKey =
  | 'dashboard'
  | 'analytics'
  | 'routing'
  | 'optimization'
  | 'commandCenter'
  | 'chat'
  | 'integrations'
  | 'billing'
  | 'settings'
  | 'teams'
  | 'auditLogs'
  | 'providers'
  | 'promptLibrary';

/** Per-team resource grants + custom permission assignments. Doc id = teamId. */
export interface TeamPermissions {
  teamId: string;
  organizationId: string;
  grants: Partial<Record<ResourceKey, boolean>>;
  customGrants: string[];   // ids of org-defined CustomPermissions
  updatedBy?: string;
  updatedAt?: Date;
}

/** Owner-defined permission (e.g. "Manage Prompt Library"), assignable to teams. */
export interface CustomPermission {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export interface TeamActivity {
  id: string;
  teamId: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  eventType: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface TeamSettings {
  teamId: string;
  organizationId: string;
  /** Default routing strategy for this team's requests. */
  defaultPriority?: 'cost' | 'speed' | 'quality' | 'balanced';
  /** Preferred baseline model id (empty = auto-select). */
  defaultModel?: string;
  /** Providers this team is allowed to route to (unset key = allowed). */
  allowedProviders?: Partial<Record<AIProvider, boolean>>;
  /** Prompt policies applied to this team's requests. */
  piiPolicy?: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy?: 'block' | 'warn' | 'allow';
  monthlyBudget?: number;         // soft budget in USD for team usage reports
  monthlyRequestLimit?: number;   // soft request cap surfaced in usage reports
  /** Notification preferences for the team's manager. */
  notifyUsageThreshold?: boolean;
  notifyMemberChanges?: boolean;
  notes?: string;
  updatedAt?: Date;
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

  // Semantic engine output
  qualityScore?: number;          // optimization quality 0-100
  intentScore?: number;           // intent preservation 0-100
  confidenceScore?: number;       // engine confidence 0-100
  validationPassed?: boolean;     // false if reduction < 15% on a >200-token prompt
  validationMessage?: string;
  sections?: OptimizationSection[];
}

export interface OptimizationSection {
  title: 'Objective' | 'Requirements' | 'Constraints' | 'Deliverables';
  items: string[];
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

// Model-specific optimization profile (drives Layer 5 → "Model-Specific Prompt Engineering")
export type OptimizationProfileId =
  | 'reasoning'        // Claude / Anthropic
  | 'structured'       // GPT / OpenAI
  | 'context'          // Gemini / Google
  | 'compression'      // DeepSeek
  | 'conversational';  // Grok / xAI

export interface ModelOptimizationProfile {
  id: OptimizationProfileId;
  label: string;        // e.g. "Reasoning-focused optimization"
  focus: string;        // one-line focus
  description: string;  // why this prompt was rewritten the way it was
  provider: AIProvider;
  modelName: string;
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
  selectedModel: AIModel;        // the FINAL model Inferra routed to — the one that runs the request

  // The model the user requested (baseline for cost comparison only). Undefined when auto-selecting.
  // Inferra routing is independent of this — the prompt is always optimized for `selectedModel`.
  requestedModel?: AIModel;

  // Model-specific optimization (post-selection)
  optimizationProfile?: ModelOptimizationProfile;
  routingExplanation?: string;

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

// ==================== CHAT CONTINUATION ====================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;          // cost of this message on the routed (active) model
  baselineCost: number;  // what it would have cost on the requested/baseline model
  createdAt: Date;
  isError?: boolean;     // assistant message that reports a failed provider call
}

export interface ChatSession {
  id: string;
  model: AIModel;            // the routed / active model the conversation continues on
  baselineModel: AIModel;    // requested model, or most-expensive fallback — for savings math
  requestedModel?: AIModel;
  originResult: InferraPipelineResult; // drives the left-hand routing / cost / optimization panel
  messages: ChatMessage[];

  // running totals (live tracking)
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  cumulativeSavings: number;

  createdAt: Date;
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
  /** Actor uid — the user who performed the action ('system' for scheduled jobs). */
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  /** Machine-readable event key, e.g. 'organization.settings.updated'. */
  eventType: AuditEventType;
  /** Legacy human string retained for older log rows written before eventType existed. */
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/** Registry of every event Inferra emits. Add new keys here, never inline strings. */
export type AuditEventType =
  | 'organization.created'
  | 'organization.updated'
  | 'organization.settings.updated'
  | 'organization.branding.updated'
  | 'organization.notifications.updated'
  | 'organization.logo.updated'
  | 'organization.plan.changed'
  | 'organization.switched'
  | 'organization.deleted'
  | 'organization.ownershipTransferred'
  | 'organization.selfHealed'
  | 'member.roleChanged'
  | 'member.joined'
  | 'member.left'
  | 'member.invited'
  | 'member.invitationRejected'
  | 'member.invitationCancelled'
  | 'member.invitationResent'
  | 'member.removed'
  | 'member.suspended'
  | 'member.reactivated'
  | 'user.signedUp'
  | 'user.signedIn'
  | 'subscription.created'
  | 'subscription.confirmed'
  | 'subscription.cancelled'
  | 'subscription.reconciled'
  | 'request.executed'
  | 'team.created'
  | 'team.updated'
  | 'team.archived'
  | 'team.unarchived'
  | 'team.deleted'
  | 'team.duplicated'
  | 'team.managerTransferred'
  | 'team.memberAdded'
  | 'team.memberRemoved'
  | 'team.memberRoleChanged'
  | 'team.permissionsChanged'
  | 'permission.customCreated'
  | 'permission.customDeleted'
  | 'organization.apiKeyRotated';

// ==================== SUBSCRIPTIONS (RAZORPAY) ====================

export interface PlanDefinition {
  id: PlanType;
  name: string;
  price: number;                 // display price (per month)
  currency: string;              // 'USD' | 'INR' | …
  requestsLimit: number;         // -1 = unlimited
  usersLimit: number;            // -1 = unlimited
  teamsLimit: number;
  features: string[];
  razorpayPlanIdEnv?: string;    // env var holding the Razorpay plan_id (paid plans only)
  highlighted?: boolean;
  badge?: string;
}

export interface CheckoutResult {
  subscriptionId: string;
  razorpayKeyId: string;
  shortUrl?: string;
}

// ==================== USAGE / REQUEST RECORDS ====================

// A single metered request, written server-side to the `usage` collection.
export interface UsageRecord {
  id: string;
  userId: string;
  organizationId: string;
  teamId?: string | null;  // team the request was attributed to (Command Center context)
  provider?: string;       // provider that ran the request
  selectedModel: string;   // requested / baseline model id ('auto' when unset)
  routedModel: string;     // model Inferra actually ran
  originalTokens: number;
  optimizedTokens: number;
  cost: number;
  savings: number;
  latencyMs: number;
  createdAt: Date;
}

// ==================== CHAT STORAGE ====================

export interface ChatSummary {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  model: string;          // routed model id
  messageCount: number;
  totalCost: number;
  cumulativeSavings: number;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== ORG MEMBERS / RBAC ====================

/**
 * Full role hierarchy. Ordered by capability (see src/lib/permissions.ts).
 * - owner: everything, including deleting the org
 * - admin: everything except deleting the org / transferring ownership
 * - manager: manage members + non-billing settings
 * - member: use the product (chat, requests)
 * - viewer: read-only
 */
export type MemberRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

/** Active = normal access. Suspended = blocked from every permission-gated call. */
export type MemberStatus = 'active' | 'suspended';

export interface OrgMember {
  userId: string;
  email: string;
  email_lower?: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
  lastActiveAt?: Date;
  invitedBy?: string;
}

// ==================== INVITATIONS ====================

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface Invitation {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: Exclude<MemberRole, 'owner'>;
  /** Team-targeted invitation: joining also adds the invitee to this team. */
  teamId?: string | null;
  teamName?: string | null;
  teamRole?: 'member' | 'viewer' | null;
  status: InvitationStatus;
  invitedBy: string;
  invitedByName: string;
  invitedByEmail: string;
  resendCount: number;
  createdAt: Date;
  expiresAt: Date;
  lastSentAt?: Date;
}

/** Pre-auth invitation preview (token-gated, drives the locked-email signup). */
export interface InvitationPreview {
  email: string;
  organizationName: string;
  role: string;
  teamName: string | null;
  status: string;
  invitedByName: string;
}

// ==================== NOTIFICATIONS ====================

export type NotificationType =
  | 'invitation.received'
  | 'member.joined'
  | 'member.left'
  | 'member.removed'
  | 'member.roleChanged'
  | 'usage.warning'
  | 'usage.quotaReached'
  | 'subscription.activated'
  | 'subscription.paymentFailed'
  | 'subscription.cancelled'
  | 'subscription.expiring';

export interface AppNotification {
  id: string;
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

// ==================== INVOICES ====================

export interface Invoice {
  id: string;                 // Razorpay payment id
  subscriptionId: string;
  organizationId: string | null;
  plan: PlanType | null;
  amount: number;
  currency: string;
  method: string | null;
  status: 'paid' | 'failed';
  errorDescription?: string | null;
  createdAt: Date;
}

/** Discrete permission actions used by the permission engine. */
export type Permission =
  | 'org.read'
  | 'org.update'
  | 'org.delete'
  | 'org.transferOwnership'
  | 'billing.read'
  | 'billing.manage'
  | 'members.read'
  | 'members.invite'
  | 'members.remove'
  | 'members.updateRole'
  | 'settings.read'
  | 'settings.update'
  | 'auditLogs.read'
  | 'usage.read'
  | 'requests.execute'
  | 'teams.read'
  | 'teams.manage';

// ==================== ADMIN METRICS ====================

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;          // active in last 30 days
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  totalOrganizations: number;
  mrr: number;                  // monthly recurring revenue
  arr: number;                  // annual run-rate (mrr × 12)
  revenueThisMonth: number;     // real paid invoices this month
  revenueAllTime: number;
  requestVolume: number;
  requestsToday: number;
  totalTokens: number;
  costSavingsGenerated: number;
  subscriptionsByPlan: Record<PlanType, number>;
  trialingOrgs: number;
  modelUsage: Record<string, number>;
  providerUsage: Record<string, number>;
  topOrganizations: { id: string; name: string; requests: number }[];
  failedPayments: number;
  failedPaymentsThisMonth: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  failureRate: number;          // provider failures / attempts, last 24h
  conversionRate: number;       // paid / total
  churnRate: number;
}
