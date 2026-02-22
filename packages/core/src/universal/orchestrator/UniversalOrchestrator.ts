/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseOrchestrator } from './BaseOrchestrator.js';
import { AgentInstance, AgentCapability } from '../types/common.js';
import { OrchestrationRequest, OrchestrationResponse } from '../interfaces/IOrchestrator.js';
import { IRequestAnalyzer, IRequestRouter } from '../interfaces/IRequestHandler.js';
import { IWorkflowManager } from '../interfaces/IWorkflowManager.js';
import { IEventSystem } from '../interfaces/IEventSystem.js';
import { OrchestratorConfig } from '../config/OrchestratorConfig.js';
import { MarkItDownAgent } from '../agents/MarkItDownAgent.js';
import { ImageAltTextAgent } from '../agents/ImageAltTextAgent.js';
import { AgentFactory } from '../agents/AgentFactory.js';
import { AgentConfig } from '../agents/types.js';
import { PerformanceManager, PerformanceConfig } from '../performance/PerformanceManager.js';
import { RequestPriority } from '../performance/RequestQueue.js';

export class UniversalOrchestrator extends BaseOrchestrator {
  private agentFactory: AgentFactory;
  private performanceManager: PerformanceManager;
  
  constructor(
    config: OrchestratorConfig,
    requestAnalyzer: IRequestAnalyzer,
    requestRouter: IRequestRouter,
    workflowManager: IWorkflowManager,
    eventSystem: IEventSystem,
    agentFactory?: AgentFactory,
    performanceConfig?: Partial<PerformanceConfig>
  ) {
    super(config, requestAnalyzer, requestRouter, workflowManager, eventSystem);
    this.agentFactory = agentFactory || new AgentFactory();
    
    // Initialize performance manager with optimizations
    this.performanceManager = new PerformanceManager({
      cache: {
        maxSize: config?.performance?.cache?.maxSize || 1000,
        defaultTtl: 300000, // 5 minutes
        enableMetrics: true,
        evictionPolicy: 'lru',
        redisConfig: config?.performance?.cache?.redis
      },
      queue: {
        concurrencyLimit: config?.performance?.queue?.concurrencyLimit || 10,
        maxQueueSize: 1000,
        enablePrioritization: true,
        enableBatching: false
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
        errorPercentageThreshold: 50
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        healthCheckInterval: 60000,
        performanceThresholds: {
          maxResponseTime: 5000,
          maxErrorRate: 0.1,
          maxQueueUtilization: 0.8,
          maxMemoryUsage: 0.8
        }
      },
      optimization: {
        enableAgentPooling: true,
        enableResponseCaching: true,
        enableRequestBatching: false,
        enableCircuitBreakers: true,
        agentPoolSize: 5,
        cacheHitRateTarget: 0.8,
        maxConcurrentRequests: 50
      },
      ...performanceConfig
    });

    this.setupPerformanceIntegration();
  }

  /**
   * Setup performance integration and agent pools
   */
  private setupPerformanceIntegration(): void {
    // Setup agent pools for commonly used agents
    this.performanceManager.createAgentPool(
      'gemini',
      async () => {
        const config: AgentConfig = {
          id: `gemini-pool-${Date.now()}`,
          domain: 'conversation',
          role: 'text-generator',
          capabilities: ['text-generation', 'code-assistance']
        };
        return await this.agentFactory.createAgent(config);
      },
      (agent: unknown) => agent != null && typeof (agent as Record<string, unknown>).execute === 'function',
      3
    );

    this.performanceManager.createAgentPool(
      'markdown',
      async () => {
        const config: AgentConfig = {
          id: `markdown-pool-${Date.now()}`,
          domain: 'document-processing',
          role: 'markdown-specialist',
          capabilities: ['markdown-parsing', 'document-analysis']
        };
        return new MarkItDownAgent(config);
      },
      (agent: unknown) => agent != null && typeof (agent as Record<string, unknown>).processRequest === 'function',
      2
    );

    this.performanceManager.createAgentPool(
      'image-alt-text',
      async () => {
        const config: AgentConfig = {
          id: `image-alt-text-pool-${Date.now()}`,
          domain: 'document-processing',
          role: 'image-accessibility-specialist',
          capabilities: ['image-analysis', 'alt-text-generation']
        };
        return new ImageAltTextAgent(config);
      },
      (agent: unknown) => agent != null && typeof (agent as Record<string, unknown>).execute === 'function',
      2
    );

    // Register request processors
    this.performanceManager.registerProcessor('default', async (request) => {
      return await this.processRequestDirect(request);
    });

    this.performanceManager.registerProcessor('markdown', async (request) => {
      return await this.processMarkdownRequest(request);
    });

    this.performanceManager.registerProcessor('image-processing', async (request) => {
      return await this.processImageRequest(request);
    });

    // Setup performance event listeners
    this.performanceManager.on('performance-degradation', (data) => {
      console.warn('Performance degradation detected:', data);
      this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestrator.performance.degradation',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data
      });
    });

    this.performanceManager.on('cache-optimization-needed', (data) => {
      console.info('Cache optimization needed:', data);
    });
  }
  
  protected async initializeAgents(): Promise<void> {
    // Initialize default agents
    await this.initializeGeminiAgent();
    await this.initializeTaskMasterAgent();
    await this.initializeAnalysisAgent();
    await this.initializeMarkdownAgent();
    await this.initializeImageAltTextAgent();
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
   * Initialize ImageAltText agent for image accessibility enhancement
   */
  private async initializeImageAltTextAgent(): Promise<void> {
    const imageAltTextCapabilities: AgentCapability[] = [
      {
        name: 'image-analysis',
        version: '1.0.0',
        description: 'Analyze images and extract visual information',
        supportedOperations: ['analyze', 'extract', 'describe'],
        requiredTools: ['image-processor', 'alt-text-generator'],
        performance: {
          latency: 800,
          throughput: 80,
          accuracy: 0.88,
        },
      },
      {
        name: 'alt-text-generation',
        version: '1.0.0',
        description: 'Generate descriptive alt-text for images',
        supportedOperations: ['generate', 'enhance', 'validate'],
        requiredTools: ['alt-text-generator', 'accessibility-checker'],
        performance: {
          latency: 600,
          throughput: 100,
          accuracy: 0.90,
        },
      },
      {
        name: 'accessibility-enhancement',
        version: '1.0.0',
        description: 'Enhance document accessibility through image descriptions',
        supportedOperations: ['enhance', 'validate', 'audit'],
        requiredTools: ['accessibility-checker', 'document-processor'],
        performance: {
          latency: 1000,
          throughput: 60,
          accuracy: 0.92,
        },
      },
    ];

    const imageAltTextAgent: AgentInstance = {
      id: 'image-alt-text-specialist',
      type: 'image-alt-text-specialist',
      capabilities: imageAltTextCapabilities,
      status: 'idle',
      configuration: {
        detailLevel: 'detailed',
        maxDescriptionLength: 150,
        includeImageContext: true,
        processingTimeout: 30000,
      },
      performance: {
        successRate: 0.90,
        averageResponseTime: 800,
        tasksCompleted: 0,
      },
    };

    this.agents.set(imageAltTextAgent.id, imageAltTextAgent);

    // Register the ImageAltText agent with the factory
    this.agentFactory.registerAgentType('image-alt-text-specialist', async (config: AgentConfig) => {
      return new ImageAltTextAgent(config);
    });
  }

  /**
   * Route markdown-related requests to the MarkItDown agent
   */
  private isMarkdownRequest(request: OrchestrationRequest): boolean {
    const markdownKeywords = [
      'markdown', 'md', 'parse', 'heading', 'table of contents', 'toc',
      'convert to html', 'html', 'document structure', 'extract links',
      'analyze document', 'format conversion', 'markitdown'
    ];

    const input = request.userInput?.toLowerCase() || '';
    return markdownKeywords.some(keyword => input.includes(keyword));
  }

  /**
   * Route image-related requests to the ImageAltText agent
   */
  private isImageProcessingRequest(request: OrchestrationRequest): boolean {
    const imageKeywords = [
      'image', 'img', 'alt text', 'alt-text', 'alternative text',
      'accessibility', 'screen reader', 'describe image', 'image description',
      'generate alt text', 'analyze image', 'image analysis', 'visual description',
      'enhance accessibility', 'accessibility audit', 'image accessibility'
    ];

    const input = request.userInput?.toLowerCase() || '';
    
    // Check for image-related keywords
    const hasImageKeywords = imageKeywords.some(keyword => input.includes(keyword));
    
    // Check for markdown image syntax
    const hasImageSyntax = input.includes('![') || input.includes('<img');
    
    // Check for common image file extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => input.includes(ext));
    
    return hasImageKeywords || hasImageSyntax || hasImageExtension;
  }

  /**
   * Direct request processing without performance optimizations (legacy)
   */
  private async processRequestDirect(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    return super.orchestrate(request);
  }

  /**
   * Process markdown requests with agent pooling
   */
  private async processMarkdownRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const agent = await this.performanceManager.getAgent('markdown');
    if (agent) {
      try {
        const response = await agent.processRequest({
          id: request.id,
          content: request.userInput,
          type: 'markdown-processing',
          timestamp: new Date()
        });
        return {
          id: this.generateId(),
          requestId: request.id,
          status: 'completed',
          result: response
        };
      } finally {
        this.performanceManager.returnAgent('markdown', agent);
      }
    }
    throw new Error('No markdown agent available');
  }

  /**
   * Process image requests with agent pooling
   */
  private async processImageRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const agent = await this.performanceManager.getAgent('image-alt-text');
    if (agent) {
      try {
        const response = await agent.execute({
          input: request.userInput,
          context: {
            sessionId: request.sessionContext?.sessionId || 'orchestrator-session',
            executionId: request.id,
            timestamp: new Date(),
            environment: {}
          }
        });
        return {
          id: this.generateId(),
          requestId: request.id,
          status: 'completed',
          result: response
        };
      } finally {
        this.performanceManager.returnAgent('image-alt-text', agent);
      }
    }
    throw new Error('No image processing agent available');
  }

  /**
   * Enhanced orchestrate method with performance optimizations
   */
  async orchestrate(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const startTime = Date.now();

    try {
      // Determine request priority - default to 'medium' if not specified
      let priority: RequestPriority = 'medium';
      if (request.priority === 'high' || request.priority === 'critical') {
        priority = 'high';
      } else if (request.priority === 'low') {
        priority = 'low';
      }

      // Generate cache key for response caching
      const cacheKey = `orchestrator:${request.userInput}:${JSON.stringify(request.context || {})}`;

      // Determine processor and routing
      let processorName = 'default';
      let useCircuitBreaker = false;
      let circuitBreakerName = '';

      if (this.isImageProcessingRequest(request)) {
        processorName = 'image-processing';
        useCircuitBreaker = true;
        circuitBreakerName = 'image-processing';
      } else if (this.isMarkdownRequest(request)) {
        processorName = 'markdown';
        useCircuitBreaker = true;
        circuitBreakerName = 'markdown-processing';
      }

      // Execute with performance optimizations
      const result = await this.performanceManager.executeRequest(
        request,
        priority,
        {
          useCache: true,
          cacheKey,
          cacheTtl: 300000, // 5 minutes
          useCircuitBreaker,
          circuitBreakerName,
          processorName
        }
      );

      const duration = Date.now() - startTime;
      
      // Emit performance metrics
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestrator.request.completed',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: {
          requestId: request.id,
          duration,
          processor: processorName,
          priority,
          cached: false // This would be determined by the performance manager
        }
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Emit error event
      await this.eventSystem.publish({
        id: this.generateId(),
        type: 'orchestrator.request.failed',
        source: this.config.orchestrator.id,
        timestamp: new Date(),
        data: {
          requestId: request.id,
          duration,
          error: (error as Error).message
        }
      });

      // Fallback to legacy processing
      console.warn('Performance-optimized processing failed, falling back to legacy:', error);
      return await this.orchestrateLegacy(request);
    }
  }

  /**
   * Legacy orchestrate method as fallback
   */
  private async orchestrateLegacy(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    // Check if this is an image processing request
    if (this.isImageProcessingRequest(request)) {
      const imageAgent = this.agents.get('image-alt-text-specialist');
      if (imageAgent && imageAgent.status === 'idle') {
        // Create agent instance for the request
        const agentConfig: AgentConfig = {
          id: `image-alt-text-${Date.now()}`,
          domain: 'document-processing',
          role: 'image-accessibility-specialist',
          capabilities: ['image-analysis', 'alt-text-generation', 'accessibility-enhancement'],
          tools: ['analyzeImages', 'generateAltText', 'processMarkdown', 'enhanceAccessibility']
        };

        try {
          const agent = await this.agentFactory.createAgent(agentConfig);
          
          // Update agent status
          imageAgent.status = 'busy';
          
          // Process the request
          const response = await agent.execute({
            input: request.userInput,
            context: {
              sessionId: request.sessionContext?.sessionId || 'orchestrator-session',
              executionId: request.id,
              timestamp: new Date(),
              environment: {}
            }
          });

          // Update agent status back to idle
          imageAgent.status = 'idle';
          imageAgent.performance.tasksCompleted++;

          return {
            id: this.generateId(),
            requestId: request.id,
            agents: [imageAgent],
            workflow: {
              id: this.generateId(),
              name: 'Image Alt-Text Processing Workflow',
              description: 'Process images to generate accessible alt-text descriptions',
              steps: [{
                id: '1',
                name: 'Process Images',
                status: 'completed',
                output: response
              }],
              estimatedTotalDuration: 1000,
              priority: 'medium',
              metadata: { agentType: 'image-alt-text-specialist' }
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
          imageAgent.status = 'idle';
          console.error('Image alt-text agent processing failed:', error);
          // Fall back to default orchestration
        }
      }
    }

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
          const response = await (agent as unknown as { processRequest(req: { id: string; content: string; type: string; timestamp: Date }): Promise<unknown> }).processRequest({
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

  /**
   * Get performance metrics from the orchestrator
   */
  getPerformanceMetrics() {
    return this.performanceManager.getMetrics();
  }

  /**
   * Get performance health status
   */
  async getPerformanceHealth() {
    return await this.performanceManager.getHealth();
  }

  /**
   * Get performance report with recommendations
   */
  getPerformanceReport() {
    return this.performanceManager.getPerformanceReport();
  }

  /**
   * Configure caching for specific request patterns
   */
  configureCaching(patterns: { pattern: string; ttl: number; tags?: string[] }[]) {
    // This would be implemented to configure automatic caching rules
    patterns.forEach(({ pattern, ttl, tags }) => {
      console.info(`Configured caching for pattern: ${pattern}, TTL: ${ttl}ms, tags: ${tags?.join(', ') || 'none'}`);
    });
  }

  /**
   * Update performance configuration at runtime
   */
  updatePerformanceConfig(config: Partial<PerformanceConfig>) {
    console.info('Performance configuration updated:', config);
    // This would merge with existing configuration and apply changes
  }

  /**
   * Force cache invalidation by tags or patterns
   */
  async invalidateCache(options: { tags?: string[]; pattern?: string }) {
    await this.performanceManager['cacheManager'].invalidate(options);
  }

  /**
   * Get circuit breaker status for all services
   */
  getCircuitBreakerStatus() {
    return this.performanceManager['circuitBreakerFactory'].getAllHealth();
  }

  /**
   * Reset specific circuit breaker
   */
  resetCircuitBreaker(name: string) {
    const breaker = this.performanceManager['circuitBreakerFactory']['breakers'].get(name);
    if (breaker) {
      breaker.reset();
      console.info(`Circuit breaker ${name} reset`);
    }
  }

  /**
   * Enhanced initialization with performance setup
   */
  async initialize(): Promise<void> {
    await super.initialize();
    console.info('UniversalOrchestrator initialized with performance optimizations');
  }

  /**
   * Cleanup with performance manager destruction
   */
  async terminate(): Promise<void> {
    await this.performanceManager.destroy();
    await super.terminate();
  }
}