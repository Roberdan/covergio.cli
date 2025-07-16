/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { CacheManager, CacheConfig } from './CacheManager.js';
import { RequestQueue, RequestQueueConfig, RequestPriority, RequestProcessor } from './RequestQueue.js';
import { CircuitBreakerFactory, CircuitBreakerConfig } from './CircuitBreaker.js';
import { ObservabilityManager, ObservabilityConfig } from './ObservabilityManager.js';
import { MemoryProfiler } from './MemoryProfiler.js';
import { ResourceManager } from './ResourceManager.js';
import { GCOptimizer } from './GCOptimizer.js';
import { OrchestrationRequest, OrchestrationResponse } from '../interfaces/IOrchestrator.js';

/**
 * Performance manager configuration
 */
export interface PerformanceConfig {
  cache: Partial<CacheConfig>;
  queue: Partial<RequestQueueConfig>;
  circuitBreaker: Partial<CircuitBreakerConfig>;
  observability: Partial<ObservabilityConfig>;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    performanceThresholds: {
      maxResponseTime: number;
      maxErrorRate: number;
      maxQueueUtilization: number;
      maxMemoryUsage: number;
    };
  };
  optimization: {
    enableAgentPooling: boolean;
    enableResponseCaching: boolean;
    enableRequestBatching: boolean;
    enableCircuitBreakers: boolean;
    enableMemoryOptimization: boolean;
    enableGCOptimization: boolean;
    agentPoolSize: number;
    cacheHitRateTarget: number;
    maxConcurrentRequests: number;
  };
}

/**
 * Agent pool interface
 */
interface AgentPool {
  available: any[];
  busy: Set<any>;
  maxSize: number;
  createAgent: () => Promise<any>;
  validateAgent: (agent: any) => boolean;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  cache: {
    hitRate: number;
    size: number;
    memoryUsage: number;
  };
  queue: {
    size: number;
    utilization: number;
    averageWaitTime: number;
    throughput: number;
  };
  circuitBreakers: Record<string, {
    state: string;
    errorRate: number;
    recentFailures: number;
  }>;
  agents: {
    total: number;
    active: number;
    poolUtilization: number;
  };
  system: {
    responseTime: number;
    errorRate: number;
    requestsPerSecond: number;
    memoryUsage: number;
  };
}

/**
 * Performance health status
 */
export interface PerformanceHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    cache: 'healthy' | 'degraded' | 'unhealthy';
    queue: 'healthy' | 'degraded' | 'unhealthy';
    circuitBreakers: 'healthy' | 'degraded' | 'unhealthy';
    agents: 'healthy' | 'degraded' | 'unhealthy';
  };
  alerts: string[];
  recommendations: string[];
}

/**
 * Comprehensive Performance Manager
 */
export class PerformanceManager extends EventEmitter {
  private config: PerformanceConfig;
  private cacheManager: CacheManager;
  private requestQueue: RequestQueue;
  private circuitBreakerFactory: CircuitBreakerFactory;
  private observabilityManager: ObservabilityManager;
  private memoryProfiler?: MemoryProfiler;
  private resourceManager?: ResourceManager;
  private gcOptimizer?: GCOptimizer;
  private agentPools = new Map<string, AgentPool>();
  private processors = new Map<string, RequestProcessor>();
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private performanceMetrics: PerformanceMetrics;
  private isInitialized = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();

    this.config = {
      cache: {
        maxSize: 1000,
        defaultTtl: 300000,
        enableMetrics: true,
        evictionPolicy: 'lru',
        ...config.cache
      },
      queue: {
        concurrencyLimit: 10,
        maxQueueSize: 1000,
        enablePrioritization: true,
        enableBatching: false,
        ...config.queue
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
        errorPercentageThreshold: 50,
        ...config.circuitBreaker
      },
      observability: {
        serviceName: 'convergio-cli',
        environment: process.env.NODE_ENV || 'development',
        enableMetrics: true,
        enableTracing: true,
        enableProfiling: false,
        sampleRate: 0.1,
        ...config.observability
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        healthCheckInterval: 60000,
        performanceThresholds: {
          maxResponseTime: 5000,
          maxErrorRate: 0.1,
          maxQueueUtilization: 0.8,
          maxMemoryUsage: 0.8
        },
        ...config.monitoring
      },
      optimization: {
        enableAgentPooling: true,
        enableResponseCaching: true,
        enableRequestBatching: false,
        enableCircuitBreakers: true,
        enableMemoryOptimization: true,
        enableGCOptimization: true,
        agentPoolSize: 5,
        cacheHitRateTarget: 0.8,
        maxConcurrentRequests: 50,
        ...config.optimization
      }
    };

    this.performanceMetrics = this.initializeMetrics();
    this.initializeComponents();
  }

  /**
   * Initialize performance metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      cache: {
        hitRate: 0,
        size: 0,
        memoryUsage: 0
      },
      queue: {
        size: 0,
        utilization: 0,
        averageWaitTime: 0,
        throughput: 0
      },
      circuitBreakers: {},
      agents: {
        total: 0,
        active: 0,
        poolUtilization: 0
      },
      system: {
        responseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        memoryUsage: 0
      }
    };
  }

  /**
   * Initialize performance components
   */
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize cache manager
      this.cacheManager = new CacheManager(this.config.cache);

      // Initialize request queue
      this.requestQueue = new RequestQueue(this.config.queue);

      // Initialize circuit breaker factory
      this.circuitBreakerFactory = new CircuitBreakerFactory(this.config.circuitBreaker);

      // Initialize observability manager
      this.observabilityManager = new ObservabilityManager(this.config.observability);

      // Initialize memory optimization components if enabled
      if (this.config.optimization.enableMemoryOptimization) {
        this.memoryProfiler = new MemoryProfiler({
          maxHeapSize: 1024 * 1024 * 1024, // 1GB
          enableCollection: true
        });

        this.resourceManager = new ResourceManager({
          maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
          maxCpuUsage: 80
        });
      }

      // Initialize GC optimization if enabled
      if (this.config.optimization.enableGCOptimization) {
        this.gcOptimizer = new GCOptimizer({
          enableAdaptiveGC: true,
          gcTriggerThreshold: 0.8,
          optimizationStrategy: 'balanced'
        });
      }

      // Setup event listeners
      this.setupEventListeners();

      // Start monitoring if enabled
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      this.isInitialized = true;
      this.emit('initialized', { config: this.config });

    } catch (error) {
      this.emit('initialization-error', { error });
      throw error;
    }
  }

  /**
   * Setup event listeners for components
   */
  private setupEventListeners(): void {
    // Cache events
    this.cacheManager.on('error', (data) => {
      this.emit('cache-error', data);
    });

    this.cacheManager.on('set', (data) => {
      this.emit('cache-set', data);
    });

    // Queue events
    this.requestQueue.on('request-completed', (data) => {
      this.updateSystemMetrics(data);
      this.emit('request-completed', data);
    });

    this.requestQueue.on('request-failed', (data) => {
      this.updateSystemMetrics(data, false);
      this.emit('request-failed', data);
    });

    // Circuit breaker events
    this.circuitBreakerFactory.on('state-changed', (data) => {
      this.emit('circuit-breaker-state-changed', data);
    });
  }

  /**
   * Create or get agent pool for a specific agent type
   */
  createAgentPool(
    agentType: string,
    createAgentFn: () => Promise<any>,
    validateAgentFn: (agent: any) => boolean = () => true,
    poolSize: number = this.config.optimization.agentPoolSize
  ): void {
    if (!this.config.optimization.enableAgentPooling) {
      return;
    }

    const pool: AgentPool = {
      available: [],
      busy: new Set(),
      maxSize: poolSize,
      createAgent: createAgentFn,
      validateAgent: validateAgentFn
    };

    this.agentPools.set(agentType, pool);

    // Pre-warm the pool
    this.warmUpPool(agentType);
  }

  /**
   * Get agent from pool
   */
  async getAgent(agentType: string): Promise<any> {
    if (!this.config.optimization.enableAgentPooling) {
      return null;
    }

    const pool = this.agentPools.get(agentType);
    if (!pool) {
      throw new Error(`Agent pool not found for type: ${agentType}`);
    }

    // Try to get available agent
    let agent = pool.available.pop();

    // Create new agent if none available and under limit
    if (!agent && (pool.available.length + pool.busy.size) < pool.maxSize) {
      agent = await pool.createAgent();
    }

    // Validate agent
    if (agent && !pool.validateAgent(agent)) {
      agent = await pool.createAgent();
    }

    if (agent) {
      pool.busy.add(agent);
      this.updateAgentMetrics();
    }

    return agent;
  }

  /**
   * Return agent to pool
   */
  returnAgent(agentType: string, agent: any): void {
    if (!this.config.optimization.enableAgentPooling) {
      return;
    }

    const pool = this.agentPools.get(agentType);
    if (!pool || !pool.busy.has(agent)) {
      return;
    }

    pool.busy.delete(agent);

    // Validate agent before returning to pool
    if (pool.validateAgent(agent) && pool.available.length < pool.maxSize) {
      pool.available.push(agent);
    }

    this.updateAgentMetrics();
  }

  /**
   * Warm up agent pool
   */
  private async warmUpPool(agentType: string): Promise<void> {
    const pool = this.agentPools.get(agentType);
    if (!pool) return;

    const warmUpSize = Math.min(3, pool.maxSize);
    const promises: Promise<any>[] = [];

    for (let i = 0; i < warmUpSize; i++) {
      promises.push(
        pool.createAgent().then(agent => {
          if (pool.validateAgent(agent)) {
            pool.available.push(agent);
          }
        }).catch(error => {
          this.emit('pool-warmup-error', { agentType, error });
        })
      );
    }

    await Promise.allSettled(promises);
    this.emit('pool-warmed', { agentType, size: pool.available.length });
  }

  /**
   * Register request processor
   */
  registerProcessor(name: string, processor: RequestProcessor): void {
    this.processors.set(name, processor);
    this.requestQueue.addProcessor(name, processor);
  }

  /**
   * Execute request with performance optimizations and observability
   */
  async executeRequest(
    request: OrchestrationRequest,
    priority: RequestPriority = RequestPriority.NORMAL,
    options: {
      useCache?: boolean;
      cacheKey?: string;
      cacheTtl?: number;
      useCircuitBreaker?: boolean;
      circuitBreakerName?: string;
      processorName?: string;
      correlationContext?: any;
    } = {}
  ): Promise<OrchestrationResponse> {
    // Start observability tracking
    const { span, context, timer } = this.observabilityManager.startOperation(
      'execute_request',
      options.correlationContext,
      {
        'request.id': request.id,
        'request.type': request.type || 'unknown',
        'processor.name': options.processorName || 'default',
        'cache.enabled': options.useCache || false,
        'circuit_breaker.enabled': options.useCircuitBreaker || false
      }
    );

    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.optimization.enableResponseCaching && options.useCache && options.cacheKey) {
        const cachedResult = await this.cacheManager.get<OrchestrationResponse>(options.cacheKey);
        if (cachedResult) {
          // Add cache hit tags to span
          span.tags = { ...span.tags, 'cache.hit': true, 'cache.key': options.cacheKey };
          this.observabilityManager.finishOperation(span, context, timer, { success: true, statusCode: 200 });
          
          this.emit('cache-hit', { requestId: request.id, cacheKey: options.cacheKey });
          return cachedResult;
        }
        // Add cache miss tags to span
        span.tags = { ...span.tags, 'cache.miss': true, 'cache.key': options.cacheKey };
      }

      // Get processor
      const processor = this.processors.get(options.processorName || 'default');
      if (!processor) {
        const error = new Error(`Processor not found: ${options.processorName || 'default'}`);
        this.observabilityManager.finishOperation(span, context, timer, { 
          success: false, 
          error, 
          statusCode: 404 
        });
        throw error;
      }

      // Execute with circuit breaker if enabled
      let result: OrchestrationResponse;
      if (this.config.optimization.enableCircuitBreakers && options.useCircuitBreaker && options.circuitBreakerName) {
        // Add circuit breaker tags to span
        span.tags = { 
          ...span.tags,
          'circuit_breaker.name': options.circuitBreakerName,
          'execution.method': 'circuit_breaker'
        };
        
        const circuitBreaker = this.circuitBreakerFactory.getCircuitBreaker(
          options.circuitBreakerName,
          processor,
          this.config.circuitBreaker
        );
        result = await circuitBreaker.execute(request);
      } else {
        // Add queue execution tags to span
        span.tags = { ...span.tags, 'execution.method': 'queue' };
        // Execute through queue
        result = await this.requestQueue.enqueue(request, priority, processor);
      }

      // Cache result if enabled
      if (this.config.optimization.enableResponseCaching && options.useCache && options.cacheKey && result) {
        await this.cacheManager.set(options.cacheKey, result, {
          ttl: options.cacheTtl
        });
        // Add cache stored tag to span
        span.tags = { ...span.tags, 'cache.stored': true };
      }

      const duration = Date.now() - startTime;
      // Add final execution tags to span
      span.tags = { 
        ...span.tags,
        'response.type': result.type,
        'execution.duration_ms': duration
      };

      this.observabilityManager.finishOperation(span, context, timer, { 
        success: true, 
        statusCode: 200 
      });

      this.emit('request-executed', { 
        requestId: request.id, 
        duration, 
        cached: false,
        correlationId: context.correlationId
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.observabilityManager.finishOperation(span, context, timer, { 
        success: false, 
        error: error as Error,
        statusCode: 500 
      });

      this.emit('request-execution-error', { 
        requestId: request.id, 
        duration, 
        error,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(data: any, success: boolean = true): void {
    if (data.processingTime) {
      const currentAvg = this.performanceMetrics.system.responseTime;
      this.performanceMetrics.system.responseTime = currentAvg === 0 ? 
        data.processingTime : (currentAvg + data.processingTime) / 2;
    }

    // Update error rate
    const totalRequests = this.performanceMetrics.system.requestsPerSecond * 60; // Approximate
    if (totalRequests > 0) {
      const errors = success ? 0 : 1;
      this.performanceMetrics.system.errorRate = 
        (this.performanceMetrics.system.errorRate * (totalRequests - 1) + errors) / totalRequests;
    }
  }

  /**
   * Update agent metrics
   */
  private updateAgentMetrics(): void {
    let totalAgents = 0;
    let activeAgents = 0;

    for (const pool of this.agentPools.values()) {
      totalAgents += pool.available.length + pool.busy.size;
      activeAgents += pool.busy.size;
    }

    this.performanceMetrics.agents = {
      total: totalAgents,
      active: activeAgents,
      poolUtilization: totalAgents > 0 ? activeAgents / totalAgents : 0
    };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    // Metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);

    // Health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Cache metrics
      const cacheMetrics = this.cacheManager.getMetrics();
      this.performanceMetrics.cache = {
        hitRate: cacheMetrics.hitRate,
        size: cacheMetrics.size,
        memoryUsage: cacheMetrics.memoryUsage
      };

      // Queue metrics
      const queueMetrics = this.requestQueue.getMetrics();
      this.performanceMetrics.queue = {
        size: queueMetrics.currentQueueSize,
        utilization: queueMetrics.queueUtilization,
        averageWaitTime: queueMetrics.averageWaitTime,
        throughput: queueMetrics.throughputPerSecond
      };

      // Circuit breaker metrics
      const circuitBreakerHealth = this.circuitBreakerFactory.getAllHealth();
      this.performanceMetrics.circuitBreakers = {};
      for (const [name, health] of Object.entries(circuitBreakerHealth)) {
        this.performanceMetrics.circuitBreakers[name] = {
          state: health.state,
          errorRate: health.errorPercentage,
          recentFailures: health.recentFailures
        };
      }

      // Update agent metrics
      this.updateAgentMetrics();

      // System metrics (memory usage)
      if (process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.performanceMetrics.system.memoryUsage = memUsage.heapUsed / memUsage.heapTotal;
      }

      this.emit('metrics-collected', this.performanceMetrics);

    } catch (error) {
      this.emit('metrics-collection-error', { error });
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealth();
      
      // Check for performance issues
      if (health.overall !== 'healthy') {
        this.emit('performance-degradation', { health });
      }

      // Trigger optimization if needed
      await this.optimizePerformance(health);

      this.emit('health-checked', { health });

    } catch (error) {
      this.emit('health-check-error', { error });
    }
  }

  /**
   * Optimize performance based on current state
   */
  private async optimizePerformance(health: PerformanceHealth): Promise<void> {
    const thresholds = this.config.monitoring.performanceThresholds;

    // Cache optimization
    if (this.performanceMetrics.cache.hitRate < this.config.optimization.cacheHitRateTarget) {
      this.emit('cache-optimization-needed', { 
        currentHitRate: this.performanceMetrics.cache.hitRate,
        target: this.config.optimization.cacheHitRateTarget
      });
    }

    // Queue optimization
    if (this.performanceMetrics.queue.utilization > thresholds.maxQueueUtilization) {
      // Increase concurrency if possible
      const currentLimit = this.requestQueue.getMetrics().queueUtilization;
      if (currentLimit < this.config.optimization.maxConcurrentRequests) {
        this.emit('queue-optimization-triggered', { 
          action: 'increase-concurrency',
          currentUtilization: this.performanceMetrics.queue.utilization
        });
      }
    }

    // Memory optimization
    if (this.performanceMetrics.system.memoryUsage > thresholds.maxMemoryUsage) {
      // Clear cache entries if memory is high
      await this.cacheManager.invalidate({ 
        beforeTimestamp: Date.now() - 600000 // 10 minutes ago
      });
      
      this.emit('memory-optimization-triggered', {
        memoryUsage: this.performanceMetrics.system.memoryUsage,
        action: 'cache-cleanup'
      });
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get comprehensive health status
   */
  async getHealth(): Promise<PerformanceHealth> {
    const thresholds = this.config.monitoring.performanceThresholds;
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Cache health
    const cacheHealth = await this.cacheManager.getHealth();
    
    // Queue health
    const queueHealth = this.requestQueue.getHealth();

    // Circuit breaker health
    const circuitBreakerHealth = this.circuitBreakerFactory.getAllHealth();
    const unhealthyBreakers = Object.entries(circuitBreakerHealth)
      .filter(([, health]) => health.status === 'unhealthy').length;

    // Agent health
    let agentHealthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (this.performanceMetrics.agents.poolUtilization > 0.8) {
      agentHealthStatus = 'degraded';
    }
    if (this.performanceMetrics.agents.poolUtilization > 0.95) {
      agentHealthStatus = 'unhealthy';
    }

    // Generate alerts and recommendations
    if (this.performanceMetrics.system.responseTime > thresholds.maxResponseTime) {
      alerts.push(`High response time: ${this.performanceMetrics.system.responseTime}ms`);
      recommendations.push('Consider increasing agent pool size or enabling request batching');
    }

    if (this.performanceMetrics.system.errorRate > thresholds.maxErrorRate) {
      alerts.push(`High error rate: ${(this.performanceMetrics.system.errorRate * 100).toFixed(2)}%`);
      recommendations.push('Check circuit breaker configurations and service health');
    }

    if (cacheHealth.performance.hitRate < this.config.optimization.cacheHitRateTarget) {
      recommendations.push('Optimize caching strategy to improve hit rate');
    }

    // Overall health calculation
    const componentHealthScores = {
      cache: cacheHealth.status === 'healthy' ? 3 : cacheHealth.status === 'degraded' ? 2 : 1,
      queue: queueHealth.status === 'healthy' ? 3 : queueHealth.status === 'degraded' ? 2 : 1,
      circuitBreakers: unhealthyBreakers === 0 ? 3 : unhealthyBreakers < 3 ? 2 : 1,
      agents: agentHealthStatus === 'healthy' ? 3 : agentHealthStatus === 'degraded' ? 2 : 1
    };

    const averageScore = Object.values(componentHealthScores).reduce((a, b) => a + b, 0) / 4;
    const overall: 'healthy' | 'degraded' | 'unhealthy' = 
      averageScore >= 2.5 ? 'healthy' : averageScore >= 1.5 ? 'degraded' : 'unhealthy';

    return {
      overall,
      components: {
        cache: cacheHealth.status,
        queue: queueHealth.status,
        circuitBreakers: unhealthyBreakers === 0 ? 'healthy' : unhealthyBreakers < 3 ? 'degraded' : 'unhealthy',
        agents: agentHealthStatus
      },
      alerts,
      recommendations
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    summary: PerformanceHealth;
    metrics: PerformanceMetrics;
    recommendations: string[];
    optimizations: {
      implemented: string[];
      suggested: string[];
    };
  } {
    // This would be expanded with actual optimization tracking
    return {
      summary: {} as PerformanceHealth, // Would call getHealth()
      metrics: this.getMetrics(),
      recommendations: [
        'Enable response caching for frequently accessed data',
        'Implement request batching for similar operations',
        'Configure circuit breakers for external services',
        'Monitor and optimize agent pool sizes'
      ],
      optimizations: {
        implemented: [
          'LRU cache with TTL support',
          'Priority-based request queuing',
          'Circuit breaker pattern implementation',
          'Agent pooling system'
        ],
        suggested: [
          'Response compression for large payloads',
          'Database connection pooling',
          'Request deduplication',
          'Predictive cache warming'
        ]
      }
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Stop monitoring
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Cleanup components
    await this.cacheManager.destroy();
    await this.requestQueue.shutdown();
    this.circuitBreakerFactory.destroy();

    // Cleanup observability components
    await this.observabilityManager.destroy();

    // Cleanup memory optimization components
    if (this.memoryProfiler) {
      this.memoryProfiler.destroy();
    }
    if (this.resourceManager) {
      await this.resourceManager.destroy();
    }
    if (this.gcOptimizer) {
      this.gcOptimizer.destroy();
    }

    // Clear agent pools
    this.agentPools.clear();
    this.processors.clear();

    this.emit('destroyed');
  }

  /**
   * Get observability data export
   */
  getObservabilityData(): any {
    return this.observabilityManager.exportObservabilityData();
  }

  /**
   * Get memory profiling report
   */
  getMemoryReport(): any {
    if (!this.memoryProfiler) return null;
    
    return {
      profile: this.memoryProfiler.stopProfiling(),
      objectPools: this.memoryProfiler.getObjectPoolStatistics(),
      recommendations: this.memoryProfiler.getOptimizationRecommendations()
    };
  }

  /**
   * Get GC optimization statistics
   */
  getGCStats(): any {
    if (!this.gcOptimizer) return null;
    
    return {
      statistics: this.gcOptimizer.getGCStatistics(),
      recommendations: this.gcOptimizer.getOptimizationRecommendations(),
      timings: this.gcOptimizer.exportTimingData()
    };
  }

  /**
   * Get resource manager metrics
   */
  getResourceMetrics(): any {
    if (!this.resourceManager) return null;
    
    return {
      metrics: this.resourceManager.getResourceMetrics(),
      health: this.resourceManager.getResourceHealth(),
      pools: this.resourceManager.getAllPoolStatistics()
    };
  }
}