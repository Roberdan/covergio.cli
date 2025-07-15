/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, EventUtils } from './EventBus.js';
import { OrchestrationEvent } from '../interfaces/IEventSystem.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({
      enableWildcards: true,
      maxListeners: 100,
      enableMetrics: true,
    });
  });

  describe('basic event emission and listening', () => {
    it('should emit and receive events', async () => {
      const callback = vi.fn();
      eventBus.on('test.event', callback);

      const event: OrchestrationEvent = {
        id: 'test-1',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
        data: { message: 'Hello' },
      };

      await eventBus.emit(event);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should handle multiple listeners for same event', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test.event', callback1);
      eventBus.on('test.event', callback2);

      const event: OrchestrationEvent = {
        id: 'test-1',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      };

      await eventBus.emit(event);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
    });

    it('should not call listeners for different event types', async () => {
      const callback = vi.fn();
      eventBus.on('test.event1', callback);

      const event: OrchestrationEvent = {
        id: 'test-1',
        type: 'test.event2',
        source: 'test',
        timestamp: new Date(),
      };

      await eventBus.emit(event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('listener management', () => {
    it('should unsubscribe listeners', async () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on('test.event', callback);

      // First event should be received
      await eventBus.emit({
        id: 'test-1',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second event should not be received
      await eventBus.emit({
        id: 'test-2',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle once listeners', async () => {
      const callback = vi.fn();
      eventBus.once('test.event', callback);

      // First event should be received
      await eventBus.emit({
        id: 'test-1',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Second event should not be received
      await eventBus.emit({
        id: 'test-2',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for event type', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test.event', callback1);
      eventBus.on('test.event', callback2);

      expect(eventBus.hasListeners('test.event')).toBe(true);

      eventBus.removeAllListeners('test.event');

      expect(eventBus.hasListeners('test.event')).toBe(false);
    });

    it('should remove all listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test.event1', callback1);
      eventBus.on('test.event2', callback2);

      expect(eventBus.hasListeners('test.event1')).toBe(true);
      expect(eventBus.hasListeners('test.event2')).toBe(true);

      eventBus.removeAllListeners();

      expect(eventBus.hasListeners('test.event1')).toBe(false);
      expect(eventBus.hasListeners('test.event2')).toBe(false);
    });

    it('should enforce listener limit', () => {
      const limitedBus = new EventBus({ maxListeners: 2 });

      limitedBus.on('test.event', vi.fn());
      limitedBus.on('test.event', vi.fn());

      expect(() => limitedBus.on('test.event', vi.fn()))
        .toThrow('Maximum listeners limit (2) reached');
    });
  });

  describe('priority handling', () => {
    it('should execute listeners in priority order', async () => {
      const executionOrder: number[] = [];

      eventBus.on('test.priority', () => { executionOrder.push(1); }, 1);
      eventBus.on('test.priority', () => { executionOrder.push(3); }, 3);
      eventBus.on('test.priority', () => { executionOrder.push(2); }, 2);

      await eventBus.emit({
        id: 'priority-test',
        type: 'test.priority',
        source: 'test',
        timestamp: new Date(),
      });

      expect(executionOrder).toEqual([3, 2, 1]);
    });

    it('should handle equal priority listeners', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test.equal', callback1, 1);
      eventBus.on('test.equal', callback2, 1);

      await eventBus.emit({
        id: 'equal-test',
        type: 'test.equal',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('wildcard support', () => {
    it('should match wildcard patterns', async () => {
      const callback = vi.fn();
      eventBus.on('test.*', callback);

      const event1: OrchestrationEvent = {
        id: 'test-1',
        type: 'test.event1',
        source: 'test',
        timestamp: new Date(),
      };

      const event2: OrchestrationEvent = {
        id: 'test-2',
        type: 'test.event2',
        source: 'test',
        timestamp: new Date(),
      };

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(callback).toHaveBeenCalledWith(event1);
      expect(callback).toHaveBeenCalledWith(event2);
    });

    it('should match single character wildcards', async () => {
      const callback = vi.fn();
      eventBus.on('test.event?', callback);

      const event1: OrchestrationEvent = {
        id: 'test-1',
        type: 'test.event1',
        source: 'test',
        timestamp: new Date(),
      };

      const event2: OrchestrationEvent = {
        id: 'test-2',
        type: 'test.event12',
        source: 'test',
        timestamp: new Date(),
      };

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(callback).toHaveBeenCalledWith(event1);
      expect(callback).not.toHaveBeenCalledWith(event2);
    });

    it('should work with wildcards disabled', async () => {
      const noWildcardBus = new EventBus({ enableWildcards: false });
      const callback = vi.fn();

      noWildcardBus.on('test.*', callback);

      await noWildcardBus.emit({
        id: 'test-1',
        type: 'test.event1',
        source: 'test',
        timestamp: new Date(),
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle listener errors gracefully', async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error('Listener error'));
      const normalCallback = vi.fn();

      eventBus.on('test.error', errorCallback);
      eventBus.on('test.error', normalCallback);

      const event: OrchestrationEvent = {
        id: 'error-test',
        type: 'test.error',
        source: 'test',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(eventBus.emit(event)).resolves.not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should track error count in metrics', async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error('Test error'));
      eventBus.on('test.error', errorCallback);

      await eventBus.emit({
        id: 'error-test',
        type: 'test.error',
        source: 'test',
        timestamp: new Date(),
      });

      const metrics = eventBus.getMetrics();
      expect(metrics.errorCount).toBe(1);
    });
  });

  describe('metrics collection', () => {
    it('should collect event metrics', async () => {
      const callback = vi.fn();
      eventBus.on('test.metrics', callback);

      const events: OrchestrationEvent[] = Array.from({ length: 3 }, (_, i) => ({
        id: `metrics-${i}`,
        type: 'test.metrics',
        source: 'test',
        timestamp: new Date(),
      }));

      for (const event of events) {
        await eventBus.emit(event);
      }

      const metrics = eventBus.getMetrics();
      expect(metrics.totalEvents).toBe(3);
      expect(metrics.totalListeners).toBe(1);
      expect(metrics.eventTypeDistribution['test.metrics']).toBe(3);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('should track listener count', () => {
      eventBus.on('test.count1', vi.fn());
      eventBus.on('test.count2', vi.fn());
      eventBus.on('test.count1', vi.fn());

      const metrics = eventBus.getMetrics();
      expect(metrics.totalListeners).toBe(3);
    });
  });

  describe('listener introspection', () => {
    it('should get listeners for event type', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on('test.introspect', callback1, 1);
      eventBus.on('test.introspect', callback2, 2);

      const listeners = eventBus.getListeners('test.introspect');
      expect(listeners).toHaveLength(2);
      expect(listeners[0].priority).toBe(2); // Higher priority first
      expect(listeners[1].priority).toBe(1);
    });

    it('should check if event has listeners', () => {
      expect(eventBus.hasListeners('test.nonexistent')).toBe(false);

      eventBus.on('test.exists', vi.fn());
      expect(eventBus.hasListeners('test.exists')).toBe(true);
    });

    it('should get all event types', () => {
      eventBus.on('test.type1', vi.fn());
      eventBus.on('test.type2', vi.fn());
      eventBus.on('test.*', vi.fn());

      const eventTypes = eventBus.getEventTypes();
      expect(eventTypes).toContain('test.type1');
      expect(eventTypes).toContain('test.type2');
      expect(eventTypes).toContain('test.*');
    });
  });
});

describe('EventUtils', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('namespace creation', () => {
    it('should create namespaced event emitter', async () => {
      const namespace = EventUtils.createNamespace('test-namespace', eventBus);
      const callback = vi.fn();

      namespace.on('event', callback);

      await namespace.emit('event', { data: { message: 'Hello' } });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0];
      expect(event.type).toBe('test-namespace.event');
      expect(event.source).toBe('test-namespace');
    });

    it('should handle namespaced once listeners', async () => {
      const namespace = EventUtils.createNamespace('test-namespace', eventBus);
      const callback = vi.fn();

      namespace.once('event', callback);

      await namespace.emit('event', {});
      await namespace.emit('event', {});

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('typed emitter creation', () => {
    it('should create typed event emitter', async () => {
      interface TestData {
        message: string;
        count: number;
      }

      const typedEmitter = EventUtils.createTypedEmitter<TestData>('test.typed', eventBus);
      const callback = vi.fn();

      typedEmitter.on(callback);

      await typedEmitter.emit({
        message: 'Hello',
        count: 42,
      });

      expect(callback).toHaveBeenCalled();
      const [data, event] = callback.mock.calls[0];
      expect(data.message).toBe('Hello');
      expect(data.count).toBe(42);
      expect(event.type).toBe('test.typed');
    });
  });

  describe('pipeline creation', () => {
    it('should create event processing pipeline', async () => {
      const pipeline = EventUtils.createPipeline([
        (event) => ({ ...event, data: { ...event.data, step1: true } }),
        (event) => ({ ...event, data: { ...event.data, step2: true } }),
        (event) => ({ ...event, data: { ...event.data, step3: true } }),
      ]);

      const originalEvent: OrchestrationEvent = {
        id: 'pipeline-test',
        type: 'test.pipeline',
        source: 'test',
        timestamp: new Date(),
        data: { original: true },
      };

      const processedEvent = await pipeline(originalEvent);

      expect(processedEvent.data).toEqual({
        original: true,
        step1: true,
        step2: true,
        step3: true,
      });
    });
  });

  describe('batcher creation', () => {
    it('should batch events by size', async () => {
      const processedBatches: OrchestrationEvent[][] = [];
      const batcher = EventUtils.createBatcher(
        3,
        1000,
        (events) => { processedBatches.push([...events]); }
      );

      const events: OrchestrationEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-${i}`,
        type: 'test.batch',
        source: 'test',
        timestamp: new Date(),
      }));

      // Add events one by one
      for (const event of events) {
        await batcher.add(event);
      }

      // Should have processed one batch of 3 events
      expect(processedBatches).toHaveLength(1);
      expect(processedBatches[0]).toHaveLength(3);
      expect(batcher.getBatchSize()).toBe(2); // 2 remaining events
    });

    it('should batch events by timeout', async () => {
      const processedBatches: OrchestrationEvent[][] = [];
      const batcher = EventUtils.createBatcher(
        10, // Large batch size
        100, // Short timeout
        (events) => { processedBatches.push([...events]); }
      );

      const event: OrchestrationEvent = {
        id: 'timeout-test',
        type: 'test.timeout',
        source: 'test',
        timestamp: new Date(),
      };

      await batcher.add(event);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(processedBatches).toHaveLength(1);
      expect(processedBatches[0]).toHaveLength(1);
      expect(batcher.getBatchSize()).toBe(0);
    });

    it('should flush manually', async () => {
      const processedBatches: OrchestrationEvent[][] = [];
      const batcher = EventUtils.createBatcher(
        10,
        1000,
        (events) => { processedBatches.push([...events]); }
      );

      const event: OrchestrationEvent = {
        id: 'manual-flush',
        type: 'test.manual',
        source: 'test',
        timestamp: new Date(),
      };

      await batcher.add(event);
      await batcher.flush();

      expect(processedBatches).toHaveLength(1);
      expect(processedBatches[0]).toHaveLength(1);
      expect(batcher.getBatchSize()).toBe(0);
    });
  });
});