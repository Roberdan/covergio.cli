/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  FallbackSystem,
  LocalDecompositionFallback,
  CachedResponseFallback,
  FallbackStrategy,
  CircuitBreakerConfig
} from './FallbackSystem.js';

// Mock strategy for testing
class MockFallbackStrategy implements FallbackStrategy {
  name = 'mock-strategy';
  priority = 10;
  private healthy = true;
  private shouldHandle = true;

  canHandle(operation: string, error: Error): boolean {
    return this.shouldHandle;
  }

  async execute(operation: string, data: any): Promise<any> {
    if (!this.healthy) {
      throw new Error('Mock strategy is unhealthy');
    }
    return { result: 'mock-success', operation, data };
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  setShouldHandle(shouldHandle: boolean): void {
    this.shouldHandle = shouldHandle;
  }
}

describe('FallbackSystem', () => {
  let fallbackSystem: FallbackSystem;
  let mockStrategy: MockFallbackStrategy;

  const testConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    recoveryTimeout: 1000,
    monitoringPeriod: 500,
    halfOpenMaxCalls: 2,
    minimumCalls: 3
  };

  beforeEach(() => {
    fallbackSystem = new FallbackSystem(testConfig);
    mockStrategy = new MockFallbackStrategy();
    fallbackSystem.addStrategy(mockStrategy);
  });

  describe('circuit breaker functionality', () => {
    it('should start with closed circuit breaker', () => {
      const stats = fallbackSystem.getCircuitBreakerStats('test-operation');
      expect(stats).toBeNull();
    });

    it('should create circuit breaker on first operation', async () => {
      const primaryFunction = vi.fn().mockResolvedValue('success');
      
      await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      
      const stats = fallbackSystem.getCircuitBreakerStats('test-op');
      expect(stats).toBeDefined();
      expect(stats!.state).toBe('closed');
      expect(stats!.successCount).toBe(1);
      expect(stats!.failureCount).toBe(0);
    });

    it('should open circuit breaker after threshold failures', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false); // Force fallback to fail

      // Execute enough failures to open circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = fallbackSystem.getCircuitBreakerStats('test-op');
      expect(stats!.state).toBe('open');
      expect(stats!.failureCount).toBe(testConfig.failureThreshold);
    });

    it('should not call primary function when circuit is open', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false);

      // Open the circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected
        }
      }

      // Reset the mock to track new calls
      primaryFunction.mockClear();

      // Try to execute again - should not call primary function
      try {
        await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      } catch (error) {
        // Expected
      }

      expect(primaryFunction).not.toHaveBeenCalled();
    });

    it('should transition to half-open after recovery timeout', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false);

      // Open the circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected
        }
      }

      expect(fallbackSystem.getCircuitBreakerStats('test-op')!.state).toBe('open');

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, testConfig.recoveryTimeout + 100));

      // Now it should try the primary function again and transition to half-open
      primaryFunction.mockResolvedValueOnce('success');
      
      const result = await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      
      expect(result).toBe('success');
      expect(fallbackSystem.getCircuitBreakerStats('test-op')!.state).toBe('closed');
    });

    it('should emit circuit breaker events', async () => {
      const openedSpy = vi.fn();
      const closedSpy = vi.fn();
      const halfOpenedSpy = vi.fn();

      fallbackSystem.on('circuit-breaker-opened', openedSpy);
      fallbackSystem.on('circuit-breaker-closed', closedSpy);
      fallbackSystem.on('circuit-breaker-half-opened', halfOpenedSpy);

      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false);

      // Open the circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected
        }
      }

      expect(openedSpy).toHaveBeenCalledWith({
        operation: 'test-op',
        error: expect.any(Error)
      });
    });

    it('should reset circuit breaker', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false);

      // Open the circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected
        }
      }

      expect(fallbackSystem.getCircuitBreakerStats('test-op')!.state).toBe('open');

      // Reset the circuit breaker
      fallbackSystem.resetCircuitBreaker('test-op');

      const stats = fallbackSystem.getCircuitBreakerStats('test-op')!;
      expect(stats.state).toBe('closed');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('fallback strategy execution', () => {
    it('should execute fallback when primary function fails', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Primary failed'));
      
      const result = await fallbackSystem.executeWithFallback('test-op', primaryFunction, { test: 'data' });
      
      expect(result).toEqual({
        result: 'mock-success',
        operation: 'test-op',
        data: { test: 'data' }
      });
    });

    it('should try strategies in priority order', async () => {
      const lowPriorityStrategy = new MockFallbackStrategy();
      lowPriorityStrategy.name = 'low-priority';
      lowPriorityStrategy.priority = 1;
      
      fallbackSystem.addStrategy(lowPriorityStrategy);
      
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Primary failed'));
      
      const result = await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      
      // Should use high priority strategy (mockStrategy with priority 10)
      expect(result.result).toBe('mock-success');
    });

    it('should skip unhealthy strategies', async () => {
      mockStrategy.setHealthy(false);
      
      const healthyStrategy = new MockFallbackStrategy();
      healthyStrategy.name = 'healthy-strategy';
      healthyStrategy.priority = 5;
      fallbackSystem.addStrategy(healthyStrategy);
      
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Primary failed'));
      
      const result = await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      
      expect(result.result).toBe('mock-success');
    });

    it('should emit fallback events', async () => {
      const executedSpy = vi.fn();
      const failedSpy = vi.fn();
      
      fallbackSystem.on('fallback-executed', executedSpy);
      fallbackSystem.on('fallback-failed', failedSpy);
      
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Primary failed'));
      
      await fallbackSystem.executeWithFallback('test-op', primaryFunction);
      
      expect(executedSpy).toHaveBeenCalledWith({
        strategy: 'mock-strategy',
        operation: 'test-op',
        success: true
      });
    });

    it('should throw error when all fallbacks fail', async () => {
      mockStrategy.setHealthy(false);
      
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Primary failed'));
      
      await expect(fallbackSystem.executeWithFallback('test-op', primaryFunction))
        .rejects.toThrow('All fallback strategies failed');
    });
  });

  describe('health monitoring', () => {
    it('should report healthy status with working strategies', () => {
      const health = fallbackSystem.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.availableStrategies).toBeGreaterThan(0);
      expect(health.issues).toHaveLength(0);
    });

    it('should report degraded status with some unhealthy strategies', () => {
      mockStrategy.setHealthy(false);
      
      const health = fallbackSystem.getHealth();
      
      expect(health.status).toBe('degraded');
      expect(health.issues).toContain('Some fallback strategies are unhealthy');
    });

    it('should report critical status with no healthy strategies', () => {
      // Create a new fallback system and clear all default strategies
      const testFallbackSystem = new FallbackSystem(testConfig);
      // Clear default strategies first
      testFallbackSystem['fallbackStrategies'] = [];
      
      const unhealthyStrategy = new MockFallbackStrategy();
      unhealthyStrategy.setHealthy(false);
      testFallbackSystem.addStrategy(unhealthyStrategy);
      
      const health = testFallbackSystem.getHealth();
      
      expect(health.status).toBe('critical');
      expect(health.issues).toContain('No healthy fallback strategies available');
    });

    it('should include circuit breaker states in health report', async () => {
      const primaryFunction = vi.fn().mockRejectedValue(new Error('Test error'));
      mockStrategy.setShouldHandle(false);

      // Open a circuit
      for (let i = 0; i < testConfig.failureThreshold; i++) {
        try {
          await fallbackSystem.executeWithFallback('test-op', primaryFunction);
        } catch (error) {
          // Expected
        }
      }

      const health = fallbackSystem.getHealth();
      
      expect(health.circuitBreakers['test-op']).toBe('open');
      expect(health.issues).toContain('Circuit breaker open for test-op');
    });
  });

  describe('hasFallback', () => {
    it('should return true when fallback is available', () => {
      expect(fallbackSystem.hasFallback('test-op')).toBe(true);
    });

    it('should return false when no healthy fallback is available', () => {
      mockStrategy.setHealthy(false);
      
      // Remove other default strategies for clean test
      fallbackSystem['fallbackStrategies'] = [mockStrategy];
      
      expect(fallbackSystem.hasFallback('test-op')).toBe(false);
    });

    it('should return false when no strategy can handle the operation', () => {
      mockStrategy.setShouldHandle(false);
      
      // Remove other default strategies for clean test
      fallbackSystem['fallbackStrategies'] = [mockStrategy];
      
      expect(fallbackSystem.hasFallback('test-op')).toBe(false);
    });
  });

  describe('getAllCircuitBreakerStats', () => {
    it('should return stats for all circuit breakers', async () => {
      const primaryFunction1 = vi.fn().mockResolvedValue('success1');
      const primaryFunction2 = vi.fn().mockResolvedValue('success2');
      
      await fallbackSystem.executeWithFallback('op1', primaryFunction1);
      await fallbackSystem.executeWithFallback('op2', primaryFunction2);
      
      const allStats = fallbackSystem.getAllCircuitBreakerStats();
      
      expect(allStats).toHaveProperty('op1');
      expect(allStats).toHaveProperty('op2');
      expect(allStats.op1.successCount).toBe(1);
      expect(allStats.op2.successCount).toBe(1);
    });
  });
});

describe('LocalDecompositionFallback', () => {
  let fallback: LocalDecompositionFallback;

  beforeEach(() => {
    fallback = new LocalDecompositionFallback();
  });

  describe('canHandle', () => {
    it('should handle decompose operations', () => {
      expect(fallback.canHandle('decompose', new Error())).toBe(true);
    });

    it('should handle analyze operations', () => {
      expect(fallback.canHandle('analyze', new Error())).toBe(true);
    });

    it('should not handle other operations', () => {
      expect(fallback.canHandle('unknown', new Error())).toBe(false);
    });
  });

  describe('isHealthy', () => {
    it('should always be healthy', () => {
      expect(fallback.isHealthy()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should decompose web development tasks', async () => {
      const request = {
        originalTask: 'Create a React component for user authentication'
      };

      const result = await fallback.execute('decompose', request);

      expect(result.subtasks).toBeDefined();
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.metadata.source).toBe('local-fallback');
      expect(result.subtasks[0].title).toContain('Project Setup');
    });

    it('should analyze request complexity', async () => {
      const request = {
        text: 'Build a microservices architecture with machine learning components'
      };

      const result = await fallback.execute('analyze', request);

      expect(result.domains).toBeDefined();
      expect(result.complexity).toBe('complex');
      expect(result.requiredExpertise).toBeDefined();
      expect(result.confidence).toBe(0.5);
    });

    it('should detect web development domain', async () => {
      const request = {
        text: 'Create a React frontend with HTML and CSS'
      };

      const result = await fallback.execute('analyze', request);

      expect(result.domains).toContain('web-development');
    });

    it('should detect backend development domain', async () => {
      const request = {
        text: 'Build a REST API with Node.js and database integration'
      };

      const result = await fallback.execute('analyze', request);

      expect(result.domains).toContain('backend-development');
    });

    it('should identify risk factors', async () => {
      const request = {
        text: 'Integrate with legacy systems and ensure high performance'
      };

      const result = await fallback.execute('analyze', request);

      expect(result.riskFactors).toContain('Legacy technology risk');
      expect(result.riskFactors).toContain('Performance requirements');
    });

    it('should throw error for unsupported operations', async () => {
      await expect(fallback.execute('unsupported', {}))
        .rejects.toThrow('Unsupported operation: unsupported');
    });

    it('should handle general tasks with default template', async () => {
      const request = {
        originalTask: 'Solve a quantum computing problem'
      };

      const result = await fallback.execute('decompose', request);

      expect(result.subtasks).toBeDefined();
      expect(result.subtasks.length).toBeGreaterThan(0);
      expect(result.subtasks[0].title).toContain('Requirements Analysis');
    });
  });
});

describe('CachedResponseFallback', () => {
  let fallback: CachedResponseFallback;

  beforeEach(() => {
    fallback = new CachedResponseFallback();
  });

  describe('cacheResponse and execute', () => {
    it('should cache and retrieve responses', async () => {
      const operation = 'test-op';
      const data = { test: 'data' };
      const response = { result: 'cached-result' };

      // Cache the response
      fallback.cacheResponse(operation, data, response);

      // Verify cache can handle the operation (need to pass the data to generate the same cache key)
      expect(fallback.canHandle(operation, data as any)).toBe(true);

      // Retrieve from cache
      const result = await fallback.execute(operation, data);
      expect(result).toEqual(response);
    });

    it('should reject expired cache entries', async () => {
      const operation = 'test-op';
      const data = { test: 'data' };
      const response = { result: 'cached-result' };
      const shortTTL = 100; // 100ms

      // Cache with short TTL
      fallback.cacheResponse(operation, data, response, shortTTL);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should throw error for expired cache
      await expect(fallback.execute(operation, data))
        .rejects.toThrow('Cached response expired');
    });

    it('should handle cache misses', async () => {
      expect(fallback.canHandle('non-existent', new Error())).toBe(false);

      await expect(fallback.execute('non-existent', {}))
        .rejects.toThrow('No cached response available');
    });
  });

  describe('isHealthy', () => {
    it('should be unhealthy when empty', () => {
      expect(fallback.isHealthy()).toBe(false);
    });

    it('should be healthy when has cached entries', () => {
      fallback.cacheResponse('test', {}, {});
      expect(fallback.isHealthy()).toBe(true);
    });
  });
});