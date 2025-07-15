/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerError, CircuitBreakerRegistry } from './CircuitBreaker.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockOperation: ReturnType<typeof vi.fn>;
  let mockFallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 60000,
      successThreshold: 2,
      maxRetries: 3,
      retryDelay: 100,
    });
    
    mockOperation = vi.fn();
    mockFallback = vi.fn();
  });

  describe('execute', () => {
    it('should execute operation successfully when circuit is closed', async () => {
      mockOperation.mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
    });

    it('should record failure when operation fails', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(1);
      expect(stats.successes).toBe(0);
    });

    it('should open circuit after failure threshold is reached', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('open');
      expect(stats.failures).toBe(3);
      expect(stats.nextRetryTime).toBeDefined();
    });

    it('should reject requests immediately when circuit is open', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Next request should be rejected immediately
      mockOperation.mockClear();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(CircuitBreakerError);
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should use fallback when circuit is open and fallback is provided', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      mockFallback.mockResolvedValue('fallback result');
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Next request should use fallback
      const result = await circuitBreaker.execute(mockOperation, mockFallback);
      expect(result).toBe('fallback result');
      expect(mockFallback).toHaveBeenCalledOnce();
    });

    it('should transition to half-open after recovery timeout', async () => {
      vi.useFakeTimers();
      
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      expect(circuitBreaker.getStats().state).toBe('open');
      
      // Fast forward past recovery timeout
      vi.advanceTimersByTime(1100);
      
      // Next request should transition to half-open
      mockOperation.mockClear();
      mockOperation.mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.getStats().state).toBe('half-open');
      
      vi.useRealTimers();
    });

    it('should close circuit after successful requests in half-open state', async () => {
      vi.useFakeTimers();
      
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Transition to half-open
      vi.advanceTimersByTime(1100);
      
      mockOperation.mockClear();
      mockOperation.mockResolvedValue('success');
      
      // Execute enough successful requests to close circuit
      for (let i = 0; i < 2; i++) {
        await circuitBreaker.execute(mockOperation);
      }
      
      expect(circuitBreaker.getStats().state).toBe('closed');
      expect(circuitBreaker.getStats().failures).toBe(0);
      
      vi.useRealTimers();
    });

    it('should return to open state if request fails in half-open state', async () => {
      vi.useFakeTimers();
      
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Transition to half-open
      vi.advanceTimersByTime(1100);
      
      mockOperation.mockClear();
      mockOperation.mockRejectedValue(new Error('still failing'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('still failing');
      
      expect(circuitBreaker.getStats().state).toBe('open');
      
      vi.useRealTimers();
    });
  });

  describe('executeWithRetry', () => {
    it('should retry operation on failure', async () => {
      // Use a network error which is retryable
      mockOperation
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success');
      
      const result = await circuitBreaker.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      // Use a network error which is retryable
      mockOperation.mockRejectedValue(new Error('network timeout'));
      
      await expect(circuitBreaker.executeWithRetry(mockOperation)).rejects.toThrow('network timeout');
      
      expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use fallback after max retries', async () => {
      mockOperation.mockRejectedValue(new Error('persistent failure'));
      mockFallback.mockResolvedValue('fallback result');
      
      // Let the circuit open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.executeWithRetry(mockOperation)).rejects.toThrow('persistent failure');
      }
      
      // Should use fallback when circuit is open
      const result = await circuitBreaker.executeWithRetry(mockOperation, mockFallback);
      expect(result).toBe('fallback result');
    });

    it('should not retry circuit breaker errors', async () => {
      // Open the circuit first
      mockOperation.mockRejectedValue(new Error('operation failed'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Clear mock to see if it's called again
      mockOperation.mockClear();
      
      // Should not retry when circuit is open
      await expect(circuitBreaker.executeWithRetry(mockOperation)).rejects.toThrow(CircuitBreakerError);
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      const stats = circuitBreaker.getStats();
      
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.halfOpenSuccesses).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
      expect(stats.lastSuccessTime).toBeUndefined();
      expect(stats.nextRetryTime).toBeUndefined();
    });

    it('should track statistics correctly', async () => {
      mockOperation.mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.lastSuccessTime).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to initial state', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      expect(circuitBreaker.getStats().state).toBe('open');
      
      circuitBreaker.reset();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.halfOpenSuccesses).toBe(0);
      expect(stats.nextRetryTime).toBeUndefined();
    });
  });

  describe('forceOpen', () => {
    it('should force circuit to open state', () => {
      circuitBreaker.forceOpen();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('open');
      expect(stats.nextRetryTime).toBeDefined();
    });
  });

  describe('forceClosed', () => {
    it('should force circuit to closed state', async () => {
      mockOperation.mockRejectedValue(new Error('operation failed'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      expect(circuitBreaker.getStats().state).toBe('open');
      
      circuitBreaker.forceClosed();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.nextRetryTime).toBeUndefined();
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  describe('getBreaker', () => {
    it('should create and return circuit breaker for service', () => {
      const breaker = registry.getBreaker('test-service');
      
      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.getStats().state).toBe('closed');
    });

    it('should return same breaker for same service name', () => {
      const breaker1 = registry.getBreaker('test-service');
      const breaker2 = registry.getBreaker('test-service');
      
      expect(breaker1).toBe(breaker2);
    });

    it('should create breaker with custom config', () => {
      const breaker = registry.getBreaker('test-service', {
        failureThreshold: 10,
        recoveryTimeout: 5000,
      });
      
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe('removeBreaker', () => {
    it('should remove circuit breaker', () => {
      registry.getBreaker('test-service');
      
      const removed = registry.removeBreaker('test-service');
      expect(removed).toBe(true);
      
      const removedAgain = registry.removeBreaker('test-service');
      expect(removedAgain).toBe(false);
    });
  });

  describe('getBreakerNames', () => {
    it('should return all circuit breaker names', () => {
      registry.getBreaker('service1');
      registry.getBreaker('service2');
      registry.getBreaker('service3');
      
      const names = registry.getBreakerNames();
      expect(names).toEqual(['service1', 'service2', 'service3']);
    });
  });

  describe('getAllStats', () => {
    it('should return statistics for all circuit breakers', () => {
      registry.getBreaker('service1');
      registry.getBreaker('service2');
      
      const stats = registry.getAllStats();
      
      expect(stats).toHaveProperty('service1');
      expect(stats).toHaveProperty('service2');
      expect(stats.service1.state).toBe('closed');
      expect(stats.service2.state).toBe('closed');
    });
  });

  describe('resetAll', () => {
    it('should reset all circuit breakers', async () => {
      const breaker1 = registry.getBreaker('service1');
      const breaker2 = registry.getBreaker('service2');
      
      // Force open both breakers
      breaker1.forceOpen();
      breaker2.forceOpen();
      
      registry.resetAll();
      
      expect(breaker1.getStats().state).toBe('closed');
      expect(breaker2.getStats().state).toBe('closed');
    });
  });

  describe('getOpenBreakers', () => {
    it('should return names of open circuit breakers', () => {
      const breaker1 = registry.getBreaker('service1');
      const breaker2 = registry.getBreaker('service2');
      const breaker3 = registry.getBreaker('service3');
      
      breaker1.forceOpen();
      breaker3.forceOpen();
      
      const openBreakers = registry.getOpenBreakers();
      expect(openBreakers).toEqual(['service1', 'service3']);
    });
  });

  describe('execute', () => {
    it('should execute operation with circuit breaker protection', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await registry.execute('test-service', mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should use fallback when circuit is open', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('service down'));
      const mockFallback = vi.fn().mockResolvedValue('fallback result');
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await registry.execute('test-service', mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const result = await registry.execute('test-service', mockOperation, mockFallback);
      expect(result).toBe('fallback result');
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation with retry logic', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValue('success');
      
      const result = await registry.executeWithRetry('test-service', mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });
});