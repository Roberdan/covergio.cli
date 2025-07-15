/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventSystem, EventSystemConfig } from './EventSystem.js';
import { OrchestrationEvent } from '../interfaces/IEventSystem.js';

describe('EventSystem', () => {
  let eventSystem: EventSystem;
  let config: EventSystemConfig;

  beforeEach(() => {
    config = {
      maxSubscribers: 100,
      eventRetention: 60000, // 1 minute for testing
      batchSize: 5,
      flushInterval: 100, // 100ms for testing
      enablePersistence: true,
      maxEventSize: 1024,
    };

    eventSystem = new EventSystem(config);
  });

  afterEach(async () => {
    await eventSystem.shutdown();
  });

  describe('initialization and shutdown', () => {
    it('should initialize successfully', async () => {
      await eventSystem.initialize();
      
      const metrics = await eventSystem.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.eventsPublished).toBe(0);
      expect(metrics.activeSubscriptions).toBe(0);
    });

    it('should shutdown gracefully', async () => {
      await eventSystem.initialize();
      await eventSystem.shutdown();
      
      // Should not throw after shutdown
      expect(() => eventSystem.getSubscriptions()).not.toThrow();
    });
  });

  describe('event publishing', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should publish single event', async () => {
      const event: OrchestrationEvent = {
        id: 'test-event-1',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
        data: { message: 'Hello World' },
      };

      await eventSystem.publish(event);
      
      const metrics = await eventSystem.getMetrics();
      expect(metrics.eventsPublished).toBe(1);
    });

    it('should publish batch of events', async () => {
      const events: OrchestrationEvent[] = [
        {
          id: 'test-event-1',
          type: 'test.event',
          source: 'test',
          timestamp: new Date(),
          data: { message: 'Event 1' },
        },
        {
          id: 'test-event-2',
          type: 'test.event',
          source: 'test',
          timestamp: new Date(),
          data: { message: 'Event 2' },
        },
      ];

      await eventSystem.publishBatch(events);
      
      const metrics = await eventSystem.getMetrics();
      expect(metrics.eventsPublished).toBe(2);
    });

    it('should handle high priority events immediately', async () => {
      const callbacks = vi.fn();
      
      eventSystem.subscribe(['test.critical'], callbacks);

      const criticalEvent: OrchestrationEvent = {
        id: 'critical-event',
        type: 'test.critical',
        source: 'test',
        timestamp: new Date(),
        priority: 'critical',
        data: { urgent: true },
      };

      await eventSystem.publish(criticalEvent);
      
      // Should be called immediately for critical events
      expect(callbacks).toHaveBeenCalledWith(criticalEvent);
    });

    it('should reject events exceeding size limit', async () => {
      const largeEvent: OrchestrationEvent = {
        id: 'large-event',
        type: 'test.large',
        source: 'test',
        timestamp: new Date(),
        data: { content: 'x'.repeat(2000) }, // Exceeds 1024 byte limit
      };

      await expect(eventSystem.publish(largeEvent))
        .rejects.toThrow('Event size exceeds maximum allowed size');
    });
  });

  describe('event subscription', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should subscribe and receive events', async () => {
      const callback = vi.fn();
      const subscriptionId = eventSystem.subscribe(['test.event'], callback);

      expect(subscriptionId).toBeTruthy();

      const event: OrchestrationEvent = {
        id: 'test-event',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      };

      // Wait for batch processing
      await eventSystem.publish(event);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should unsubscribe successfully', async () => {
      const callback = vi.fn();
      const subscriptionId = eventSystem.subscribe(['test.event'], callback);

      const unsubscribed = eventSystem.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);

      const event: OrchestrationEvent = {
        id: 'test-event',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      };

      await eventSystem.publish(event);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should filter events by type', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventSystem.subscribe(['test.event1'], callback1);
      eventSystem.subscribe(['test.event2'], callback2);

      const event1: OrchestrationEvent = {
        id: 'event-1',
        type: 'test.event1',
        source: 'test',
        timestamp: new Date(),
      };

      const event2: OrchestrationEvent = {
        id: 'event-2',
        type: 'test.event2',
        source: 'test',
        timestamp: new Date(),
      };

      await eventSystem.publishBatch([event1, event2]);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback1).toHaveBeenCalledWith(event1);
      expect(callback1).not.toHaveBeenCalledWith(event2);
      expect(callback2).toHaveBeenCalledWith(event2);
      expect(callback2).not.toHaveBeenCalledWith(event1);
    });

    it('should apply source filters', async () => {
      const callback = vi.fn();
      
      eventSystem.subscribe(['test.event'], callback, {
        sources: ['allowed-source'],
      });

      const allowedEvent: OrchestrationEvent = {
        id: 'allowed-event',
        type: 'test.event',
        source: 'allowed-source',
        timestamp: new Date(),
      };

      const blockedEvent: OrchestrationEvent = {
        id: 'blocked-event',
        type: 'test.event',
        source: 'blocked-source',
        timestamp: new Date(),
      };

      await eventSystem.publishBatch([allowedEvent, blockedEvent]);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith(allowedEvent);
      expect(callback).not.toHaveBeenCalledWith(blockedEvent);
    });

    it('should apply priority filters', async () => {
      const callback = vi.fn();
      
      eventSystem.subscribe(['test.event'], callback, {
        priority: ['high', 'critical'],
      });

      const highEvent: OrchestrationEvent = {
        id: 'high-event',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
        priority: 'high',
      };

      const lowEvent: OrchestrationEvent = {
        id: 'low-event',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
        priority: 'low',
      };

      await eventSystem.publishBatch([highEvent, lowEvent]);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith(highEvent);
      expect(callback).not.toHaveBeenCalledWith(lowEvent);
    });

    it('should handle subscriber errors gracefully', async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error('Subscriber error'));
      const normalCallback = vi.fn();

      eventSystem.subscribe(['test.event'], errorCallback);
      eventSystem.subscribe(['test.event'], normalCallback);

      const event: OrchestrationEvent = {
        id: 'test-event',
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      };

      // Should not throw despite subscriber error
      await expect(eventSystem.publish(event)).resolves.not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('event querying', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should query events by type', async () => {
      const events: OrchestrationEvent[] = [
        {
          id: 'event-1',
          type: 'test.query',
          source: 'test',
          timestamp: new Date(),
        },
        {
          id: 'event-2',
          type: 'other.event',
          source: 'test',
          timestamp: new Date(),
        },
      ];

      await eventSystem.publishBatch(events);
      await new Promise(resolve => setTimeout(resolve, 150));

      const queryResults = await eventSystem.getEventsByType('test.query');
      expect(queryResults).toHaveLength(1);
      expect(queryResults[0].id).toBe('event-1');
    });

    it('should query events by source', async () => {
      const events: OrchestrationEvent[] = [
        {
          id: 'event-1',
          type: 'test.event',
          source: 'source-a',
          timestamp: new Date(),
        },
        {
          id: 'event-2',
          type: 'test.event',
          source: 'source-b',
          timestamp: new Date(),
        },
      ];

      await eventSystem.publishBatch(events);
      await new Promise(resolve => setTimeout(resolve, 150));

      const queryResults = await eventSystem.getEventsBySource('source-a');
      expect(queryResults).toHaveLength(1);
      expect(queryResults[0].id).toBe('event-1');
    });

    it('should get recent events', async () => {
      const events: OrchestrationEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `event-${i}`,
        type: 'test.event',
        source: 'test',
        timestamp: new Date(),
      }));

      await eventSystem.publishBatch(events);
      await new Promise(resolve => setTimeout(resolve, 150));

      const recentEvents = await eventSystem.getRecentEvents(5);
      expect(recentEvents).toHaveLength(5);
    });

    it('should apply date range filters', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      const future = new Date(now.getTime() + 60000); // 1 minute from now

      const events: OrchestrationEvent[] = [
        {
          id: 'past-event',
          type: 'test.event',
          source: 'test',
          timestamp: past,
        },
        {
          id: 'current-event',
          type: 'test.event',
          source: 'test',
          timestamp: now,
        },
      ];

      await eventSystem.publishBatch(events);
      await new Promise(resolve => setTimeout(resolve, 150));

      const queryResults = await eventSystem.queryEvents({
        types: ['test.event'],
        dateRange: {
          start: new Date(now.getTime() - 30000), // 30 seconds ago
          end: future,
        },
      });

      expect(queryResults).toHaveLength(1);
      expect(queryResults[0].id).toBe('current-event');
    });
  });

  describe('event store operations', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should store and retrieve events', async () => {
      const event: OrchestrationEvent = {
        id: 'stored-event',
        type: 'test.store',
        source: 'test',
        timestamp: new Date(),
        data: { content: 'test data' },
      };

      await eventSystem.publish(event);
      await new Promise(resolve => setTimeout(resolve, 150));

      const store = eventSystem.getStore();
      const retrievedEvent = await store.getById('stored-event');
      
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent!.id).toBe('stored-event');
      expect(retrievedEvent!.data).toEqual({ content: 'test data' });
    });

    it('should clean up expired events', async () => {
      // Create event system with very short retention
      const shortRetentionSystem = new EventSystem({
        ...config,
        eventRetention: 100, // 100ms
      });

      await shortRetentionSystem.initialize();

      const event: OrchestrationEvent = {
        id: 'expiring-event',
        type: 'test.expire',
        source: 'test',
        timestamp: new Date(),
      };

      await shortRetentionSystem.publish(event);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 200));

      const store = shortRetentionSystem.getStore();
      const cleanedCount = await store.cleanup();
      
      expect(cleanedCount).toBeGreaterThan(0);

      await shortRetentionSystem.shutdown();
    });
  });

  describe('metrics and monitoring', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should track event publishing metrics', async () => {
      const events: OrchestrationEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `metric-event-${i}`,
        type: 'test.metrics',
        source: 'test',
        timestamp: new Date(),
      }));

      await eventSystem.publishBatch(events);
      
      const metrics = await eventSystem.getMetrics();
      expect(metrics.eventsPublished).toBe(5);
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should track subscription metrics', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventSystem.subscribe(['test.event'], callback1);
      eventSystem.subscribe(['test.event'], callback2);

      const metrics = await eventSystem.getMetrics();
      expect(metrics.activeSubscriptions).toBe(2);

      const subscriptions = eventSystem.getSubscriptions();
      expect(subscriptions).toHaveLength(2);
    });

    it('should track storage metrics', async () => {
      const events: OrchestrationEvent[] = Array.from({ length: 3 }, (_, i) => ({
        id: `storage-event-${i}`,
        type: 'test.storage',
        source: 'test',
        timestamp: new Date(),
      }));

      await eventSystem.publishBatch(events);
      await new Promise(resolve => setTimeout(resolve, 150));

      const metrics = await eventSystem.getMetrics();
      expect(metrics.eventsStored).toBe(3);
    });
  });

  describe('batch processing', () => {
    beforeEach(async () => {
      await eventSystem.initialize();
    });

    it('should flush queue when batch size is reached', async () => {
      const callback = vi.fn();
      eventSystem.subscribe(['test.batch'], callback);

      // Publish exactly batch size number of events
      const events: OrchestrationEvent[] = Array.from({ length: config.batchSize }, (_, i) => ({
        id: `batch-event-${i}`,
        type: 'test.batch',
        source: 'test',
        timestamp: new Date(),
      }));

      await eventSystem.publishBatch(events);

      // Should flush immediately when batch size is reached
      expect(callback).toHaveBeenCalledTimes(config.batchSize);
    });

    it('should flush queue on timer interval', async () => {
      const callback = vi.fn();
      eventSystem.subscribe(['test.timer'], callback);

      const event: OrchestrationEvent = {
        id: 'timer-event',
        type: 'test.timer',
        source: 'test',
        timestamp: new Date(),
      };

      await eventSystem.publish(event);

      // Wait for timer flush
      await new Promise(resolve => setTimeout(resolve, config.flushInterval + 50));

      expect(callback).toHaveBeenCalledWith(event);
    });
  });
});