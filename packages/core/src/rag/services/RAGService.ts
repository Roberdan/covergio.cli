/**
 * Main RAG service that coordinates all RAG components
 */

import { ServiceRegistry, ServiceType } from './ServiceRegistry.js';
import { RAGConfig, ConfigFactory } from '../config/index.js';
import { 
  IAgentManager,
  IKnowledgeBaseManager,
  IQueryEngine,
  IEmbeddingService,
  IVectorStore
} from '../interfaces/index.js';
import { 
  RAGSystemConfig,
  AgentResponse,
  QueryOptions,
  KnowledgeBase,
  AgentConfig,
  RAGAgent
} from '../types/index.js';

export class RAGService {
  private registry: ServiceRegistry;
  private config: RAGConfig;
  private initialized = false;

  constructor(config?: Partial<RAGSystemConfig>) {
    this.registry = new ServiceRegistry();
    this.config = ConfigFactory.create(config);
    this.setupDefaultServices();
  }

  /**
   * Initialize the RAG service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Register configuration
    this.registry.registerInstance('config', this.config);

    // Initialize all services
    await this.registry.initializeAll();

    this.initialized = true;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the service registry
   */
  getRegistry(): ServiceRegistry {
    return this.registry;
  }

  /**
   * Get configuration
   */
  getConfig(): RAGConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RAGSystemConfig>): void {
    this.config.updateConfig(updates);
  }

  /**
   * Create a knowledge base
   */
  async createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase> {
    const kbManager = await this.registry.get<IKnowledgeBaseManager>('knowledgeBaseManager');
    return kbManager.createKnowledgeBase(name, description);
  }

  /**
   * Get a knowledge base
   */
  async getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    const kbManager = await this.registry.get<IKnowledgeBaseManager>('knowledgeBaseManager');
    return kbManager.getKnowledgeBase(id);
  }

  /**
   * List all knowledge bases
   */
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    const kbManager = await this.registry.get<IKnowledgeBaseManager>('knowledgeBaseManager');
    return kbManager.listKnowledgeBases();
  }

  /**
   * Add documents to a knowledge base
   */
  async addDocuments(kbId: string, filePaths: string[]): Promise<void> {
    const kbManager = await this.registry.get<IKnowledgeBaseManager>('knowledgeBaseManager');
    await kbManager.addDocuments(kbId, filePaths);
  }

  /**
   * Create an agent
   */
  async createAgent(config: AgentConfig): Promise<RAGAgent> {
    const agentManager = await this.registry.get<IAgentManager>('agentManager');
    return agentManager.createAgent(config);
  }

  /**
   * Get an agent
   */
  async getAgent(agentId: string): Promise<RAGAgent | null> {
    const agentManager = await this.registry.get<IAgentManager>('agentManager');
    return agentManager.getAgent(agentId);
  }

  /**
   * Query an agent
   */
  async queryAgent(
    agentId: string, 
    question: string, 
    options?: QueryOptions
  ): Promise<AgentResponse> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.query(question, options);
  }

  /**
   * Get service by type
   */
  async getService<T>(type: ServiceType): Promise<T> {
    return this.registry.get<T>(type);
  }

  /**
   * Register a custom service
   */
  registerService<T>(type: ServiceType, instance: T): void {
    this.registry.registerInstance(type, instance as any);
  }

  /**
   * Dispose the RAG service
   */
  async dispose(): Promise<void> {
    await this.registry.dispose();
    this.initialized = false;
  }

  /**
   * Setup default service factories
   */
  private setupDefaultServices(): void {
    // Note: These would be implemented with actual service implementations
    // For now, we're just setting up the structure
    
    // Example factory registration (would be implemented with real services):
    // this.registry.registerFactory('embeddingService', {
    //   create: async (registry) => new LocalEmbeddingService(registry.get('config'))
    // });
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    const types = this.registry.getRegisteredTypes();

    for (const type of types) {
      try {
        const service = await this.registry.get(type);
        // Check if service has an isReady method
        if (service && typeof (service as any).isReady === 'function') {
          status[type] = (service as any).isReady();
        } else {
          status[type] = true; // Assume healthy if no isReady method
        }
      } catch (error) {
        status[type] = false;
      }
    }

    return status;
  }
}