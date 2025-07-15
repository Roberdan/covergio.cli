/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IEventSystem, OrchestrationEvent, EventSubscription, EventStore, EventMetrics, EventFilter, EventHandler } from '../interfaces/IEventSystem.js';

export interface EventSystemConfig {
  maxSubscribers: number;
  eventRetention: number; // milliseconds
  batchSize: number;
  flushInterval: number;
  enablePersistence: boolean;
  maxEventSize: number;
}

// EventFilter is now imported from IEventSystem
// Keeping this interface for backward compatibility with existing code
export interface EventSystemFilter {
  types?: string[];
  sources?: string[];
  priority?: ('low' | 'medium' | 'high' | 'critical')[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class EventSystem implements IEventSystem {
  private subscriptions = new Map<string, EventSubscription>();
  private eventStore: EventStore;
  private config: EventSystemConfig;
  private eventQueue: OrchestrationEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private metrics: EventMetrics = {
    eventsPublished: 0,
    eventsStored: 0,
    activeSubscriptions: 0,
    averageProcessingTime: 0,
  };
  private processingTimes: number[] = [];

  constructor(config?: Partial<EventSystemConfig>) {
    this.config = {
      maxSubscribers: 1000,
      eventRetention: 86400000, // 24 hours
      batchSize: 100,
      flushInterval: 1000, // 1 second
      enablePersistence: true,
      maxEventSize: 1024 * 1024, // 1MB
      ...config,
    };

    this.eventStore = new MemoryEventStore(this.config.eventRetention);
    this.startFlushTimer();
  }

  async initialize(): Promise<void> {
    // Initialize event store if needed
    if (this.eventStore.initialize) {
      await this.eventStore.initialize();
    }

    // Clean up expired events
    await this.eventStore.cleanup();
  }

  async shutdown(): Promise<void> {
    // Flush any pending events
    await this.flushQueue();

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Clear subscriptions
    this.subscriptions.clear();

    // Shutdown event store
    if (this.eventStore.shutdown) {
      await this.eventStore.shutdown();
    }
  }

  async publish(event: OrchestrationEvent): Promise<void> {
    const startTime = Date.now();

    // Validate event size
    if (this.getEventSize(event) > this.config.maxEventSize) {
      throw new Error(`Event size exceeds maximum allowed size of ${this.config.maxEventSize} bytes`);
    }

    // Add to queue for batch processing
    this.eventQueue.push({
      ...event,
      timestamp: event.timestamp || new Date(),
    });

    // Immediately notify subscribers for high priority events
    if (event.priority === 'critical' || event.priority === 'high') {
      await this.notifySubscribers([event]);
    }

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flushQueue();
    }

    // Update metrics
    this.metrics.eventsPublished++;
    this.updateProcessingTime(Date.now() - startTime);
  }

  async publishBatch(events: OrchestrationEvent[]): Promise<void> {
    const startTime = Date.now();

    // Validate and prepare events
    const validEvents = events
      .filter(event => this.getEventSize(event) <= this.config.maxEventSize)
      .map(event => ({
        ...event,
        timestamp: event.timestamp || new Date(),
      }));

    // Add to queue
    this.eventQueue.push(...validEvents);

    // Find critical events for immediate processing
    const criticalEvents = validEvents.filter(event => 
      event.priority === 'critical' || event.priority === 'high'
    );

    if (criticalEvents.length > 0) {
      await this.notifySubscribers(criticalEvents);
    }

    // Flush if queue is getting large
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flushQueue();
    }

    // Update metrics
    this.metrics.eventsPublished += validEvents.length;
    this.updateProcessingTime(Date.now() - startTime);
  }

  // Interface-compatible subscribe method
  subscribe(filter: EventFilter, handler: EventHandler): string;
  // Legacy subscribe method for backward compatibility
  subscribe(
    types: string[],
    callback: (event: OrchestrationEvent) => void | Promise<void>,
    filter?: EventSystemFilter
  ): string;
  subscribe(
    filterOrTypes: EventFilter | string[],
    handlerOrCallback?: EventHandler | ((event: OrchestrationEvent) => void | Promise<void>),
    filter?: EventSystemFilter
  ): string {
    let types: string[];
    let callback: EventHandler;
    let eventFilter: EventSystemFilter | undefined;

    if (Array.isArray(filterOrTypes)) {
      // Legacy signature: subscribe(types, callback, filter)
      types = filterOrTypes;
      callback = handlerOrCallback as EventHandler;
      eventFilter = filter;
    } else {
      // New signature: subscribe(filter, handler)
      const inputFilter = filterOrTypes;
      callback = handlerOrCallback as EventHandler;
      types = inputFilter.types || [];
      eventFilter = {
        types: inputFilter.types,
        sources: inputFilter.sources,
        priority: inputFilter.priority,
        dateRange: inputFilter.dateRange,
      };
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      types,
      callback,
      filter: eventFilter,
      createdAt: new Date(),
      callCount: 0,
      lastCalled: undefined,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.activeSubscriptions = this.subscriptions.size;

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    this.metrics.activeSubscriptions = this.subscriptions.size;
    return removed;
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getStore(): EventStore {
    return this.eventStore;
  }

  async getMetrics(): Promise<EventMetrics> {
    return {
      ...this.metrics,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    };
  }

  async queryEvents(filter: EventSystemFilter, limit = 100): Promise<OrchestrationEvent[]> {
    const allEvents = await this.eventStore.retrieve(limit * 2); // Get more to filter
    return this.filterEvents(allEvents, filter).slice(0, limit);
  }

  async getEventsByType(type: string, limit = 100): Promise<OrchestrationEvent[]> {
    return this.queryEvents({ types: [type] }, limit);
  }

  async getEventsBySource(source: string, limit = 100): Promise<OrchestrationEvent[]> {
    return this.queryEvents({ sources: [source] }, limit);
  }

  async getRecentEvents(count = 50): Promise<OrchestrationEvent[]> {
    return this.eventStore.retrieve(count);
  }

  private async flushQueue(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToProcess = [...this.eventQueue];
    this.eventQueue = [];

    // Store events if persistence is enabled
    if (this.config.enablePersistence) {
      for (const event of eventsToProcess) {
        await this.eventStore.store(event);
        this.metrics.eventsStored++;
      }
    }

    // Notify subscribers
    await this.notifySubscribers(eventsToProcess);
  }

  private async notifySubscribers(events: OrchestrationEvent[]): Promise<void> {
    const notificationPromises: Promise<void>[] = [];

    for (const subscription of Array.from(this.subscriptions.values())) {
      const relevantEvents = events.filter(event => 
        this.isEventRelevant(event, subscription)
      );

      if (relevantEvents.length > 0) {
        for (const event of relevantEvents) {
          notificationPromises.push(
            this.notifySubscriber(subscription, event)
          );
        }
      }
    }

    // Execute all notifications in parallel with error handling
    await Promise.allSettled(notificationPromises);
  }

  private async notifySubscriber(
    subscription: EventSubscription,
    event: OrchestrationEvent
  ): Promise<void> {
    try {
      await subscription.callback(event);
      subscription.callCount++;
      subscription.lastCalled = new Date();
    } catch (error) {
      // Log error but don't throw to avoid breaking other subscribers
      console.error(`Error in event subscriber ${subscription.id}:`, error);
    }
  }

  private isEventRelevant(event: OrchestrationEvent, subscription: EventSubscription): boolean {
    // Check event type
    if (!subscription.types.includes(event.type)) {
      return false;
    }

    // Apply additional filters if provided
    if (subscription.filter) {
      const filter = subscription.filter;

      // Check source filter
      if (filter.sources && !filter.sources.includes(event.source)) {
        return false;
      }

      // Check priority filter
      if (filter.priority && event.priority && !filter.priority.includes(event.priority)) {
        return false;
      }

      // Check date range filter
      if (filter.dateRange) {
        const eventTime = event.timestamp.getTime();
        const startTime = filter.dateRange.start.getTime();
        const endTime = filter.dateRange.end.getTime();
        
        if (eventTime < startTime || eventTime > endTime) {
          return false;
        }
      }
    }

    return true;
  }

  private filterEvents(events: OrchestrationEvent[], filter: EventSystemFilter): OrchestrationEvent[] {
    return events.filter(event => {
      // Type filter
      if (filter.types && !filter.types.includes(event.type)) {
        return false;
      }

      // Source filter
      if (filter.sources && !filter.sources.includes(event.source)) {
        return false;
      }

      // Priority filter
      if (filter.priority && event.priority && !filter.priority.includes(event.priority)) {
        return false;
      }

      // Date range filter
      if (filter.dateRange) {
        const eventTime = event.timestamp.getTime();
        const startTime = filter.dateRange.start.getTime();
        const endTime = filter.dateRange.end.getTime();
        
        if (eventTime < startTime || eventTime > endTime) {
          return false;
        }
      }

      return true;
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flushQueue();
      } catch (error) {
        console.error('Error flushing event queue:', error);
      }
    }, this.config.flushInterval);
  }

  private getEventSize(event: OrchestrationEvent): number {
    return Buffer.byteLength(JSON.stringify(event), 'utf8');
  }

  private updateProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only recent processing times (last 1000)
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000);
    }
  }

  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.processingTimes.length;
  }
}

class MemoryEventStore implements EventStore {
  private events: OrchestrationEvent[] = [];
  private retentionMs: number;

  constructor(retentionMs: number) {
    this.retentionMs = retentionMs;
  }

  async initialize(): Promise<void> {
    // No initialization needed for memory store
  }

  async shutdown(): Promise<void> {
    this.events = [];
  }

  async store(event: OrchestrationEvent): Promise<void> {
    this.events.push(event);
    
    // Limit memory usage by keeping only recent events
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000); // Keep half
    }
  }

  async retrieve(limit = 100): Promise<OrchestrationEvent[]> {
    await this.cleanup(); // Clean expired events
    
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Most recent first
      .slice(0, limit);
  }

  async getById(id: string): Promise<OrchestrationEvent | null> {
    return this.events.find(event => event.id === id) || null;
  }

  async cleanup(): Promise<number> {
    const cutoffTime = Date.now() - this.retentionMs;
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => 
      event.timestamp.getTime() > cutoffTime
    );
    
    return initialCount - this.events.length;
  }
}