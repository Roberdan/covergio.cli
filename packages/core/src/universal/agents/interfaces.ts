/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PersonalityTrait, Capability, ToolDefinition, AgentState, IAgent } from './types.js';
import { PersonalityProfile } from './personality/PersonalityGenerator.js';
import { ExtendedCapability } from './capabilities/CapabilityRegistry.js';

/**
 * Integrated personality interface that extends basic personality with factory-specific methods
 */
export interface IPersonality extends PersonalityProfile {
  /**
   * Get capabilities that are compatible with this personality
   */
  getCompatibleCapabilities(): Promise<string[]>;

  /**
   * Get response templates based on communication style
   */
  getResponseTemplates(): ResponseTemplate[];

  /**
   * Get decision weights for various scenarios
   */
  getDecisionWeights(): DecisionWeights;

  /**
   * Check if personality is compatible with given capabilities
   */
  isCompatibleWith(capabilities: string[]): Promise<CompatibilityCheck>;

  /**
   * Generate behavior responses for given context
   */
  generateBehaviorResponse(context: BehaviorContext): Promise<BehaviorResponse>;

  /**
   * Update personality traits dynamically
   */
  updateTrait(traitName: string, value: number): Promise<boolean>;

  /**
   * Get personality strength score for a domain
   */
  getStrengthScore(domain: string): number;
}

/**
 * Integrated capability interface that extends basic capability with factory-specific methods
 */
export interface ICapability extends ExtendedCapability {
  /**
   * Get capability dependencies
   */
  getDependencies(): Promise<CapabilityDependency[]>;

  /**
   * Get compatibility requirements for this capability
   */
  getCompatibilityRequirements(): CompatibilityRequirement[];

  /**
   * Get resource requirements for this capability
   */
  getResourceRequirements(): ResourceRequirement[];

  /**
   * Check if capability can be combined with others
   */
  canCombineWith(capabilities: string[]): Promise<CombinationResult>;

  /**
   * Execute capability with given parameters
   */
  execute(params: Record<string, any>, context: CapabilityContext): Promise<CapabilityResult>;

  /**
   * Get capability performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics;

  /**
   * Validate capability configuration
   */
  validateConfiguration(config: any): ValidationResult;
}

/**
 * Response template for personality-based responses
 */
export interface ResponseTemplate {
  id: string;
  name: string;
  pattern: string;
  triggers: string[];
  variables: Record<string, any>;
  style: {
    formality: 'casual' | 'professional' | 'formal' | 'academic';
    tone: 'friendly' | 'neutral' | 'authoritative';
    length: 'short' | 'medium' | 'long';
  };
}

/**
 * Decision weights for personality-based decisions
 */
export interface DecisionWeights {
  speed: number;
  accuracy: number;
  creativity: number;
  collaboration: number;
  risktaking: number;
  detailOrientation: number;
  userFocus: number;
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  compatible: boolean;
  score: number;
  conflicts: string[];
  recommendations: string[];
  warnings: string[];
}

/**
 * Behavior context for response generation
 */
export interface BehaviorContext {
  situation: string;
  userInput: string;
  previousInteractions: string[];
  currentCapabilities: string[];
  environment: Record<string, any>;
}

/**
 * Behavior response from personality
 */
export interface BehaviorResponse {
  response: string;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  emotionalState: string;
}

/**
 * Capability dependency
 */
export interface CapabilityDependency {
  capabilityId: string;
  dependencyType: 'required' | 'optional' | 'conditional';
  version?: string;
  reason: string;
}

/**
 * Compatibility requirement
 */
export interface CompatibilityRequirement {
  type: 'personality' | 'capability' | 'tool' | 'environment';
  requirement: string;
  level: 'must' | 'should' | 'could';
  description: string;
}

/**
 * Resource requirement
 */
export interface ResourceRequirement {
  type: 'memory' | 'cpu' | 'network' | 'storage' | 'time';
  amount: number;
  unit: string;
  description: string;
}

/**
 * Combination result
 */
export interface CombinationResult {
  canCombine: boolean;
  conflicts: string[];
  synergies: string[];
  recommendations: string[];
  combinedCapability?: ExtendedCapability;
}

/**
 * Capability execution context
 */
export interface CapabilityContext {
  agentId: string;
  sessionId: string;
  userId?: string;
  environment: Record<string, any>;
  previousResults: any[];
  timeoutMs: number;
}

/**
 * Capability execution result
 */
export interface CapabilityResult {
  success: boolean;
  result: any;
  error?: string;
  executionTime: number;
  resourcesUsed: Record<string, number>;
  confidence: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  successRate: number;
  averageExecutionTime: number;
  resourceEfficiency: number;
  userSatisfactionScore: number;
  errorRate: number;
  lastUpdated: Date;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Personality-capability compatibility matrix
 */
export interface CompatibilityMatrix {
  [personalityId: string]: {
    [capabilityId: string]: {
      compatibility: number;
      synergy: number;
      conflicts: string[];
      recommendations: string[];
    };
  };
}

/**
 * Capability composition strategy
 */
export interface CompositionStrategy {
  id: string;
  name: string;
  description: string;
  
  /**
   * Check if this strategy can handle the given capabilities
   */
  canHandle(capabilities: string[]): boolean;

  /**
   * Compose capabilities using this strategy
   */
  compose(capabilities: ExtendedCapability[]): Promise<ExtendedCapability>;

  /**
   * Get composition priority
   */
  getPriority(): number;
}

/**
 * Personality generation context
 */
export interface PersonalityGenerationContext {
  domain: string;
  role: string;
  requirements: string[];
  constraints: string[];
  existingCapabilities: string[];
  userPreferences: Record<string, any>;
  collaborationNeeds: string[];
}

/**
 * Capability assignment context
 */
export interface CapabilityAssignmentContext {
  personalityId: string;
  domain: string;
  role: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  constraints: string[];
  performanceRequirements: Record<string, number>;
}

/**
 * Personality-capability manager interface
 */
export interface IPersonalityCapabilityManager {
  /**
   * Generate personality optimized for given capabilities
   */
  generateOptimalPersonality(
    capabilities: string[],
    context: PersonalityGenerationContext
  ): Promise<IPersonality>;

  /**
   * Assign capabilities optimized for given personality
   */
  assignOptimalCapabilities(
    personalityId: string,
    context: CapabilityAssignmentContext
  ): Promise<ICapability[]>;

  /**
   * Check compatibility between personality and capabilities
   */
  checkCompatibility(
    personalityId: string,
    capabilities: string[]
  ): Promise<CompatibilityCheck>;

  /**
   * Get recommendations for improving compatibility
   */
  getOptimizationRecommendations(
    personalityId: string,
    capabilities: string[]
  ): Promise<OptimizationRecommendation[]>;

  /**
   * Update compatibility matrix
   */
  updateCompatibilityMatrix(
    personalityId: string,
    capabilityId: string,
    compatibility: number
  ): Promise<void>;

  /**
   * Get performance analytics
   */
  getAnalytics(): Promise<PerformanceAnalytics>;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  type: 'personality' | 'capability' | 'configuration';
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number;
}

/**
 * Performance analytics
 */
export interface PerformanceAnalytics {
  totalAgents: number;
  averageCompatibilityScore: number;
  topPerformingCombinations: Array<{
    personalityId: string;
    capabilities: string[];
    score: number;
  }>;
  commonIssues: string[];
  recommendations: string[];
  trendData: {
    timeframe: string;
    metrics: Record<string, number[]>;
  };
}

/**
 * Agent factory integration interface
 */
export interface IAgentFactoryIntegration {
  /**
   * Create integrated personality
   */
  createPersonality(
    profile: PersonalityProfile,
    context: PersonalityGenerationContext
  ): Promise<IPersonality>;

  /**
   * Create integrated capability
   */
  createCapability(
    definition: ExtendedCapability,
    context: CapabilityContext
  ): Promise<ICapability>;

  /**
   * Get compatibility matrix
   */
  getCompatibilityMatrix(): Promise<CompatibilityMatrix>;

  /**
   * Update compatibility matrix
   */
  updateCompatibilityMatrix(matrix: Partial<CompatibilityMatrix>): Promise<void>;

  /**
   * Get composition strategies
   */
  getCompositionStrategies(): CompositionStrategy[];

  /**
   * Register composition strategy
   */
  registerCompositionStrategy(strategy: CompositionStrategy): void;

  /**
   * Get personality-capability manager
   */
  getPersonalityCapabilityManager(): IPersonalityCapabilityManager;

  /**
   * Get agent lifecycle manager
   */
  getAgentLifecycleManager(): IAgentLifecycleManager;
}

/**
 * Agent lifecycle management interface
 */
export interface IAgentLifecycle {
  /**
   * Initialize the agent with full setup
   */
  initialize(): Promise<void>;

  /**
   * Pause agent execution temporarily
   */
  pause(): Promise<void>;

  /**
   * Resume agent execution from paused state
   */
  resume(): Promise<void>;

  /**
   * Terminate agent and cleanup resources
   */
  terminate(): Promise<void>;

  /**
   * Get current lifecycle state
   */
  getLifecycleState(): AgentLifecycleState;

  /**
   * Check if agent can transition to a new state
   */
  canTransitionTo(newState: AgentState): boolean;

  /**
   * Force a state transition (admin only)
   */
  forceTransition(newState: AgentState): Promise<void>;
}

/**
 * Agent lifecycle manager interface
 */
export interface IAgentLifecycleManager {
  /**
   * Register an agent for lifecycle management
   */
  registerAgent(agent: IAgent): Promise<void>;

  /**
   * Unregister an agent from lifecycle management
   */
  unregisterAgent(agentId: string): Promise<void>;

  /**
   * Get lifecycle state for an agent
   */
  getAgentLifecycleState(agentId: string): Promise<AgentLifecycleState | null>;

  /**
   * Pause an agent
   */
  pauseAgent(agentId: string): Promise<void>;

  /**
   * Resume an agent
   */
  resumeAgent(agentId: string): Promise<void>;

  /**
   * Terminate an agent
   */
  terminateAgent(agentId: string): Promise<void>;

  /**
   * Get all managed agents
   */
  getManagedAgents(): Promise<AgentLifecycleInfo[]>;

  /**
   * Get agents by state
   */
  getAgentsByState(state: AgentState): Promise<AgentLifecycleInfo[]>;

  /**
   * Serialize agent state for persistence
   */
  serializeAgent(agentId: string): Promise<SerializedAgentState>;

  /**
   * Deserialize and restore agent state
   */
  deserializeAgent(serializedState: SerializedAgentState): Promise<IAgent>;

  /**
   * Monitor agent health and performance
   */
  monitorAgent(agentId: string): Promise<AgentHealthMetrics>;

  /**
   * Get resource usage for an agent
   */
  getResourceUsage(agentId: string): Promise<ResourceUsageMetrics>;

  /**
   * Cleanup terminated agents
   */
  cleanupTerminatedAgents(): Promise<number>;

  /**
   * Get lifecycle statistics
   */
  getLifecycleStatistics(): Promise<LifecycleStatistics>;

  /**
   * Enable/disable automatic health monitoring
   */
  setHealthMonitoring(enabled: boolean, intervalMs?: number): void;

  /**
   * Set resource limits for agents
   */
  setResourceLimits(limits: ResourceLimits): void;

  /**
   * Upgrade agent to new version
   */
  upgradeAgent(agentId: string, newVersion: string): Promise<void>;
}

/**
 * Agent lifecycle state information
 */
export interface AgentLifecycleState {
  agentId: string;
  currentState: AgentState;
  previousState: AgentState | null;
  stateHistory: StateTransition[];
  uptime: number;
  lastStateChange: Date;
  isHealthy: boolean;
  canPause: boolean;
  canResume: boolean;
  canTerminate: boolean;
  metadata: Record<string, any>;
}

/**
 * State transition record
 */
export interface StateTransition {
  fromState: AgentState;
  toState: AgentState;
  timestamp: Date;
  reason: string;
  metadata?: Record<string, any>;
}

/**
 * Agent lifecycle information
 */
export interface AgentLifecycleInfo {
  agentId: string;
  definition: {
    domain: string;
    role: string;
    version: string;
  };
  state: AgentState;
  health: AgentHealthMetrics;
  resources: ResourceUsageMetrics;
  uptime: number;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, any>;
}

/**
 * Agent health metrics
 */
export interface AgentHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  executionCount: number;
  successRate: number;
  errorCount: number;
  lastError: string | null;
  lastActivity: Date;
  responseTime: {
    average: number;
    median: number;
    percentile95: number;
  };
  healthScore: number; // 0-100
  alerts: HealthAlert[];
}

/**
 * Health alert
 */
export interface HealthAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  metric: string;
  value: number;
  threshold: number;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsageMetrics {
  memory: {
    used: number;
    peak: number;
    limit: number;
    unit: 'MB' | 'GB';
  };
  cpu: {
    usage: number;
    peak: number;
    limit: number;
    unit: 'percent';
  };
  storage: {
    used: number;
    limit: number;
    unit: 'MB' | 'GB';
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  executionTime: {
    total: number;
    average: number;
    peak: number;
    unit: 'milliseconds';
  };
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  memory: {
    maxUsage: number;
    unit: 'MB' | 'GB';
  };
  cpu: {
    maxUsage: number;
    unit: 'percent';
  };
  storage: {
    maxUsage: number;
    unit: 'MB' | 'GB';
  };
  executionTime: {
    maxDuration: number;
    unit: 'milliseconds';
  };
  concurrency: {
    maxConcurrentTasks: number;
  };
}

/**
 * Serialized agent state for persistence
 */
export interface SerializedAgentState {
  agentId: string;
  definition: any;
  config: any;
  state: AgentState;
  memory: string; // Serialized memory data
  personalityState: any;
  capabilityStates: Record<string, any>;
  executionStats: {
    executionCount: number;
    errorCount: number;
    startTime: Date;
    lastActivity: Date;
  };
  metadata: Record<string, any>;
  version: string;
  serializedAt: Date;
}

/**
 * Lifecycle statistics
 */
export interface LifecycleStatistics {
  totalAgents: number;
  activeAgents: number;
  pausedAgents: number;
  terminatedAgents: number;
  erroredAgents: number;
  agentsByState: Record<AgentState, number>;
  averageUptime: number;
  totalExecutions: number;
  averageResponseTime: number;
  systemHealth: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    alerts: number;
  };
  resourceUtilization: {
    memory: number;
    cpu: number;
    storage: number;
  };
  performance: {
    throughput: number;
    errorRate: number;
    successRate: number;
  };
}