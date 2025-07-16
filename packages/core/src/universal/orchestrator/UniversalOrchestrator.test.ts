/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UniversalOrchestrator } from './UniversalOrchestrator.js';
import { OrchestratorConfig } from '../config/OrchestratorConfig.js';
import { IRequestAnalyzer, IRequestRouter } from '../interfaces/IRequestHandler.js';
import { IWorkflowManager } from '../interfaces/IWorkflowManager.js';
import { IEventSystem } from '../interfaces/IEventSystem.js';
import { AgentInstance } from '../types/common.js';
import { AgentFactory } from '../agents/AgentFactory.js';
import { MarkItDownAgent } from '../agents/MarkItDownAgent.js';

// Mock implementations
class MockRequestAnalyzer implements IRequestAnalyzer {
  async analyze() {
    return {
      complexity: 'simple' as const,
      intent: 'test intent',
      domains: ['test'],
      requiredCapabilities: ['test-capability'],
      estimatedDuration: 1000,
      priority: 'medium' as const,
      metadata: {},
    };
  }

  async canHandle() {
    return true;
  }
}

class MockRequestRouter implements IRequestRouter {
  registerHandler = vi.fn();
  unregisterHandler = vi.fn();
  getHandlers = vi.fn(() => []);
  
  async route() {
    return {
      getId: () => 'mock-handler',
      getCapabilities: () => ['test'],
      canHandle: async () => true,
      getPriority: async () => 1,
      handle: async (request: unknown, analysis: unknown) => ({
        id: 'mock-response',
        requestId: (request as { id: string }).id,
        agents: [],
        workflow: {
          id: 'mock-workflow',
          name: 'Mock Workflow',
          description: (analysis as { intent: string }).intent,
          steps: [],
          estimatedTotalDuration: (analysis as { estimatedDuration: number }).estimatedDuration,
          priority: (analysis as { priority: 'low' | 'medium' | 'high' | 'critical' }).priority,
          metadata: (analysis as { metadata: Record<string, unknown> }).metadata,
        },
        status: 'completed' as const,
        metrics: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 1000,
          agentsUsed: 0,
          stepsCompleted: 0,
        },
      }),
    };
  }
}

class MockWorkflowManager implements IWorkflowManager {
  getPlanner = vi.fn();
  getExecutor = vi.fn();
  createAndExecute = vi.fn();
  getActiveWorkflows = vi.fn(() => Promise.resolve([]));
  getHistory = vi.fn(() => Promise.resolve([]));
}

class MockEventSystem implements IEventSystem {
  private events: unknown[] = [];
  
  async publish(event: unknown) {
    this.events.push(event);
  }
  
  async publishBatch(events: unknown[]) {
    this.events.push(...events);
  }
  
  subscribe = vi.fn(() => 'sub-id');
  unsubscribe = vi.fn();
  getSubscriptions = vi.fn(() => []);
  
  getStore = vi.fn(() => ({
    store: vi.fn(),
    retrieve: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(() => Promise.resolve(null)),
    cleanup: vi.fn(() => Promise.resolve(0)),
  }));
  
  async queryEvents() {
    return [];
  }
  
  async getEventsByType() {
    return [];
  }
  
  async getEventsBySource() {
    return [];
  }
  
  async getRecentEvents() {
    return [];
  }
  
  async initialize() {}
  async shutdown() {}
  async getMetrics() {
    return {
      eventsPublished: this.events.length,
      eventsStored: this.events.length,
      activeSubscriptions: 0,
      averageProcessingTime: 100,
    };
  }
}

describe('UniversalOrchestrator', () => {
  let orchestrator: UniversalOrchestrator;
  let config: OrchestratorConfig;
  let mockAnalyzer: MockRequestAnalyzer;
  let mockRouter: MockRequestRouter;
  let mockWorkflowManager: MockWorkflowManager;
  let mockEventSystem: MockEventSystem;

  beforeEach(() => {
    config = {
      orchestrator: {
        id: 'test-orchestrator',
        name: 'Test Orchestrator',
        version: '1.0.0',
        environment: 'development',
      },
      agents: {
        maxAgents: 5,
        defaultTimeout: 30000,
        retryAttempts: 3,
        healthCheckInterval: 60000,
      },
      workflow: {
        maxConcurrentWorkflows: 3,
        stepTimeout: 120000,
        checkpointInterval: 10000,
        enableRollback: true,
      },
      events: {
        eventStore: { type: 'memory' },
        publisher: { batchSize: 100, flushInterval: 1000 },
      },
      performance: {
        metrics: { enabled: true, collectInterval: 5000, retention: 3600000 },
        cache: { enabled: true, maxSize: 1000, ttl: 300000 },
        concurrency: { maxConcurrentRequests: 20, queueSize: 100 },
      },
      security: {
        authentication: { enabled: false, providers: [] },
        authorization: { enabled: false, defaultRole: 'user' },
        encryption: { enabled: false, algorithm: 'AES-256-GCM', keyRotation: 86400000 },
      },
      logging: {
        level: 'info',
        format: 'text',
        outputs: ['console'],
      },
      features: {
        fallbackToGemini: true,
        experimentalFeatures: [],
      },
    };

    mockAnalyzer = new MockRequestAnalyzer();
    mockRouter = new MockRequestRouter();
    mockWorkflowManager = new MockWorkflowManager();
    mockEventSystem = new MockEventSystem();

    orchestrator = new UniversalOrchestrator(
      config,
      mockAnalyzer,
      mockRouter,
      mockWorkflowManager,
      mockEventSystem
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await orchestrator.initialize({});
      
      const agents = await orchestrator.getAvailableAgents();
      
      // Should have initialized default agents
      expect(agents.length).toBeGreaterThan(0);
      
      // Check for expected agent types
      const agentTypes = agents.map(agent => agent.type);
      expect(agentTypes).toContain('gemini');
      expect(agentTypes).toContain('task-master');
      expect(agentTypes).toContain('analysis');
      expect(agentTypes).toContain('markdown-specialist');
    });

    it('should throw error if already initialized', async () => {
      await orchestrator.initialize({});
      
      await expect(orchestrator.initialize({})).rejects.toThrow(
        'Orchestrator already initialized'
      );
    });
  });

  describe('agent management', () => {
    beforeEach(async () => {
      await orchestrator.initialize({});
    });

    it('should add new agent', async () => {
      const newAgent: AgentInstance = {
        id: 'custom-agent',
        type: 'custom',
        capabilities: [],
        status: 'idle',
        configuration: {},
        performance: {
          successRate: 1.0,
          averageResponseTime: 500,
          tasksCompleted: 0,
        },
      };

      await orchestrator.addAgent(newAgent);
      
      const agent = orchestrator.getAgent('custom-agent');
      expect(agent).toBeDefined();
      expect(agent?.id).toBe('custom-agent');
    });

    it('should remove agent', async () => {
      const agents = await orchestrator.getAvailableAgents();
      const agentToRemove = agents[0];
      
      const removed = await orchestrator.removeAgent(agentToRemove.id);
      
      expect(removed).toBe(true);
      expect(orchestrator.getAgent(agentToRemove.id)).toBeUndefined();
    });

    it('should update agent status', async () => {
      const agents = await orchestrator.getAvailableAgents();
      const agent = agents[0];
      
      await orchestrator.updateAgentStatus(agent.id, 'busy');
      
      const updatedAgent = orchestrator.getAgent(agent.id);
      expect(updatedAgent?.status).toBe('busy');
    });

    it('should get agents by capability', async () => {
      const agents = orchestrator.getAgentsByCapability('text-generation');
      
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].capabilities.some(cap => cap.name === 'text-generation')).toBe(true);
    });

    it('should get idle agents', async () => {
      const idleAgents = orchestrator.getIdleAgents();
      
      expect(idleAgents.length).toBeGreaterThan(0);
      expect(idleAgents.every(agent => agent.status === 'idle')).toBe(true);
    });
  });

  describe('orchestration', () => {
    beforeEach(async () => {
      await orchestrator.initialize({});
    });

    it('should orchestrate a request successfully', async () => {
      const request = {
        id: 'test-request',
        userInput: 'Test user input',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      const response = await orchestrator.orchestrate(request);
      
      expect(response).toBeDefined();
      expect(response.requestId).toBe(request.id);
      expect(response.status).toBe('completed');
    });

    it('should throw error if not initialized', async () => {
      // Create a fresh orchestrator without initialization
      const freshOrchestrator = new UniversalOrchestrator(
        config,
        mockAnalyzer,
        mockRouter,
        mockWorkflowManager,
        mockEventSystem
      );

      const request = {
        id: 'test-request',
        userInput: 'Test user input',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      await expect(freshOrchestrator.orchestrate(request)).rejects.toThrow(
        'Orchestrator not initialized'
      );
    });

    it('should get orchestration status', async () => {
      const status = await orchestrator.getStatus('nonexistent-request');
      
      expect(status).toBe('failed');
    });

    it('should cancel orchestration', async () => {
      const cancelled = await orchestrator.cancel('nonexistent-request');
      
      expect(cancelled).toBe(false);
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await orchestrator.initialize({});
    });

    it('should get orchestration metrics', async () => {
      const metrics = await orchestrator.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await orchestrator.initialize({});
    });

    it('should shutdown gracefully', async () => {
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
    });
  });

  describe('MarkItDown Agent Integration', () => {
    let agentFactory: AgentFactory;

    beforeEach(async () => {
      await orchestrator.initialize({});
      agentFactory = (orchestrator as any).agentFactory;
    });

    it('should initialize markdown agent on startup', async () => {
      const agents = await orchestrator.getAvailableAgents();
      const markdownAgent = agents.find(agent => agent.id === 'markdown-specialist');
      
      expect(markdownAgent).toBeDefined();
      expect(markdownAgent?.type).toBe('markdown-specialist');
      expect(markdownAgent?.capabilities).toHaveLength(3);
      expect(markdownAgent?.capabilities.map(c => c.name)).toEqual([
        'markdown-parsing',
        'document-analysis',
        'format-conversion'
      ]);
    });

    it('should register MarkItDown agent with factory', async () => {
      const availableTypes = agentFactory.getAvailableTypes();
      expect(availableTypes).toContain('markdown-specialist');
    });

    it('should detect markdown requests correctly', async () => {
      const isMarkdownRequest = (orchestrator as any).isMarkdownRequest.bind(orchestrator);
      
      const markdownRequests = [
        { userInput: 'Parse this markdown content' },
        { userInput: 'Generate table of contents for md file' },
        { userInput: 'Convert markdown to HTML' },
        { userInput: 'Extract headings from document' },
        { userInput: 'MarkItDown processing' },
        { userInput: 'analyze document structure' },
      ];

      const nonMarkdownRequests = [
        { userInput: 'What is the weather today?' },
        { userInput: 'Write a Python script' },
        { userInput: 'Explain quantum computing' },
        { userInput: 'Create a React component' },
      ];

      for (const request of markdownRequests) {
        expect(isMarkdownRequest(request)).toBe(true);
      }

      for (const request of nonMarkdownRequests) {
        expect(isMarkdownRequest(request)).toBe(false);
      }
    });

    it('should route markdown requests to MarkItDown agent', async () => {
      const markdownRequest = {
        id: 'test-markdown-request',
        userInput: 'Parse this markdown: # Hello World\\n\\nThis is a test.',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      // Mock agent creation
      const mockAgent = {
        processRequest: vi.fn().mockResolvedValue({
          success: true,
          result: {
            content: 'Parsed markdown content',
            headings: ['Hello World'],
            structure: { level1: 1, level2: 0 },
          },
          tools: ['parseMarkdown'],
        }),
      };

      vi.spyOn(agentFactory, 'createAgent').mockResolvedValue(mockAgent as any);

      const response = await orchestrator.orchestrate(markdownRequest);

      expect(response.agents).toHaveLength(1);
      expect(response.agents[0].id).toBe('markdown-specialist');
      expect(response.workflow.name).toBe('Markdown Processing Workflow');
      expect(response.status).toBe('completed');
      expect(mockAgent.processRequest).toHaveBeenCalledWith({
        id: 'test-markdown-request',
        content: 'Parse this markdown: # Hello World\\n\\nThis is a test.',
        type: 'markdown-processing',
        timestamp: expect.any(Date),
      });
    });

    it('should handle agent busy state correctly', async () => {
      const markdownRequest = {
        id: 'test-request',
        userInput: 'Parse markdown content',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      // Set markdown agent to busy
      await orchestrator.updateAgentStatus('markdown-specialist', 'busy');

      const mockAgent = {
        processRequest: vi.fn().mockResolvedValue({
          success: true,
          result: 'Fallback processed',
        }),
      };

      vi.spyOn(agentFactory, 'createAgent').mockResolvedValue(mockAgent as any);

      // Mock the super.orchestrate method for fallback
      const superOrchestrate = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(orchestrator)), 'orchestrate');
      superOrchestrate.mockResolvedValue({
        id: 'fallback-response',
        status: 'completed',
        result: 'Fallback processed',
      });

      const response = await orchestrator.orchestrate(markdownRequest);

      expect(superOrchestrate).toHaveBeenCalledWith(markdownRequest);
      expect(response.id).toBe('fallback-response');
    });

    it('should fall back to default orchestration when markdown agent fails', async () => {
      const markdownRequest = {
        id: 'test-request',
        userInput: 'Parse this markdown content',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      // Mock agent creation failure
      vi.spyOn(agentFactory, 'createAgent').mockRejectedValue(new Error('Agent creation failed'));
      
      // Mock the super.orchestrate method
      const superOrchestrate = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(orchestrator)), 'orchestrate');
      superOrchestrate.mockResolvedValue({
        id: 'fallback-response',
        status: 'completed',
        result: 'Fallback processed',
      });

      const response = await orchestrator.orchestrate(markdownRequest);

      expect(superOrchestrate).toHaveBeenCalledWith(markdownRequest);
      expect(response.id).toBe('fallback-response');
    });

    it('should handle agent capabilities correctly', async () => {
      const markdownAgents = orchestrator.getAgentsByCapability('markdown-parsing');
      expect(markdownAgents).toHaveLength(1);
      expect(markdownAgents[0].id).toBe('markdown-specialist');

      const documentAnalysisAgents = orchestrator.getAgentsByCapability('document-analysis');
      expect(documentAnalysisAgents).toHaveLength(1);
      expect(documentAnalysisAgents[0].id).toBe('markdown-specialist');

      const formatConversionAgents = orchestrator.getAgentsByCapability('format-conversion');
      expect(formatConversionAgents).toHaveLength(1);
      expect(formatConversionAgents[0].id).toBe('markdown-specialist');
    });

    it('should update agent performance metrics', async () => {
      const markdownRequest = {
        id: 'test-request',
        userInput: 'Parse markdown content',
        sessionContext: {
          sessionId: 'test-session',
          workspaceRoot: '/test',
          timestamp: new Date(),
          metadata: {},
        },
        timestamp: new Date(),
      };

      const mockAgent = {
        processRequest: vi.fn().mockResolvedValue({
          success: true,
          result: 'Processed',
        }),
      };

      vi.spyOn(agentFactory, 'createAgent').mockResolvedValue(mockAgent as any);

      const initialAgent = orchestrator.getAgent('markdown-specialist');
      const initialTasksCompleted = initialAgent?.performance.tasksCompleted || 0;

      await orchestrator.orchestrate(markdownRequest);

      const updatedAgent = orchestrator.getAgent('markdown-specialist');
      expect(updatedAgent?.performance.tasksCompleted).toBe(initialTasksCompleted + 1);
      expect(updatedAgent?.status).toBe('idle');
    });

    it('should create MarkItDown agent through factory', async () => {
      const config = {
        id: 'test-markdown-agent',
        domain: 'document-processing',
        role: 'markdown-specialist',
        capabilities: ['markdown-parsing'],
        tools: ['parseMarkdown'],
      };

      const agent = await agentFactory.createAgent(config);
      
      expect(agent).toBeInstanceOf(MarkItDownAgent);
      expect(agent.id).toBe('test-markdown-agent');
    });
  });
});