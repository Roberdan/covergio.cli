/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  TaskDecomposition, 
  SubtaskDefinition, 
  DependencyDefinition,
  TaskMasterAnalysisResult 
} from '../types.js';

/**
 * Input for task decomposition
 */
export interface DecompositionInput {
  originalTask: string;
  context?: {
    userId?: string;
    projectId?: string;
    domain?: string;
    teamExpertise?: string[];
    constraints?: {
      timeLimit?: number;
      resources?: string[];
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      maxSubtasks?: number;
      targetComplexity?: number;
      preferredApproach?: 'waterfall' | 'agile' | 'iterative';
    };
  };
  options?: {
    enableValidation?: boolean;
    enableOptimization?: boolean;
    includeRisks?: boolean;
    generateDependencies?: boolean;
  };
}

/**
 * Result of task decomposition
 */
export interface DecompositionResult {
  input: DecompositionInput;
  decomposition: TaskDecomposition;
  analysis: TaskMasterAnalysisResult;
  validation: ValidationResult;
  optimization: OptimizationResult;
  metadata: {
    processingTime: number;
    subtaskCount: number;
    dependencyCount: number;
    complexityScore: number;
    confidence: number;
    generatedAt: Date;
  };
}

/**
 * Validation result for decomposed tasks
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  confidence: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  type: 'circular-dependency' | 'missing-dependency' | 'invalid-subtask' | 'complexity-mismatch' | 'resource-conflict';
  message: string;
  subtaskId?: string;
  dependencyId?: string;
  severity: 'error' | 'warning' | 'info';
  fix?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  type: 'performance' | 'resource' | 'timeline' | 'risk';
  message: string;
  subtaskId?: string;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  optimized: boolean;
  originalCount: number;
  optimizedCount: number;
  changes: OptimizationChange[];
  improvementMetrics: {
    timeReduction: number;
    complexityReduction: number;
    parallelismIncrease: number;
    resourceOptimization: number;
  };
}

/**
 * Optimization change
 */
export interface OptimizationChange {
  type: 'merge' | 'split' | 'reorder' | 'parallelize' | 'remove';
  description: string;
  affectedSubtasks: string[];
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  id: string;
  subtask: SubtaskDefinition;
  dependencies: string[];
  dependents: string[];
  level: number;
  canRunInParallel: boolean;
  criticalPath: boolean;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyDefinition[];
  levels: string[][];
  criticalPath: string[];
  parallelGroups: string[][];
}

/**
 * Subtask generation configuration
 */
export interface SubtaskGenerationConfig {
  maxSubtasks: number;
  targetComplexity: 'simple' | 'medium' | 'complex';
  preferredApproach: 'waterfall' | 'agile' | 'iterative';
  enableParallelism: boolean;
  includeRisks: boolean;
  domainSpecific: boolean;
}

/**
 * Priority assignment strategy
 */
export interface PriorityStrategy {
  name: string;
  calculate(subtask: SubtaskDefinition, context: DecompositionInput): 'low' | 'medium' | 'high';
  weight: number;
}

/**
 * Decomposition metrics
 */
export interface DecompositionMetrics {
  totalDecompositions: number;
  successfulDecompositions: number;
  failedDecompositions: number;
  averageSubtaskCount: number;
  averageProcessingTime: number;
  validationSuccessRate: number;
  optimizationSuccessRate: number;
  averageComplexityScore: number;
  errorsByType: Record<string, number>;
  lastDecompositionTime?: Date;
}

/**
 * Decomposition cache entry
 */
export interface DecompositionCacheEntry {
  key: string;
  result: DecompositionResult;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
}

/**
 * Decomposition strategy
 */
export interface DecompositionStrategy {
  name: string;
  canHandle(input: DecompositionInput): boolean;
  decompose(input: DecompositionInput): Promise<DecompositionResult>;
  validate(decomposition: TaskDecomposition): ValidationResult;
  optimize(decomposition: TaskDecomposition): OptimizationResult;
}

/**
 * Recovery strategy for failed decompositions
 */
export interface RecoveryStrategy {
  name: string;
  canRecover(error: Error, input: DecompositionInput): boolean;
  recover(error: Error, input: DecompositionInput): Promise<DecompositionResult>;
}

/**
 * Decomposition event
 */
export interface DecompositionEvent {
  type: 'started' | 'completed' | 'failed' | 'validated' | 'optimized';
  decompositionId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  error?: Error;
}

/**
 * Decomposition configuration
 */
export interface DecompositionConfig {
  enableCaching: boolean;
  cacheTimeoutMs: number;
  maxCacheSize: number;
  enableValidation: boolean;
  enableOptimization: boolean;
  enableMetrics: boolean;
  defaultStrategy: string;
  recoveryStrategies: string[];
  maxRetries: number;
  timeout: number;
}