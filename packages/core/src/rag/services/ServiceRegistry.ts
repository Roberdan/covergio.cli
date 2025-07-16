/**
 * Service registry for RAG system dependency injection
 */

import { 
  ITextExtractor,
  ITextChunker,
  IDocumentProcessor,
  IEmbeddingService,
  IVectorStore,
  IAgentManager,
  IQueryEngine,
  IKnowledgeBaseManager
} from '../interfaces/index.js';
import { RAGConfig } from '../config/index.js';

export type ServiceType = 
  | 'textExtractor'
  | 'textChunker'
  | 'documentProcessor'
  | 'embeddingService'
  | 'vectorStore'
  | 'agentManager'
  | 'queryEngine'
  | 'knowledgeBaseManager'
  | 'config';

export type RAGServiceInstance = 
  | ITextExtractor
  | ITextChunker
  | IDocumentProcessor
  | IEmbeddingService
  | IVectorStore
  | IAgentManager
  | IQueryEngine
  | IKnowledgeBaseManager
  | RAGConfig;

export interface RAGServiceFactory<T = RAGServiceInstance> {
  create(registry: ServiceRegistry): Promise<T>;
}

export class ServiceRegistry {
  private services = new Map<ServiceType, ServiceInstance>();
  private factories = new Map<ServiceType, ServiceFactory>();
  private singletons = new Set<ServiceType>();

  /**
   * Register a service factory
   */
  registerFactory<T extends ServiceInstance>(
    type: ServiceType,
    factory: ServiceFactory<T>,
    singleton = true
  ): void {
    this.factories.set(type, factory);
    if (singleton) {
      this.singletons.add(type);
    }
  }

  /**
   * Register a service instance
   */
  registerInstance<T extends ServiceInstance>(type: ServiceType, instance: T): void {
    this.services.set(type, instance);
  }

  /**
   * Get a service instance
   */
  async get<T extends ServiceInstance>(type: ServiceType): Promise<T> {
    // Return existing instance if available
    if (this.services.has(type)) {
      return this.services.get(type) as T;
    }

    // Create new instance using factory
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for service type: ${type}`);
    }

    const instance = await factory.create(this);

    // Store as singleton if configured
    if (this.singletons.has(type)) {
      this.services.set(type, instance);
    }

    return instance as T;
  }

  /**
   * Check if service is registered
   */
  has(type: ServiceType): boolean {
    return this.services.has(type) || this.factories.has(type);
  }

  /**
   * Remove a service
   */
  remove(type: ServiceType): void {
    this.services.delete(type);
    this.factories.delete(type);
    this.singletons.delete(type);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service types
   */
  getRegisteredTypes(): ServiceType[] {
    const types = new Set<ServiceType>();
    this.services.forEach((_, type) => types.add(type));
    this.factories.forEach((_, type) => types.add(type));
    return Array.from(types);
  }

  /**
   * Initialize all singleton services
   */
  async initializeAll(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const type of this.singletons) {
      if (!this.services.has(type)) {
        initPromises.push(
          this.get(type).then(() => {
            // Service is now initialized and stored
          })
        );
      }
    }

    await Promise.all(initPromises);
  }

  /**
   * Dispose all services that have a dispose method
   */
  async dispose(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    for (const [, service] of this.services) {
      if (service && typeof (service as any).dispose === 'function') {
        disposePromises.push((service as any).dispose());
      }
    }

    await Promise.all(disposePromises);
    this.clear();
  }
}