/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  DecompositionInput, 
  DecompositionResult, 
  DecompositionConfig,
  DecompositionStrategy,
  RecoveryStrategy,
  DecompositionMetrics,
  DecompositionCacheEntry,
  DecompositionEvent,
  ValidationResult,
  OptimizationResult,
  PriorityStrategy,
  SubtaskGenerationConfig
} from './types.js';
import { 
  TaskDecomposition, 
  SubtaskDefinition, 
  TaskMasterAnalysisResult 
} from '../types.js';
import { TaskMasterClient } from '../TaskMasterClient.js';
import { DependencyGraphManager } from './DependencyGraphManager.js';

/**
 * Default decomposition strategy using Task-Master-AI
 */
class DefaultDecompositionStrategy implements DecompositionStrategy {
  name = 'default';

  constructor(private taskMasterClient: TaskMasterClient) {}

  canHandle(input: DecompositionInput): boolean {
    return true; // Default strategy handles all inputs
  }

  async decompose(input: DecompositionInput): Promise<DecompositionResult> {
    const startTime = Date.now();

    // Use Task-Master-AI to decompose the task
    const analysis = await this.taskMasterClient.decomposeTask(
      input.originalTask,
      input.context
    );

    if (!analysis.response.decomposition) {
      throw new Error('Task-Master-AI did not provide decomposition');
    }

    const decomposition = analysis.response.decomposition;

    // Generate validation result
    const validation = this.validate(decomposition);

    // Generate optimization result
    const optimization = this.optimize(decomposition);

    return {
      input,
      decomposition,
      analysis,
      validation,
      optimization,
      metadata: {
        processingTime: Date.now() - startTime,
        subtaskCount: decomposition.subtasks.length,
        dependencyCount: decomposition.dependencies.length,
        complexityScore: this.calculateComplexityScore(decomposition),
        confidence: analysis.response.confidence,
        generatedAt: new Date()
      }
    };
  }

  validate(decomposition: TaskDecomposition): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];
    const suggestions: string[] = [];

    // Validate subtasks
    for (const subtask of decomposition.subtasks) {
      if (!subtask.id || !subtask.title || !subtask.description) {
        errors.push({
          type: 'invalid-subtask',
          message: `Subtask ${subtask.id} is missing required fields`,
          subtaskId: subtask.id,
          severity: 'error'
        });
      }

      if (subtask.estimatedDuration <= 0) {
        warnings.push({
          type: 'timeline',
          message: `Subtask ${subtask.id} has invalid duration`,
          subtaskId: subtask.id,
          impact: 'medium',
          recommendation: 'Set a realistic estimated duration'
        });
      }
    }

    // Validate dependencies
    const subtaskIds = new Set(decomposition.subtasks.map(s => s.id));
    for (const dependency of decomposition.dependencies) {
      if (!subtaskIds.has(dependency.fromTask) || !subtaskIds.has(dependency.toTask)) {
        errors.push({
          type: 'missing-dependency',
          message: `Dependency references non-existent subtask`,
          severity: 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      confidence: errors.length === 0 ? 0.9 : 0.3
    };
  }

  optimize(decomposition: TaskDecomposition): OptimizationResult {
    const changes: any[] = [];
    let optimized = false;

    // Simple optimization: merge very small subtasks
    const smallTasks = decomposition.subtasks.filter(s => s.estimatedDuration < 300); // 5 minutes
    if (smallTasks.length > 1) {
      changes.push({
        type: 'merge',
        description: `Merge ${smallTasks.length} small subtasks`,
        affectedSubtasks: smallTasks.map(s => s.id),
        impact: 'positive',
        confidence: 0.8
      });
      optimized = true;
    }

    return {
      optimized,
      originalCount: decomposition.subtasks.length,
      optimizedCount: decomposition.subtasks.length - (optimized ? smallTasks.length - 1 : 0),
      changes,
      improvementMetrics: {
        timeReduction: optimized ? 300 : 0,
        complexityReduction: optimized ? 0.1 : 0,
        parallelismIncrease: 0,
        resourceOptimization: 0
      }
    };
  }

  private calculateComplexityScore(decomposition: TaskDecomposition): number {
    const subtaskComplexity = decomposition.subtasks.reduce((sum, subtask) => {
      const complexity = subtask.complexity === 'simple' ? 1 : subtask.complexity === 'medium' ? 2 : 3;
      return sum + complexity;
    }, 0);

    const dependencyComplexity = decomposition.dependencies.length * 0.5;
    
    return subtaskComplexity + dependencyComplexity;
  }
}

/**
 * Recovery strategy for when Task-Master-AI fails
 */
class LocalRecoveryStrategy implements RecoveryStrategy {
  name = 'local-fallback';

  canRecover(error: Error, input: DecompositionInput): boolean {
    // Can recover from API failures but not from validation errors
    return error.message.includes('network') || error.message.includes('timeout');
  }

  async recover(error: Error, input: DecompositionInput): Promise<DecompositionResult> {
    // Simple local decomposition as fallback
    const localDecomposition = this.createLocalDecomposition(input);
    
    return {
      input,
      decomposition: localDecomposition,
      analysis: this.createFallbackAnalysis(input),
      validation: { isValid: true, errors: [], warnings: [], suggestions: [], confidence: 0.6 },
      optimization: { 
        optimized: false, 
        originalCount: localDecomposition.subtasks.length,
        optimizedCount: localDecomposition.subtasks.length,
        changes: [], 
        improvementMetrics: { timeReduction: 0, complexityReduction: 0, parallelismIncrease: 0, resourceOptimization: 0 }
      },
      metadata: {
        processingTime: 100,
        subtaskCount: localDecomposition.subtasks.length,
        dependencyCount: 0,
        complexityScore: 2,
        confidence: 0.6,
        generatedAt: new Date()
      }
    };
  }

  private createLocalDecomposition(input: DecompositionInput): TaskDecomposition {
    // Simple rule-based decomposition
    const subtasks: SubtaskDefinition[] = [
      {
        id: 'local-1',
        title: 'Analyze Requirements',
        description: `Analyze the requirements for: ${input.originalTask}`,
        complexity: 'simple',
        estimatedDuration: 1800,
        requiredCapabilities: ['analysis'],
        dependencies: [],
        priority: 'high',
        acceptanceCriteria: ['Requirements are clearly defined'],
        riskLevel: 'low',
        tags: ['analysis'],
        canRunInParallel: false
      },
      {
        id: 'local-2',
        title: 'Implement Solution',
        description: `Implement the solution for: ${input.originalTask}`,
        complexity: 'medium',
        estimatedDuration: 5400,
        requiredCapabilities: ['implementation'],
        dependencies: ['local-1'],
        priority: 'high',
        acceptanceCriteria: ['Solution is implemented correctly'],
        riskLevel: 'medium',
        tags: ['implementation'],
        canRunInParallel: false
      },
      {
        id: 'local-3',
        title: 'Test and Validate',
        description: `Test and validate the solution for: ${input.originalTask}`,
        complexity: 'simple',
        estimatedDuration: 1800,
        requiredCapabilities: ['testing'],
        dependencies: ['local-2'],
        priority: 'medium',
        acceptanceCriteria: ['Solution is tested and validated'],
        riskLevel: 'low',
        tags: ['testing'],
        canRunInParallel: false
      }
    ];

    return {
      subtasks,
      dependencies: [],
      criticalPath: ['local-1', 'local-2', 'local-3'],
      estimatedTotalDuration: 9000,
      parallelizationOpportunities: [],
      riskAssessment: {
        overallRisk: 'low',
        riskFactors: [],
        mitigationStrategies: ['Use fallback decomposition when API fails'],
        contingencyPlans: ['Manual task breakdown if needed']
      },
      milestones: []
    };
  }

  private createFallbackAnalysis(input: DecompositionInput): TaskMasterAnalysisResult {
    return {
      request: {
        text: input.originalTask,
        analysisType: 'task-decomposition'
      },
      response: {
        requestId: 'fallback-' + Date.now(),
        timestamp: new Date(),
        status: 'success',
        confidence: 0.6,
        analysis: {
          intent: 'fallback decomposition',
          domains: ['general'],
          complexity: 'medium',
          estimatedDuration: 9000,
          priority: 'medium',
          requiredCapabilities: ['analysis', 'implementation', 'testing'],
          riskFactors: ['api-unavailable'],
          confidence: 0.6,
          reasoning: 'Local fallback decomposition due to API failure',
          tags: ['fallback'],
          category: 'feature'
        },
        decomposition: this.createLocalDecomposition(input),
        metadata: {
          processingTime: 100,
          modelVersion: 'local-fallback',
          tokensUsed: 0,
          cached: false
        }
      },
      context: {
        requestId: 'fallback-' + Date.now(),
        retryCount: 0,
        startTime: new Date(),
        metadata: {}
      },
      cached: false,
      metrics: {
        responseTime: 100,
        retryCount: 0,
        cacheHit: false,
        rateLimited: false
      }
    };
  }
}

/**
 * Priority strategy based on complexity and dependencies
 */
class ComplexityBasedPriorityStrategy implements PriorityStrategy {
  name = 'complexity-based';
  weight = 0.5;

  calculate(subtask: SubtaskDefinition, context: DecompositionInput): 'low' | 'medium' | 'high' {
    const complexityScore = subtask.complexity === 'simple' ? 1 : subtask.complexity === 'medium' ? 2 : 3;
    const dependencyScore = subtask.dependencies.length;
    const totalScore = complexityScore + dependencyScore;

    if (totalScore >= 4) return 'high';
    if (totalScore >= 2) return 'medium';
    return 'low';
  }
}

/**
 * Main Task Decomposition System
 */
export class TaskDecompositionSystem {
  private config: DecompositionConfig;
  private strategies: Map<string, DecompositionStrategy> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private priorityStrategies: PriorityStrategy[] = [];
  private dependencyGraphManager: DependencyGraphManager;
  private cache: Map<string, DecompositionCacheEntry> = new Map();
  private metrics: DecompositionMetrics;
  private eventHandlers: Map<string, ((event: DecompositionEvent) => void)[]> = new Map();

  constructor(
    private taskMasterClient: TaskMasterClient,
    config: Partial<DecompositionConfig> = {}
  ) {
    this.config = {
      enableCaching: config.enableCaching ?? true,
      cacheTimeoutMs: config.cacheTimeoutMs ?? 300000, // 5 minutes
      maxCacheSize: config.maxCacheSize ?? 1000,
      enableValidation: config.enableValidation ?? true,
      enableOptimization: config.enableOptimization ?? true,
      enableMetrics: config.enableMetrics ?? true,
      defaultStrategy: config.defaultStrategy ?? 'default',
      recoveryStrategies: config.recoveryStrategies ?? ['local-fallback'],
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000
    };

    this.dependencyGraphManager = new DependencyGraphManager();
    this.metrics = this.initializeMetrics();

    // Register default strategies
    this.registerStrategy(new DefaultDecompositionStrategy(taskMasterClient));
    this.registerRecoveryStrategy(new LocalRecoveryStrategy());
    this.registerPriorityStrategy(new ComplexityBasedPriorityStrategy());
  }

  /**
   * Decompose a task into subtasks
   */
  async decompose(input: DecompositionInput): Promise<DecompositionResult> {
    const decompositionId = this.generateDecompositionId(input);
    
    try {
      this.emitEvent('started', decompositionId, { input });

      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(input);
        if (cached) {
          this.updateMetrics(true);
          return cached;
        }
      }

      // Find appropriate strategy
      const strategy = this.findStrategy(input);
      if (!strategy) {
        throw new Error('No suitable decomposition strategy found');
      }

      // Decompose with retry logic
      const result = await this.decomposeWithRetry(input, strategy);

      // Apply priority assignment
      this.assignPriorities(result.decomposition, input);

      // Cache result
      if (this.config.enableCaching) {
        this.cacheResult(input, result);
      }

      this.updateMetrics(true);
      this.emitEvent('completed', decompositionId, { result });

      return result;
    } catch (error) {
      this.updateMetrics(false);
      this.emitEvent('failed', decompositionId, { error });
      throw error;
    }
  }

  /**
   * Validate a decomposition result
   */
  validateDecomposition(decomposition: TaskDecomposition): ValidationResult {
    const graph = this.dependencyGraphManager.buildGraph(decomposition);
    const graphValidation = this.dependencyGraphManager.validateGraph(graph);

    return {
      isValid: graphValidation.errors.length === 0,
      errors: graphValidation.errors,
      warnings: graphValidation.warnings,
      suggestions: this.generateSuggestions(decomposition, graphValidation),
      confidence: graphValidation.errors.length === 0 ? 0.9 : 0.3
    };
  }

  /**
   * Optimize a decomposition
   */
  optimizeDecomposition(decomposition: TaskDecomposition): OptimizationResult {
    const graph = this.dependencyGraphManager.buildGraph(decomposition);
    const optimizedGraph = this.dependencyGraphManager.optimizeGraph(graph);

    // Calculate improvements
    const originalStats = this.dependencyGraphManager.getGraphStatistics(graph);
    const optimizedStats = this.dependencyGraphManager.getGraphStatistics(optimizedGraph);

    return {
      optimized: true,
      originalCount: originalStats.totalNodes,
      optimizedCount: optimizedStats.totalNodes,
      changes: [],
      improvementMetrics: {
        timeReduction: this.dependencyGraphManager.calculateEstimatedTime(graph) - 
                      this.dependencyGraphManager.calculateEstimatedTime(optimizedGraph),
        complexityReduction: originalStats.complexity - optimizedStats.complexity,
        parallelismIncrease: optimizedStats.parallelism - originalStats.parallelism,
        resourceOptimization: 0.1
      }
    };
  }

  /**
   * Get execution order for decomposed tasks
   */
  getExecutionOrder(decomposition: TaskDecomposition): string[][] {
    const graph = this.dependencyGraphManager.buildGraph(decomposition);
    return this.dependencyGraphManager.getExecutionOrder(graph);
  }

  /**
   * Register a decomposition strategy
   */
  registerStrategy(strategy: DecompositionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Register a recovery strategy
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy);
  }

  /**
   * Register a priority strategy
   */
  registerPriorityStrategy(strategy: PriorityStrategy): void {
    this.priorityStrategies.push(strategy);
  }

  /**
   * Get system metrics
   */
  getMetrics(): DecompositionMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Add event handler
   */
  on(event: string, handler: (event: DecompositionEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private async decomposeWithRetry(input: DecompositionInput, strategy: DecompositionStrategy): Promise<DecompositionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          strategy.decompose(input),
          this.createTimeoutPromise(this.config.timeout)
        ]);

        if (this.config.enableValidation) {
          const validation = this.validateDecomposition(result.decomposition);
          if (!validation.isValid) {
            throw new Error('Decomposition validation failed');
          }
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Try recovery strategies
        for (const recoveryName of this.config.recoveryStrategies) {
          const recoveryStrategy = this.recoveryStrategies.get(recoveryName);
          if (recoveryStrategy && recoveryStrategy.canRecover(lastError, input)) {
            try {
              return await recoveryStrategy.recover(lastError, input);
            } catch (recoveryError) {
              // Continue to next recovery strategy
            }
          }
        }

        // If last attempt, throw the error
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Wait before retry
        await this.delay(1000 * Math.pow(2, attempt - 1));
      }
    }

    throw lastError || new Error('Decomposition failed after all retries');
  }

  private findStrategy(input: DecompositionInput): DecompositionStrategy | null {
    // Find the most suitable strategy
    for (const [name, strategy] of this.strategies) {
      if (strategy.canHandle(input)) {
        return strategy;
      }
    }

    // Fall back to default strategy
    return this.strategies.get(this.config.defaultStrategy) || null;
  }

  private assignPriorities(decomposition: TaskDecomposition, input: DecompositionInput): void {
    for (const subtask of decomposition.subtasks) {
      const priorities: { priority: 'low' | 'medium' | 'high'; weight: number }[] = [];

      // Calculate priority using all strategies
      for (const strategy of this.priorityStrategies) {
        const priority = strategy.calculate(subtask, input);
        priorities.push({ priority, weight: strategy.weight });
      }

      // Weighted average
      const weightedScore = priorities.reduce((sum, p) => {
        const score = p.priority === 'low' ? 1 : p.priority === 'medium' ? 2 : 3;
        return sum + score * p.weight;
      }, 0);

      const totalWeight = priorities.reduce((sum, p) => sum + p.weight, 0);
      const avgScore = weightedScore / totalWeight;

      subtask.priority = avgScore >= 2.5 ? 'high' : avgScore >= 1.5 ? 'medium' : 'low';
    }
  }

  private getCachedResult(input: DecompositionInput): DecompositionResult | null {
    const key = this.generateCacheKey(input);
    const entry = this.cache.get(key);

    if (entry && Date.now() < entry.expiresAt.getTime()) {
      entry.hits++;
      entry.lastAccessed = new Date();
      return entry.result;
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  private cacheResult(input: DecompositionInput, result: DecompositionResult): void {
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldestCacheEntry();
    }

    const key = this.generateCacheKey(input);
    const entry: DecompositionCacheEntry = {
      key,
      result,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.cacheTimeoutMs),
      hits: 0,
      lastAccessed: new Date()
    };

    this.cache.set(key, entry);
  }

  private evictOldestCacheEntry(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private generateCacheKey(input: DecompositionInput): string {
    const keyData = {
      task: input.originalTask,
      context: input.context,
      options: input.options
    };
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private generateDecompositionId(input: DecompositionInput): string {
    return `decomp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSuggestions(decomposition: TaskDecomposition, validation: any): string[] {
    const suggestions: string[] = [];

    if (decomposition.subtasks.length > 20) {
      suggestions.push('Consider grouping related subtasks to reduce complexity');
    }

    if (validation.warnings.some((w: any) => w.type === 'timeline')) {
      suggestions.push('Review estimated durations for accuracy');
    }

    if (decomposition.dependencies.length === 0 && decomposition.subtasks.length > 1) {
      suggestions.push('Consider if any subtasks have natural dependencies');
    }

    return suggestions;
  }

  private updateMetrics(success: boolean): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalDecompositions++;
    this.metrics.lastDecompositionTime = new Date();

    if (success) {
      this.metrics.successfulDecompositions++;
    } else {
      this.metrics.failedDecompositions++;
    }
  }

  private initializeMetrics(): DecompositionMetrics {
    return {
      totalDecompositions: 0,
      successfulDecompositions: 0,
      failedDecompositions: 0,
      averageSubtaskCount: 0,
      averageProcessingTime: 0,
      validationSuccessRate: 0,
      optimizationSuccessRate: 0,
      averageComplexityScore: 0,
      errorsByType: {}
    };
  }

  private emitEvent(type: string, decompositionId: string, data: Record<string, unknown>): void {
    const event: DecompositionEvent = {
      type: type as any,
      decompositionId,
      timestamp: new Date(),
      data
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      }
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Decomposition timeout')), timeout);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}