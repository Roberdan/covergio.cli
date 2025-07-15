/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskDecompositionSystem } from './TaskDecompositionSystem.js';
import { TaskMasterClient } from '../TaskMasterClient.js';
import { DecompositionInput, DecompositionResult } from './types.js';
import { TaskDecomposition, TaskMasterAnalysisResult } from '../types.js';

// Mock TaskMasterClient
vi.mock('../TaskMasterClient.js');

describe('TaskDecompositionSystem', () => {
  let system: TaskDecompositionSystem;
  let mockClient: TaskMasterClient;

  const mockDecomposition: TaskDecomposition = {
    subtasks: [
      {
        id: 'task-1',
        title: 'Analysis Phase',
        description: 'Analyze requirements',
        complexity: 'simple',
        estimatedDuration: 3600,
        requiredCapabilities: ['analysis'],
        dependencies: [],
        priority: 'high',
        acceptanceCriteria: ['Requirements documented'],
        riskLevel: 'low',
        tags: ['analysis'],
        canRunInParallel: false
      },
      {
        id: 'task-2',
        title: 'Implementation Phase',
        description: 'Implement solution',
        complexity: 'medium',
        estimatedDuration: 7200,
        requiredCapabilities: ['coding'],
        dependencies: ['task-1'],
        priority: 'high',
        acceptanceCriteria: ['Code implemented'],
        riskLevel: 'medium',
        tags: ['implementation'],
        canRunInParallel: false
      },
      {
        id: 'task-3',
        title: 'Testing Phase',
        description: 'Test solution',
        complexity: 'simple',
        estimatedDuration: 1800,
        requiredCapabilities: ['testing'],
        dependencies: ['task-2'],
        priority: 'medium',
        acceptanceCriteria: ['Tests passed'],
        riskLevel: 'low',
        tags: ['testing'],
        canRunInParallel: false
      }
    ],
    dependencies: [
      {
        fromTask: 'task-1',
        toTask: 'task-2',
        type: 'blocks',
        reason: 'Implementation needs requirements',
        strength: 'strong',
        canBeParallelized: false
      },
      {
        fromTask: 'task-2',
        toTask: 'task-3',
        type: 'blocks',
        reason: 'Testing needs implementation',
        strength: 'strong',
        canBeParallelized: false
      }
    ],
    criticalPath: ['task-1', 'task-2', 'task-3'],
    estimatedTotalDuration: 12600,
    parallelizationOpportunities: [],
    riskAssessment: {
      overallRisk: 'medium',
      riskFactors: [{
        type: 'technical',
        description: 'Complex implementation',
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Regular review'
      }],
      mitigationStrategies: ['Regular reviews'],
      contingencyPlans: ['Fallback plan']
    },
    milestones: []
  };

  const mockAnalysisResult: TaskMasterAnalysisResult = {
    request: {
      text: 'Build a web application',
      analysisType: 'task-decomposition'
    },
    response: {
      requestId: 'test-request',
      timestamp: new Date(),
      status: 'success',
      confidence: 0.9,
      analysis: {
        intent: 'build web application',
        domains: ['web-development'],
        complexity: 'medium',
        estimatedDuration: 12600,
        priority: 'high',
        requiredCapabilities: ['web-dev'],
        riskFactors: [],
        confidence: 0.9,
        reasoning: 'Web development project',
        tags: ['web'],
        category: 'feature'
      },
      decomposition: mockDecomposition,
      metadata: {
        processingTime: 1000,
        modelVersion: 'v1.0',
        tokensUsed: 100,
        cached: false
      }
    },
    context: {
      requestId: 'test-request',
      retryCount: 0,
      startTime: new Date(),
      metadata: {}
    },
    cached: false,
    metrics: {
      responseTime: 1000,
      retryCount: 0,
      cacheHit: false,
      rateLimited: false
    }
  };

  beforeEach(() => {
    mockClient = {
      decomposeTask: vi.fn().mockResolvedValue(mockAnalysisResult)
    } as any;

    system = new TaskDecompositionSystem(mockClient, {
      enableCaching: true,
      enableValidation: true,
      enableOptimization: true,
      maxRetries: 3,
      timeout: 30000
    });
  });

  describe('decompose', () => {
    it('should decompose a simple task successfully', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: {
          userId: 'user123',
          projectId: 'proj456'
        },
        options: {
          enableValidation: true,
          enableOptimization: true
        }
      };

      const result = await system.decompose(input);

      expect(result.decomposition.subtasks).toHaveLength(3);
      expect(result.decomposition.subtasks[0].id).toBe('task-1');
      expect(result.validation.isValid).toBe(true);
      expect(result.metadata.subtaskCount).toBe(3);
      expect(result.metadata.confidence).toBe(0.9);
    });

    it('should handle complex task with constraints', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a complex e-commerce platform',
        context: {
          userId: 'user123',
          projectId: 'proj456',
          constraints: {
            timeLimit: 86400000, // 24 hours
            priority: 'urgent',
            maxSubtasks: 10
          }
        },
        options: {
          enableValidation: true,
          enableOptimization: true
        }
      };

      const result = await system.decompose(input);

      expect(result.decomposition.subtasks).toHaveLength(3);
      expect(result.validation.isValid).toBe(true);
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should cache results when caching is enabled', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      // First call
      const result1 = await system.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await system.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(1);
      expect(result2.decomposition.subtasks).toHaveLength(3);
    });

    it('should handle API failures with recovery', async () => {
      // Mock API failure
      mockClient.decomposeTask = vi.fn().mockRejectedValue(new Error('Network error'));

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      const result = await system.decompose(input);

      // Should use fallback strategy
      expect(result.decomposition.subtasks).toHaveLength(3);
      expect(result.metadata.confidence).toBe(0.6); // Lower confidence for fallback
    });

    it('should validate decomposition and report errors', async () => {
      // Mock invalid decomposition
      const invalidDecomposition = {
        ...mockDecomposition,
        subtasks: [
          {
            id: '', // Invalid: empty ID
            title: 'Invalid Task',
            description: 'Task with invalid ID',
            complexity: 'simple' as const,
            estimatedDuration: -100, // Invalid: negative duration
            requiredCapabilities: [],
            dependencies: [],
            priority: 'low' as const,
            acceptanceCriteria: [],
            riskLevel: 'low' as const,
            tags: [],
            canRunInParallel: false
          }
        ]
      };

      const invalidAnalysisResult = {
        ...mockAnalysisResult,
        response: {
          ...mockAnalysisResult.response,
          decomposition: invalidDecomposition
        }
      };

      mockClient.decomposeTask = vi.fn().mockResolvedValue(invalidAnalysisResult);

      // Create system with validation disabled for this test
      const noValidationSystem = new TaskDecompositionSystem(mockClient, {
        enableValidation: false
      });

      const input: DecompositionInput = {
        originalTask: 'Build invalid application',
        context: { userId: 'user123' }
      };

      const result = await noValidationSystem.decompose(input);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle timeout scenarios', async () => {
      // Mock slow API response
      mockClient.decomposeTask = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000))
      );

      const timeoutSystem = new TaskDecompositionSystem(mockClient, {
        timeout: 1000 // 1 second timeout
      });

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      const result = await timeoutSystem.decompose(input);

      // Should use recovery strategy due to timeout
      expect(result.decomposition.subtasks).toHaveLength(3);
      expect(result.metadata.confidence).toBe(0.6);
    });

    it('should assign priorities correctly', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      const result = await system.decompose(input);

      // Check that priorities are assigned
      expect(result.decomposition.subtasks[0].priority).toBeDefined();
      expect(result.decomposition.subtasks[1].priority).toBeDefined();
      expect(result.decomposition.subtasks[2].priority).toBeDefined();
    });

    it('should emit events during decomposition', async () => {
      const events: string[] = [];

      system.on('started', () => events.push('started'));
      system.on('completed', () => events.push('completed'));

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      await system.decompose(input);

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });
  });

  describe('validateDecomposition', () => {
    it('should validate a correct decomposition', () => {
      const result = system.validateDecomposition(mockDecomposition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect circular dependencies', () => {
      const circularDecomposition: TaskDecomposition = {
        ...mockDecomposition,
        subtasks: [
          {
            ...mockDecomposition.subtasks[0],
            dependencies: ['task-2'] // Creates circular dependency
          },
          {
            ...mockDecomposition.subtasks[1],
            dependencies: ['task-1']
          }
        ]
      };

      const result = system.validateDecomposition(circularDecomposition);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'circular-dependency')).toBe(true);
    });

    it('should detect missing dependencies', () => {
      const invalidDecomposition: TaskDecomposition = {
        ...mockDecomposition,
        subtasks: [
          {
            ...mockDecomposition.subtasks[0],
            dependencies: ['non-existent-task']
          }
        ]
      };

      const result = system.validateDecomposition(invalidDecomposition);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing-dependency')).toBe(true);
    });

    it('should generate warnings for complex dependencies', () => {
      const complexDecomposition: TaskDecomposition = {
        ...mockDecomposition,
        subtasks: [
          {
            ...mockDecomposition.subtasks[0],
            dependencies: ['task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7'] // Too many dependencies
          }
        ]
      };

      const result = system.validateDecomposition(complexDecomposition);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('optimizeDecomposition', () => {
    it('should optimize decomposition and provide improvements', () => {
      const result = system.optimizeDecomposition(mockDecomposition);

      expect(result.optimized).toBe(true);
      expect(result.improvementMetrics).toBeDefined();
      expect(result.improvementMetrics.timeReduction).toBeGreaterThanOrEqual(0);
      expect(result.improvementMetrics.complexityReduction).toBeGreaterThanOrEqual(0);
    });

    it('should maintain optimization metrics', () => {
      const result = system.optimizeDecomposition(mockDecomposition);

      expect(result.originalCount).toBe(mockDecomposition.subtasks.length);
      expect(result.optimizedCount).toBeGreaterThan(0);
      expect(result.improvementMetrics.parallelismIncrease).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return correct execution order', () => {
      const order = system.getExecutionOrder(mockDecomposition);

      expect(order).toHaveLength(3); // 3 levels
      expect(order[0]).toContain('task-1');
      expect(order[1]).toContain('task-2');
      expect(order[2]).toContain('task-3');
    });

    it('should handle parallel tasks correctly', () => {
      const parallelDecomposition: TaskDecomposition = {
        ...mockDecomposition,
        subtasks: [
          mockDecomposition.subtasks[0],
          {
            ...mockDecomposition.subtasks[1],
            canRunInParallel: true
          },
          {
            ...mockDecomposition.subtasks[2],
            dependencies: ['task-1'], // Both task-2 and task-3 depend only on task-1
            canRunInParallel: true
          }
        ]
      };

      const order = system.getExecutionOrder(parallelDecomposition);

      expect(order).toHaveLength(2); // 2 levels due to parallelism
      expect(order[0]).toContain('task-1');
      expect(order[1]).toContain('task-2');
      expect(order[1]).toContain('task-3');
    });
  });

  describe('metrics', () => {
    it('should track decomposition metrics', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      await system.decompose(input);

      const metrics = system.getMetrics();

      expect(metrics.totalDecompositions).toBe(1);
      expect(metrics.successfulDecompositions).toBe(1);
      expect(metrics.failedDecompositions).toBe(0);
      expect(metrics.lastDecompositionTime).toBeDefined();
    });

    it('should track failed decompositions', async () => {
      mockClient.decomposeTask = vi.fn().mockRejectedValue(new Error('API Error'));

      // Disable recovery for this test
      const noRecoverySystem = new TaskDecompositionSystem(mockClient, {
        recoveryStrategies: []
      });

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      await expect(noRecoverySystem.decompose(input)).rejects.toThrow();

      const metrics = noRecoverySystem.getMetrics();

      expect(metrics.totalDecompositions).toBe(1);
      expect(metrics.successfulDecompositions).toBe(0);
      expect(metrics.failedDecompositions).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      // First call
      await system.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await system.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(1);

      // Clear cache
      system.clearCache();

      // Third call should not use cache
      await system.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(2);
    });

    it('should handle cache expiration', async () => {
      const shortCacheSystem = new TaskDecompositionSystem(mockClient, {
        enableCaching: true,
        cacheTimeoutMs: 100 // 100ms cache timeout
      });

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      // First call
      await shortCacheSystem.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should not use expired cache
      await shortCacheSystem.decompose(input);
      expect(mockClient.decomposeTask).toHaveBeenCalledTimes(2);
    });
  });

  describe('custom strategies', () => {
    it('should allow custom decomposition strategies', async () => {
      const customStrategy = {
        name: 'custom',
        canHandle: vi.fn().mockReturnValue(true),
        decompose: vi.fn().mockResolvedValue({
          input: {} as any,
          decomposition: mockDecomposition,
          analysis: mockAnalysisResult,
          validation: { isValid: true, errors: [], warnings: [], suggestions: [], confidence: 0.8 },
          optimization: { 
            optimized: false, 
            originalCount: 3,
            optimizedCount: 3,
            changes: [], 
            improvementMetrics: { timeReduction: 0, complexityReduction: 0, parallelismIncrease: 0, resourceOptimization: 0 }
          },
          metadata: {
            processingTime: 100,
            subtaskCount: 3,
            dependencyCount: 2,
            complexityScore: 5,
            confidence: 0.8,
            generatedAt: new Date()
          }
        }),
        validate: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [], suggestions: [], confidence: 0.8 }),
        optimize: vi.fn().mockReturnValue({ 
          optimized: false, 
          originalCount: 3,
          optimizedCount: 3,
          changes: [], 
          improvementMetrics: { timeReduction: 0, complexityReduction: 0, parallelismIncrease: 0, resourceOptimization: 0 }
        })
      };

      system.registerStrategy(customStrategy);

      const input: DecompositionInput = {
        originalTask: 'Build a web application',
        context: { userId: 'user123' }
      };

      await system.decompose(input);

      expect(customStrategy.canHandle).toHaveBeenCalled();
      expect(customStrategy.decompose).toHaveBeenCalled();
    });
  });
});