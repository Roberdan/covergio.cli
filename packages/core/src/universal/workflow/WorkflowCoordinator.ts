/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ContextEngine } from '../context/ContextEngine';
import { TaskMaster } from '../agents/TaskMaster';
import { AnalysisEngine } from '../analysis/AnalysisEngine';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  task: string;
  dependsOn?: string[];
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  requiredDomains?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  defaultTimeout?: number;
  defaultRetries?: number;
  defaultRetryDelay?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep?: string;
  progress: number; // 0-100
  results: Record<string, WorkflowStepResult>;
  contextId?: string;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface WorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  duration?: number; // ms
  attempts: number;
  error?: string;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface WorkflowCoordinatorOptions {
  contextEngine?: ContextEngine;
  taskMaster?: TaskMaster;
  analysisEngine?: AnalysisEngine;
  maxParallelSteps?: number;
  autoStart?: boolean;
}

export class WorkflowCoordinator extends EventEmitter {
  private contextEngine: ContextEngine;
  private taskMaster: TaskMaster;
  private analysisEngine: AnalysisEngine;
  private maxParallelSteps: number;
  private executions: Map<string, WorkflowExecution> = new Map();
  private activeExecutions: Set<string> = new Set();
  private executionQueue: string[] = [];
  private isProcessingQueue: boolean = false;

  constructor(options: WorkflowCoordinatorOptions = {}) {
    super();
    
    this.contextEngine = options.contextEngine || ContextEngine.getInstance();
    this.taskMaster = options.taskMaster || new TaskMaster({});
    this.analysisEngine = options.analysisEngine || AnalysisEngine.getInstance();
    this.maxParallelSteps = options.maxParallelSteps || 5;
    
    if (options.autoStart !== false) {
      this.startQueueProcessor();
    }
  }

  /**
   * Create a new workflow execution
   */
  async createExecution(
    workflow: WorkflowDefinition,
    contextId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    // Create a new context if none provided
    if (!contextId) {
      const context = await this.contextEngine.createContext(
        'workflow',
        { workflow: { id: workflow.id, name: workflow.name } },
        ['workflow', 'execution']
      );
      contextId = context.id;
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId: workflow.id,
      status: 'pending',
      startTime: new Date(),
      progress: 0,
      results: {},
      contextId,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
      },
    };

    // Initialize step results
    for (const step of workflow.steps) {
      execution.results[step.id] = {
        stepId: step.id,
        status: 'pending',
        attempts: 0,
      };
    }

    // Store the execution
    this.executions.set(execution.id, execution);
    this.emit('execution:created', { executionId: execution.id, workflow });

    // Queue the execution
    this.queueExecution(execution.id);

    return execution;
  }

  /**
   * Queue an execution for processing
   */
  private queueExecution(executionId: string): void {
    if (!this.executionQueue.includes(executionId)) {
      this.executionQueue.push(executionId);
      this.emit('execution:queued', { executionId });
      this.processQueue().catch(error => {
        console.error('Error processing workflow queue:', error);
        this.emit('error', { error, context: 'processQueue' });
      });
    }
  }

  /**
   * Start the queue processor if not already running
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.activeExecutions.size >= this.maxParallelSteps) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.executionQueue.length > 0 && this.activeExecutions.size < this.maxParallelSteps) {
        const executionId = this.executionQueue.shift();
        if (!executionId) continue;

        const execution = this.executions.get(executionId);
        if (!execution) continue;

        // Skip if already running or completed
        if (execution.status !== 'pending' && execution.status !== 'paused') {
          continue;
        }

        // Mark as running
        execution.status = 'running';
        this.activeExecutions.add(executionId);
        this.emit('execution:started', { executionId });

        // Start execution in the background
        this.executeWorkflow(executionId).catch(error => {
          console.error(`Error executing workflow ${executionId}:`, error);
          this.emit('error', { 
            error, 
            executionId,
            context: 'executeWorkflow' 
          });
          
          // Update execution status
          const exec = this.executions.get(executionId);
          if (exec) {
            exec.status = 'failed';
            exec.endTime = new Date();
            exec.error = error.message;
            this.emit('execution:failed', { 
              executionId, 
              error: error.message 
            });
          }
          
          this.activeExecutions.delete(executionId);
        });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a workflow
   */
  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    try {
      // Get workflow definition (in a real implementation, this would be loaded from storage)
      const workflow = await this.getWorkflowDefinition(execution.workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${execution.workflowId}`);
      }

      // Process steps in dependency order
      const processedSteps = new Set<string>();
      let hasMoreSteps = true;

      while (hasMoreSteps) {
        const nextSteps = this.getRunnableSteps(workflow, execution.results, processedSteps);
        
        if (nextSteps.length === 0) {
          // No more runnable steps
          if (processedSteps.size === workflow.steps.length) {
            // All steps completed
            execution.status = 'completed';
            execution.endTime = new Date();
            execution.progress = 100;
            this.emit('execution:completed', { executionId });
          } else if (Object.values(execution.results).some(r => r.status === 'failed')) {
            // Some step failed
            execution.status = 'failed';
            execution.endTime = new Date();
            this.emit('execution:failed', { 
              executionId, 
              error: 'One or more steps failed' 
            });
          } else {
            // Deadlock or invalid workflow
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.error = 'Workflow deadlock detected';
            this.emit('execution:failed', { 
              executionId, 
              error: 'Workflow deadlock detected' 
            });
          }
          break;
        }

        // Execute steps in parallel
        await Promise.all(
          nextSteps.map(step => this.executeStep(execution, workflow, step))
        );

        // Update progress
        execution.progress = Math.floor(
          (processedSteps.size / workflow.steps.length) * 100
        );
        this.emit('execution:progress', { 
          executionId, 
          progress: execution.progress 
        });
      }
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : String(error);
      this.emit('execution:failed', { 
        executionId, 
        error: execution.error 
      });
      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
      // Continue processing the queue
      this.processQueue().catch(error => {
        console.error('Error continuing queue processing:', error);
        this.emit('error', { 
          error, 
          context: 'continueQueueProcessing' 
        });
      });
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition,
    step: WorkflowStep
  ): Promise<void> {
    const stepResult = execution.results[step.id];
    if (!stepResult) {
      throw new Error(`Step result not found: ${step.id}`);
    }

    // Skip if already completed or failed
    if (stepResult.status === 'completed' || stepResult.status === 'failed') {
      return;
    }

    // Update step status
    stepResult.status = 'running';
    stepResult.attempts++;
    stepResult.startTime = new Date();
    
    this.emit('step:started', { 
      executionId: execution.id, 
      stepId: step.id 
    });

    try {
      // Get step dependencies
      const dependencies = step.dependsOn?.reduce((acc, depId) => {
        const depResult = execution.results[depId];
        if (depResult?.output) {
          acc[depId] = depResult.output;
        }
        return acc;
      }, {} as Record<string, unknown>) || {};

      // Get context
      const context = execution.contextId 
        ? await this.contextEngine.getContext(execution.contextId) 
        : null;

      // Prepare task input
      const taskInput = {
        workflowId: workflow.id,
        executionId: execution.id,
        stepId: step.id,
        task: step.task,
        dependencies,
        context: context?.data,
        metadata: {
          ...execution.metadata,
          workflow: {
            id: workflow.id,
            name: workflow.name,
            version: workflow.version,
          },
          step: {
            id: step.id,
            name: step.name,
            description: step.description,
            metadata: step.metadata,
          },
        },
      };

      // Execute the task
      const taskResult = await this.taskMaster.execute({
        id: step.id,
        description: step.description,
        priority: 'medium',
        requiredDomains: step.requiredDomains || [],
        context: taskInput,
      });

      // Update step result
      stepResult.status = 'completed';
      stepResult.output = taskResult.output;
      stepResult.endTime = new Date();
      stepResult.duration = stepResult.endTime.getTime() - stepResult.startTime!.getTime();
      
      this.emit('step:completed', { 
        executionId: execution.id, 
        stepId: step.id,
        result: stepResult,
      });

    } catch (error) {
      // Handle step failure
      stepResult.status = 'failed';
      stepResult.endTime = new Date();
      stepResult.duration = stepResult.endTime.getTime() - stepResult.startTime!.getTime();
      stepResult.error = error instanceof Error ? error.message : String(error);
      
      this.emit('step:failed', { 
        executionId: execution.id, 
        stepId: step.id,
        error: stepResult.error,
        result: stepResult,
      });

      // Check if we should retry
      const maxRetries = step.retries ?? workflow.defaultRetries ?? 0;
      if (stepResult.attempts <= maxRetries) {
        const retryDelay = step.retryDelay ?? workflow.defaultRetryDelay ?? 1000;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.executeStep(execution, workflow, step);
      }
      
      throw error;
    }
  }

  /**
   * Get runnable steps (steps whose dependencies are satisfied)
   */
  private getRunnableSteps(
    workflow: WorkflowDefinition,
    results: Record<string, WorkflowStepResult>,
    processedSteps: Set<string>
  ): WorkflowStep[] {
    return workflow.steps.filter(step => {
      // Skip already processed steps
      if (processedSteps.has(step.id)) {
        return false;
      }

      // Check if all dependencies are satisfied
      const dependenciesSatisfied = !step.dependsOn || step.dependsOn.every(depId => {
        const depResult = results[depId];
        return depResult?.status === 'completed';
      });

      return dependenciesSatisfied;
    });
  }

  /**
   * Get workflow definition (stub - would be implemented to load from storage)
   */
  private async getWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
    // In a real implementation, this would load the workflow definition from storage
    // For now, we'll return a simple workflow for testing
    if (workflowId === 'test-workflow') {
      return {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'A simple test workflow',
        version: '1.0.0',
        defaultRetries: 2,
        defaultRetryDelay: 1000,
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            description: 'First step of the workflow',
            task: 'echo "Hello, World!"',
          },
          {
            id: 'step2',
            name: 'Second Step',
            description: 'Second step that depends on the first',
            task: 'process-data',
            dependsOn: ['step1'],
          },
        ],
      };
    }
    
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  /**
   * Start the queue processor
   */
  public startQueueProcessor(): void {
    if (!this.isProcessingQueue) {
      this.processQueue().catch(error => {
        console.error('Error in queue processor:', error);
        this.emit('error', { error, context: 'queueProcessor' });
      });
    }
  }

  /**
   * Stop the queue processor
   */
  public stopQueueProcessor(): void {
    this.isProcessingQueue = false;
  }

  /**
   * Get execution status
   */
  public getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Cancel a running execution
   */
  public cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    if (execution.status === 'running' || execution.status === 'paused') {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.emit('execution:cancelled', { executionId });
      return true;
    }

    return false;
  }

  /**
   * Pause a running execution
   */
  public pauseExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return false;

    execution.status = 'paused';
    this.emit('execution:paused', { executionId });
    return true;
  }

  /**
   * Resume a paused execution
   */
  public resumeExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'paused') return false;

    execution.status = 'pending';
    this.queueExecution(executionId);
    this.emit('execution:resumed', { executionId });
    return true;
  }

  /**
   * Clean up completed executions older than the specified age
   */
  public cleanupOldExecutions(maxAgeMs: number): number {
    const cutoff = new Date(Date.now() - maxAgeMs);
    let count = 0;

    for (const [id, execution] of this.executions.entries()) {
      if (
        (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') &&
        execution.endTime &&
        execution.endTime < cutoff
      ) {
        this.executions.delete(id);
        count++;
      }
    }

    return count;
  }
}

// Export types
export type {
  WorkflowStep,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStepResult,
  WorkflowCoordinatorOptions,
};
