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
});