/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowPlan, WorkflowStep, AgentInstance } from '../types/common.js';
import { RequestAnalysis } from './IRequestHandler.js';
import { OrchestrationRequest } from './IOrchestrator.js';

export interface WorkflowExecutionContext {
  workflowId: string;
  request: OrchestrationRequest;
  agents: AgentInstance[];
  currentStep?: WorkflowStep;
  executedSteps: WorkflowStep[];
  startTime: Date;
  metadata: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: unknown;
  error?: Error;
  executedSteps: WorkflowStep[];
  metrics: {
    totalDuration: number;
    stepsCompleted: number;
    stepsFailed: number;
    agentsUsed: string[];
  };
}

export interface IWorkflowPlanner {
  /**
   * Create a workflow plan based on request analysis
   */
  createPlan(request: OrchestrationRequest, analysis: RequestAnalysis, agents: AgentInstance[]): Promise<WorkflowPlan>;

  /**
   * Validate a workflow plan
   */
  validatePlan(plan: WorkflowPlan): Promise<boolean>;

  /**
   * Optimize a workflow plan
   */
  optimizePlan(plan: WorkflowPlan): Promise<WorkflowPlan>;
}

export interface IWorkflowExecutor {
  /**
   * Execute a workflow plan
   */
  execute(plan: WorkflowPlan, context: WorkflowExecutionContext): Promise<WorkflowExecutionResult>;

  /**
   * Pause workflow execution
   */
  pause(workflowId: string): Promise<boolean>;

  /**
   * Resume workflow execution
   */
  resume(workflowId: string): Promise<boolean>;

  /**
   * Cancel workflow execution
   */
  cancel(workflowId: string): Promise<boolean>;

  /**
   * Get workflow execution status
   */
  getStatus(workflowId: string): Promise<'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'>;
}

export interface IWorkflowManager {
  /**
   * Get workflow planner
   */
  getPlanner(): IWorkflowPlanner;

  /**
   * Get workflow executor
   */
  getExecutor(): IWorkflowExecutor;

  /**
   * Create and execute a workflow
   */
  createAndExecute(request: OrchestrationRequest, analysis: RequestAnalysis, agents: AgentInstance[]): Promise<WorkflowExecutionResult>;

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Promise<WorkflowExecutionContext[]>;

  /**
   * Get workflow history
   */
  getHistory(limit?: number): Promise<WorkflowExecutionResult[]>;
}