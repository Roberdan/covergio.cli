/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWorkflowManager } from '../interfaces/IWorkflowManager.js';
import { IWorkflowPlanner, PlanningContext, PlanningConstraints } from './interfaces/IWorkflowPlanner.js';
import { IWorkflowExecutor, ExecutionOptions } from './interfaces/IWorkflowExecutor.js';
import { SmartWorkflowPlanner } from './planners/SmartWorkflowPlanner.js';
import { WorkflowExecutor } from './executors/WorkflowExecutor.js';
import { WorkflowPlan, WorkflowExecution, AgentInstance } from '../types/common.js';
import { RequestAnalysis } from '../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../interfaces/IOrchestrator.js';
import { ExecutionEvent } from './interfaces/IWorkflowExecutor.js';

export interface WorkflowManagerConfig {
  maxConcurrentWorkflows: number;
  defaultTimeout: number;
  enableCheckpoints: boolean;
  enableRollback: boolean;
  maxRetries: number;
  planningConstraints: PlanningConstraints;
}

export class WorkflowManager implements IWorkflowManager {
  private planner: IWorkflowPlanner;
  private executor: IWorkflowExecutor;
  private config: WorkflowManagerConfig;
  private activeWorkflows = new Map<string, WorkflowExecution>();
  private workflowHistory: WorkflowExecution[] = [];

  constructor(
    config: WorkflowManagerConfig,
    eventCallback?: (event: ExecutionEvent) => void,
    planner?: IWorkflowPlanner,
    executor?: IWorkflowExecutor
  ) {
    this.config = config;
    this.planner = planner || new SmartWorkflowPlanner();
    this.executor = executor || new WorkflowExecutor(eventCallback);
  }

  getPlanner(): IWorkflowPlanner {
    return this.planner;
  }

  getExecutor(): IWorkflowExecutor {
    return this.executor;
  }

  async createAndExecute(
    request: OrchestrationRequest,
    analysis: RequestAnalysis,
    availableAgents: AgentInstance[]
  ): Promise<WorkflowExecution> {
    // Check concurrent workflow limit
    if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows limit reached');
    }

    // Create planning context
    const planningContext: PlanningContext = {
      request,
      analysis,
      availableAgents,
      constraints: this.config.planningConstraints,
    };

    // Generate workflow plan
    const planningResult = await this.planner.createPlan(planningContext);
    
    // Validate the plan
    const validationResult = await this.planner.validatePlan(planningResult.plan, availableAgents);
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors
        .filter(e => e.severity === 'error')
        .map(e => e.message);
      throw new Error(`Invalid workflow plan: ${errorMessages.join(', ')}`);
    }

    // Prepare execution options
    const executionOptions: ExecutionOptions = {
      timeout: this.config.defaultTimeout,
      enableCheckpoints: this.config.enableCheckpoints,
      enableRollback: this.config.enableRollback,
      maxRetries: this.config.maxRetries,
      notificationCallback: this.handleExecutionEvent.bind(this),
    };

    // Execute the workflow
    const execution = await this.executor.execute(planningResult.plan, executionOptions);
    
    // Track active workflow if not already completed
    if (!['completed', 'failed', 'cancelled'].includes(execution.status)) {
      this.activeWorkflows.set(execution.id, execution);
    } else {
      // Move completed workflow directly to history
      this.moveToHistory(execution);
    }

    // Clean up completed workflows
    this.cleanupCompletedWorkflows();

    return execution;
  }

  async getActiveWorkflows(): Promise<WorkflowExecution[]> {
    return Array.from(this.activeWorkflows.values());
  }

  async getHistory(): Promise<WorkflowExecution[]> {
    return [...this.workflowHistory];
  }

  async pauseWorkflow(executionId: string): Promise<boolean> {
    return await this.executor.pause(executionId);
  }

  async resumeWorkflow(executionId: string): Promise<boolean> {
    return await this.executor.resume(executionId);
  }

  async cancelWorkflow(executionId: string): Promise<boolean> {
    const result = await this.executor.cancel(executionId);
    
    if (result) {
      const execution = this.activeWorkflows.get(executionId);
      if (execution) {
        this.moveToHistory(execution);
        this.activeWorkflows.delete(executionId);
      }
    }
    
    return result;
  }

  async getWorkflowStatus(executionId: string): Promise<WorkflowExecution | null> {
    // Check active workflows first
    const activeWorkflow = this.activeWorkflows.get(executionId);
    if (activeWorkflow) {
      return activeWorkflow;
    }

    // Check history
    const historicalWorkflow = this.workflowHistory.find(w => w.id === executionId);
    return historicalWorkflow || null;
  }

  async optimizeWorkflow(plan: WorkflowPlan, constraints?: Partial<PlanningConstraints>): Promise<WorkflowPlan> {
    const optimizationConstraints = {
      ...this.config.planningConstraints,
      ...constraints,
    };

    return await this.planner.optimizePlan(plan, optimizationConstraints);
  }

  async validateWorkflow(plan: WorkflowPlan, availableAgents: AgentInstance[]): Promise<boolean> {
    const validationResult = await this.planner.validatePlan(plan, availableAgents);
    return validationResult.isValid;
  }

  async createCustomPlan(
    request: OrchestrationRequest,
    analysis: RequestAnalysis,
    availableAgents: AgentInstance[],
    customConstraints?: Partial<PlanningConstraints>
  ): Promise<WorkflowPlan> {
    const planningContext: PlanningContext = {
      request,
      analysis,
      availableAgents,
      constraints: {
        ...this.config.planningConstraints,
        ...customConstraints,
      },
    };

    const planningResult = await this.planner.createPlan(planningContext);
    return planningResult.plan;
  }

  async getWorkflowMetrics(): Promise<WorkflowMetrics> {
    const activeCount = this.activeWorkflows.size;
    const totalCount = activeCount + this.workflowHistory.length;
    
    const completed = this.workflowHistory.filter(w => w.status === 'completed').length;
    const failed = this.workflowHistory.filter(w => w.status === 'failed').length;
    const cancelled = this.workflowHistory.filter(w => w.status === 'cancelled').length;

    const avgDuration = this.calculateAverageDuration();
    const successRate = totalCount > 0 ? completed / totalCount : 0;

    return {
      totalWorkflows: totalCount,
      activeWorkflows: activeCount,
      completedWorkflows: completed,
      failedWorkflows: failed,
      cancelledWorkflows: cancelled,
      successRate,
      averageDuration: avgDuration,
      queuedWorkflows: 0, // TODO: Implement workflow queue
    };
  }

  private handleExecutionEvent(event: ExecutionEvent): void {
    // Handle workflow execution events
    if (event.type === 'workflow-cancelled' || 
        (event.type === 'step-completed' && this.isWorkflowComplete(event.executionId))) {
      
      const execution = this.activeWorkflows.get(event.executionId);
      if (execution) {
        this.moveToHistory(execution);
        this.activeWorkflows.delete(event.executionId);
      }
    }
  }

  private isWorkflowComplete(executionId: string): boolean {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) return false;

    return ['completed', 'failed', 'cancelled'].includes(execution.status);
  }

  private moveToHistory(execution: WorkflowExecution): void {
    this.workflowHistory.push(execution);
    
    // Limit history size to prevent memory issues
    const maxHistorySize = 1000;
    if (this.workflowHistory.length > maxHistorySize) {
      this.workflowHistory = this.workflowHistory.slice(-maxHistorySize);
    }
  }

  private cleanupCompletedWorkflows(): void {
    const completedWorkflows: string[] = [];
    
    for (const [id, execution] of this.activeWorkflows.entries()) {
      if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
        this.moveToHistory(execution);
        completedWorkflows.push(id);
      }
    }

    completedWorkflows.forEach(id => this.activeWorkflows.delete(id));
  }

  private calculateAverageDuration(): number {
    const completedWorkflows = this.workflowHistory.filter(w => 
      w.status === 'completed' && w.endTime
    );

    if (completedWorkflows.length === 0) return 0;

    const totalDuration = completedWorkflows.reduce((sum, workflow) => {
      const duration = workflow.endTime!.getTime() - workflow.startTime.getTime();
      return sum + duration;
    }, 0);

    return totalDuration / completedWorkflows.length;
  }
}

export interface WorkflowMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  cancelledWorkflows: number;
  successRate: number;
  averageDuration: number;
  queuedWorkflows: number;
}