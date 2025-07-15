/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  IWorkflowExecutor, 
  ExecutionContext, 
  ExecutionOptions, 
  ExecutionEvent, 
  StepExecutionResult, 
  ExecutionCheckpoint,
  ExecutionStatus
} from '../interfaces/IWorkflowExecutor.js';
import { WorkflowPlan, WorkflowStep, WorkflowExecution, AgentInstance } from '../../types/common.js';

export class WorkflowExecutor implements IWorkflowExecutor {
  private activeExecutions = new Map<string, WorkflowExecution>();
  private executionContexts = new Map<string, ExecutionContext>();
  private checkpoints = new Map<string, ExecutionCheckpoint[]>();
  private eventCallback?: (event: ExecutionEvent) => void;

  constructor(eventCallback?: (event: ExecutionEvent) => void) {
    this.eventCallback = eventCallback;
  }

  async execute(plan: WorkflowPlan, options: ExecutionOptions): Promise<WorkflowExecution> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize execution
    const execution: WorkflowExecution = {
      id: executionId,
      plan,
      status: 'pending',
      startTime: new Date(),
      currentStep: 0,
      completedSteps: [],
      progress: 0,
      metadata: {
        options,
        retryCount: 0,
      },
    };

    // Create execution context
    const context: ExecutionContext = {
      plan,
      agents: new Map(),
      variables: new Map(),
      metadata: {
        executionId,
        startTime: execution.startTime,
        options,
      },
    };

    // Store execution state
    this.activeExecutions.set(executionId, execution);
    this.executionContexts.set(executionId, context);
    this.checkpoints.set(executionId, []);

    // Start execution
    try {
      await this.executeWorkflow(execution, context, options);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      await this.publishEvent({
        type: 'workflow-cancelled',
        executionId,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }

    return execution;
  }

  async pause(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'paused';
    await this.publishEvent({
      type: 'workflow-paused',
      executionId,
      timestamp: new Date(),
    });

    return true;
  }

  async resume(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'paused') {
      return false;
    }

    execution.status = 'running';
    await this.publishEvent({
      type: 'workflow-resumed',
      executionId,
      timestamp: new Date(),
    });

    // Resume execution from current step
    const context = this.executionContexts.get(executionId);
    if (context) {
      const options = execution.metadata.options as ExecutionOptions;
      await this.continueExecution(execution, context, options);
    }

    return true;
  }

  async cancel(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || ['completed', 'failed', 'cancelled'].includes(execution.status)) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    
    await this.publishEvent({
      type: 'workflow-cancelled',
      executionId,
      timestamp: new Date(),
    });

    return true;
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return null;
    }

    return {
      executionId: execution.id,
      status: execution.status,
      currentStep: execution.currentStep,
      totalSteps: execution.plan.steps.length,
      progress: execution.progress,
      startTime: execution.startTime,
      endTime: execution.endTime,
      duration: execution.endTime ? 
        execution.endTime.getTime() - execution.startTime.getTime() : 
        Date.now() - execution.startTime.getTime(),
      error: execution.error,
      lastCheckpoint: this.getLastCheckpointTime(executionId),
    };
  }

  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.activeExecutions.values())
      .filter(execution => ['pending', 'running', 'paused'].includes(execution.status));
  }

  async restoreFromCheckpoint(checkpoint: ExecutionCheckpoint): Promise<WorkflowExecution> {
    const { executionId, stepIndex, completedSteps, variables } = checkpoint;
    
    // Find the original execution or create a new one
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    // Restore execution state
    execution.currentStep = stepIndex;
    execution.completedSteps = completedSteps;
    execution.progress = (stepIndex / execution.plan.steps.length) * 100;
    execution.status = 'running';

    // Restore context
    const context = this.executionContexts.get(executionId);
    if (context) {
      context.variables = variables;
      context.metadata = {
        ...context.metadata,
        restoredFrom: checkpoint.timestamp,
      };
    }

    return execution;
  }

  async createCheckpoint(executionId: string): Promise<ExecutionCheckpoint | null> {
    const execution = this.activeExecutions.get(executionId);
    const context = this.executionContexts.get(executionId);
    
    if (!execution || !context) {
      return null;
    }

    const checkpoint: ExecutionCheckpoint = {
      executionId,
      stepIndex: execution.currentStep,
      completedSteps: [...execution.completedSteps],
      variables: new Map(context.variables),
      timestamp: new Date(),
      metadata: {
        ...context.metadata,
        checkpointReason: 'manual',
      },
    };

    // Store checkpoint
    const checkpointList = this.checkpoints.get(executionId) || [];
    checkpointList.push(checkpoint);
    this.checkpoints.set(executionId, checkpointList);

    return checkpoint;
  }

  private async executeWorkflow(
    execution: WorkflowExecution,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<void> {
    execution.status = 'running';
    
    const steps = execution.plan.steps;
    const parallelGroups = this.organizeParallelGroups(steps);

    for (const group of parallelGroups) {
      if (execution.status !== 'running') {
        break; // Execution was paused or cancelled
      }

      if (group.parallel) {
        await this.executeParallelSteps(group.steps, execution, context, options);
      } else {
        for (const step of group.steps) {
          if (execution.status !== 'running') {
            break;
          }
          
          await this.executeStep(step, execution, context, options);
          
          // Create checkpoint if enabled
          if (options.enableCheckpoints) {
            await this.createCheckpoint(execution.id);
          }
        }
      }
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress = 100;
    }
  }

  private async continueExecution(
    execution: WorkflowExecution,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<void> {
    const remainingSteps = execution.plan.steps.slice(execution.currentStep);
    
    for (const step of remainingSteps) {
      if (execution.status !== 'running') {
        break;
      }
      
      await this.executeStep(step, execution, context, options);
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress = 100;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<void> {
    const stepStartTime = Date.now();
    
    await this.publishEvent({
      type: 'step-started',
      executionId: execution.id,
      stepId: step.id,
      timestamp: new Date(),
      data: { step: step.name },
    });

    try {
      // Check dependencies
      if (!this.areDependenciesMet(step, execution)) {
        throw new Error(`Dependencies not met for step ${step.id}`);
      }

      // Find and assign agent
      const agent = await this.findAgentForStep(step, context);
      if (!agent) {
        throw new Error(`No suitable agent found for step ${step.id}`);
      }

      context.agents.set(step.id, agent);

      // Execute step with timeout
      const stepTimeout = options.timeout || 300000; // 5 minutes default
      const result = await this.executeStepWithTimeout(step, agent, context, stepTimeout);

      // Store result
      const stepResult: StepExecutionResult = {
        stepId: step.id,
        status: 'completed',
        output: result,
        duration: Date.now() - stepStartTime,
        agentUsed: agent.id,
        metadata: {
          startTime: stepStartTime,
          endTime: Date.now(),
        },
      };

      execution.completedSteps.push(stepResult);
      execution.currentStep++;
      execution.progress = (execution.currentStep / execution.plan.steps.length) * 100;

      // Store step output in context variables
      if (result) {
        context.variables.set(`step_${step.id}_output`, result);
      }

      await this.publishEvent({
        type: 'step-completed',
        executionId: execution.id,
        stepId: step.id,
        timestamp: new Date(),
        data: { result: stepResult },
      });

    } catch (error) {
      const stepResult: StepExecutionResult = {
        stepId: step.id,
        status: 'failed',
        error: error instanceof Error ? error : new Error('Unknown error'),
        duration: Date.now() - stepStartTime,
        metadata: {
          startTime: stepStartTime,
          endTime: Date.now(),
        },
      };

      execution.completedSteps.push(stepResult);

      // Handle step failure
      if (options.maxRetries > 0 && (execution.metadata.retryCount || 0) < options.maxRetries) {
        execution.metadata.retryCount = (execution.metadata.retryCount || 0) + 1;
        
        // Retry step
        await this.executeStep(step, execution, context, options);
        return;
      }

      await this.publishEvent({
        type: 'step-failed',
        executionId: execution.id,
        stepId: step.id,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error('Unknown error'),
      });

      throw error;
    }
  }

  private async executeParallelSteps(
    steps: WorkflowStep[],
    execution: WorkflowExecution,
    context: ExecutionContext,
    options: ExecutionOptions
  ): Promise<void> {
    const promises = steps.map(step => 
      this.executeStep(step, execution, context, options)
    );

    await Promise.all(promises);
  }

  private async executeStepWithTimeout(
    step: WorkflowStep,
    agent: AgentInstance,
    _context: ExecutionContext,
    timeout: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step ${step.id} timed out after ${timeout}ms`));
      }, timeout);

      // Simulate step execution
      this.simulateStepExecution(step, agent, _context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async simulateStepExecution(
    step: WorkflowStep,
    agent: AgentInstance,
    _context: ExecutionContext
  ): Promise<unknown> {
    // This is a simulation - in a real implementation, this would
    // dispatch the step to the actual agent for execution
    
    const action = step.configuration.action;
    const parameters = step.configuration.parameters || {};
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    switch (action) {
      case 'analyze':
        return {
          type: 'analysis',
          result: `Analysis completed for: ${parameters.input}`,
          agent: agent.id,
          timestamp: new Date(),
        };
      
      case 'generate':
        return {
          type: 'generation',
          result: `Generated ${parameters.type}: ${step.description}`,
          agent: agent.id,
          timestamp: new Date(),
        };
      
      case 'test':
        return {
          type: 'testing',
          result: `Tests created for step: ${step.id}`,
          testsCount: Math.floor(Math.random() * 10) + 1,
          agent: agent.id,
          timestamp: new Date(),
        };
      
      case 'plan':
        return {
          type: 'planning',
          result: `Plan created for: ${step.description}`,
          steps: Math.floor(Math.random() * 5) + 1,
          agent: agent.id,
          timestamp: new Date(),
        };
      
      default:
        return {
          type: 'general',
          result: `Step ${step.id} completed`,
          agent: agent.id,
          timestamp: new Date(),
        };
    }
  }

  private organizeParallelGroups(steps: WorkflowStep[]): Array<{ parallel: boolean; steps: WorkflowStep[] }> {
    const groups: Array<{ parallel: boolean; steps: WorkflowStep[] }> = [];
    let currentGroup: WorkflowStep[] = [];
    let isParallel = false;

    for (const step of steps) {
      if (step.parallel !== isParallel) {
        // Group changed
        if (currentGroup.length > 0) {
          groups.push({ parallel: isParallel, steps: currentGroup });
        }
        currentGroup = [step];
        isParallel = step.parallel;
      } else {
        currentGroup.push(step);
      }
    }

    if (currentGroup.length > 0) {
      groups.push({ parallel: isParallel, steps: currentGroup });
    }

    return groups;
  }

  private areDependenciesMet(step: WorkflowStep, execution: WorkflowExecution): boolean {
    const completedStepIds = execution.completedSteps
      .filter(result => result.status === 'completed')
      .map(result => result.stepId);

    return step.dependencies.every(depId => completedStepIds.includes(depId));
  }

  private async findAgentForStep(step: WorkflowStep, context: ExecutionContext): Promise<AgentInstance | null> {
    const requiredCapabilities = step.configuration.requiredCapabilities || [];
    
    // For now, create a mock agent that matches the requirements
    // In a real implementation, this would query the agent registry
    const mockAgent: AgentInstance = {
      id: `agent-${step.id}`,
      type: this.inferAgentType(requiredCapabilities),
      capabilities: requiredCapabilities.map(cap => ({
        name: cap,
        version: '1.0.0',
        enabled: true,
      })),
      status: 'idle',
      configuration: {},
      performance: {
        successRate: 0.95,
        averageResponseTime: 2000,
        tasksCompleted: 10,
      },
    };

    return mockAgent;
  }

  private inferAgentType(capabilities: string[]): string {
    if (capabilities.includes('code-assistance')) return 'gemini';
    if (capabilities.includes('project-management')) return 'task-master';
    if (capabilities.includes('analysis')) return 'analysis';
    return 'general';
  }

  private getLastCheckpointTime(executionId: string): Date | undefined {
    const checkpoints = this.checkpoints.get(executionId);
    if (!checkpoints || checkpoints.length === 0) {
      return undefined;
    }
    
    return checkpoints[checkpoints.length - 1].timestamp;
  }

  private async publishEvent(event: ExecutionEvent): Promise<void> {
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }
}