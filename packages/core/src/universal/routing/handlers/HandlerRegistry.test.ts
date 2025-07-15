/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HandlerRegistry } from './HandlerRegistry.js';
import { IRequestHandler } from '../../interfaces/IRequestHandler.js';

// Mock handler implementation
class MockHandler implements IRequestHandler {
  constructor(
    private id: string,
    private capabilities: string[]
  ) {}

  getId(): string {
    return this.id;
  }

  getCapabilities(): string[] {
    return this.capabilities;
  }

  async canHandle(): Promise<boolean> {
    return true;
  }

  async getPriority(): Promise<number> {
    return 1;
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

describe('HandlerRegistry', () => {
  let registry: HandlerRegistry;
  let mockHandler: IRequestHandler;

  beforeEach(() => {
    registry = new HandlerRegistry();
    mockHandler = new MockHandler('test-handler', ['test-capability', 'another-capability']);
  });

  describe('handler registration', () => {
    it('should register a handler successfully', () => {
      registry.register(mockHandler);
      
      expect(registry.getHandler('test-handler')).toBe(mockHandler);
      expect(registry.getAllHandlers()).toContain(mockHandler);
      expect(registry.size()).toBe(1);
    });

    it('should throw error when registering duplicate handler ID', () => {
      registry.register(mockHandler);
      
      expect(() => registry.register(mockHandler))
        .toThrow("Handler with ID 'test-handler' already registered");
    });

    it('should unregister a handler successfully', () => {
      registry.register(mockHandler);
      
      const result = registry.unregister('test-handler');
      
      expect(result).toBe(true);
      expect(registry.getHandler('test-handler')).toBeUndefined();
      expect(registry.getAllHandlers()).not.toContain(mockHandler);
      expect(registry.size()).toBe(0);
    });

    it('should return false when unregistering non-existent handler', () => {
      const result = registry.unregister('non-existent-handler');
      expect(result).toBe(false);
    });
  });

  describe('capability indexing', () => {
    it('should index handlers by capabilities', () => {
      registry.register(mockHandler);
      
      const handlersByCapability = registry.getHandlersByCapability('test-capability');
      expect(handlersByCapability).toContain(mockHandler);
      
      const handlersByAnotherCapability = registry.getHandlersByCapability('another-capability');
      expect(handlersByAnotherCapability).toContain(mockHandler);
    });

    it('should return empty array for non-existent capability', () => {
      const handlers = registry.getHandlersByCapability('non-existent-capability');
      expect(handlers).toEqual([]);
    });

    it('should update capability index when handler is unregistered', () => {
      registry.register(mockHandler);
      registry.unregister('test-handler');
      
      const handlersByCapability = registry.getHandlersByCapability('test-capability');
      expect(handlersByCapability).toEqual([]);
    });

    it('should handle multiple handlers with same capability', () => {
      const handler1 = new MockHandler('handler1', ['shared-capability']);
      const handler2 = new MockHandler('handler2', ['shared-capability']);
      
      registry.register(handler1);
      registry.register(handler2);
      
      const handlers = registry.getHandlersByCapability('shared-capability');
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
      expect(handlers).toHaveLength(2);
    });

    it('should get all available capabilities', () => {
      const handler1 = new MockHandler('handler1', ['capability1', 'capability2']);
      const handler2 = new MockHandler('handler2', ['capability2', 'capability3']);
      
      registry.register(handler1);
      registry.register(handler2);
      
      const capabilities = registry.getCapabilities();
      expect(capabilities).toContain('capability1');
      expect(capabilities).toContain('capability2');
      expect(capabilities).toContain('capability3');
      expect(capabilities).toHaveLength(3);
    });
  });

  describe('handler enabling/disabling', () => {
    beforeEach(() => {
      registry.register(mockHandler);
    });

    it('should enable and disable handlers', () => {
      const disabled = registry.disableHandler('test-handler');
      expect(disabled).toBe(true);
      expect(registry.getHandler('test-handler')).toBeUndefined();
      expect(registry.getAllHandlers()).not.toContain(mockHandler);
      
      const enabled = registry.enableHandler('test-handler');
      expect(enabled).toBe(true);
      expect(registry.getHandler('test-handler')).toBe(mockHandler);
      expect(registry.getAllHandlers()).toContain(mockHandler);
    });

    it('should return false when enabling/disabling non-existent handler', () => {
      expect(registry.enableHandler('non-existent')).toBe(false);
      expect(registry.disableHandler('non-existent')).toBe(false);
    });

    it('should exclude disabled handlers from capability searches', () => {
      registry.disableHandler('test-handler');
      
      const handlers = registry.getHandlersByCapability('test-capability');
      expect(handlers).not.toContain(mockHandler);
    });
  });

  describe('metrics tracking', () => {
    beforeEach(() => {
      registry.register(mockHandler);
    });

    it('should update handler metrics', () => {
      registry.updateHandlerMetrics('test-handler', 500, true);
      
      const registration = registry.getHandlerRegistration('test-handler');
      expect(registration!.usageCount).toBe(1);
      expect(registration!.averageResponseTime).toBe(500);
      expect(registration!.successRate).toBe(1.0);
      expect(registration!.lastUsed).toBeInstanceOf(Date);
    });

    it('should calculate running averages correctly', () => {
      // First call: 1000ms, success
      registry.updateHandlerMetrics('test-handler', 1000, true);
      
      // Second call: 500ms, success
      registry.updateHandlerMetrics('test-handler', 500, true);
      
      const registration = registry.getHandlerRegistration('test-handler');
      expect(registration!.usageCount).toBe(2);
      expect(registration!.averageResponseTime).toBe(750); // (1000 + 500) / 2
      expect(registration!.successRate).toBe(1.0); // 100% success
    });

    it('should handle failure in success rate calculation', () => {
      registry.updateHandlerMetrics('test-handler', 1000, true);
      registry.updateHandlerMetrics('test-handler', 500, false);
      
      const registration = registry.getHandlerRegistration('test-handler');
      expect(registration!.successRate).toBe(0.5); // 50% success rate
    });

    it('should ignore metrics update for non-existent handler', () => {
      registry.updateHandlerMetrics('non-existent', 1000, true);
      // Should not throw error, just silently ignore
    });

    it('should provide handler statistics', () => {
      registry.updateHandlerMetrics('test-handler', 1000, true);
      
      const stats = registry.getHandlerStats();
      expect(stats['test-handler']).toBeDefined();
      expect(stats['test-handler'].usageCount).toBe(1);
      expect(stats['test-handler'].averageResponseTime).toBe(1000);
      expect(stats['test-handler'].successRate).toBe(1.0);
      expect(stats['test-handler'].enabled).toBe(true);
    });
  });

  describe('best handler selection', () => {
    beforeEach(() => {
      const handler1 = new MockHandler('handler1', ['shared-capability']);
      const handler2 = new MockHandler('handler2', ['shared-capability']);
      const handler3 = new MockHandler('handler3', ['shared-capability']);
      
      registry.register(handler1);
      registry.register(handler2);
      registry.register(handler3);
    });

    it('should return undefined for non-existent capability', () => {
      const bestHandler = registry.findBestHandlerForCapability('non-existent');
      expect(bestHandler).toBeUndefined();
    });

    it('should return the only handler if only one available', () => {
      const singleHandler = new MockHandler('single', ['unique-capability']);
      registry.register(singleHandler);
      
      const bestHandler = registry.findBestHandlerForCapability('unique-capability');
      expect(bestHandler).toBe(singleHandler);
    });

    it('should select handler with better performance metrics', () => {
      // Set up performance data
      registry.updateHandlerMetrics('handler1', 100, true);  // Fast, reliable
      registry.updateHandlerMetrics('handler1', 200, true);
      
      registry.updateHandlerMetrics('handler2', 1000, true); // Slow but reliable
      registry.updateHandlerMetrics('handler2', 1500, true);
      
      registry.updateHandlerMetrics('handler3', 300, false); // Fast but unreliable
      registry.updateHandlerMetrics('handler3', 250, false);
      
      const bestHandler = registry.findBestHandlerForCapability('shared-capability');
      expect(bestHandler!.getId()).toBe('handler1');
    });

    it('should exclude disabled handlers from selection', () => {
      registry.updateHandlerMetrics('handler1', 100, true);
      registry.disableHandler('handler1');
      
      const bestHandler = registry.findBestHandlerForCapability('shared-capability');
      expect(bestHandler!.getId()).not.toBe('handler1');
    });

    it('should give new handlers benefit of doubt', () => {
      // handler1 has poor performance
      registry.updateHandlerMetrics('handler1', 2000, false);
      registry.updateHandlerMetrics('handler1', 3000, false);
      
      // handler2 is new (no metrics)
      // handler3 has some good performance
      registry.updateHandlerMetrics('handler3', 500, true);
      
      const bestHandler = registry.findBestHandlerForCapability('shared-capability');
      // Should prefer handler3 or handler2 over handler1
      expect(bestHandler!.getId()).not.toBe('handler1');
    });
  });

  describe('registry management', () => {
    it('should clear all handlers and capabilities', () => {
      registry.register(mockHandler);
      registry.clear();
      
      expect(registry.size()).toBe(0);
      expect(registry.getAllHandlers()).toEqual([]);
      expect(registry.getCapabilities()).toEqual([]);
    });

    it('should provide accurate size count', () => {
      expect(registry.size()).toBe(0);
      
      registry.register(mockHandler);
      expect(registry.size()).toBe(1);
      
      const anotherHandler = new MockHandler('another', ['another-capability']);
      registry.register(anotherHandler);
      expect(registry.size()).toBe(2);
      
      registry.unregister('test-handler');
      expect(registry.size()).toBe(1);
    });

    it('should handle handler registration edge cases', () => {
      const handlerWithNoCapabilities = new MockHandler('no-caps', []);
      registry.register(handlerWithNoCapabilities);
      
      expect(registry.getHandler('no-caps')).toBe(handlerWithNoCapabilities);
      expect(registry.getAllHandlers()).toContain(handlerWithNoCapabilities);
    });
  });

  describe('registration details', () => {
    it('should track registration timestamp', () => {
      const beforeRegistration = new Date();
      registry.register(mockHandler);
      const afterRegistration = new Date();
      
      const registration = registry.getHandlerRegistration('test-handler');
      expect(registration!.registeredAt.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
      expect(registration!.registeredAt.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());
    });

    it('should initialize registration with default values', () => {
      registry.register(mockHandler);
      
      const registration = registry.getHandlerRegistration('test-handler');
      expect(registration!.handler).toBe(mockHandler);
      expect(registration!.usageCount).toBe(0);
      expect(registration!.averageResponseTime).toBe(0);
      expect(registration!.successRate).toBe(1.0);
      expect(registration!.enabled).toBe(true);
      expect(registration!.lastUsed).toBeUndefined();
    });

    it('should return undefined for non-existent handler registration', () => {
      const registration = registry.getHandlerRegistration('non-existent');
      expect(registration).toBeUndefined();
    });
  });
});