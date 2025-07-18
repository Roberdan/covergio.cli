/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import { WorkflowCoordinator } from '../../src/universal/workflow/WorkflowCoordinator';
import { AgentFactory } from '../../src/universal/agent/AgentFactory';
import { DomainRegistry } from '../../src/universal/domain/DomainRegistry';
import { ContextEngine } from '../../src/universal/context/ContextEngine';
import { AnalysisEngine } from '../../src/universal/analysis/AnalysisEngine';
import { TaskMaster } from '../../src/universal/agents/TaskMaster';
import { BaseAgent } from '../../src/universal/agent/BaseAgent';
import { AgentCapability, AgentRole } from '../../src/universal/types/agent';

describe('End-to-End Workflow Execution', () => {
  let workflowCoordinator: WorkflowCoordinator;
  let agentFactory: AgentFactory;
  let domainRegistry: DomainRegistry;
  let contextEngine: ContextEngine;
  let analysisEngine: AnalysisEngine;
  let taskMaster: TaskMaster;

  // Mock agent implementation for testing
  class TestAgent extends BaseAgent {
    async executeTask(task: string, context: Record<string, any> = {}): Promise<any> {
      // Simple echo agent for testing
      return { result: `Processed: ${task}`, context };
    }
  }

  beforeAll(async () => {
    // Initialize all services
    contextEngine = ContextEngine.getInstance();
    agentFactory = AgentFactory.getInstance();
    domainRegistry = DomainRegistry.getInstance();
    analysisEngine = AnalysisEngine.getInstance();
    taskMaster = new TaskMaster({});

    // Register test domains and agents
    domainRegistry.registerDomain({
      id: 'testing',
      name: 'Testing',
      description: 'Testing domain',
      dependencies: [],
    });

    domainRegistry.registerAgentTemplate({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent for E2E testing',
      domain: 'testing',
      capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.CODE_ANALYSIS],
      role: AgentRole.DEVELOPER,
      createInstance: () => new TestAgent('test-agent', 'Test Agent'),
    });

    // Create workflow coordinator
    workflowCoordinator = new WorkflowCoordinator({
      contextEngine,
      taskMaster,
      analysisEngine,
      maxParallelSteps: 3,
      autoStart: true,
    });
  });

  afterAll(async () => {
    // Clean up any resources
    await workflowCoordinator.cleanup();
  });

  it('should execute a simple workflow with multiple steps', async () => {
    // Define a simple workflow
    const workflow = {
      id: 'test-workflow-e2e',
      name: 'E2E Test Workflow',
      description: 'A simple workflow for end-to-end testing',
      version: '1.0.0',
      steps: [
        {
          id: 'step1',
          name: 'First Step',
          description: 'First step in the workflow',
          task: 'Generate test data',
          requiredDomains: ['testing'],
        },
        {
          id: 'step2',
          name: 'Second Step',
          description: 'Second step that depends on the first',
          task: 'Process the generated data',
          dependsOn: ['step1'],
          requiredDomains: ['testing'],
        },
        {
          id: 'step3',
          name: 'Parallel Step',
          description: 'This can run in parallel with step2',
          task: 'Perform parallel processing',
          dependsOn: ['step1'],
          requiredDomains: ['testing'],
        },
      ],
    };

    // Start the workflow execution
    const execution = await workflowCoordinator.createExecution(workflow);
    
    // Wait for the workflow to complete (in a real test, you might poll or use events)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the final execution status
    const finalExecution = workflowCoordinator.getExecution(execution.id);
    
    // Verify the workflow completed successfully
    expect(finalExecution).toBeDefined();
    expect(finalExecution?.status).toBe('completed');
    expect(finalExecution?.progress).toBe(100);
    
    // Verify all steps were executed
    const steps = Object.values(finalExecution?.results || {});
    expect(steps).toHaveLength(3);
    expect(steps.every(step => step.status === 'completed')).toBe(true);
    
    // Verify step dependencies were respected
    const step1End = steps.find(s => s.stepId === 'step1')?.endTime?.getTime() || 0;
    const step2Start = steps.find(s => s.stepId === 'step2')?.startTime?.getTime() || 0;
    const step3Start = steps.find(s => s.stepId === 'step3')?.startTime?.getTime() || 0;
    
    expect(step2Start).toBeGreaterThanOrEqual(step1End);
    expect(step3Start).toBeGreaterThanOrEqual(step1End);
  });

  it('should handle workflow with failing steps and retries', async () => {
    // Mock the agent to fail on the first attempt
    let attemptCount = 0;
    
    class FailingTestAgent extends BaseAgent {
      async executeTask(task: string): Promise<any> {
        attemptCount++;
        if (attemptCount <= 1) {
          throw new Error('Simulated failure on first attempt');
        }
        return { result: `Processed after retry: ${task}` };
      }
    }

    // Register the failing agent
    domainRegistry.registerAgentTemplate({
      id: 'failing-agent',
      name: 'Failing Test Agent',
      description: 'Agent that fails on first attempt',
      domain: 'testing',
      capabilities: [AgentCapability.TESTING],
      role: AgentRole.TESTER,
      createInstance: () => new FailingTestAgent('failing-agent', 'Failing Test Agent'),
    });

    // Define a workflow with retry logic
    const workflow = {
      id: 'failing-workflow-e2e',
      name: 'Failing Workflow E2E',
      description: 'Workflow that tests retry logic',
      version: '1.0.0',
      defaultRetries: 2,
      defaultRetryDelay: 100, // Shorter delay for testing
      steps: [
        {
          id: 'failing-step',
          name: 'Failing Step',
          description: 'Step that will fail on first attempt',
          task: 'Fail and retry',
          requiredDomains: ['testing'],
          requiredAgent: 'failing-agent',
          retries: 3, // Override default
        },
      ],
    };

    // Reset attempt counter
    attemptCount = 0;
    
    // Start the workflow execution
    const execution = await workflowCoordinator.createExecution(workflow);
    
    // Wait for the workflow to complete (with enough time for retries)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the final execution status
    const finalExecution = workflowCoordinator.getExecution(execution.id);
    
    // Verify the workflow completed successfully after retry
    expect(finalExecution).toBeDefined();
    expect(finalExecution?.status).toBe('completed');
    
    // Verify the step was retried
    const step = finalExecution?.results['failing-step'];
    expect(step).toBeDefined();
    expect(step.status).toBe('completed');
    expect(step.attempts).toBe(2); // 1 failure + 1 success
  });

  it('should handle parallel step execution', async () => {
    // Track execution order
    const executionOrder: string[] = [];
    
    class TrackingAgent extends BaseAgent {
      async executeTask(task: string): Promise<any> {
        executionOrder.push(task);
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: `Processed: ${task}` };
      }
    }

    // Register the tracking agent
    domainRegistry.registerAgentTemplate({
      id: 'tracking-agent',
      name: 'Tracking Agent',
      description: 'Agent that tracks execution order',
      domain: 'testing',
      capabilities: [AgentCapability.MONITORING],
      role: AgentRole.ARCHITECT,
      createInstance: () => new TrackingAgent('tracking-agent', 'Tracking Agent'),
    });

    // Define a workflow with parallel steps
    const workflow = {
      id: 'parallel-workflow-e2e',
      name: 'Parallel Workflow E2E',
      description: 'Workflow that tests parallel step execution',
      version: '1.0.0',
      steps: [
        {
          id: 'parallel-1',
          name: 'Parallel Task 1',
          description: 'First parallel task',
          task: 'task-1',
          requiredDomains: ['testing'],
          requiredAgent: 'tracking-agent',
        },
        {
          id: 'parallel-2',
          name: 'Parallel Task 2',
          description: 'Second parallel task',
          task: 'task-2',
          requiredDomains: ['testing'],
          requiredAgent: 'tracking-agent',
        },
        {
          id: 'final-step',
          name: 'Final Step',
          description: 'Step that depends on parallel tasks',
          task: 'final-task',
          dependsOn: ['parallel-1', 'parallel-2'],
          requiredDomains: ['testing'],
          requiredAgent: 'tracking-agent',
        },
      ],
    };

    // Reset execution order
    executionOrder.length = 0;
    
    // Start the workflow execution
    const execution = await workflowCoordinator.createExecution(workflow);
    
    // Wait for the workflow to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the final execution status
    const finalExecution = workflowCoordinator.getExecution(execution.id);
    
    // Verify the workflow completed successfully
    expect(finalExecution).toBeDefined();
    expect(finalExecution?.status).toBe('completed');
    
    // Verify parallel steps executed in parallel (order not guaranteed between them)
    expect(executionOrder).toContain('task-1');
    expect(executionOrder).toContain('task-2');
    
    // Final step should be last
    expect(executionOrder[executionOrder.length - 1]).toBe('final-task');
    
    // Verify step dependencies were respected
    const parallel1End = finalExecution?.results['parallel-1']?.endTime?.getTime() || 0;
    const parallel2End = finalExecution?.results['parallel-2']?.endTime?.getTime() || 0;
    const finalStepStart = finalExecution?.results['final-step']?.startTime?.getTime() || 0;
    
    expect(finalStepStart).toBeGreaterThanOrEqual(parallel1End);
    expect(finalStepStart).toBeGreaterThanOrEqual(parallel2End);
  });
});
