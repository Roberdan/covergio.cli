/**
 * Configuration factory for RAG system
 */

import { RAGConfig } from './RAGConfig.js';
import { RAGSystemConfig } from '../types/index.js';

export class ConfigFactory {
  private static instance: RAGConfig | null = null;

  /**
   * Create or get singleton configuration instance
   */
  static getInstance(config?: Partial<RAGSystemConfig>): RAGConfig {
    if (!this.instance || config) {
      this.instance = new RAGConfig(config);
    }
    return this.instance;
  }

  /**
   * Create a new configuration instance
   */
  static create(config?: Partial<RAGSystemConfig>): RAGConfig {
    return new RAGConfig(config);
  }

  /**
   * Load configuration from environment variables
   */
  static fromEnvironment(): RAGConfig {
    const config: Partial<RAGSystemConfig> = {};

    // Embedding configuration from environment
    if (process.env.RAG_EMBEDDING_MODEL) {
      config.embedding = {
        ...config.embedding,
        modelName: process.env.RAG_EMBEDDING_MODEL
      };
    }

    if (process.env.RAG_EMBEDDING_DIMENSIONS) {
      config.embedding = {
        ...config.embedding,
        dimensions: parseInt(process.env.RAG_EMBEDDING_DIMENSIONS, 10)
      };
    }

    if (process.env.RAG_EMBEDDING_DEVICE) {
      config.embedding = {
        ...config.embedding,
        device: process.env.RAG_EMBEDDING_DEVICE as 'cpu' | 'gpu'
      };
    }

    // Vector store configuration from environment
    if (process.env.RAG_VECTOR_STORE_PATH) {
      config.vectorStore = {
        ...config.vectorStore,
        storePath: process.env.RAG_VECTOR_STORE_PATH
      };
    }

    // Chunking configuration from environment
    if (process.env.RAG_CHUNK_SIZE) {
      config.chunking = {
        ...config.chunking,
        defaultSize: parseInt(process.env.RAG_CHUNK_SIZE, 10)
      };
    }

    if (process.env.RAG_CHUNK_OVERLAP) {
      config.chunking = {
        ...config.chunking,
        defaultOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP, 10)
      };
    }

    // Performance configuration from environment
    if (process.env.RAG_MAX_CONCURRENT) {
      config.performance = {
        ...config.performance,
        maxConcurrentProcessing: parseInt(process.env.RAG_MAX_CONCURRENT, 10)
      };
    }

    if (process.env.RAG_MEMORY_LIMIT_MB) {
      config.performance = {
        ...config.performance,
        memoryLimitMB: parseInt(process.env.RAG_MEMORY_LIMIT_MB, 10)
      };
    }

    return new RAGConfig(config);
  }

  /**
   * Load configuration from file
   */
  static async fromFile(filePath: string): Promise<RAGConfig> {
    try {
      const fs = await import('fs/promises');
      const configData = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(configData) as Partial<RAGSystemConfig>;
      return new RAGConfig(config);
    } catch (error) {
      throw new Error(`Failed to load configuration from file: ${error}`);
    }
  }

  /**
   * Reset singleton instance
   */
  static reset(): void {
    this.instance = null;
  }
}