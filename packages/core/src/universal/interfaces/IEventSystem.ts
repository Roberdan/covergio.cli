/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OrchestrationEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, unknown>;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export type EventHandler = (event: OrchestrationEvent) => Promise<void> | void;

export interface EventFilter {
  types?: string[];
  sources?: string[];
  correlationId?: string;
  metadata?: Record<string, unknown>;
  priority?: ('low' | 'medium' | 'high' | 'critical')[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface IEventPublisher {
  /**
   * Publish an event
   */
  publish(event: OrchestrationEvent): Promise<void>;

  /**
   * Publish multiple events
   */
  publishBatch(events: OrchestrationEvent[]): Promise<void>;
}

export interface EventSubscription {
  id: string;
  types: string[];
  callback: EventHandler;
  filter?: EventFilter;
  createdAt: Date;
  callCount: number;
  lastCalled?: Date;
}

export interface IEventSubscriber {
  /**
   * Subscribe to events
   */
  subscribe(filter: EventFilter, handler: EventHandler): string;
  subscribe(types: string[], callback: EventHandler, filter?: EventFilter): string;

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean;

  /**
   * Get active subscriptions
   */
  getSubscriptions(): EventSubscription[];
}

export interface EventStore {
  /**
   * Store an event
   */
  store(event: OrchestrationEvent): Promise<void>;

  /**
   * Retrieve events
   */
  retrieve(limit?: number): Promise<OrchestrationEvent[]>;

  /**
   * Get event by ID
   */
  getById(eventId: string): Promise<OrchestrationEvent | null>;

  /**
   * Cleanup old events
   */
  cleanup(): Promise<number>;

  /**
   * Initialize the store
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown the store
   */
  shutdown?(): Promise<void>;
}

export interface IEventStore {
  /**
   * Store an event
   */
  store(event: OrchestrationEvent): Promise<void>;

  /**
   * Retrieve events by filter
   */
  retrieve(filter: EventFilter, limit?: number, offset?: number): Promise<OrchestrationEvent[]>;

  /**
   * Get event by ID
   */
  getById(eventId: string): Promise<OrchestrationEvent | null>;

  /**
   * Cleanup old events
   */
  cleanup(olderThan: Date): Promise<number>;
}

export interface EventMetrics {
  eventsPublished: number;
  eventsStored: number;
  activeSubscriptions: number;
  averageProcessingTime: number;
}

export interface IEventSystem extends IEventPublisher, IEventSubscriber {
  /**
   * Get event store
   */
  getStore(): EventStore;

  /**
   * Initialize the event system
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the event system
   */
  shutdown(): Promise<void>;

  /**
   * Get system metrics
   */
  getMetrics(): Promise<EventMetrics>;

  /**
   * Query events with filters
   */
  queryEvents(filter: EventFilter, limit?: number): Promise<OrchestrationEvent[]>;

  /**
   * Get events by type
   */
  getEventsByType(type: string, limit?: number): Promise<OrchestrationEvent[]>;

  /**
   * Get events by source
   */
  getEventsBySource(source: string, limit?: number): Promise<OrchestrationEvent[]>;

  /**
   * Get recent events
   */
  getRecentEvents(count?: number): Promise<OrchestrationEvent[]>;
}