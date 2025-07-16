/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseOrchestrator } from './BaseOrchestrator.js';
import { AgentInstance, AgentCapability } from '../types/common.js';
import { MarkItDownAgent } from '../agents/MarkItDownAgent.js';
import { AgentFactory } from '../agents/AgentFactory.js';
import { AgentConfig } from '../agents/types.js';

export class UniversalOrchestrator extends BaseOrchestrator {
  private agentFactory: AgentFactory;
  
  constructor(
    config: any,
    requestAnalyzer: any,
    requestRouter: any,
    workflowManager: any,
    eventSystem: any,
    agentFactory?: AgentFactory
  ) {
    super(config, requestAnalyzer, requestRouter, workflowManager, eventSystem);
    this.agentFactory = agentFactory || new AgentFactory();
  }
  
  protected async initializeAgents(): Promise<void> {
    // Initialize default agents
    await this.initializeGeminiAgent();
    await this.initializeTaskMasterAgent();
    await this.initializeAnalysisAgent();
    await this.initializeMarkdownAgent();
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

  /**
   * Initialize MarkItDown agent for markdown processing
   */
  private async initializeMarkdownAgent(): Promise<void> {
    const markdownCapabilities: AgentCapability[] = [
      {
        name: 'markdown-parsing',
        version: '1.0.0',
        description: 'Parse and process markdown content',
        supportedOperations: ['parse', 'extract', 'convert'],
        requiredTools: ['markitdown-processor'],
        performance: {
          latency: 500,
          throughput: 150,
          accuracy: 0.92,
        },
      },
      {
        name: 'document-analysis',
        version: '1.0.0',
        description: 'Analyze document structure and content',
        supportedOperations: ['analyze', 'extract-headings', 'table-of-contents'],
        requiredTools: ['markitdown-processor'],
        performance: {
          latency: 300,
          throughput: 200,
          accuracy: 0.90,
        },
      },
      {
        name: 'format-conversion',
        version: '1.0.0',
        description: 'Convert between different document formats',
        supportedOperations: ['convert-to-html', 'convert-to-pdf', 'convert-format'],
        requiredTools: ['markitdown-processor'],
        performance: {
          latency: 800,
          throughput: 100,
          accuracy: 0.88,
        },
      },
    ];

    const markdownAgent: AgentInstance = {
      id: 'markdown-specialist',
      type: 'markdown-specialist',
      capabilities: markdownCapabilities,
      status: 'idle',
      configuration: {
        enableFallback: true,
        processingTimeout: 30000,
        maxFileSize: 10485760, // 10MB
      },
      performance: {
        successRate: 0.92,
        averageResponseTime: 600,
        tasksCompleted: 0,
      },
    };

    this.agents.set(markdownAgent.id, markdownAgent);

    // Register the MarkItDown agent with the factory
    this.agentFactory.registerAgentType('markdown-specialist', async (config: AgentConfig) => {
      return new MarkItDownAgent(config);
    });
  }

  /**
   * Route markdown-related requests to the MarkItDown agent
   */
  private isMarkdownRequest(request: any): boolean {
    const markdownKeywords = [
      'markdown', 'md', 'parse', 'heading', 'table of contents', 'toc',
      'convert to html', 'html', 'document structure', 'extract links',
      'analyze document', 'format conversion', 'markitdown'
    ];

    const input = request.userInput?.toLowerCase() || '';
    return markdownKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Enhanced orchestrate method with markdown routing
   */
  async orchestrate(request: any): Promise<any> {
    // Check if this is a markdown-related request
    if (this.isMarkdownRequest(request)) {
      const markdownAgent = this.agents.get('markdown-specialist');
      if (markdownAgent && markdownAgent.status === 'idle') {
        // Create agent instance for the request
        const agentConfig: AgentConfig = {
          id: `markdown-${Date.now()}`,
          domain: 'document-processing',
          role: 'markdown-specialist',
          capabilities: ['markdown-parsing', 'document-analysis', 'format-conversion'],
          tools: ['parseMarkdown', 'extractHeadings', 'generateTableOfContents', 'convertToHTML']
        };

        try {
          const agent = await this.agentFactory.createAgent(agentConfig);
          
          // Update agent status
          markdownAgent.status = 'busy';
          
          // Process the request
          const response = await (agent as any).processRequest({
            id: request.id,
            content: request.userInput,
            type: 'markdown-processing',
            timestamp: new Date()
          });

          // Update agent status back to idle
          markdownAgent.status = 'idle';
          markdownAgent.performance.tasksCompleted++;

          return {
            id: this.generateId(),
            requestId: request.id,
            agents: [markdownAgent],
            workflow: {
              id: this.generateId(),
              name: 'Markdown Processing Workflow',
              description: 'Process markdown content with specialized agent',
              steps: [{
                id: '1',
                name: 'Process Markdown',
                status: 'completed',
                output: response
              }],
              estimatedTotalDuration: 1000,
              priority: 'medium',
              metadata: { agentType: 'markdown-specialist' }
            },
            status: 'completed',
            metrics: {
              startTime: new Date(),
              agentsUsed: 1,
              stepsCompleted: 1,
            },
            result: response
          };
        } catch (error) {
          markdownAgent.status = 'idle';
          console.error('Markdown agent processing failed:', error);
          // Fall back to default orchestration
        }
      }
    }

    // Fall back to default orchestration for non-markdown requests
    return super.orchestrate(request);
  }
}