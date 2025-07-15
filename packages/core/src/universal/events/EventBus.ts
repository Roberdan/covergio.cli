/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrchestrationEvent } from '../interfaces/IEventSystem.js';

export interface EventBusConfig {
  enableWildcards: boolean;
  maxListeners: number;
  enableMetrics: boolean;
}

export interface EventPattern {
  pattern: string;
  callback: (event: OrchestrationEvent) => void | Promise<void>;
  priority: number;
}

export interface EventBusMetrics {
  totalEvents: number;
  totalListeners: number;
  eventTypeDistribution: Record<string, number>;
  averageLatency: number;
  errorCount: number;
}

/**
 * High-performance event bus for cross-component communication
 * Supports wildcards, priorities, and advanced filtering
 */
export class EventBus {
  private listeners = new Map<string, Set<EventPattern>>();
  private wildcardListeners: EventPattern[] = [];
  private config: EventBusConfig;
  private metrics: EventBusMetrics = {
    totalEvents: 0,
    totalListeners: 0,
    eventTypeDistribution: {},
    averageLatency: 0,
    errorCount: 0,
  };
  private latencies: number[] = [];

  constructor(config?: Partial<EventBusConfig>) {
    this.config = {
      enableWildcards: true,
      maxListeners: 1000,
      enableMetrics: true,
      ...config,
    };
  }

  /**
   * Emit an event to all matching listeners
   */
  async emit(event: OrchestrationEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Get direct listeners
      const directListeners = this.listeners.get(event.type) || new Set();
      
      // Get wildcard listeners if enabled
      const wildcardMatches = this.config.enableWildcards 
        ? this.getWildcardMatches(event.type)
        : [];

      // Combine and sort by priority
      const allPatterns = [
        ...Array.from(directListeners),
        ...wildcardMatches,
      ].sort((a, b) => b.priority - a.priority);

      // Execute listeners in parallel with error isolation
      const promises = allPatterns.map(pattern => 
        this.executeListener(pattern, event)
      );

      await Promise.allSettled(promises);

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(event, Date.now() - startTime);
      }
    } catch (error) {
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * Subscribe to events with pattern matching
   */
  on(
    eventType: string,
    callback: (event: OrchestrationEvent) => void | Promise<void>,
    priority = 0
  ): () => void {
    if (this.getTotalListeners() >= this.config.maxListeners) {
      throw new Error(`Maximum listeners limit (${this.config.maxListeners}) reached`);
    }

    const pattern: EventPattern = {
      pattern: eventType,
      callback,
      priority,
    };

    if (this.isWildcardPattern(eventType)) {
      this.wildcardListeners.push(pattern);
    } else {
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, new Set());
      }
      this.listeners.get(eventType)!.add(pattern);
    }

    this.metrics.totalListeners = this.getTotalListeners();

    // Return unsubscribe function
    return () => this.off(eventType, callback);
  }

  /**
   * Subscribe to events once
   */
  once(
    eventType: string,
    callback: (event: OrchestrationEvent) => void | Promise<void>,
    priority = 0
  ): () => void {
    const wrappedCallback = async (event: OrchestrationEvent) => {
      unsubscribe();
      await callback(event);
    };

    const unsubscribe = this.on(eventType, wrappedCallback, priority);
    return unsubscribe;
  }

  /**
   * Unsubscribe from events
   */
  off(
    eventType: string,
    callback?: (event: OrchestrationEvent) => void | Promise<void>
  ): void {
    if (this.isWildcardPattern(eventType)) {
      if (callback) {
        this.wildcardListeners = this.wildcardListeners.filter(
          pattern => pattern.callback !== callback
        );
      } else {
        this.wildcardListeners = this.wildcardListeners.filter(
          pattern => pattern.pattern !== eventType
        );
      }
    } else {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        if (callback) {
          for (const pattern of listeners) {
            if (pattern.callback === callback) {
              listeners.delete(pattern);
              break;
            }
          }
        } else {
          listeners.clear();
        }

        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    }

    this.metrics.totalListeners = this.getTotalListeners();
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      if (this.isWildcardPattern(eventType)) {
        this.wildcardListeners = this.wildcardListeners.filter(
          pattern => pattern.pattern !== eventType
        );
      } else {
        this.listeners.delete(eventType);
      }
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }

    this.metrics.totalListeners = this.getTotalListeners();
  }

  /**
   * Get event bus metrics
   */
  getMetrics(): EventBusMetrics {
    return {
      ...this.metrics,
      averageLatency: this.calculateAverageLatency(),
    };
  }

  /**
   * Get listeners for a specific event type
   */
  getListeners(eventType: string): EventPattern[] {
    const directListeners = Array.from(this.listeners.get(eventType) || []);
    const wildcardMatches = this.config.enableWildcards 
      ? this.getWildcardMatches(eventType)
      : [];

    return [...directListeners, ...wildcardMatches]
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if there are listeners for an event type
   */
  hasListeners(eventType: string): boolean {
    const directListeners = this.listeners.get(eventType);
    if (directListeners && directListeners.size > 0) {
      return true;
    }

    if (this.config.enableWildcards) {
      return this.getWildcardMatches(eventType).length > 0;
    }

    return false;
  }

  /**
   * Get all event types with listeners
   */
  getEventTypes(): string[] {
    const types = new Set<string>();
    
    // Add direct event types
    for (const eventType of this.listeners.keys()) {
      types.add(eventType);
    }

    // Add wildcard patterns
    for (const pattern of this.wildcardListeners) {
      types.add(pattern.pattern);
    }

    return Array.from(types);
  }

  private async executeListener(
    pattern: EventPattern,
    event: OrchestrationEvent
  ): Promise<void> {
    try {
      await pattern.callback(event);
    } catch (error) {
      this.metrics.errorCount++;
      console.error(`Error in event listener for ${pattern.pattern}:`, error);
    }
  }

  private isWildcardPattern(pattern: string): boolean {
    return pattern.includes('*') || pattern.includes('?');
  }

  private getWildcardMatches(eventType: string): EventPattern[] {
    return this.wildcardListeners.filter(pattern => 
      this.matchesWildcard(eventType, pattern.pattern)
    );
  }

  private matchesWildcard(eventType: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }

  private getTotalListeners(): number {
    let count = this.wildcardListeners.length;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }

  private updateMetrics(event: OrchestrationEvent, latency: number): void {
    this.metrics.totalEvents++;
    
    // Update event type distribution
    this.metrics.eventTypeDistribution[event.type] = 
      (this.metrics.eventTypeDistribution[event.type] || 0) + 1;

    // Update latency tracking
    this.latencies.push(latency);
    if (this.latencies.length > 1000) {
      this.latencies = this.latencies.slice(-1000);
    }
  }

  private calculateAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    
    const sum = this.latencies.reduce((acc, latency) => acc + latency, 0);
    return sum / this.latencies.length;
  }
}

/**
 * Global event bus instance for application-wide communication
 */
export const globalEventBus = new EventBus({
  enableWildcards: true,
  maxListeners: 10000,
  enableMetrics: true,
});

/**
 * Utility functions for common event patterns
 */
export class EventUtils {
  /**
   * Create a namespaced event emitter
   */
  static createNamespace(namespace: string, eventBus: EventBus = globalEventBus) {
    return {
      emit: (eventType: string, data: Partial<OrchestrationEvent>) => {
        const event: OrchestrationEvent = {
          id: `${namespace}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: `${namespace}.${eventType}`,
          source: namespace,
          timestamp: new Date(),
          data: data.data || {},
          ...data,
        };
        return eventBus.emit(event);
      },
      
      on: (eventType: string, callback: (event: OrchestrationEvent) => void | Promise<void>, priority = 0) => {
        return eventBus.on(`${namespace}.${eventType}`, callback, priority);
      },
      
      once: (eventType: string, callback: (event: OrchestrationEvent) => void | Promise<void>, priority = 0) => {
        return eventBus.once(`${namespace}.${eventType}`, callback, priority);
      },
      
      off: (eventType: string, callback?: (event: OrchestrationEvent) => void | Promise<void>) => {
        return eventBus.off(`${namespace}.${eventType}`, callback);
      },
    };
  }

  /**
   * Create a typed event emitter for specific event data types
   */
  static createTypedEmitter<T extends Record<string, unknown>>(eventType: string, eventBus: EventBus = globalEventBus) {
    return {
      emit: (data: T & Partial<OrchestrationEvent>) => {
        const event: OrchestrationEvent = {
          id: `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: eventType,
          source: 'typed-emitter',
          timestamp: new Date(),
          data,
          ...data,
        };
        return eventBus.emit(event);
      },
      
      on: (callback: (data: T, event: OrchestrationEvent) => void | Promise<void>, priority = 0) => {
        return eventBus.on(eventType, async (event) => {
          await callback(event.data as T, event);
        }, priority);
      },
      
      once: (callback: (data: T, event: OrchestrationEvent) => void | Promise<void>, priority = 0) => {
        return eventBus.once(eventType, async (event) => {
          await callback(event.data as T, event);
        }, priority);
      },
    };
  }

  /**
   * Create an event pipeline for chaining event processors
   */
  static createPipeline(stages: Array<(event: OrchestrationEvent) => OrchestrationEvent | Promise<OrchestrationEvent>>) {
    return async (event: OrchestrationEvent): Promise<OrchestrationEvent> => {
      let processedEvent = event;
      
      for (const stage of stages) {
        processedEvent = await stage(processedEvent);
      }
      
      return processedEvent;
    };
  }

  /**
   * Create a batching event collector
   */
  static createBatcher(
    batchSize: number,
    timeoutMs: number,
    processor: (events: OrchestrationEvent[]) => void | Promise<void>
  ) {
    let batch: OrchestrationEvent[] = [];
    let timeout: NodeJS.Timeout | null = null;

    const flush = async () => {
      if (batch.length > 0) {
        const eventsToProcess = [...batch];
        batch = [];
        
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        
        await processor(eventsToProcess);
      }
    };

    return {
      add: async (event: OrchestrationEvent) => {
        batch.push(event);
        
        if (batch.length >= batchSize) {
          await flush();
        } else if (!timeout) {
          timeout = setTimeout(flush, timeoutMs);
        }
      },
      
      flush,
      
      getBatchSize: () => batch.length,
    };
  }
}