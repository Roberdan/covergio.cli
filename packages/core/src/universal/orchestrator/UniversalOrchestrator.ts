/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseOrchestrator } from './BaseOrchestrator.js';
import { AgentInstance, AgentCapability } from '../types/common.js';

export class UniversalOrchestrator extends BaseOrchestrator {
  
  protected async initializeAgents(): Promise<void> {
    // Initialize default agents
    await this.initializeGeminiAgent();
    await this.initializeTaskMasterAgent();
    await this.initializeAnalysisAgent();
  }

  private async initializeGeminiAgent(): Promise<void> {
    const geminiCapabilities: AgentCapability[] = [
      {
        name: 'text-generation',
        version: '1.0.0',
        description: 'Advanced text generation and conversation',
        supportedOperations: ['generate', 'chat', 'complete'],
        requiredTools: ['gemini-api'],
        performance: {
          latency: 1000,
          throughput: 100,
          accuracy: 0.95,
        },
      },
      {
        name: 'code-assistance',
        version: '1.0.0',
        description: 'Code generation, review, and assistance',
        supportedOperations: ['code-gen', 'code-review', 'debug'],
        requiredTools: ['gemini-api', 'file-system'],
        performance: {
          latency: 2000,
          throughput: 50,
          accuracy: 0.92,
        },
      },
    ];

    const geminiAgent: AgentInstance = {
      id: 'gemini-primary',
      type: 'gemini',
      capabilities: geminiCapabilities,
      status: 'idle',
      configuration: {
        model: 'gemini-2.5-pro',
        temperature: 0.7,
        maxTokens: 8192,
      },
      performance: {
        successRate: 0.95,
        averageResponseTime: 1500,
        tasksCompleted: 0,
      },
    };

    this.agents.set(geminiAgent.id, geminiAgent);
  }

  private async initializeTaskMasterAgent(): Promise<void> {
    const taskMasterCapabilities: AgentCapability[] = [
      {
        name: 'task-analysis',
        version: '1.0.0',
        description: 'Task decomposition and analysis',
        supportedOperations: ['analyze', 'decompose', 'prioritize'],
        requiredTools: ['task-master-api'],
        performance: {
          latency: 500,
          throughput: 200,
          accuracy: 0.88,
        },
      },
      {
        name: 'project-management',
        version: '1.0.0',
        description: 'Project planning and coordination',
        supportedOperations: ['plan', 'coordinate', 'track'],
        requiredTools: ['task-master-api'],
        performance: {
          latency: 800,
          throughput: 150,
          accuracy: 0.90,
        },
      },
    ];

    const taskMasterAgent: AgentInstance = {
      id: 'task-master-primary',
      type: 'task-master',
      capabilities: taskMasterCapabilities,
      status: 'idle',
      configuration: {
        endpoint: 'task-master-ai',
        timeout: 30000,
      },
      performance: {
        successRate: 0.90,
        averageResponseTime: 650,
        tasksCompleted: 0,
      },
    };

    this.agents.set(taskMasterAgent.id, taskMasterAgent);
  }

  private async initializeAnalysisAgent(): Promise<void> {
    const analysisCapabilities: AgentCapability[] = [
      {
        name: 'request-analysis',
        version: '1.0.0',
        description: 'Analyze and categorize user requests',
        supportedOperations: ['analyze', 'classify', 'extract'],
        requiredTools: ['nlp-processor'],
        performance: {
          latency: 300,
          throughput: 300,
          accuracy: 0.85,
        },
      },
    ];

    const analysisAgent: AgentInstance = {
      id: 'analysis-primary',
      type: 'analysis',
      capabilities: analysisCapabilities,
      status: 'idle',
      configuration: {
        models: ['bert-base', 'distilbert'],
        threshold: 0.8,
      },
      performance: {
        successRate: 0.85,
        averageResponseTime: 300,
        tasksCompleted: 0,
      },
    };

    this.agents.set(analysisAgent.id, analysisAgent);
  }

  /**
   * Add a new agent to the orchestrator
   */
  async addAgent(agent: AgentInstance): Promise<void> {
    this.agents.set(agent.id, agent);
    
    await this.eventSystem.publish({
      id: this.generateId(),
      type: 'agent.added',
      source: this.config.orchestrator.id,
      timestamp: new Date(),
      data: { agent },
    });
  }

  /**
   * Remove an agent from the orchestrator
   */
  async removeAgent(agentId: string): Promise<boolean> {
    const removed = this.agents.delete(agentId);
    
    if (removed) {
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'agent.removed',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { agentId },
      });
    }
    
    return removed;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId: string, status: AgentInstance['status']): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'agent.status.updated',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: { agentId, status },
      });
    }
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capabilityName: string): AgentInstance[] {
    const agents: AgentInstance[] = [];
    
    for (const agent of this.agents.values()) {
      if (agent.capabilities.some(cap => cap.name === capabilityName)) {
        agents.push(agent);
      }
    }
    
    return agents;
  }

  /**
   * Get idle agents
   */
  getIdleAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
  }
}