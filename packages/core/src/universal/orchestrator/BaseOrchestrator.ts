/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IOrchestrator, OrchestrationRequest, OrchestrationResponse } from '../interfaces/IOrchestrator.js';
import { IRequestAnalyzer, IRequestRouter } from '../interfaces/IRequestHandler.js';
import { IWorkflowManager } from '../interfaces/IWorkflowManager.js';
import { IEventSystem } from '../interfaces/IEventSystem.js';
import { AgentInstance, OrchestrationStatus, OrchestrationMetrics } from '../types/common.js';
import { OrchestratorConfig } from '../config/OrchestratorConfig.js';

export abstract class BaseOrchestrator implements IOrchestrator {
  protected config: OrchestratorConfig;
  protected requestAnalyzer: IRequestAnalyzer;
  protected requestRouter: IRequestRouter;
  protected workflowManager: IWorkflowManager;
  protected eventSystem: IEventSystem;
  protected agents: Map<string, AgentInstance> = new Map();
  protected activeRequests: Map<string, OrchestrationResponse> = new Map();
  protected metrics: OrchestrationMetrics;
  protected initialized = false;

  constructor(
    config: OrchestratorConfig,
    requestAnalyzer: IRequestAnalyzer,
    requestRouter: IRequestRouter,
    workflowManager: IWorkflowManager,
    eventSystem: IEventSystem
  ) {
    this.config = config;
    this.requestAnalyzer = requestAnalyzer;
    this.requestRouter = requestRouter;
    this.workflowManager = workflowManager;
    this.eventSystem = eventSystem;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): OrchestrationMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      agentUtilization: {},
      workflowDistribution: {},
    };
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    if (this.initialized) {
      throw new Error('Orchestrator already initialized');
    }

    // Initialize subsystems
    await this.eventSystem.initialize((config.events as Record<string, unknown>) || {});
    await this.initializeAgents();
    
    this.initialized = true;
    
    // Publish initialization event
    await this.eventSystem.publish({
      id: this.generateId(),
      type: 'orchestrator.initialized',
      source: this.config.orchestrator.id,
      timestamp: new Date(),
      data: { config: this.config.orchestrator },
    });
  }

  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized');
    }

    const startTime = new Date();
    this.metrics.totalRequests++;

    try {
      // Analyze the request
      const analysis = await this.requestAnalyzer.analyze(request);
      
      // Route to appropriate handler
      const handler = await this.requestRouter.route(request, analysis);
      
      // Create initial response
      const response: OrchestrationResponse = {
        id: this.generateId(),
        requestId: request.id,
        agents: [],
        workflow: {
          id: this.generateId(),
          name: `Workflow for ${request.id}`,
          description: analysis.intent,
          steps: [],
          estimatedTotalDuration: analysis.estimatedDuration,
          priority: analysis.priority,
          metadata: analysis.metadata,
        },
        status: 'pending',
        metrics: {
          startTime,
          agentsUsed: 0,
          stepsCompleted: 0,
        },
      };

      this.activeRequests.set(request.id, response);

      // Publish orchestration started event
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestration.started',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { request, analysis },
        correlationId: request.id,
      });

      // Handle the request
      const finalResponse = await handler.handle(request, analysis);
      
      // Update metrics
      this.updateMetrics(finalResponse, startTime);
      
      // Publish orchestration completed event
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestration.completed',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { response: finalResponse },
        correlationId: request.id,
      });

      this.activeRequests.delete(request.id);
      return finalResponse;

    } catch (error) {
      this.metrics.failedRequests++;
      
      // Publish orchestration failed event
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestration.failed',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : String(error) },
        correlationId: request.id,
      });

      this.activeRequests.delete(request.id);
      throw error;
    }
  }

  async getStatus(requestId: string): Promise<OrchestrationStatus> {
    const response = this.activeRequests.get(requestId);
    return response?.status || 'failed';
  }

  async cancel(requestId: string): Promise<boolean> {
    const response = this.activeRequests.get(requestId);
    if (response) {
      response.status = 'cancelled';
      this.activeRequests.delete(requestId);
      
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestration.cancelled',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { requestId },
        correlationId: requestId,
      });
      
      return true;
    }
    return false;
  }

  async getMetrics(): Promise<OrchestrationMetrics> {
    return { ...this.metrics };
  }

  async getAvailableAgents(): Promise<AgentInstance[]> {
    return Array.from(this.agents.values());
  }

  async shutdown(): Promise<void> {
    // Cancel all active requests
    for (const requestId of this.activeRequests.keys()) {
      await this.cancel(requestId);
    }

    // Shutdown subsystems
    await this.eventSystem.shutdown();
    
    this.initialized = false;
    
    // Publish shutdown event
    await this.eventSystem.publish({
      id: this.generateId(),
      type: 'orchestrator.shutdown',
      source: this.config.orchestrator.id,
      timestamp: new Date(),
      data: { metrics: this.metrics },
    });
  }

  protected abstract initializeAgents(): Promise<void>;

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(response: OrchestrationResponse, startTime: Date): void {
    const duration = Date.now() - startTime.getTime();
    
    this.metrics.successfulRequests++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration) / 
      this.metrics.totalRequests;

    // Update agent utilization
    for (const agent of response.agents) {
      this.metrics.agentUtilization[agent.id] = 
        (this.metrics.agentUtilization[agent.id] || 0) + 1;
    }

    // Update workflow distribution
    const workflowType = response.workflow.name;
    this.metrics.workflowDistribution[workflowType] = 
      (this.metrics.workflowDistribution[workflowType] || 0) + 1;
  }
}