/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent } from '../types/agent';
import { DomainRegistry } from '../domain/DomainRegistry';
import { AgentFactory } from './AgentFactory';

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredDomains: string[];
  dependencies?: string[];
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'partial' | 'failed';
  output?: unknown;
  error?: Error;
  metrics?: {
    duration: number;
    agentCalls: number;
    retries: number;
  };
  metadata?: Record<string, unknown>;
}

export interface TaskAnalysis {
  requiredDomains: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedEffort: number;
  dependencies: string[];
  requiredCapabilities: string[];
}

export class TaskMaster extends BaseAgent {
  private domainRegistry: DomainRegistry;
  private agentFactory: AgentFactory;
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  constructor(config: any) {
    super({
      id: config?.id || 'task-master',
      type: 'system',
      domain: 'system',
      role: 'task-master',
      capabilities: ['task-decomposition', 'agent-coordination', 'workflow-management'],
      config: config || {}
    });

    this.domainRegistry = DomainRegistry.getInstance();
    this.agentFactory = AgentFactory.getInstance();
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    let agentCalls = 0;
    let retries = 0;

    try {
      // 1. Analyze task requirements
      const analysis = await this.analyzeTask(task);
      
      // 2. Get required agents
      const agents = await this.domainRegistry.getAgentsForDomains(analysis.requiredDomains);
      
      // 3. Execute task with retries
      let lastError: Error | undefined;
      
      while (retries < this.maxRetries) {
        try {
          const result = await this.executeWithAgents(task, agents, analysis);
          agentCalls += result.metrics?.agentCalls || 0;
          
          return {
            ...result,
            metrics: {
              duration: Date.now() - startTime,
              agentCalls,
              retries
            }
          };
        } catch (error) {
          lastError = error as Error;
          retries++;
          if (retries < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay * retries));
          }
        }
      }
      
      throw lastError || new Error('Task execution failed');
      
    } catch (error) {
      return {
        taskId: task.id,
        status: 'failed',
        error: error as Error,
        metrics: {
          duration: Date.now() - startTime,
          agentCalls,
          retries
        }
      };
    }
  }

  private async analyzeTask(task: Task): Promise<TaskAnalysis> {
    // In a real implementation, this would use NLP to analyze the task
    // For now, we'll use a simplified approach
    return {
      requiredDomains: task.requiredDomains,
      complexity: this.estimateComplexity(task),
      estimatedEffort: this.estimateEffort(task),
      dependencies: task.dependencies || [],
      requiredCapabilities: []
    };
  }

  private estimateComplexity(task: Task): 'low' | 'medium' | 'high' {
    // Simple heuristic based on description length and required domains
    const domainCount = task.requiredDomains.length;
    const descriptionLength = task.description.length;
    
    if (domainCount <= 1 && descriptionLength < 100) return 'low';
    if (domainCount <= 3 && descriptionLength < 300) return 'medium';
    return 'high';
  }

  private estimateEffort(task: Task): number {
    // Simple effort estimation (in arbitrary units)
    const complexity = this.estimateComplexity(task);
    switch (complexity) {
      case 'low': return 1;
      case 'medium': return 3;
      case 'high': return 8;
      default: return 5;
    }
  }

  private async executeWithAgents(
    task: Task,
    agents: any[],
    analysis: TaskAnalysis
  ): Promise<TaskResult> {
    let agentCalls = 0;
    const results: Record<string, unknown> = {};
    
    // Simple round-robin execution for now
    // In a real implementation, this would be more sophisticated
    for (const agent of agents) {
      try {
        const result = await agent.execute({
          task: task.description,
          context: task.context,
          previousResults: results
        });
        
        agentCalls++;
        results[agent.id] = result;
        
      } catch (error) {
        console.error(`Agent ${agent.id} failed:`, error);
        // Continue with other agents
      }
    }
    
    return {
      taskId: task.id,
      status: Object.keys(results).length > 0 ? 'success' : 'failed',
      output: results,
      metrics: { agentCalls, duration: 0, retries: 0 },
      metadata: { analysis }
    };
  }
}
