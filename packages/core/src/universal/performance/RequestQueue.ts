/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { OrchestrationRequest, OrchestrationResponse } from '../interfaces/IOrchestrator.js';

/**
 * Request queue configuration
 */
export interface RequestQueueConfig {
  concurrencyLimit: number;
  maxQueueSize: number;
  requestTimeout: number;
  priorityLevels: number;
  batchSize: number;
  batchTimeout: number;
  enableBatching: boolean;
  enablePrioritization: boolean;
  enableLoadBalancing: boolean;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Queue metrics interface
 */
export interface QueueMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  currentQueueSize: number;
  activeRequests: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughputPerSecond: number;
  queueUtilization: number;
  errorRate: number;
  priorityDistribution: Record<RequestPriority, number>;
}

/**
 * Queued request interface
 */
interface QueuedRequest extends OrchestrationRequest {
  priority: RequestPriority;
  queuedAt: number;
  attempts: number;
  resolve: (result: OrchestrationResponse) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
  batch?: boolean;
}

/**
 * Request processor function type
 */
export type RequestProcessor = (request: OrchestrationRequest) => Promise<OrchestrationResponse>;

/**
 * Batch request processor function type
 */
export type BatchRequestProcessor = (requests: OrchestrationRequest[]) => Promise<OrchestrationResponse[]>;

/**
 * Load balancer interface
 */
interface LoadBalancer {
  selectProcessor(request: OrchestrationRequest): RequestProcessor;
  addProcessor(id: string, processor: RequestProcessor): void;
  removeProcessor(id: string): void;
  getProcessorHealth(id: string): number;
}

/**
 * Advanced Request Queue with Load Balancing and Batching
 */
export class RequestQueue extends EventEmitter {
  private config: RequestQueueConfig;
  private queues: Map<RequestPriority, QueuedRequest[]> = new Map();
  private activeRequests = new Set<QueuedRequest>();
  private processing = false;
  private metrics: QueueMetrics;
  private processors = new Map<string, RequestProcessor>();
  private batchProcessor?: BatchRequestProcessor;
  private loadBalancer?: LoadBalancer;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    config: Partial<RequestQueueConfig> = {},
    batchProcessor?: BatchRequestProcessor
  ) {
    super();

    this.config = {
      concurrencyLimit: 5,
      maxQueueSize: 1000,
      requestTimeout: 30000,
      priorityLevels: 4,
      batchSize: 10,
      batchTimeout: 1000,
      enableBatching: false,
      enablePrioritization: true,
      enableLoadBalancing: false,
      retryAttempts: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      ...config
    };

    this.batchProcessor = batchProcessor;

    this.metrics = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      currentQueueSize: 0,
      activeRequests: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughputPerSecond: 0,
      queueUtilization: 0,
      errorRate: 0,
      priorityDistribution: {
        [RequestPriority.LOW]: 0,
        [RequestPriority.NORMAL]: 0,
        [RequestPriority.HIGH]: 0,
        [RequestPriority.CRITICAL]: 0
      }
    };

    this.initializeQueues();
    this.setupLoadBalancer();
    this.startMetricsCollection();
  }

  /**
   * Initialize priority queues
   */
  private initializeQueues(): void {
    for (let priority = 0; priority < this.config.priorityLevels; priority++) {
      this.queues.set(priority as RequestPriority, []);
    }
  }

  /**
   * Setup load balancer if enabled
   */
  private setupLoadBalancer(): void {
    if (!this.config.enableLoadBalancing) return;

    this.loadBalancer = {
      selectProcessor: (request: OrchestrationRequest): RequestProcessor => {
        const processors = Array.from(this.processors.values());
        if (processors.length === 0) {
          throw new Error('No processors available');
        }

        // Simple round-robin for now, can be enhanced with health-based selection
        const index = this.metrics.totalRequests % processors.length;
        return processors[index];
      },

      addProcessor: (id: string, processor: RequestProcessor): void => {
        this.processors.set(id, processor);
        this.emit('processor-added', { id });
      },

      removeProcessor: (id: string): void => {
        this.processors.delete(id);
        this.emit('processor-removed', { id });
      },

      getProcessorHealth: (id: string): number => {
        // Placeholder for health calculation
        return 1.0;
      }
    };
  }

  /**
   * Add a request processor
   */
  addProcessor(id: string, processor: RequestProcessor): void {
    this.processors.set(id, processor);
    if (this.loadBalancer) {
      this.loadBalancer.addProcessor(id, processor);
    }
  }

  /**
   * Remove a request processor
   */
  removeProcessor(id: string): void {
    this.processors.delete(id);
    if (this.loadBalancer) {
      this.loadBalancer.removeProcessor(id);
    }
  }

  /**
   * Enqueue a request
   */
  async enqueue(
    request: OrchestrationRequest,
    priority: RequestPriority = RequestPriority.NORMAL,
    processor?: RequestProcessor
  ): Promise<OrchestrationResponse> {
    // Check queue capacity
    if (this.getTotalQueueSize() >= this.config.maxQueueSize) {
      throw new Error('Queue is full');
    }

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        ...request,
        priority,
        queuedAt: Date.now(),
        attempts: 0,
        resolve,
        reject
      };

      // Set timeout
      if (this.config.requestTimeout > 0) {
        queuedRequest.timeout = setTimeout(() => {
          this.handleTimeout(queuedRequest);
        }, this.config.requestTimeout);
      }

      // Add to appropriate queue
      const queue = this.queues.get(priority);
      if (queue) {
        queue.push(queuedRequest);
        this.updateMetrics();
        this.emit('request-queued', { 
          requestId: request.id, 
          priority, 
          queueSize: queue.length 
        });
      }

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.activeRequests.size >= this.config.concurrencyLimit) {
      return;
    }

    this.processing = true;

    try {
      // Process batches if batching is enabled
      if (this.config.enableBatching && this.batchProcessor) {
        await this.processBatches();
      }

      // Process individual requests
      while (this.activeRequests.size < this.config.concurrencyLimit) {
        const request = this.getNextRequest();
        if (!request) break;

        this.activeRequests.add(request);
        this.processRequest(request);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get next request based on priority
   */
  private getNextRequest(): QueuedRequest | null {
    if (!this.config.enablePrioritization) {
      // FIFO processing without priority
      for (const queue of this.queues.values()) {
        if (queue.length > 0) {
          return queue.shift()!;
        }
      }
      return null;
    }

    // Priority-based processing (highest priority first)
    for (let priority = this.config.priorityLevels - 1; priority >= 0; priority--) {
      const queue = this.queues.get(priority as RequestPriority);
      if (queue && queue.length > 0) {
        return queue.shift()!;
      }
    }

    return null;
  }

  /**
   * Process individual request
   */
  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    const startTime = Date.now();
    const waitTime = startTime - queuedRequest.queuedAt;

    try {
      this.emit('request-processing', { 
        requestId: queuedRequest.id,
        waitTime,
        attempts: queuedRequest.attempts + 1
      });

      // Select processor
      let processor: RequestProcessor;
      if (this.loadBalancer && this.config.enableLoadBalancing) {
        processor = this.loadBalancer.selectProcessor(queuedRequest);
      } else {
        processor = this.processors.values().next().value;
      }

      if (!processor) {
        throw new Error('No processor available');
      }

      // Process the request
      const result = await processor(queuedRequest);

      // Clear timeout
      if (queuedRequest.timeout) {
        clearTimeout(queuedRequest.timeout);
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update metrics
      this.updateProcessingMetrics(waitTime, processingTime, true);

      // Resolve the promise
      queuedRequest.resolve(result);

      this.emit('request-completed', {
        requestId: queuedRequest.id,
        processingTime,
        waitTime
      });

    } catch (error) {
      await this.handleRequestError(queuedRequest, error as Error, startTime);
    } finally {
      // Remove from active requests
      this.activeRequests.delete(queuedRequest);
      
      // Continue processing queue
      this.processQueue();
    }
  }

  /**
   * Process batches of requests
   */
  private async processBatches(): Promise<void> {
    if (!this.batchProcessor) return;

    const batch: QueuedRequest[] = [];
    let batchStartTime = Date.now();

    // Collect requests for batch processing
    for (const queue of this.queues.values()) {
      while (batch.length < this.config.batchSize && queue.length > 0) {
        const request = queue.shift();
        if (request) {
          request.batch = true;
          batch.push(request);
        }
      }
    }

    // Process batch if we have requests
    if (batch.length > 0) {
      try {
        const results = await this.batchProcessor(batch);

        // Resolve individual requests
        batch.forEach((request, index) => {
          if (request.timeout) {
            clearTimeout(request.timeout);
          }

          const result = results[index];
          const processingTime = Date.now() - batchStartTime;
          const waitTime = batchStartTime - request.queuedAt;

          this.updateProcessingMetrics(waitTime, processingTime, true);
          request.resolve(result);

          this.emit('request-completed', {
            requestId: request.id,
            processingTime,
            waitTime,
            batch: true
          });
        });

        this.emit('batch-processed', {
          batchSize: batch.length,
          processingTime: Date.now() - batchStartTime
        });

      } catch (error) {
        // Handle batch error
        batch.forEach(request => {
          this.handleRequestError(request, error as Error, batchStartTime);
        });
      }
    }
  }

  /**
   * Handle request error with retry logic
   */
  private async handleRequestError(
    queuedRequest: QueuedRequest, 
    error: Error, 
    startTime: number
  ): Promise<void> {
    queuedRequest.attempts++;

    // Clear timeout
    if (queuedRequest.timeout) {
      clearTimeout(queuedRequest.timeout);
    }

    // Check retry attempts
    if (queuedRequest.attempts < this.config.retryAttempts) {
      // Retry after delay
      setTimeout(() => {
        const queue = this.queues.get(queuedRequest.priority);
        if (queue) {
          queue.unshift(queuedRequest);
          this.processQueue();
        }
      }, this.config.retryDelay * queuedRequest.attempts);

      this.emit('request-retry', {
        requestId: queuedRequest.id,
        attempt: queuedRequest.attempts,
        error: error.message
      });
    } else {
      // Final failure
      const processingTime = Date.now() - startTime;
      const waitTime = startTime - queuedRequest.queuedAt;

      this.updateProcessingMetrics(waitTime, processingTime, false);
      queuedRequest.reject(error);

      this.emit('request-failed', {
        requestId: queuedRequest.id,
        error: error.message,
        attempts: queuedRequest.attempts
      });
    }
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(queuedRequest: QueuedRequest): void {
    const error = new Error(`Request timeout after ${this.config.requestTimeout}ms`);
    this.handleRequestError(queuedRequest, error, Date.now());
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(
    waitTime: number, 
    processingTime: number, 
    success: boolean
  ): void {
    if (success) {
      this.metrics.completedRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update averages
    const totalCompleted = this.metrics.completedRequests;
    if (totalCompleted > 0) {
      this.metrics.averageWaitTime = 
        (this.metrics.averageWaitTime * (totalCompleted - 1) + waitTime) / totalCompleted;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (totalCompleted - 1) + processingTime) / totalCompleted;
    }

    this.updateMetrics();
  }

  /**
   * Update general metrics
   */
  private updateMetrics(): void {
    this.metrics.currentQueueSize = this.getTotalQueueSize();
    this.metrics.activeRequests = this.activeRequests.size;
    this.metrics.queueUtilization = this.metrics.activeRequests / this.config.concurrencyLimit;

    const totalProcessed = this.metrics.completedRequests + this.metrics.failedRequests;
    this.metrics.errorRate = totalProcessed > 0 ? this.metrics.failedRequests / totalProcessed : 0;

    // Update priority distribution
    for (const [priority, queue] of this.queues.entries()) {
      this.metrics.priorityDistribution[priority] = queue.length;
    }
  }

  /**
   * Get total queue size across all priorities
   */
  private getTotalQueueSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const now = Date.now();
      const timePeriod = 60000; // 1 minute
      
      // Calculate throughput
      this.metrics.throughputPerSecond = this.metrics.completedRequests / (timePeriod / 1000);

      this.emit('metrics-updated', this.getMetrics());
    }, 60000);
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueueMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get queue health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    queueUtilization: number;
    errorRate: number;
    averageWaitTime: number;
    activeProcessors: number;
  } {
    const metrics = this.getMetrics();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (metrics.queueUtilization > 0.8 || metrics.errorRate > 0.1 || metrics.averageWaitTime > 5000) {
      status = 'degraded';
    }
    
    if (metrics.queueUtilization > 0.95 || metrics.errorRate > 0.2 || metrics.averageWaitTime > 10000) {
      status = 'unhealthy';
    }

    return {
      status,
      queueUtilization: metrics.queueUtilization,
      errorRate: metrics.errorRate,
      averageWaitTime: metrics.averageWaitTime,
      activeProcessors: this.processors.size
    };
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = true;
    this.emit('paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.processing = false;
    this.processQueue();
    this.emit('resumed');
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      // Reject all pending requests
      queue.forEach(request => {
        if (request.timeout) {
          clearTimeout(request.timeout);
        }
        request.reject(new Error('Queue cleared'));
      });
      queue.length = 0;
    }

    this.updateMetrics();
    this.emit('cleared');
  }

  /**
   * Shutdown the queue
   */
  async shutdown(): Promise<void> {
    this.pause();

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Wait for active requests to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force reject remaining active requests
    for (const request of this.activeRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Queue shutdown'));
    }

    this.clear();
    this.emit('shutdown');
  }
}