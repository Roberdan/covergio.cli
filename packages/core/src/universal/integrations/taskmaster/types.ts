/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Task-Master-AI integration types and interfaces
 */

export interface TaskMasterConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCaching: boolean;
  cacheTimeoutMs: number;
  rateLimitPerSecond: number;
  enableMetrics: boolean;
}

export interface TaskMasterRequest {
  text: string;
  analysisType: 'domain-detection' | 'task-decomposition' | 'expertise-identification' | 'complexity-analysis';
  context?: {
    userId?: string;
    projectId?: string;
    domain?: string;
    previousTasks?: string[];
    teamExpertise?: string[];
    constraints?: {
      timeLimit?: number;
      resources?: string[];
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    };
  };
  options?: {
    decompose?: boolean;
    identifyExperts?: boolean;
    estimateComplexity?: boolean;
    suggestDependencies?: boolean;
    includeRisks?: boolean;
    maxSubtasks?: number;
    targetComplexity?: number;
    preferredApproach?: 'waterfall' | 'agile' | 'iterative';
  };
}

export interface TaskMasterResponse {
  requestId: string;
  timestamp: Date;
  status: 'success' | 'error' | 'partial';
  confidence: number;
  analysis: RequestAnalysis;
  decomposition?: TaskDecomposition;
  recommendations?: TaskRecommendations;
  metadata?: {
    processingTime: number;
    modelVersion: string;
    tokensUsed: number;
    cached: boolean;
  };
}

export interface RequestAnalysis {
  intent: string;
  domains: string[];
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredCapabilities: string[];
  riskFactors: string[];
  confidence: number;
  reasoning: string;
  similarTasks?: string[];
  tags: string[];
  category: 'feature' | 'bug' | 'refactor' | 'test' | 'docs' | 'infrastructure' | 'research';
}

export interface TaskDecomposition {
  subtasks: SubtaskDefinition[];
  dependencies: DependencyDefinition[];
  criticalPath: string[];
  estimatedTotalDuration: number;
  parallelizationOpportunities: string[];
  riskAssessment: RiskAssessment;
  milestones: MilestoneDefinition[];
}

export interface SubtaskDefinition {
  id: string;
  title: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDuration: number;
  requiredCapabilities: string[];
  dependencies: string[];
  priority: 'low' | 'medium' | 'high';
  acceptanceCriteria: string[];
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
  canRunInParallel: boolean;
  blockers?: string[];
  resources?: string[];
}

export interface DependencyDefinition {
  fromTask: string;
  toTask: string;
  type: 'blocks' | 'enables' | 'influences' | 'depends-on';
  reason: string;
  strength: 'weak' | 'medium' | 'strong';
  canBeParallelized: boolean;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  contingencyPlans: string[];
}

export interface RiskFactor {
  type: 'technical' | 'resource' | 'timeline' | 'dependency' | 'external';
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface MilestoneDefinition {
  id: string;
  name: string;
  description: string;
  deliverables: string[];
  successCriteria: string[];
  estimatedCompletion: number;
  dependencies: string[];
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface TaskRecommendations {
  expertiseNeeded: ExpertiseRequirement[];
  toolsRecommended: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  resourceAllocation: ResourceAllocation;
  testingStrategy: TestingStrategy;
  qualityGates: QualityGate[];
}

export interface ExpertiseRequirement {
  domain: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  importance: 'nice-to-have' | 'preferred' | 'required' | 'critical';
  alternatives: string[];
  timeAllocation: number;
}

export interface ResourceAllocation {
  developers: number;
  testers: number;
  designers: number;
  devops: number;
  projectManagers: number;
  totalEffort: number;
  peakConcurrency: number;
  timeline: TimelinePhase[];
}

export interface TimelinePhase {
  name: string;
  duration: number;
  resources: string[];
  deliverables: string[];
  dependencies: string[];
  risks: string[];
}

export interface TestingStrategy {
  approach: 'unit' | 'integration' | 'e2e' | 'mixed';
  coverage: number;
  automationLevel: 'low' | 'medium' | 'high';
  tools: string[];
  phases: TestingPhase[];
  riskAreas: string[];
}

export interface TestingPhase {
  type: 'unit' | 'integration' | 'system' | 'acceptance';
  timing: 'parallel' | 'sequential' | 'continuous';
  coverage: number;
  automation: boolean;
  tools: string[];
  exitCriteria: string[];
}

export interface QualityGate {
  name: string;
  criteria: string[];
  blockers: string[];
  approvers: string[];
  automation: boolean;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface TaskMasterError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  requestId?: string;
  retryable: boolean;
}

export interface TaskMasterMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  rateLimitHits: number;
  errorsByType: Record<string, number>;
  requestsByAnalysisType: Record<string, number>;
  lastRequestTime?: Date;
  lastSuccessTime?: Date;
  lastErrorTime?: Date;
  uptime: number;
  apiHealth: 'healthy' | 'degraded' | 'down';
}

export interface CacheEntry {
  key: string;
  value: TaskMasterResponse;
  timestamp: Date;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  projectId?: string;
  correlationId?: string;
  retryCount: number;
  startTime: Date;
  metadata: Record<string, unknown>;
}

export interface ApiRateLimit {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface TaskMasterHealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: Date;
  responseTime: number;
  services: {
    api: 'up' | 'down' | 'degraded';
    cache: 'up' | 'down' | 'degraded';
    database: 'up' | 'down' | 'degraded';
  };
  metrics: TaskMasterMetrics;
}

export interface TaskMasterOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableCaching?: boolean;
  cacheTimeout?: number;
  rateLimitPerSecond?: number;
  enableMetrics?: boolean;
  validateRequest?: boolean;
  enableCompression?: boolean;
  userAgent?: string;
  headers?: Record<string, string>;
}

export interface TaskMasterAnalysisResult {
  request: TaskMasterRequest;
  response: TaskMasterResponse;
  context: RequestContext;
  cached: boolean;
  error?: TaskMasterError;
  metrics: {
    responseTime: number;
    retryCount: number;
    cacheHit: boolean;
    rateLimited: boolean;
  };
}