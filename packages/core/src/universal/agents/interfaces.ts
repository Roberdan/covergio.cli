/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PersonalityTrait, Capability, ToolDefinition } from './types.js';
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
    formality: 'casual' | 'professional' | 'formal';
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
}