/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SessionContext {
  sessionId: string;
  userId?: string;
  workspaceRoot: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface AgentCapability {
  name: string;
  version: string;
  description?: string;
  enabled?: boolean;
  supportedOperations?: string[];
  requiredTools?: string[];
  performance?: {
    latency: number;
    throughput: number;
    accuracy: number;
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  description: string;
  agentId?: string;
  operation?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  dependencies: string[];
  parallel: boolean;
  estimatedDuration: number;
  actualDuration?: number;
  configuration: {
    action?: string;
    requiredCapabilities?: string[];
    parameters?: Record<string, unknown>;
    optional?: boolean;
    [key: string]: unknown;
  };
}

export interface WorkflowPlan {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTotalDuration: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, unknown>;
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

export interface WorkflowExecution {
  id: string;
  plan: WorkflowPlan;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentStep: number;
  completedSteps: StepExecutionResult[];
  progress: number; // 0-100
  error?: string;
  metadata: Record<string, unknown>;
}

export interface AgentInstance {
  id: string;
  type: string;
  capabilities: AgentCapability[];
  status: 'idle' | 'busy' | 'error' | 'offline';
  configuration: Record<string, unknown>;
  performance: {
    successRate: number;
    averageResponseTime: number;
    tasksCompleted: number;
  };
}

export type OrchestrationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

export interface OrchestrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  agentUtilization: Record<string, number>;
  workflowDistribution: Record<string, number>;
}