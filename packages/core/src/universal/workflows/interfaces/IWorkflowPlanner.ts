/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowPlan, AgentInstance } from '../../types/common.js';
import { RequestAnalysis } from '../../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../../interfaces/IOrchestrator.js';

export interface PlanningContext {
  request: OrchestrationRequest;
  analysis: RequestAnalysis;
  availableAgents: AgentInstance[];
  constraints: PlanningConstraints;
}

export interface PlanningConstraints {
  maxSteps: number;
  maxDuration: number;
  allowedAgentTypes: string[];
  requireApproval: boolean;
  budget?: {
    maxCost: number;
    costPerMinute: number;
  };
}

export interface PlanningResult {
  plan: WorkflowPlan;
  confidence: number;
  estimatedCost: number;
  alternatives: WorkflowPlan[];
  warnings: string[];
}

export interface IWorkflowPlanner {
  /**
   * Create a workflow plan for the given request and analysis
   */
  createPlan(context: PlanningContext): Promise<PlanningResult>;

  /**
   * Optimize an existing workflow plan
   */
  optimizePlan(plan: WorkflowPlan, constraints: PlanningConstraints): Promise<WorkflowPlan>;

  /**
   * Validate that a workflow plan is executable
   */
  validatePlan(plan: WorkflowPlan, availableAgents: AgentInstance[]): Promise<ValidationResult>;

  /**
   * Get planning capabilities and preferences
   */
  getCapabilities(): PlannerCapabilities;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationError {
  stepId: string;
  message: string;
  severity: 'error' | 'warning';
  fixSuggestion?: string;
}

export interface PlannerCapabilities {
  supportedComplexity: Array<'simple' | 'medium' | 'complex'>;
  supportedDomains: string[];
  maxStepsSupported: number;
  supportsParallelExecution: boolean;
  supportsConditionalLogic: boolean;
  supportsRollback: boolean;
}