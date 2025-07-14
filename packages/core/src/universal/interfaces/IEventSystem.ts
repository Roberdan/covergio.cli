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
}

export type EventHandler = (event: OrchestrationEvent) => Promise<void> | void;

export interface EventFilter {
  types?: string[];
  sources?: string[];
  correlationId?: string;
  metadata?: Record<string, unknown>;
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

export interface IEventSubscriber {
  /**
   * Subscribe to events
   */
  subscribe(filter: EventFilter, handler: EventHandler): string;

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void;

  /**
   * Get active subscriptions
   */
  getSubscriptions(): Array<{ id: string; filter: EventFilter; handler: EventHandler }>;
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

export interface IEventSystem extends IEventPublisher, IEventSubscriber {
  /**
   * Get event store
   */
  getStore(): IEventStore;

  /**
   * Initialize the event system
   */
  initialize(config: Record<string, unknown>): Promise<void>;

  /**
   * Shutdown the event system
   */
  shutdown(): Promise<void>;

  /**
   * Get system metrics
   */
  getMetrics(): Promise<{
    eventsPublished: number;
    eventsStored: number;
    activeSubscriptions: number;
    averageProcessingTime: number;
  }>;
}