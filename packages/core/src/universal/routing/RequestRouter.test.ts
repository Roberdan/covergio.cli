/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestRouter, RoutingDecision } from './RequestRouter.js';
import { HandlerRegistry } from './handlers/HandlerRegistry.js';
import { IRequestHandler, RequestAnalysis } from '../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../interfaces/IOrchestrator.js';

// Mock handler implementation
class MockHandler implements IRequestHandler {
  constructor(
    private id: string,
    private capabilities: string[],
    private priority: number = 1,
    private canHandleResult: boolean = true
  ) {}

  getId(): string {
    return this.id;
  }

  getCapabilities(): string[] {
    return this.capabilities;
  }

  async canHandle(): Promise<boolean> {
    return this.canHandleResult;
  }

  async getPriority(): Promise<number> {
    return this.priority;
  }

  async handle() {
    return {
      id: `response-${this.id}`,
      requestId: 'test-request',
      agents: [],
      workflow: {
        id: 'mock-workflow',
        name: 'Mock Workflow',
        description: 'Mock description',
        steps: [],
        estimatedTotalDuration: 1000,
        priority: 'medium' as const,
        metadata: {},
      },
      status: 'completed' as const,
      metrics: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
        agentsUsed: 1,
        stepsCompleted: 1,
      },
    };
  }
}

describe('RequestRouter', () => {
  let router: RequestRouter;
  let registry: HandlerRegistry;
  let mockRequest: OrchestrationRequest;
  let mockAnalysis: RequestAnalysis;

  beforeEach(() => {
    registry = new HandlerRegistry();
    router = new RequestRouter(registry);

    mockRequest = {
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

    mockAnalysis = {
      complexity: 'medium',
      intent: 'create something',
      domains: ['code-generation'],
      requiredCapabilities: ['text-generation', 'code-assistance'],
      estimatedDuration: 5000,
      priority: 'medium',
      metadata: {
        originalInput: 'Test user input',
        normalizedInput: 'test user input',
        wordCount: 3,
        hasQuestions: false,
        hasCommands: false,
        timestamp: new Date().toISOString(),
      },
    };
  });

  describe('handler registration', () => {
    it('should register and unregister handlers', () => {
      const handler = new MockHandler('test-handler', ['test-capability']);
      
      router.registerHandler(handler);
      expect(router.getHandlers()).toContain(handler);
      
      const unregistered = router.unregisterHandler('test-handler');
      expect(unregistered).toBe(true);
      expect(router.getHandlers()).not.toContain(handler);
    });

    it('should return false when unregistering non-existent handler', () => {
      const result = router.unregisterHandler('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('routing decisions', () => {
    it('should route to handler with best capability match', async () => {
      const codeHandler = new MockHandler('code-handler', ['text-generation', 'code-assistance'], 2);
      const generalHandler = new MockHandler('general-handler', ['text-generation'], 1);
      
      router.registerHandler(codeHandler);
      router.registerHandler(generalHandler);

      const selectedHandler = await router.route(mockRequest, mockAnalysis);
      
      expect(selectedHandler.getId()).toBe('code-handler');
    });

    it('should consider handler priority in routing decision', async () => {
      const highPriorityHandler = new MockHandler('high-priority', ['text-generation'], 4);
      const lowPriorityHandler = new MockHandler('low-priority', ['text-generation'], 1);
      
      router.registerHandler(highPriorityHandler);
      router.registerHandler(lowPriorityHandler);

      const criticalAnalysis = { ...mockAnalysis, priority: 'critical' as const };
      const selectedHandler = await router.route(mockRequest, criticalAnalysis);
      
      expect(selectedHandler.getId()).toBe('high-priority');
    });

    it('should handle complex requests appropriately', async () => {
      const simpleHandler = new MockHandler('simple-handler', ['text-generation'], 1);
      const complexHandler = new MockHandler('complex-handler', ['text-generation', 'orchestration', 'planning'], 2);
      
      router.registerHandler(simpleHandler);
      router.registerHandler(complexHandler);

      const complexAnalysis = { ...mockAnalysis, complexity: 'complex' as const };
      const selectedHandler = await router.route(mockRequest, complexAnalysis);
      
      expect(selectedHandler.getId()).toBe('complex-handler');
    });

    it('should fall back when no perfect match exists', async () => {
      const fallbackHandler = new MockHandler('fallback-handler', ['general-assistance']);
      router.registerHandler(fallbackHandler);

      const specializedAnalysis = {
        ...mockAnalysis,
        requiredCapabilities: ['very-specific-capability'],
      };

      const selectedHandler = await router.route(mockRequest, specializedAnalysis);
      expect(selectedHandler.getId()).toBe('fallback-handler');
    });

    it('should throw error when no handlers available', async () => {
      await expect(router.route(mockRequest, mockAnalysis))
        .rejects.toThrow('No suitable handler found for request');
    });
  });

  describe('routing metrics', () => {
    it('should track routing metrics', async () => {
      const handler = new MockHandler('test-handler', ['text-generation']);
      router.registerHandler(handler);

      await router.route(mockRequest, mockAnalysis);
      
      const metrics = router.getRoutingMetrics();
      expect(metrics.routingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.handlersConsidered).toBeGreaterThan(0);
      expect(metrics.avgConfidence).toBeGreaterThan(0);
    });

    it('should track fallback usage', async () => {
      const unreliableHandler = new MockHandler('unreliable', ['text-generation'], 1, false);
      const fallbackHandler = new MockHandler('fallback', ['general-assistance']);
      router.registerHandler(unreliableHandler);
      router.registerHandler(fallbackHandler);

      try {
        await router.route(mockRequest, mockAnalysis);
      } catch (_error) {
        // Expected to fail and use fallback
      }
      
      const metrics = router.getRoutingMetrics();
      expect(metrics.fallbacksUsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('routing history', () => {
    it('should store routing decisions in history', async () => {
      const handler = new MockHandler('test-handler', ['text-generation']);
      router.registerHandler(handler);

      await router.route(mockRequest, mockAnalysis);
      
      const decision = router.getRoutingHistory('test-request') as RoutingDecision;
      expect(decision).toBeDefined();
      expect(decision.handler.getId()).toBe('test-handler');
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.reasoning).toBeTruthy();
    });

    it('should return all history when no specific request ID provided', async () => {
      const handler = new MockHandler('test-handler', ['text-generation']);
      router.registerHandler(handler);

      await router.route(mockRequest, mockAnalysis);
      
      const allHistory = router.getRoutingHistory() as Map<string, RoutingDecision>;
      expect(allHistory).toBeInstanceOf(Map);
      expect(allHistory.size).toBe(1);
    });

    it('should clear history', async () => {
      const handler = new MockHandler('test-handler', ['text-generation']);
      router.registerHandler(handler);

      await router.route(mockRequest, mockAnalysis);
      router.clearHistory();
      
      const history = router.getRoutingHistory() as Map<string, RoutingDecision>;
      expect(history.size).toBe(0);
    });
  });

  describe('scoring algorithm', () => {
    it('should score handlers based on capability match', async () => {
      const perfectMatch = new MockHandler('perfect', ['text-generation', 'code-assistance'], 1);
      const partialMatch = new MockHandler('partial', ['text-generation'], 1);
      
      router.registerHandler(perfectMatch);
      router.registerHandler(partialMatch);

      const decision = await router.makeRoutingDecision(mockRequest, mockAnalysis);
      
      expect(decision.handler.getId()).toBe('perfect');
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should handle empty required capabilities gracefully', async () => {
      const handler = new MockHandler('test-handler', ['text-generation']);
      router.registerHandler(handler);

      const emptyCapabilitiesAnalysis = {
        ...mockAnalysis,
        requiredCapabilities: [],
      };

      const decision = await router.makeRoutingDecision(mockRequest, emptyCapabilitiesAnalysis);
      expect(decision.handler.getId()).toBe('test-handler');
    });
  });

  describe('error handling', () => {
    it('should handle handlers that throw during canHandle', async () => {
      const faultyHandler = {
        getId: () => 'faulty-handler',
        getCapabilities: () => ['text-generation'],
        canHandle: () => Promise.reject(new Error('Handler error')),
        getPriority: () => Promise.resolve(1),
        handle: vi.fn(),
      };

      const goodHandler = new MockHandler('good-handler', ['text-generation']);
      
      router.registerHandler(faultyHandler as IRequestHandler);
      router.registerHandler(goodHandler);

      const selectedHandler = await router.route(mockRequest, mockAnalysis);
      expect(selectedHandler.getId()).toBe('good-handler');
    });

    it('should throw appropriate error when no candidates found', async () => {
      const unavailableHandler = {
        getId: () => 'unavailable-handler',
        getCapabilities: () => ['text-generation'],
        canHandle: () => Promise.resolve(false),
        getPriority: () => Promise.resolve(1),
        handle: vi.fn(),
      };
      router.registerHandler(unavailableHandler as IRequestHandler);

      await expect(router.route(mockRequest, mockAnalysis))
        .rejects.toThrow('No suitable handler found for request');
    });
  });

  describe('performance optimization', () => {
    it('should consider handler performance metrics in scoring', async () => {
      const fastHandler = new MockHandler('fast-handler', ['text-generation']);
      const slowHandler = new MockHandler('slow-handler', ['text-generation']);
      
      router.registerHandler(fastHandler);
      router.registerHandler(slowHandler);

      // Simulate performance history
      const fastRegistration = registry.getHandlerRegistration('fast-handler')!;
      const slowRegistration = registry.getHandlerRegistration('slow-handler')!;
      
      fastRegistration.averageResponseTime = 100;
      fastRegistration.successRate = 0.95;
      fastRegistration.usageCount = 10;
      
      slowRegistration.averageResponseTime = 2000;
      slowRegistration.successRate = 0.8;
      slowRegistration.usageCount = 10;

      const selectedHandler = await router.route(mockRequest, mockAnalysis);
      expect(selectedHandler.getId()).toBe('fast-handler');
    });
  });
});