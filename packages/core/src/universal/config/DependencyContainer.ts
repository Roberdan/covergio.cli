/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ServiceFactory<T> = () => T | Promise<T>;
export type ServiceInstance<T> = T | Promise<T>;

export interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
  dependencies?: string[];
}

export class DependencyContainer {
  private services = new Map<string, ServiceRegistration>();
  private resolving = new Set<string>();

  /**
   * Register a service factory
   */
  register<T>(token: string, factory: ServiceFactory<T>, singleton = true, dependencies: string[] = []): void {
    this.services.set(token, {
      factory,
      singleton,
      dependencies,
    });
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(token: string, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      singleton: true,
      instance,
      dependencies: [],
    });
  }

  /**
   * Resolve a service
   */
  async resolve<T>(token: string): Promise<T> {
    const registration = this.services.get(token);
    if (!registration) {
      throw new Error(`Service '${token}' not registered`);
    }

    // Check for circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected for service '${token}'`);
    }

    // Return existing singleton instance
    if (registration.singleton && registration.instance) {
      return registration.instance as T;
    }

    this.resolving.add(token);

    try {
      // Resolve dependencies first
      const resolvedDependencies: unknown[] = [];
      for (const dep of registration.dependencies || []) {
        resolvedDependencies.push(await this.resolve(dep));
      }

      // Create new instance
      const instance = await registration.factory();
      
      // Store singleton instance
      if (registration.singleton) {
        registration.instance = instance as unknown;
      }

      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Unregister a service
   */
  unregister(token: string): void {
    this.services.delete(token);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Create a child container with access to parent services
   */
  createChild(): DependencyContainer {
    const child = new DependencyContainer();
    
    // Copy parent services to child
    for (const [token, registration] of this.services.entries()) {
      child.services.set(token, { ...registration });
    }
    
    return child;
  }
}

// Service tokens
export const ServiceTokens = {
  ORCHESTRATOR: 'IOrchestrator',
  REQUEST_ANALYZER: 'IRequestAnalyzer',
  REQUEST_ROUTER: 'IRequestRouter',
  WORKFLOW_MANAGER: 'IWorkflowManager',
  EVENT_SYSTEM: 'IEventSystem',
  CONFIG_MANAGER: 'OrchestratorConfigManager',
  LOGGER: 'Logger',
} as const;

export type ServiceToken = typeof ServiceTokens[keyof typeof ServiceTokens];