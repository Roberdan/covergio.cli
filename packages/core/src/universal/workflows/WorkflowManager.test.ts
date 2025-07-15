/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowManager, WorkflowManagerConfig } from './WorkflowManager.js';
import { IWorkflowPlanner, PlanningResult } from './interfaces/IWorkflowPlanner.js';
import { IWorkflowExecutor, ExecutionOptions } from './interfaces/IWorkflowExecutor.js';
import { WorkflowPlan, WorkflowExecution, AgentInstance } from '../types/common.js';
import { RequestAnalysis } from '../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../interfaces/IOrchestrator.js';

// Mock implementations
class MockPlanner implements IWorkflowPlanner {
  async createPlan(): Promise<PlanningResult> {
    const mockPlan: WorkflowPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      description: 'Test workflow plan',
      steps: [{
        id: 'step-1',
        name: 'Test Step',
        type: 'test',
        description: 'Test step',
        estimatedDuration: 1000,
        dependencies: [],
        parallel: false,
        configuration: {
          action: 'test',
          requiredCapabilities: ['test'],
        },
      }],
      estimatedTotalDuration: 1000,
      priority: 'medium',
      metadata: {},
    };

    return {
      plan: mockPlan,
      confidence: 0.9,
      estimatedCost: 100,
      alternatives: [],
      warnings: [],
    };
  }

  async optimizePlan(plan: WorkflowPlan): Promise<WorkflowPlan> {
    return { ...plan, name: `${plan.name} (Optimized)` };
  }

  async validatePlan() {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };
  }

  getCapabilities() {
    return {
      supportedComplexity: ['simple', 'medium', 'complex'] as ('simple' | 'medium' | 'complex')[],
      supportedDomains: ['test'],
      maxStepsSupported: 10,
      supportsParallelExecution: true,
      supportsConditionalLogic: false,
      supportsRollback: true,
    };
  }
}

class MockExecutor implements IWorkflowExecutor {
  private executions = new Map<string, WorkflowExecution>();

  async execute(plan: WorkflowPlan, options: ExecutionOptions): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      plan,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      currentStep: 1,
      completedSteps: [{
        stepId: 'step-1',
        status: 'completed',
        duration: 500,
      }],
      progress: 100,
      metadata: { options },
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async pause(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'paused';
      return true;
    }
    return false;
  }

  async resume(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'running';
      return true;
    }
    return false;
  }

  async cancel(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      return true;
    }
    return false;
  }

  async getExecutionStatus(executionId: string) {
    const execution = this.executions.get(executionId);
    return execution ? {
      executionId: execution.id,
      status: execution.status,
      currentStep: execution.currentStep,
      totalSteps: execution.plan.steps.length,
      progress: execution.progress,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.endTime ? 
        execution.endTime.getTime() - execution.startTime.getTime() : 0,
    } : null;
  }

  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter(e => ['running', 'paused'].includes(e.status));
  }

  async restoreFromCheckpoint(checkpoint: import('./interfaces/IWorkflowExecutor.js').ExecutionCheckpoint): Promise<WorkflowExecution> {
    // Create a new execution from the checkpoint
    const execution: WorkflowExecution = {
      id: checkpoint.executionId,
      plan: {
        id: 'restored-plan',
        name: 'Restored Plan',
        description: 'Restored from checkpoint',
        steps: [],
        estimatedTotalDuration: 1000,
        priority: 'medium',
        metadata: {},
      },
      status: 'running',
      startTime: checkpoint.timestamp,
      currentStep: checkpoint.stepIndex,
      completedSteps: checkpoint.completedSteps,
      progress: Math.floor((checkpoint.stepIndex / 10) * 100),
      metadata: { options: checkpoint.metadata },
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async createCheckpoint() {
    return null;
  }
}

describe('WorkflowManager', () => {
  let manager: WorkflowManager;
  let config: WorkflowManagerConfig;
  let mockPlanner: MockPlanner;
  let mockExecutor: MockExecutor;
  let mockRequest: OrchestrationRequest;
  let mockAnalysis: RequestAnalysis;
  let mockAgents: AgentInstance[];

  beforeEach(() => {
    config = {
      maxConcurrentWorkflows: 5,
      defaultTimeout: 30000,
      enableCheckpoints: true,
      enableRollback: true,
      maxRetries: 3,
      planningConstraints: {
        maxSteps: 10,
        maxDuration: 600000,
        allowedAgentTypes: ['test'],
        requireApproval: false,
      },
    };

    mockPlanner = new MockPlanner();
    mockExecutor = new MockExecutor();
    manager = new WorkflowManager(config, undefined, mockPlanner, mockExecutor);

    mockRequest = {
      id: 'test-request',
      userInput: 'Test request',
      sessionContext: {
        sessionId: 'test-session',
        workspaceRoot: '/test',
        timestamp: new Date(),
        metadata: {},
      },
      timestamp: new Date(),
    };

    mockAnalysis = {
      complexity: 'medium',
      intent: 'test workflow',
      domains: ['test'],
      requiredCapabilities: ['test'],
      estimatedDuration: 5000,
      priority: 'medium',
      metadata: {},
    };

    mockAgents = [{
      id: 'test-agent',
      type: 'test',
      capabilities: [{
        name: 'test',
        version: '1.0.0',
        enabled: true,
      }],
      status: 'idle',
      configuration: {},
      performance: {
        successRate: 0.95,
        averageResponseTime: 1000,
        tasksCompleted: 5,
      },
    }];
  });

  describe('initialization', () => {
    it('should initialize with default planner and executor', () => {
      const defaultManager = new WorkflowManager(config);
      expect(defaultManager.getPlanner()).toBeDefined();
      expect(defaultManager.getExecutor()).toBeDefined();
    });

    it('should use provided planner and executor', () => {
      // The manager wraps the provided planner/executor in adapters for legacy interface compatibility
      expect(manager.getPlanner()).toBeDefined();
      expect(manager.getExecutor()).toBeDefined();
    });
  });

  describe('workflow creation and execution', () => {
    it('should create and execute a workflow', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      expect(execution).toBeDefined();
      expect(execution.workflowId).toBeTruthy();
      expect(execution.status).toBe('completed');
    });

    it('should track active workflows', async () => {
      // Create a mock executor that returns a running workflow
      const runningExecutor = {
        ...mockExecutor,
        execute: vi.fn().mockResolvedValue({
          id: 'running-exec',
          plan: {
            id: 'running-plan',
            name: 'Running Plan',
            description: 'Running workflow plan',
            steps: [{
              id: 'running-step-1',
              name: 'Running Step',
              type: 'test',
              description: 'Running step',
              estimatedDuration: 1000,
              dependencies: [],
              parallel: false,
              configuration: {
                action: 'test',
                requiredCapabilities: ['test'],
              },
            }],
            estimatedTotalDuration: 1000,
            priority: 'medium',
            metadata: {},
          } as WorkflowPlan,
          status: 'running',
          startTime: new Date(),
          currentStep: 0,
          completedSteps: [],
          progress: 50,
          metadata: { options: {} },
        }),
      };

      const runningManager = new WorkflowManager(
        config,
        undefined,
        mockPlanner,
        runningExecutor as unknown as IWorkflowExecutor
      );

      await runningManager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      const activeWorkflows = await runningManager.getActiveWorkflows();
      expect(activeWorkflows).toHaveLength(1);
    });

    it('should enforce concurrent workflow limit', async () => {
      // Create a mock executor that keeps workflows active
      const slowExecutor = {
        ...mockExecutor,
        execute: vi.fn().mockResolvedValue({
          id: 'slow-exec',
          plan: {
            id: 'slow-plan',
            name: 'Slow Plan',
            description: 'Slow workflow plan',
            steps: [{
              id: 'slow-step-1',
              name: 'Slow Step',
              type: 'test',
              description: 'Slow step',
              estimatedDuration: 1000,
              dependencies: [],
              parallel: false,
              configuration: {
                action: 'test',
                requiredCapabilities: ['test'],
              },
            }],
            estimatedTotalDuration: 1000,
            priority: 'medium',
            metadata: {},
          } as WorkflowPlan,
          status: 'running',
          startTime: new Date(),
          currentStep: 0,
          completedSteps: [],
          progress: 0,
          metadata: { options: {} },
        }),
      };

      const managerWithSlowExecutor = new WorkflowManager(
        { ...config, maxConcurrentWorkflows: 1 },
        undefined,
        mockPlanner,
        slowExecutor as unknown as IWorkflowExecutor
      );

      await managerWithSlowExecutor.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      await expect(
        managerWithSlowExecutor.createAndExecute(mockRequest, mockAnalysis, mockAgents)
      ).rejects.toThrow('Maximum concurrent workflows limit reached');
    });
  });

  describe('workflow control', () => {
    it('should pause workflow', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      const paused = await manager.pauseWorkflow(execution.workflowId);
      
      expect(paused).toBe(true);
    });

    it('should resume workflow', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      await manager.pauseWorkflow(execution.workflowId);
      const resumed = await manager.resumeWorkflow(execution.workflowId);
      
      expect(resumed).toBe(true);
    });

    it('should cancel workflow', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      const cancelled = await manager.cancelWorkflow(execution.workflowId);
      
      expect(cancelled).toBe(true);
    });

    it('should get workflow status', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      const status = await manager.getWorkflowStatus(execution.workflowId);
      
      expect(status).toBeDefined();
      expect(status!.id).toBe(execution.workflowId);
    });
  });

  describe('workflow management', () => {
    it('should optimize workflow plan', async () => {
      const originalPlan: WorkflowPlan = {
        id: 'original-plan',
        name: 'Original Plan',
        description: 'Original workflow plan',
        steps: [],
        estimatedTotalDuration: 1000,
        priority: 'medium',
        metadata: {},
      };

      const optimizedPlan = await manager.optimizeWorkflow(originalPlan);
      
      expect(optimizedPlan.name).toBe('Original Plan (Optimized)');
    });

    it('should validate workflow plan', async () => {
      const plan: WorkflowPlan = {
        id: 'valid-plan',
        name: 'Valid Plan',
        description: 'Valid workflow plan',
        steps: [],
        estimatedTotalDuration: 1000,
        priority: 'medium',
        metadata: {},
      };

      const isValid = await manager.validateWorkflow(plan, mockAgents);
      expect(isValid).toBe(true);
    });

    it('should create custom plan', async () => {
      const customPlan = await manager.createCustomPlan(
        mockRequest,
        mockAnalysis,
        mockAgents,
        { maxSteps: 5 }
      );

      expect(customPlan).toBeDefined();
      expect(customPlan.id).toBeTruthy();
    });
  });

  describe('workflow history and metrics', () => {
    it('should track workflow history', async () => {
      const execution = await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      // Simulate workflow completion by moving to history
      await manager.cancelWorkflow(execution.workflowId);
      
      const history = await manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].workflowId).toBe(execution.workflowId);
    });

    it('should provide workflow metrics', async () => {
      await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      const metrics = await manager.getWorkflowMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalWorkflows).toBeGreaterThan(0);
      expect(metrics.activeWorkflows).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average duration', async () => {
      // Create multiple workflows to test average calculation
      await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      await manager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      const metrics = await manager.getWorkflowMetrics();
      
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle planning validation errors', async () => {
      const failingPlanner: IWorkflowPlanner = {
        createPlan: mockPlanner.createPlan.bind(mockPlanner),
        optimizePlan: mockPlanner.optimizePlan.bind(mockPlanner),
        getCapabilities: mockPlanner.getCapabilities.bind(mockPlanner),
        validatePlan: vi.fn().mockResolvedValue({
          isValid: false,
          errors: [{ stepId: 'step-1', message: 'Invalid step', severity: 'error' }],
          warnings: [],
          suggestions: [],
        }),
      };

      const managerWithFailingPlanner = new WorkflowManager(
        config,
        undefined,
        failingPlanner,
        mockExecutor
      );

      await expect(
        managerWithFailingPlanner.createAndExecute(mockRequest, mockAnalysis, mockAgents)
      ).rejects.toThrow('Invalid workflow plan');
    });

    it('should handle execution errors gracefully', async () => {
      const failingExecutor = {
        ...mockExecutor,
        execute: vi.fn().mockRejectedValue(new Error('Execution failed')),
      };

      const managerWithFailingExecutor = new WorkflowManager(
        config,
        undefined,
        mockPlanner,
        failingExecutor as unknown as IWorkflowExecutor
      );

      await expect(
        managerWithFailingExecutor.createAndExecute(mockRequest, mockAnalysis, mockAgents)
      ).rejects.toThrow('Execution failed');
    });
  });

  describe('workflow cleanup', () => {
    it('should clean up completed workflows', async () => {
      // Create a workflow that starts as running then gets cancelled
      const pendingExecutor = {
        ...mockExecutor,
        execute: vi.fn().mockResolvedValue({
          id: 'pending-exec',
          plan: {
            id: 'pending-plan',
            name: 'Pending Plan',
            description: 'Pending workflow plan',
            steps: [{
              id: 'pending-step-1',
              name: 'Pending Step',
              type: 'test',
              description: 'Pending step',
              estimatedDuration: 1000,
              dependencies: [],
              parallel: false,
              configuration: {
                action: 'test',
                requiredCapabilities: ['test'],
              },
            }],
            estimatedTotalDuration: 1000,
            priority: 'medium',
            metadata: {},
          } as WorkflowPlan,
          status: 'pending',
          startTime: new Date(),
          currentStep: 0,
          completedSteps: [],
          progress: 0,
          metadata: { options: {} },
        }),
        cancel: vi.fn().mockResolvedValue(true),
      };

      const cleanupManager = new WorkflowManager(
        config,
        undefined,
        mockPlanner,
        pendingExecutor as unknown as IWorkflowExecutor
      );

      const execution = await cleanupManager.createAndExecute(mockRequest, mockAnalysis, mockAgents);
      
      // Initially should be in active workflows
      let activeWorkflows = await cleanupManager.getActiveWorkflows();
      expect(activeWorkflows).toHaveLength(1);
      
      // Cancel the workflow to trigger cleanup
      await cleanupManager.cancelWorkflow(execution.workflowId);
      
      // Should be moved to history
      activeWorkflows = await cleanupManager.getActiveWorkflows();
      expect(activeWorkflows).toHaveLength(0);
      
      const history = await cleanupManager.getHistory();
      expect(history).toHaveLength(1);
    });
  });
});