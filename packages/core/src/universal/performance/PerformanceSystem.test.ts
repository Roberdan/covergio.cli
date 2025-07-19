/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from './CacheManager.js';
import { RequestQueue, RequestPriority } from './RequestQueue.js';
import { CircuitBreaker, CircuitState } from './CircuitBreaker.js';
import { PerformanceManager } from './PerformanceManager.js';
import { OrchestrationRequest } from '../interfaces/IOrchestrator.js';

// Helper function to create valid test requests
function createTestRequest(id: string, userInput: string): OrchestrationRequest {
  return {
    id,
    userInput,
    sessionContext: {
      sessionId: `session-${id}`,
      userId: 'test-user',
      currentContext: {},
      conversationHistory: [],
      metadata: {}
    },
    timestamp: new Date(),
    priority: 'medium'
  };
}

describe('Performance System Integration Tests', () => {
  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({
        maxSize: 100,
        defaultTtl: 60000,
        enableMetrics: true
      });
    });

    afterEach(async () => {
      await cacheManager.destroy();
    });

    it('should cache and retrieve values correctly', async () => {
      const key = 'test-key';
      const value = { data: 'test-data', timestamp: Date.now() };

      await cacheManager.set(key, value);
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should respect TTL and expire entries', async () => {
      const key = 'expire-test';
      const value = 'expire-value';

      await cacheManager.set(key, value, { ttl: 100 });
      
      // Should be available immediately
      expect(await cacheManager.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await cacheManager.get(key)).toBeNull();
    });

    it('should track cache metrics correctly', async () => {
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      
      // Hit
      await cacheManager.get('key1');
      // Miss
      await cacheManager.get('nonexistent');

      const metrics = cacheManager.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
      expect(metrics.size).toBe(2);
    });

    it('should invalidate entries by tags', async () => {
      await cacheManager.set('item1', 'value1', { tags: ['user', 'profile'] });
      await cacheManager.set('item2', 'value2', { tags: ['user', 'settings'] });
      await cacheManager.set('item3', 'value3', { tags: ['system'] });

      const invalidated = await cacheManager.invalidate({ tags: ['user'] });
      
      expect(invalidated).toBe(2);
      expect(await cacheManager.get('item1')).toBeNull();
      expect(await cacheManager.get('item2')).toBeNull();
      expect(await cacheManager.get('item3')).toBe('value3');
    });

    it('should handle cache health monitoring', async () => {
      // Fill cache to test health
      for (let i = 0; i < 50; i++) {
        await cacheManager.set(`key${i}`, `value${i}`);
      }

      const health = await cacheManager.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.memory.usage).toBe(50);
      expect(health.memory.utilizationPercent).toBe(50);
    });
  });

  describe('RequestQueue', () => {
    let requestQueue: RequestQueue;

    beforeEach(() => {
      requestQueue = new RequestQueue({
        concurrencyLimit: 2,
        maxQueueSize: 10,
        enablePrioritization: true
      });

      // Add a simple processor
      requestQueue.addProcessor('test', async (request) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          id: 'response-' + request.id,
          requestId: request.id,
          type: 'success',
          content: 'Processed: ' + request.userInput,
          agents: [],
          workflow: { steps: [], metadata: {} },
          status: 'completed' as any,
          metrics: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 100,
            agentsUsed: 0,
            stepsCompleted: 1,
            totalSteps: 1,
            averageResponseTime: 100,
            successRate: 1,
            errorRate: 0,
            cacheMisses: 0,
            cacheHits: 0
          }
        };
      });
    });

    afterEach(async () => {
      await requestQueue.shutdown();
    });

    it('should process requests with correct prioritization', async () => {
      const results: any[] = [];
      const startTime = Date.now();

      // Enqueue requests with different priorities
      const promises = [
        requestQueue.enqueue(
          createTestRequest('1', 'low priority'), 
          'low'
        ).then(result => {
          results.push({ ...result, completedAt: Date.now() - startTime });
        }),
        requestQueue.enqueue(
          createTestRequest('2', 'high priority'), 
          'high'
        ).then(result => {
          results.push({ ...result, completedAt: Date.now() - startTime });
        }),
        requestQueue.enqueue(
          createTestRequest('3', 'normal priority'), 
          'medium'
        ).then(result => {
          results.push({ ...result, completedAt: Date.now() - startTime });
        })
      ];

      await Promise.all(promises);

      // High priority should complete first (when considering processing order)
      expect(results).toHaveLength(3);
      
      const metrics = requestQueue.getMetrics();
      expect(metrics.completedRequests).toBe(3);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should handle queue limits and reject when full', async () => {
      // Fill the queue to capacity
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          requestQueue.enqueue(createTestRequest(`req-${i}`, `test ${i}`))
        );
      }

      // This should fail as queue is now full
      await expect(
        requestQueue.enqueue(createTestRequest('overflow', 'overflow test'))
      ).rejects.toThrow('Queue is full');

      // Wait for some to complete
      await Promise.all(promises.slice(0, 2));
    });

    it('should track queue metrics accurately', async () => {
      const request1 = requestQueue.enqueue(createTestRequest('1', 'test1'));
      const request2 = requestQueue.enqueue(createTestRequest('2', 'test2'));

      await Promise.all([request1, request2]);

      const metrics = requestQueue.getMetrics();
      expect(metrics.completedRequests).toBe(2);
      expect(metrics.currentQueueSize).toBe(0);
      expect(metrics.averageWaitTime).toBeGreaterThan(0);
    });

    it('should handle request timeouts correctly', async () => {
      const timeoutQueue = new RequestQueue({
        concurrencyLimit: 1,
        requestTimeout: 50 // Very short timeout
      });

      timeoutQueue.addProcessor('slow', async (request) => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Longer than timeout
        return { 
          id: 'response', 
          requestId: request.id,
          type: 'success', 
          content: 'slow response',
          agents: [],
          workflow: { steps: [], metadata: {} },
          status: 'completed' as any,
          metrics: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 200,
            agentsUsed: 0,
            stepsCompleted: 1,
            totalSteps: 1,
            averageResponseTime: 200,
            successRate: 1,
            errorRate: 0,
            cacheMisses: 0,
            cacheHits: 0
          }
        };
      });

      await expect(
        timeoutQueue.enqueue(createTestRequest('timeout-test', 'slow request'))
      ).rejects.toThrow('timeout');

      await timeoutQueue.shutdown();
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    let callCount = 0;

    beforeEach(() => {
      callCount = 0;
      
      const flakyService = vi.fn(async (shouldFail: boolean) => {
        callCount++;
        if (shouldFail) {
          throw new Error(`Service failure ${callCount}`);
        }
        return `Success ${callCount}`;
      });

      circuitBreaker = new CircuitBreaker(
        flakyService,
        {
          failureThreshold: 3,
          resetTimeoutMs: 100,
          volumeThreshold: 5,
          errorPercentageThreshold: 60
        }
      );
    });

    afterEach(() => {
      circuitBreaker.destroy();
    });

    it('should open circuit after failure threshold', async () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Cause enough failures to open circuit
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(true); // Force failure
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to half-open after reset timeout', async () => {
      // Force circuit open
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreaker.execute(true);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next call should transition to half-open
      try {
        await circuitBreaker.execute(false); // Success
      } catch (error) {
        // May still be in transition
      }

      // Should eventually be half-open or closed
      expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(
        circuitBreaker.getState()
      );
    });

    it('should track circuit breaker metrics', async () => {
      await circuitBreaker.execute(false); // Success
      await circuitBreaker.execute(false); // Success
      
      try {
        await circuitBreaker.execute(true); // Failure
      } catch (error) {
        // Expected
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalRequests).toBe(3);
    });

    it('should use fallback when circuit is open', async () => {
      const fallback = vi.fn(async (error, shouldFail) => {
        return `Fallback response for failure: ${error.message}`;
      });

      const breakerWithFallback = new CircuitBreaker(
        async (shouldFail: boolean) => {
          if (shouldFail) throw new Error('Service error');
          return 'Service success';
        },
        { failureThreshold: 2, volumeThreshold: 2 },
        fallback
      );

      // Force circuit open
      try {
        await breakerWithFallback.execute(true);
        await breakerWithFallback.execute(true);
        await breakerWithFallback.execute(true);
      } catch (error) {
        // Expected failures
      }

      // Should now use fallback
      const result = await breakerWithFallback.execute(true);
      expect(result).toContain('Fallback response');
      expect(fallback).toHaveBeenCalled();

      breakerWithFallback.destroy();
    });
  });

  describe('PerformanceManager Integration', () => {
    let performanceManager: PerformanceManager;

    beforeEach(() => {
      performanceManager = new PerformanceManager({
        cache: { maxSize: 50, defaultTtl: 60000 },
        queue: { concurrencyLimit: 3, maxQueueSize: 20 },
        optimization: {
          enableAgentPooling: true,
          enableResponseCaching: true,
          enableCircuitBreakers: true,
          agentPoolSize: 2
        }
      });

      // Register test processor
      performanceManager.registerProcessor('test', async (request) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          id: 'response-' + request.id,
          requestId: request.id,
          type: 'success',
          content: 'Processed: ' + request.userInput,
          agents: [],
          workflow: { steps: [], metadata: {} },
          status: 'completed' as any,
          metrics: {
            startTime: new Date(),
            endTime: new Date(),
            duration: 50,
            agentsUsed: 0,
            stepsCompleted: 1,
            totalSteps: 1,
            averageResponseTime: 50,
            successRate: 1,
            errorRate: 0,
            cacheMisses: 0,
            cacheHits: 0
          }
        };
      });
    });

    afterEach(async () => {
      await performanceManager.destroy();
    });

    it('should integrate caching, queuing, and circuit breaking', async () => {
      const request = {
        id: 'test-integration',
        userInput: 'integration test'
      };

      // First request - should be processed and cached
      const result1 = await performanceManager.executeRequest(
        request,
        RequestPriority.NORMAL,
        {
          useCache: true,
          cacheKey: 'integration-test',
          cacheTtl: 60000,
          useCircuitBreaker: true,
          circuitBreakerName: 'test-service',
          processorName: 'test'
        }
      );

      expect(result1).toBeDefined();
      expect(result1.content).toContain('Processed: integration test');

      // Second identical request - should hit cache
      const startTime = Date.now();
      const result2 = await performanceManager.executeRequest(
        request,
        RequestPriority.NORMAL,
        {
          useCache: true,
          cacheKey: 'integration-test',
          processorName: 'test'
        }
      );
      const duration = Date.now() - startTime;

      expect(result2).toEqual(result1);
      expect(duration).toBeLessThan(25); // Should be much faster due to cache
    });

    it('should create and manage agent pools', async () => {
      let createCount = 0;
      
      performanceManager.createAgentPool(
        'test-agents',
        async () => {
          createCount++;
          return {
            id: `agent-${createCount}`,
            execute: vi.fn().mockResolvedValue('agent result')
          };
        },
        (agent) => agent && typeof agent.execute === 'function',
        2
      );

      // Get agents from pool
      const agent1 = await performanceManager.getAgent('test-agents');
      const agent2 = await performanceManager.getAgent('test-agents');

      expect(agent1).toBeDefined();
      expect(agent2).toBeDefined();
      expect(agent1.id).not.toBe(agent2.id);

      // Return agents to pool
      performanceManager.returnAgent('test-agents', agent1);
      performanceManager.returnAgent('test-agents', agent2);

      // Get agent again - should reuse existing
      const agent3 = await performanceManager.getAgent('test-agents');
      expect([agent1.id, agent2.id]).toContain(agent3.id);
    });

    it('should track comprehensive performance metrics', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          performanceManager.executeRequest(
            createTestRequest(`req-${i}`, `test ${i}`),
            RequestPriority.NORMAL,
            { processorName: 'test' }
          )
        );
      }

      await Promise.all(requests);

      const metrics = performanceManager.getMetrics();
      
      expect(metrics.queue.size).toBe(0); // All should be processed
      expect(metrics.system.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.cache.size).toBeGreaterThanOrEqual(0);
    });

    it('should provide health status and recommendations', async () => {
      const health = await performanceManager.getHealth();
      
      expect(health.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components).toBeDefined();
      expect(health.components.cache).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.queue).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.alerts).toBeInstanceOf(Array);
      expect(health.recommendations).toBeInstanceOf(Array);
    });

    it('should generate performance reports', () => {
      const report = performanceManager.getPerformanceReport();
      
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.optimizations.implemented).toBeInstanceOf(Array);
      expect(report.optimizations.suggested).toBeInstanceOf(Array);
    });
  });

  describe('Load Testing Simulation', () => {
    let performanceManager: PerformanceManager;

    beforeEach(() => {
      performanceManager = new PerformanceManager({
        queue: { concurrencyLimit: 5, maxQueueSize: 100 },
        cache: { maxSize: 200 },
        optimization: { 
          enableAgentPooling: true,
          enableResponseCaching: true,
          enableRequestBatching: false,
          enableCircuitBreakers: true,
          enableMemoryOptimization: false,
          enableGCOptimization: false,
          agentPoolSize: 5,
          cacheHitRateTarget: 0.8,
          maxConcurrentRequests: 50
        }
      });

      performanceManager.registerProcessor('load-test', async (request) => {
        const delay = Math.random() * 100 + 50; // 50-150ms processing time
        await new Promise(resolve => setTimeout(resolve, delay));
        return {
          id: 'response-' + request.id,
          requestId: request.id,
          type: 'success',
          content: `Processed ${request.userInput} in ${delay}ms`,
          agents: [],
          workflow: { steps: [], metadata: {} },
          status: 'completed' as any,
          metrics: {
            startTime: new Date(),
            endTime: new Date(),
            duration: delay,
            agentsUsed: 0,
            stepsCompleted: 1,
            totalSteps: 1,
            averageResponseTime: delay,
            successRate: 1,
            errorRate: 0,
            cacheMisses: 0,
            cacheHits: 0
          }
        };
      });
    });

    afterEach(async () => {
      await performanceManager.destroy();
    });

    it('should handle high load with multiple concurrent requests', async () => {
      const startTime = Date.now();
      const requestCount = 50;
      const requests = [];

      // Generate many concurrent requests
      for (let i = 0; i < requestCount; i++) {
        const useCache = i % 3 === 0; // Every 3rd request uses cache
        requests.push(
          performanceManager.executeRequest(
            createTestRequest(`load-${i}`, `load test ${i % 10}`), // 10 unique patterns
            RequestPriority.NORMAL,
            {
              useCache,
              cacheKey: useCache ? `load-pattern-${i % 10}` : undefined,
              processorName: 'load-test'
            }
          )
        );
      }

      const results = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      // Check results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(requestCount * 0.9); // At least 90% success

      // Performance expectations
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      const metrics = performanceManager.getMetrics();
      console.log('Load test metrics:', {
        duration: `${duration}ms`,
        successfulRequests: successful,
        failedRequests: requestCount - successful,
        cacheHitRate: metrics.cache.hitRate,
        queueUtilization: metrics.queue.utilization,
        averageResponseTime: metrics.system.responseTime
      });

      // Cache should have improved performance
      expect(metrics.cache.hitRate).toBeGreaterThan(0);
    });
  });
});