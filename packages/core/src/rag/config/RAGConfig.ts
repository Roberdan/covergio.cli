/**
 * RAG system configuration management
 */

import { 
  RAGSystemConfig, 
  EmbeddingConfig, 
  VectorStoreConfig, 
  ChunkingConfig, 
  AgentDefaultConfig, 
  PerformanceConfig,
  ChunkingStrategy,
  IndexType,
  DistanceMetric
} from '../types/index.js';

export class RAGConfig {
  private config: RAGSystemConfig;

  constructor(config?: Partial<RAGSystemConfig>) {
    this.config = this.mergeWithDefaults(config || {});
    this.validate();
  }

  /**
   * Get the complete configuration
   */
  getConfig(): RAGSystemConfig {
    return { ...this.config };
  }

  /**
   * Get embedding configuration
   */
  getEmbeddingConfig(): EmbeddingConfig {
    return { ...this.config.embedding };
  }

  /**
   * Get vector store configuration
   */
  getVectorStoreConfig(): VectorStoreConfig {
    return { ...this.config.vectorStore };
  }

  /**
   * Get chunking configuration
   */
  getChunkingConfig(): ChunkingConfig {
    return { ...this.config.chunking };
  }

  /**
   * Get agent default configuration
   */
  getAgentConfig(): AgentDefaultConfig {
    return { ...this.config.agents };
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig(): PerformanceConfig {
    return { ...this.config.performance };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RAGSystemConfig>): void {
    this.config = this.mergeWithDefaults(updates, this.config);
    this.validate();
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    this.validateEmbeddingConfig(this.config.embedding);
    this.validateVectorStoreConfig(this.config.vectorStore);
    this.validateChunkingConfig(this.config.chunking);
    this.validateAgentConfig(this.config.agents);
    this.validatePerformanceConfig(this.config.performance);
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(
    config: Partial<RAGSystemConfig>, 
    existing?: RAGSystemConfig
  ): RAGSystemConfig {
    const defaults = this.getDefaultConfig();
    
    return {
      embedding: { ...defaults.embedding, ...existing?.embedding, ...config.embedding },
      vectorStore: { ...defaults.vectorStore, ...existing?.vectorStore, ...config.vectorStore },
      chunking: { ...defaults.chunking, ...existing?.chunking, ...config.chunking },
      agents: { ...defaults.agents, ...existing?.agents, ...config.agents },
      performance: { ...defaults.performance, ...existing?.performance, ...config.performance }
    };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): RAGSystemConfig {
    return {
      embedding: {
        modelName: 'all-MiniLM-L6-v2',
        dimensions: 384,
        batchSize: 32,
        device: 'cpu',
        maxTokens: 512,
        cacheSize: 1000
      },
      vectorStore: {
        storePath: './data/vectors',
        dimensions: 384,
        indexType: IndexType.HNSW,
        distanceMetric: DistanceMetric.COSINE,
        maxVectors: 100000,
        persistToDisk: true
      },
      chunking: {
        defaultSize: 512,
        defaultOverlap: 50,
        maxSize: 2048,
        minSize: 100,
        strategy: ChunkingStrategy.SEMANTIC,
        preserveStructure: true
      },
      agents: {
        maxContextLength: 4096,
        defaultTemperature: 0.7,
        maxTokensPerResponse: 1024,
        enableSourceAttribution: true
      },
      performance: {
        maxConcurrentProcessing: 4,
        memoryLimitMB: 1024,
        timeoutMs: 30000,
        enableCaching: true,
        cacheExpiryMs: 3600000 // 1 hour
      }
    };
  }

  /**
   * Validate embedding configuration
   */
  private validateEmbeddingConfig(config: EmbeddingConfig): void {
    if (config.dimensions <= 0) {
      throw new Error('Embedding dimensions must be positive');
    }
    if (config.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }
    if (config.maxTokens <= 0) {
      throw new Error('Max tokens must be positive');
    }
  }

  /**
   * Validate vector store configuration
   */
  private validateVectorStoreConfig(config: VectorStoreConfig): void {
    if (config.dimensions <= 0) {
      throw new Error('Vector store dimensions must be positive');
    }
    if (config.maxVectors <= 0) {
      throw new Error('Max vectors must be positive');
    }
    if (!config.storePath) {
      throw new Error('Store path is required');
    }
  }

  /**
   * Validate chunking configuration
   */
  private validateChunkingConfig(config: ChunkingConfig): void {
    if (config.defaultSize <= 0) {
      throw new Error('Default chunk size must be positive');
    }
    if (config.defaultOverlap < 0) {
      throw new Error('Chunk overlap cannot be negative');
    }
    if (config.defaultOverlap >= config.defaultSize) {
      throw new Error('Chunk overlap must be less than chunk size');
    }
    if (config.maxSize < config.defaultSize) {
      throw new Error('Max size must be greater than or equal to default size');
    }
    if (config.minSize > config.defaultSize) {
      throw new Error('Min size must be less than or equal to default size');
    }
  }

  /**
   * Validate agent configuration
   */
  private validateAgentConfig(config: AgentDefaultConfig): void {
    if (config.maxContextLength <= 0) {
      throw new Error('Max context length must be positive');
    }
    if (config.defaultTemperature < 0 || config.defaultTemperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    if (config.maxTokensPerResponse <= 0) {
      throw new Error('Max tokens per response must be positive');
    }
  }

  /**
   * Validate performance configuration
   */
  private validatePerformanceConfig(config: PerformanceConfig): void {
    if (config.maxConcurrentProcessing <= 0) {
      throw new Error('Max concurrent processing must be positive');
    }
    if (config.memoryLimitMB <= 0) {
      throw new Error('Memory limit must be positive');
    }
    if (config.timeoutMs <= 0) {
      throw new Error('Timeout must be positive');
    }
    if (config.cacheExpiryMs <= 0) {
      throw new Error('Cache expiry must be positive');
    }
  }
}