/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { TaskDecomposition, SubTask, RequestAnalysis } from '../types.js';

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  minimumCalls: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttemptTime?: Date;
  failureRate: number;
}

/**
 * Fallback strategy interface
 */
export interface FallbackStrategy {
  name: string;
  priority: number;
  canHandle(operation: string, error: Error): boolean;
  execute(operation: string, data: any): Promise<any>;
  isHealthy(): boolean;
}

/**
 * Local task decomposition fallback
 */
export class LocalDecompositionFallback implements FallbackStrategy {
  name = 'local-decomposition';
  priority = 1;

  private decompositionTemplates = new Map<string, SubTask[]>();
  private domainPatterns = new Map<string, RegExp[]>();

  constructor() {
    this.initializeTemplates();
  }

  canHandle(operation: string, error: Error): boolean {
    return operation === 'decompose' || operation === 'analyze';
  }

  async execute(operation: string, data: any): Promise<any> {
    if (operation === 'decompose') {
      return this.decomposeLocally(data);
    } else if (operation === 'analyze') {
      return this.analyzeLocally(data);
    }
    throw new Error(`Unsupported operation: ${operation}`);
  }

  isHealthy(): boolean {
    return true; // Local fallback is always available
  }

  private async decomposeLocally(request: any): Promise<TaskDecomposition> {
    const task = request.originalTask || request.task || '';
    const domain = this.detectDomain(task);
    const template = this.decompositionTemplates.get(domain) || this.decompositionTemplates.get('general');

    if (!template) {
      throw new Error('No fallback template available for task');
    }

    const subtasks = template.map((templateTask, index) => ({
      ...templateTask,
      id: `fallback-${index + 1}`,
      title: this.adaptTaskTitle(templateTask.title, task),
      description: this.adaptTaskDescription(templateTask.description, task),
      estimatedDuration: templateTask.estimatedDuration || 3600000, // 1 hour default
      priority: templateTask.priority || 'medium',
      dependencies: templateTask.dependencies || [],
      status: 'pending' as const
    }));

    return {
      id: `fallback-decomp-${Date.now()}`,
      originalTask: task,
      subtasks,
      dependencies: [],
      metadata: {
        source: 'local-fallback',
        confidence: 0.6,
        generatedAt: new Date(),
        estimatedDuration: subtasks.reduce((total, st) => total + (st.estimatedDuration || 0), 0)
      }
    };
  }

  private async analyzeLocally(request: any): Promise<RequestAnalysis> {
    const input = request.text || request.input || '';
    const domain = this.detectDomain(input);
    
    return {
      domains: [domain],
      complexity: this.assessComplexity(input),
      estimatedDuration: this.estimateDuration(input),
      requiredExpertise: this.identifyRequiredExpertise(domain),
      riskFactors: this.identifyRiskFactors(input),
      confidence: 0.5,
      metadata: {
        source: 'local-fallback',
        analysisMethod: 'pattern-matching',
        generatedAt: new Date()
      }
    };
  }

  private detectDomain(task: string): string {
    const taskLower = task.toLowerCase();
    
    // Check patterns in priority order
    for (const [domain, patterns] of this.domainPatterns.entries()) {
      if (patterns.some(pattern => pattern.test(taskLower))) {
        return domain;
      }
    }
    
    return 'general';
  }

  private assessComplexity(task: string): 'simple' | 'medium' | 'complex' {
    const complexityIndicators = [
      /\b(microservices?|distributed|scalable?|enterprise)\b/i,
      /\b(machine learning|ai|neural network|deep learning)\b/i,
      /\b(real-?time|streaming|high-?performance)\b/i,
      /\b(security|authentication|authorization|encryption)\b/i,
      /\b(integration|api|backend|database)\b/i
    ];

    const matches = complexityIndicators.filter(pattern => pattern.test(task)).length;
    
    if (matches >= 2) return 'complex';
    if (matches >= 1) return 'medium';
    return 'simple';
  }

  private estimateDuration(task: string): number {
    const complexity = this.assessComplexity(task);
    const baseTime = {
      simple: 1800000,    // 30 minutes
      medium: 7200000,    // 2 hours
      complex: 28800000   // 8 hours
    };
    
    return baseTime[complexity];
  }

  private identifyRequiredExpertise(domain: string): string[] {
    const expertiseMap: Record<string, string[]> = {
      'web-development': ['frontend', 'javascript', 'html', 'css'],
      'backend-development': ['backend', 'api', 'database', 'server'],
      'mobile-development': ['mobile', 'ios', 'android', 'react-native'],
      'devops': ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
      'data-science': ['data-analysis', 'machine-learning', 'statistics'],
      'testing': ['qa', 'automation', 'test-frameworks'],
      'general': ['problem-solving', 'programming']
    };
    
    return expertiseMap[domain] || expertiseMap['general'];
  }

  private identifyRiskFactors(task: string): string[] {
    const riskPatterns = [
      { pattern: /\b(legacy|outdated|deprecated)\b/i, risk: 'Legacy technology risk' },
      { pattern: /\b(performance|speed|optimization)\b/i, risk: 'Performance requirements' },
      { pattern: /\b(security|authentication|encryption)\b/i, risk: 'Security considerations' },
      { pattern: /\b(integration|third-party|external)\b/i, risk: 'Integration complexity' },
      { pattern: /\b(scalable?|high-volume|concurrent)\b/i, risk: 'Scalability requirements' }
    ];

    return riskPatterns
      .filter(({ pattern }) => pattern.test(task))
      .map(({ risk }) => risk);
  }

  private adaptTaskTitle(template: string, originalTask: string): string {
    // Simple adaptation - could be more sophisticated
    return template.replace(/\{task\}/g, originalTask);
  }

  private adaptTaskDescription(template: string, originalTask: string): string {
    return template.replace(/\{task\}/g, originalTask);
  }

  private initializeTemplates(): void {
    // Web development template
    this.decompositionTemplates.set('web-development', [
      {
        id: 'setup',
        title: 'Project Setup and Configuration',
        description: 'Initialize project structure, dependencies, and configuration',
        estimatedDuration: 1800000,
        priority: 'high',
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'ui-design',
        title: 'UI/UX Design and Layout',
        description: 'Design user interface and create component layouts',
        estimatedDuration: 3600000,
        priority: 'high',
        dependencies: ['setup'],
        status: 'pending'
      },
      {
        id: 'implementation',
        title: 'Core Implementation',
        description: 'Implement main functionality and business logic',
        estimatedDuration: 7200000,
        priority: 'high',
        dependencies: ['ui-design'],
        status: 'pending'
      },
      {
        id: 'testing',
        title: 'Testing and Quality Assurance',
        description: 'Write and execute tests, perform quality checks',
        estimatedDuration: 3600000,
        priority: 'medium',
        dependencies: ['implementation'],
        status: 'pending'
      },
      {
        id: 'deployment',
        title: 'Deployment and Configuration',
        description: 'Deploy application and configure production environment',
        estimatedDuration: 1800000,
        priority: 'medium',
        dependencies: ['testing'],
        status: 'pending'
      }
    ]);

    // General template
    this.decompositionTemplates.set('general', [
      {
        id: 'analysis',
        title: 'Requirements Analysis',
        description: 'Analyze and understand the requirements for {task}',
        estimatedDuration: 1800000,
        priority: 'high',
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'planning',
        title: 'Planning and Design',
        description: 'Create plan and design approach for {task}',
        estimatedDuration: 2700000,
        priority: 'high',
        dependencies: ['analysis'],
        status: 'pending'
      },
      {
        id: 'implementation',
        title: 'Implementation',
        description: 'Execute the plan and implement {task}',
        estimatedDuration: 5400000,
        priority: 'high',
        dependencies: ['planning'],
        status: 'pending'
      },
      {
        id: 'validation',
        title: 'Validation and Testing',
        description: 'Validate and test the implementation of {task}',
        estimatedDuration: 2700000,
        priority: 'medium',
        dependencies: ['implementation'],
        status: 'pending'
      }
    ]);

    // Domain patterns for detection
    this.domainPatterns.set('web-development', [
      /\b(react|vue|angular|frontend|web|html|css|javascript)\b/i,
      /\b(website|webapp|web app|ui|user interface)\b/i
    ]);

    this.domainPatterns.set('backend-development', [
      /\b(api|backend|server|database|nodejs|express)\b/i,
      /\b(rest|graphql|microservice|service)\b/i
    ]);

    this.domainPatterns.set('mobile-development', [
      /\b(mobile|ios|android|react native|flutter|swift|kotlin)\b/i,
      /\b(app|mobile app|smartphone)\b/i
    ]);

    this.domainPatterns.set('devops', [
      /\b(deploy|deployment|ci\/cd|docker|kubernetes|infrastructure)\b/i,
      /\b(devops|cloud|aws|azure|monitoring)\b/i
    ]);

    this.domainPatterns.set('data-science', [
      /\b(machine learning|ai|data|analytics|model|algorithm)\b/i,
      /\b(python|pandas|tensorflow|pytorch|scikit)\b/i
    ]);

    this.domainPatterns.set('testing', [
      /\b(test|testing|qa|quality|automation|selenium)\b/i,
      /\b(unit test|integration test|e2e|cypress|jest)\b/i
    ]);
  }
}

/**
 * Cached response fallback
 */
export class CachedResponseFallback implements FallbackStrategy {
  name = 'cached-response';
  priority = 2;

  private responseCache = new Map<string, { data: any; timestamp: Date; ttl: number }>();
  private maxCacheSize = 100;
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours

  canHandle(operation: string, error: Error): boolean {
    const cacheKey = this.generateCacheKey(operation, error);
    const cached = this.responseCache.get(cacheKey);
    
    if (!cached) return false;
    
    // Check if cache entry is still valid
    return Date.now() - cached.timestamp.getTime() <= cached.ttl;
  }

  async execute(operation: string, data: any): Promise<any> {
    const cacheKey = this.generateCacheKey(operation, data);
    const cached = this.responseCache.get(cacheKey);
    
    if (!cached) {
      throw new Error('No cached response available');
    }

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.responseCache.delete(cacheKey);
      throw new Error('Cached response expired');
    }

    return cached.data;
  }

  isHealthy(): boolean {
    return this.responseCache.size > 0;
  }

  cacheResponse(operation: string, data: any, response: any, ttl?: number): void {
    const cacheKey = this.generateCacheKey(operation, data);
    
    // Implement LRU eviction if cache is full
    if (this.responseCache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.responseCache.keys())[0];
      this.responseCache.delete(oldestKey);
    }

    this.responseCache.set(cacheKey, {
      data: response,
      timestamp: new Date(),
      ttl: ttl || this.defaultTTL
    });
  }

  private generateCacheKey(operation: string, data: any): string {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return `${operation}:${this.hashString(dataStr)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

/**
 * Fallback system events
 */
export interface FallbackEvents {
  'circuit-breaker-opened': { operation: string; error: Error };
  'circuit-breaker-closed': { operation: string };
  'circuit-breaker-half-opened': { operation: string };
  'fallback-executed': { strategy: string; operation: string; success: boolean };
  'fallback-failed': { strategy: string; operation: string; error: Error };
  'all-fallbacks-failed': { operation: string; errors: Error[] };
}

/**
 * Comprehensive fallback system with circuit breaker pattern
 */
export class FallbackSystem extends EventEmitter {
  private circuitBreakers = new Map<string, CircuitBreakerStats>();
  private fallbackStrategies: FallbackStrategy[] = [];
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();

    this.config = {
      failureThreshold: config.failureThreshold || 5,
      recoveryTimeout: config.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 10000, // 10 seconds
      halfOpenMaxCalls: config.halfOpenMaxCalls || 3,
      minimumCalls: config.minimumCalls || 10,
      ...config
    };

    // Initialize default fallback strategies
    this.addStrategy(new LocalDecompositionFallback());
    this.addStrategy(new CachedResponseFallback());
  }

  /**
   * Add a fallback strategy
   */
  addStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.push(strategy);
    this.fallbackStrategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Execute operation with circuit breaker and fallback protection
   */
  async executeWithFallback<T>(
    operation: string,
    primaryFunction: () => Promise<T>,
    data?: any
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(operation);

    // Check circuit breaker state
    if (circuitBreaker.state === 'open') {
      if (Date.now() < (circuitBreaker.nextAttemptTime?.getTime() || 0)) {
        return this.executeFallback(operation, data);
      } else {
        // Try to half-open the circuit
        this.transitionToHalfOpen(operation);
      }
    }

    try {
      // Execute primary function
      const result = await primaryFunction();
      this.recordSuccess(operation);
      return result;
    } catch (error) {
      this.recordFailure(operation, error as Error);
      return this.executeFallback(operation, data);
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(operation: string): CircuitBreakerStats | null {
    return this.circuitBreakers.get(operation) || null;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [operation, breaker] of this.circuitBreakers.entries()) {
      stats[operation] = { ...breaker };
    }
    return stats;
  }

  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.lastFailureTime = undefined;
      breaker.nextAttemptTime = undefined;
      breaker.failureRate = 0;
    }
  }

  /**
   * Check if fallback is available for operation
   */
  hasFallback(operation: string, error?: Error): boolean {
    return this.fallbackStrategies.some(strategy => 
      strategy.isHealthy() && strategy.canHandle(operation, error || new Error())
    );
  }

  /**
   * Get fallback system health
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    availableStrategies: number;
    circuitBreakers: Record<string, CircuitBreakerState>;
    issues: string[];
  } {
    const healthyStrategies = this.fallbackStrategies.filter(s => s.isHealthy()).length;
    const totalStrategies = this.fallbackStrategies.length;
    const circuitBreakers: Record<string, CircuitBreakerState> = {};
    const issues: string[] = [];

    for (const [op, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[op] = breaker.state;
      if (breaker.state === 'open') {
        issues.push(`Circuit breaker open for ${op}`);
      }
    }

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (healthyStrategies === 0 && totalStrategies > 0) {
      status = 'critical';
      issues.push('No healthy fallback strategies available');
    } else if (healthyStrategies < totalStrategies / 2 && totalStrategies > 0) {
      status = 'degraded';
      issues.push('Some fallback strategies are unhealthy');
    }

    return {
      status,
      availableStrategies: healthyStrategies,
      circuitBreakers,
      issues
    };
  }

  /**
   * Execute fallback strategies
   */
  private async executeFallback<T>(operation: string, data?: any): Promise<T> {
    const errors: Error[] = [];

    for (const strategy of this.fallbackStrategies) {
      if (!strategy.isHealthy()) {
        continue;
      }

      if (!strategy.canHandle(operation, new Error())) {
        continue;
      }

      try {
        const result = await strategy.execute(operation, data);
        this.emit('fallback-executed', { 
          strategy: strategy.name, 
          operation, 
          success: true 
        });
        return result;
      } catch (error) {
        const err = error as Error;
        errors.push(err);
        this.emit('fallback-failed', { 
          strategy: strategy.name, 
          operation, 
          error: err 
        });
      }
    }

    this.emit('all-fallbacks-failed', { operation, errors });
    throw new Error(`All fallback strategies failed for operation: ${operation}`);
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateCircuitBreaker(operation: string): CircuitBreakerStats {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalCalls: 0,
        failureRate: 0
      });
    }
    return this.circuitBreakers.get(operation)!;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operation: string): void {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    breaker.successCount++;
    breaker.totalCalls++;
    breaker.lastSuccessTime = new Date();
    
    // Reset failure count on success
    if (breaker.state === 'half-open') {
      // Transition back to closed if successful in half-open state
      breaker.state = 'closed';
      breaker.failureCount = 0;
      this.emit('circuit-breaker-closed', { operation });
    }

    this.updateFailureRate(operation);
  }

  /**
   * Record failed operation
   */
  private recordFailure(operation: string, error: Error): void {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    breaker.failureCount++;
    breaker.totalCalls++;
    breaker.lastFailureTime = new Date();
    
    this.updateFailureRate(operation);

    // Check if we should open the circuit
    if (breaker.state === 'closed' && this.shouldOpenCircuit(breaker)) {
      this.openCircuit(operation);
    } else if (breaker.state === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this.openCircuit(operation);
    }
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(breaker: CircuitBreakerStats): boolean {
    return breaker.totalCalls >= this.config.minimumCalls &&
           breaker.failureCount >= this.config.failureThreshold;
  }

  /**
   * Open circuit breaker
   */
  private openCircuit(operation: string): void {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    breaker.state = 'open';
    breaker.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    this.emit('circuit-breaker-opened', { 
      operation, 
      error: new Error(`Circuit breaker opened due to ${breaker.failureCount} failures`) 
    });
  }

  /**
   * Transition circuit to half-open state
   */
  private transitionToHalfOpen(operation: string): void {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    breaker.state = 'half-open';
    breaker.failureCount = 0; // Reset for half-open trial
    
    this.emit('circuit-breaker-half-opened', { operation });
  }

  /**
   * Update failure rate calculation
   */
  private updateFailureRate(operation: string): void {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    if (breaker.totalCalls > 0) {
      breaker.failureRate = breaker.failureCount / breaker.totalCalls;
    }
  }
}

// Type the EventEmitter properly
export interface FallbackSystem {
  on<K extends keyof FallbackEvents>(event: K, listener: (data: FallbackEvents[K]) => void): this;
  emit<K extends keyof FallbackEvents>(event: K, data: FallbackEvents[K]): boolean;
}