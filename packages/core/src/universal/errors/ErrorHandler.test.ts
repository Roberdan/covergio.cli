/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, ErrorHandlerStrategy, ErrorHandlerResult, ErrorContext } from './ErrorHandler.js';
import { NetworkError, ValidationError, SecurityError, SystemError } from './ErrorTypes.js';
import { CircuitBreakerRegistry } from './CircuitBreaker.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockCircuitBreakerRegistry: CircuitBreakerRegistry;

  beforeEach(() => {
    mockCircuitBreakerRegistry = new CircuitBreakerRegistry();
    errorHandler = new ErrorHandler(
      {
        enableLogging: true,
        enableMetrics: true,
        enableNotifications: true,
        logLevel: 'error',
        maxRetries: 3,
        retryDelay: 100,
        fallbackEnabled: true,
        circuitBreakerEnabled: false, // Disable for easier testing
      },
      mockCircuitBreakerRegistry
    );
  });

  describe('handleError', () => {
    const context: ErrorContext = {
      operation: 'test-operation',
      component: 'test-component',
      requestId: 'req-123',
    };

    it('should handle network errors with retry', async () => {
      const error = new NetworkError('Connection failed');
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(true);
      expect(result.delay).toBe(2000);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications![0].type).toBe('log');
    });

    it('should handle validation errors without retry', async () => {
      const error = new ValidationError('Invalid input');
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(false);
      expect(result.escalate).toBe(false);
    });

    it('should escalate security errors', async () => {
      const error = new SecurityError('Unauthorized access');
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(false);
      expect(result.escalate).toBe(true);
    });

    it('should use default handling for unrecognized errors', async () => {
      const error = new Error('Unknown error');
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(false); // Unknown errors are not retryable by default
      expect(result.delay).toBe(100); // retryDelay * 2^(attempt-1)
    });

    it('should update metrics on error handling', async () => {
      const error = new NetworkError('Connection failed');
      
      await errorHandler.handleError(error, context);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByCategory.network).toBe(1);
      expect(metrics.errorsBySeverity.error).toBe(1);
      expect(metrics.errorsByComponent['test-component']).toBe(1);
    });

    it('should track recent errors', async () => {
      const error = new NetworkError('Connection failed');
      
      await errorHandler.handleError(error, context);
      
      const recentErrors = errorHandler.getRecentErrors();
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Connection failed');
    });
  });

  describe('handleWithRetry', () => {
    const context: ErrorContext = {
      operation: 'test-operation',
      component: 'test-component',
    };

    it('should successfully execute operation on first try', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await errorHandler.handleWithRetry(mockOperation, context);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should retry on retryable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new NetworkError('Temporary failure'))
        .mockResolvedValue('success');
      
      const result = await errorHandler.handleWithRetry(mockOperation, context);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new ValidationError('Invalid input'));
      
      await expect(errorHandler.handleWithRetry(mockOperation, context)).rejects.toThrow('Invalid input');
      expect(mockOperation).toHaveBeenCalledOnce();
    });

    it('should use fallback after max retries', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new NetworkError('Persistent failure'));
      
      // Create a custom strategy that provides fallback
      const fallbackStrategy: ErrorHandlerStrategy = {
        canHandle: (error) => error instanceof NetworkError,
        handle: async () => ({
          handled: true,
          retry: true,
          fallback: async () => 'fallback result',
        }),
      };
      
      errorHandler.registerStrategy(fallbackStrategy);
      
      try {
        const result = await errorHandler.handleWithRetry(mockOperation, context);
        expect(result).toBe('fallback result');
      } catch (error) {
        // If fallback fails, the original error should be thrown
        expect(error).toBeInstanceOf(NetworkError);
      }
      
      expect(mockOperation).toHaveBeenCalledTimes(3); // Max retries
    });

    it('should throw error after max retries without fallback', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new NetworkError('Persistent failure'));
      
      await expect(errorHandler.handleWithRetry(mockOperation, context)).rejects.toThrow('Persistent failure');
      expect(mockOperation).toHaveBeenCalledTimes(3); // Max retries
    });

    it('should use circuit breaker when enabled', async () => {
      const circuitBreakerHandler = new ErrorHandler({
        enableLogging: false,
        enableMetrics: false,
        enableNotifications: false,
        logLevel: 'error',
        maxRetries: 3,
        retryDelay: 100,
        fallbackEnabled: true,
        circuitBreakerEnabled: true,
      });
      
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreakerHandler.handleWithRetry(mockOperation, context);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledOnce();
    });
  });

  describe('custom strategies', () => {
    it('should register and use custom strategy', async () => {
      const customStrategy: ErrorHandlerStrategy = {
        canHandle: (error) => error instanceof SystemError,
        handle: async () => ({
          handled: true,
          retry: false,
          escalate: true,
          notifications: [{
            type: 'log',
            severity: 'critical',
            message: 'Custom strategy handled system error',
          }],
        }),
      };
      
      errorHandler.registerStrategy(customStrategy);
      
      const error = new SystemError('System failure');
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      const result = await errorHandler.handleError(error, context);
      
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(false);
      expect(result.escalate).toBe(true);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications![0].message).toBe('Custom strategy handled system error');
    });

    it('should remove custom strategy', async () => {
      const customStrategy: ErrorHandlerStrategy = {
        canHandle: (error) => error instanceof SystemError,
        handle: async () => ({
          handled: true,
          retry: false,
        }),
      };
      
      errorHandler.registerStrategy(customStrategy);
      const removed = errorHandler.removeStrategy(customStrategy);
      
      expect(removed).toBe(true);
      
      // Should fall back to default handling
      const error = new SystemError('System failure');
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      const result = await errorHandler.handleError(error, context);
      
      // Should use default handling, not custom strategy
      expect(result.handled).toBe(true);
      expect(result.retry).toBe(true); // Default for system errors
    });
  });

  describe('metrics', () => {
    it('should track error metrics correctly', async () => {
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      await errorHandler.handleError(new NetworkError('Network error'), context);
      await errorHandler.handleError(new ValidationError('Validation error'), context);
      await errorHandler.handleError(new SecurityError('Security error'), context);
      
      const metrics = errorHandler.getMetrics();
      
      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByCategory.network).toBe(1);
      expect(metrics.errorsByCategory.validation).toBe(1);
      expect(metrics.errorsByCategory.security).toBe(1);
      expect(metrics.errorsBySeverity.error).toBe(2);
      expect(metrics.errorsBySeverity.critical).toBe(1);
      expect(metrics.errorsByComponent['test-component']).toBe(3);
    });

    it('should reset metrics', async () => {
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      await errorHandler.handleError(new NetworkError('Network error'), context);
      
      let metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      
      errorHandler.resetMetrics();
      
      metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.errorsByCategory.network).toBe(0);
      expect(metrics.errorsByComponent['test-component']).toBeUndefined();
    });

    it('should limit recent errors to 1000', async () => {
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      // Add 1500 errors
      for (let i = 0; i < 1500; i++) {
        await errorHandler.handleError(new NetworkError(`Error ${i}`), context);
      }
      
      const recentErrors = errorHandler.getRecentErrors(1000);
      expect(recentErrors).toHaveLength(1000);
      
      // Should have the most recent errors
      expect(recentErrors[recentErrors.length - 1].message).toBe('Error 1499');
    });
  });

  describe('shouldEscalate', () => {
    const context: ErrorContext = {
      operation: 'test-operation',
      component: 'test-component',
    };

    it('should escalate critical errors', () => {
      const error = new SystemError('Critical system failure');
      
      const shouldEscalate = errorHandler.shouldEscalate(error, context);
      
      expect(shouldEscalate).toBe(true);
    });

    it('should escalate security errors', () => {
      const error = new SecurityError('Security breach');
      
      const shouldEscalate = errorHandler.shouldEscalate(error, context);
      
      expect(shouldEscalate).toBe(true);
    });

    it('should escalate when too many errors from same component', async () => {
      // Generate 11 errors from same component
      for (let i = 0; i < 11; i++) {
        await errorHandler.handleError(new NetworkError(`Error ${i}`), context);
      }
      
      const shouldEscalate = errorHandler.shouldEscalate(new NetworkError('Another error'), context);
      
      expect(shouldEscalate).toBe(true);
    });

    it('should not escalate normal errors', () => {
      const error = new NetworkError('Normal network error');
      
      const shouldEscalate = errorHandler.shouldEscalate(error, context);
      
      expect(shouldEscalate).toBe(false);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors with default limit', async () => {
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      for (let i = 0; i < 100; i++) {
        await errorHandler.handleError(new NetworkError(`Error ${i}`), context);
      }
      
      const recentErrors = errorHandler.getRecentErrors();
      expect(recentErrors).toHaveLength(50); // Default limit
    });

    it('should return recent errors with custom limit', async () => {
      const context: ErrorContext = {
        operation: 'test-operation',
        component: 'test-component',
      };
      
      for (let i = 0; i < 100; i++) {
        await errorHandler.handleError(new NetworkError(`Error ${i}`), context);
      }
      
      const recentErrors = errorHandler.getRecentErrors(25);
      expect(recentErrors).toHaveLength(25);
    });
  });
});