/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IWorkflowManager, IWorkflowPlanner as LegacyIWorkflowPlanner, IWorkflowExecutor as LegacyIWorkflowExecutor, WorkflowExecutionContext, WorkflowExecutionResult } from '../interfaces/IWorkflowManager.js';
import { IWorkflowPlanner, PlanningContext, PlanningConstraints } from './interfaces/IWorkflowPlanner.js';
import { IWorkflowExecutor, ExecutionOptions } from './interfaces/IWorkflowExecutor.js';
import { SmartWorkflowPlanner } from './planners/SmartWorkflowPlanner.js';
import { WorkflowExecutor } from './executors/WorkflowExecutor.js';
import { WorkflowPlan, WorkflowExecution, AgentInstance, WorkflowStep } from '../types/common.js';
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

/**
 * Adapter class to bridge the original IWorkflowPlanner interface with the new implementation
 */
class WorkflowPlannerAdapter implements LegacyIWorkflowPlanner {
  constructor(private newPlanner: IWorkflowPlanner) {}

  async createPlan(request: OrchestrationRequest, analysis: RequestAnalysis, agents: AgentInstance[]): Promise<WorkflowPlan> {
    const context: PlanningContext = {
      request,
      analysis,
      availableAgents: agents,
      constraints: {
        maxSteps: 50,
        maxDuration: 3600000, // 1 hour
        allowedAgentTypes: agents.map(a => a.type),
        requireApproval: false,
      },
    };
    
    const result = await this.newPlanner.createPlan(context);
    return result.plan;
  }

  async validatePlan(plan: WorkflowPlan): Promise<boolean> {
    // For legacy interface, we need to get available agents somehow
    // This is a limitation of the original interface design
    const mockAgents: AgentInstance[] = [];
    const result = await this.newPlanner.validatePlan(plan, mockAgents);
    return result.isValid;
  }

  async optimizePlan(plan: WorkflowPlan): Promise<WorkflowPlan> {
    const constraints: PlanningConstraints = {
      maxSteps: 50,
      maxDuration: 3600000,
      allowedAgentTypes: [],
      requireApproval: false,
    };
    
    return await this.newPlanner.optimizePlan(plan, constraints);
  }
}

/**
 * Adapter class to bridge the original IWorkflowExecutor interface with the new implementation
 */
class WorkflowExecutorAdapter implements LegacyIWorkflowExecutor {
  constructor(private newExecutor: IWorkflowExecutor) {}

  async execute(plan: WorkflowPlan, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult> {
    const executionOptions: ExecutionOptions = {
      timeout: 3600000, // 1 hour default
      enableCheckpoints: true,
      enableRollback: true,
      maxRetries: 3,
    };

    const workflowExecution = await this.newExecutor.execute(plan, executionOptions);
    return this.convertToExecutionResult(workflowExecution, context);
  }

  async pause(workflowId: string): Promise<boolean> {
    return await this.newExecutor.pause(workflowId);
  }

  async resume(workflowId: string): Promise<boolean> {
    return await this.newExecutor.resume(workflowId);
  }

  async cancel(workflowId: string): Promise<boolean> {
    return await this.newExecutor.cancel(workflowId);
  }

  async getStatus(workflowId: string): Promise<'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'> {
    const status = await this.newExecutor.getExecutionStatus(workflowId);
    return status?.status || 'failed';
  }

  private convertToExecutionResult(execution: WorkflowExecution, context: WorkflowExecutionContext): WorkflowExecutionResult {
    const duration = execution.endTime ? 
      execution.endTime.getTime() - execution.startTime.getTime() : 0;
    
    const agentsUsed = execution.completedSteps
      .map(step => step.agentUsed)
      .filter((agent): agent is string => agent !== undefined)
      .filter((agent, index, array) => array.indexOf(agent) === index);

    // Map execution status to legacy format
    let legacyStatus: 'completed' | 'failed' | 'cancelled';
    switch (execution.status) {
      case 'completed':
        legacyStatus = 'completed';
        break;
      case 'failed':
        legacyStatus = 'failed';
        break;
      case 'cancelled':
        legacyStatus = 'cancelled';
        break;
      default:
        // For pending, running, or paused, we'll consider it as completed for legacy interface
        legacyStatus = 'completed';
        break;
    }

    return {
      workflowId: execution.id,
      status: legacyStatus,
      result: execution.completedSteps.map(step => step.output).filter(output => output !== undefined),
      error: execution.error ? new Error(execution.error) : undefined,
      executedSteps: this.convertStepsToLegacyFormat(execution.completedSteps, execution.plan.steps),
      metrics: {
        totalDuration: duration,
        stepsCompleted: execution.completedSteps.filter(s => s.status === 'completed').length,
        stepsFailed: execution.completedSteps.filter(s => s.status === 'failed').length,
        agentsUsed,
      },
    };
  }

  private convertStepsToLegacyFormat(completedSteps: import('../types/common.js').StepExecutionResult[], planSteps: WorkflowStep[]): WorkflowStep[] {
    return completedSteps.map(step => {
      const planStep = planSteps.find(ps => ps.id === step.stepId);
      if (!planStep) {
        throw new Error(`Plan step not found for executed step: ${step.stepId}`);
      }
      
      return {
        ...planStep,
        status: step.status,
        outputs: step.output ? { result: step.output } : undefined,
        actualDuration: step.duration,
      };
    });
  }
}

export class WorkflowManager implements IWorkflowManager {
  private planner: IWorkflowPlanner;
  private executor: IWorkflowExecutor;
  private legacyPlannerAdapter: WorkflowPlannerAdapter;
  private legacyExecutorAdapter: WorkflowExecutorAdapter;
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
    this.legacyPlannerAdapter = new WorkflowPlannerAdapter(this.planner);
    this.legacyExecutorAdapter = new WorkflowExecutorAdapter(this.executor);
  }

  getPlanner(): LegacyIWorkflowPlanner {
    return this.legacyPlannerAdapter;
  }

  getExecutor(): LegacyIWorkflowExecutor {
    return this.legacyExecutorAdapter;
  }

  async createAndExecute(
    request: OrchestrationRequest,
    analysis: RequestAnalysis,
    availableAgents: AgentInstance[]
  ): Promise<WorkflowExecutionResult> {
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

    // Convert to legacy format
    return this.convertToLegacyExecutionResult(execution, request, availableAgents);
  }

  async getActiveWorkflows(): Promise<WorkflowExecutionContext[]> {
    const activeExecutions = Array.from(this.activeWorkflows.values());
    return activeExecutions.map(execution => this.convertToLegacyExecutionContext(execution));
  }

  async getHistory(limit?: number): Promise<WorkflowExecutionResult[]> {
    const history = [...this.workflowHistory];
    const limitedHistory = limit ? history.slice(-limit) : history;
    return limitedHistory.map(execution => this.convertToLegacyExecutionResult(execution, 
      {
        id: '',
        type: 'workflow-execution',
        userInput: '',
        sessionContext: {
          sessionId: '',
          workspaceRoot: '',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      } as OrchestrationRequest, 
      []
    ));
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
    
    this.activeWorkflows.forEach((execution, id) => {
      if (['completed', 'failed', 'cancelled'].includes(execution.status)) {
        this.moveToHistory(execution);
        completedWorkflows.push(id);
      }
    });

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

  /**
   * Convert new WorkflowExecution to legacy WorkflowExecutionResult
   */
  private convertToLegacyExecutionResult(
    execution: WorkflowExecution, 
    request: OrchestrationRequest, 
    agents: AgentInstance[]
  ): WorkflowExecutionResult {
    const duration = execution.endTime ? 
      execution.endTime.getTime() - execution.startTime.getTime() : 0;
    
    const agentsUsed = execution.completedSteps
      .map(step => step.agentUsed)
      .filter((agent): agent is string => agent !== undefined)
      .filter((agent, index, array) => array.indexOf(agent) === index);

    // Map execution status to legacy format
    let legacyStatus: 'completed' | 'failed' | 'cancelled';
    switch (execution.status) {
      case 'completed':
        legacyStatus = 'completed';
        break;
      case 'failed':
        legacyStatus = 'failed';
        break;
      case 'cancelled':
        legacyStatus = 'cancelled';
        break;
      default:
        // For pending, running, or paused, we'll consider it as completed for legacy interface
        legacyStatus = 'completed';
        break;
    }

    return {
      workflowId: execution.id,
      status: legacyStatus,
      result: execution.completedSteps.map(step => step.output).filter(output => output !== undefined),
      error: execution.error ? new Error(execution.error) : undefined,
      executedSteps: this.convertStepsToLegacyFormat(execution.completedSteps, execution.plan.steps),
      metrics: {
        totalDuration: duration,
        stepsCompleted: execution.completedSteps.filter(s => s.status === 'completed').length,
        stepsFailed: execution.completedSteps.filter(s => s.status === 'failed').length,
        agentsUsed,
      },
    };
  }

  /**
   * Convert new WorkflowExecution to legacy WorkflowExecutionContext
   */
  private convertToLegacyExecutionContext(execution: WorkflowExecution): WorkflowExecutionContext {
    const currentStep = execution.plan.steps[execution.currentStep];
    const executedSteps = this.convertStepsToLegacyFormat(execution.completedSteps, execution.plan.steps);
    
    return {
      workflowId: execution.id,
      request: {
        id: execution.id,
        type: 'workflow-execution',
        userInput: '',
        sessionContext: {
          sessionId: execution.id,
          workspaceRoot: '',
          timestamp: execution.startTime,
          metadata: execution.metadata,
        },
        timestamp: execution.startTime,
      } as OrchestrationRequest,
      agents: [], // Legacy interface doesn't provide a way to get the original agents
      currentStep,
      executedSteps,
      startTime: execution.startTime,
      metadata: execution.metadata,
    };
  }

  /**
   * Convert new StepExecutionResult to legacy WorkflowStep format
   */
  private convertStepsToLegacyFormat(completedSteps: import('../types/common.js').StepExecutionResult[], planSteps: WorkflowStep[]): WorkflowStep[] {
    return completedSteps.map(step => {
      const planStep = planSteps.find(ps => ps.id === step.stepId);
      if (!planStep) {
        throw new Error(`Plan step not found for executed step: ${step.stepId}`);
      }
      
      return {
        ...planStep,
        status: step.status,
        outputs: step.output ? { result: step.output } : undefined,
        actualDuration: step.duration,
      };
    });
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