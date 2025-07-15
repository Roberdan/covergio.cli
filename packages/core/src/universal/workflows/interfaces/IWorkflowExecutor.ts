/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowPlan, WorkflowExecution, AgentInstance } from '../../types/common.js';

export interface ExecutionContext {
  plan: WorkflowPlan;
  agents: Map<string, AgentInstance>;
  variables: Map<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ExecutionOptions {
  timeout?: number;
  enableCheckpoints: boolean;
  enableRollback: boolean;
  maxRetries: number;
  notificationCallback?: (event: ExecutionEvent) => void;
}

export interface ExecutionEvent {
  type: 'step-started' | 'step-completed' | 'step-failed' | 'workflow-paused' | 'workflow-resumed' | 'workflow-cancelled';
  executionId: string;
  stepId?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface StepExecutionResult {
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: Error;
  duration: number;
  agentUsed?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionCheckpoint {
  executionId: string;
  stepIndex: number;
  completedSteps: StepExecutionResult[];
  variables: Map<string, unknown>;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface IWorkflowExecutor {
  /**
   * Execute a workflow plan
   */
  execute(plan: WorkflowPlan, options: ExecutionOptions): Promise<WorkflowExecution>;

  /**
   * Pause an active execution
   */
  pause(executionId: string): Promise<boolean>;

  /**
   * Resume a paused execution
   */
  resume(executionId: string): Promise<boolean>;

  /**
   * Cancel an active execution
   */
  cancel(executionId: string): Promise<boolean>;

  /**
   * Get the status of an execution
   */
  getExecutionStatus(executionId: string): Promise<ExecutionStatus | null>;

  /**
   * Get all active executions
   */
  getActiveExecutions(): Promise<WorkflowExecution[]>;

  /**
   * Restore execution from checkpoint
   */
  restoreFromCheckpoint(checkpoint: ExecutionCheckpoint): Promise<WorkflowExecution>;

  /**
   * Create a checkpoint of current execution state
   */
  createCheckpoint(executionId: string): Promise<ExecutionCheckpoint | null>;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  lastCheckpoint?: Date;
}