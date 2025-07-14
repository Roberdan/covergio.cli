/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SessionContext, AgentInstance, WorkflowPlan, OrchestrationStatus, OrchestrationMetrics } from '../types/common.js';

export interface OrchestrationRequest {
  id: string;
  userInput: string;
  sessionContext: SessionContext;
  timestamp: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface OrchestrationResponse {
  id: string;
  requestId: string;
  agents: AgentInstance[];
  workflow: WorkflowPlan;
  status: OrchestrationStatus;
  result?: unknown;
  error?: Error;
  metrics: {
    startTime: Date;
    endTime?: Date;
    duration?: number;
    agentsUsed: number;
    stepsCompleted: number;
  };
}

export interface IOrchestrator {
  /**
   * Initialize the orchestrator with configuration
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Process an orchestration request
   */
  orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse>;

  /**
   * Get the status of an ongoing orchestration
   */
  getStatus(requestId: string): Promise<OrchestrationStatus>;

  /**
   * Cancel an orchestration request
   */
  cancel(requestId: string): Promise<boolean>;

  /**
   * Get orchestration metrics
   */
  getMetrics(): Promise<OrchestrationMetrics>;

  /**
   * Get list of available agents
   */
  getAvailableAgents(): Promise<AgentInstance[]>;

  /**
   * Shutdown the orchestrator gracefully
   */
  shutdown(): Promise<void>;
}