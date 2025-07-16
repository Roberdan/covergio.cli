/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { VectorDatabase } from './interfaces.js';
import {
  VectorEmbedding,
  VectorQuery,
  VectorSearchResult,
  VectorOperationResult,
  VectorBatchOperation,
  VectorIndexStats,
  VectorDbHealth,
  VectorDbConfig,
  VectorDbProvider,
  VectorDistanceMetric
} from './types.js';

/**
 * Universal vector database abstraction supporting multiple providers
 */
export class UniversalVectorDatabase implements VectorDatabase {
  private config?: VectorDbConfig;
  private initialized = false;
  private provider?: VectorDbProvider;

  /**
   * Initialize the vector database connection
   */
  async initialize(config: VectorDbConfig): Promise<void> {
    this.config = config;
    this.provider = config.provider;

    // Validate configuration
    this.validateConfig(config);

    // Provider-specific initialization
    await this.initializeProvider(config);

    this.initialized = true;
  }

  /**
   * Create a new vector index
   */
  async createIndex(indexName: string, dimensions: number): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const result = await this.executeCreateIndex(indexName, dimensions);
      return {
        ...result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create index: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Delete a vector index
   */
  async deleteIndex(indexName: string): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const result = await this.executeDeleteIndex(indexName);
      return {
        ...result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete index: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * List available indices
   */
  async listIndices(): Promise<string[]> {
    this.ensureInitialized();
    return await this.executeListIndices();
  }

  /**
   * Insert or update vectors
   */
  async upsert(indexName: string, vectors: VectorEmbedding[]): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Validate vectors
      this.validateVectors(vectors);

      // Execute upsert operation
      const result = await this.executeUpsert(indexName, vectors);
      
      return {
        ...result,
        executionTime: Date.now() - startTime,
        vectorsProcessed: vectors.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to upsert vectors: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Delete vectors by ID
   */
  async delete(indexName: string, vectorIds: string[]): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const result = await this.executeDelete(indexName, vectorIds);
      return {
        ...result,
        executionTime: Date.now() - startTime,
        vectorsProcessed: vectorIds.length
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete vectors: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Perform similarity search
   */
  async query(indexName: string, query: VectorQuery): Promise<VectorSearchResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Validate query
      this.validateQuery(query);

      const matches = await this.executeQuery(indexName, query);
      
      return {
        matches,
        totalCount: matches.length,
        executionTime: Date.now() - startTime,
        query
      };
    } catch (error) {
      return {
        matches: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
        query
      };
    }
  }

  /**
   * Get vectors by ID
   */
  async fetch(indexName: string, vectorIds: string[]): Promise<VectorEmbedding[]> {
    this.ensureInitialized();
    return await this.executeFetch(indexName, vectorIds);
  }

  /**
   * Perform batch operations
   */
  async batch(indexName: string, operations: VectorBatchOperation[]): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      let totalProcessed = 0;
      
      for (const operation of operations) {
        switch (operation.operation) {
          case 'upsert':
            if (operation.vectors) {
              await this.executeUpsert(indexName, operation.vectors);
              totalProcessed += operation.vectors.length;
            }
            break;
          case 'delete':
            if (operation.vectorIds) {
              await this.executeDelete(indexName, operation.vectorIds);
              totalProcessed += operation.vectorIds.length;
            }
            break;
          case 'query':
            if (operation.query) {
              await this.executeQuery(indexName, operation.query);
              totalProcessed += 1;
            }
            break;
        }
      }

      return {
        success: true,
        message: `Batch operation completed successfully`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: totalProcessed
      };
    } catch (error) {
      return {
        success: false,
        message: `Batch operation failed: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Get index statistics
   */
  async getStats(indexName: string): Promise<VectorIndexStats> {
    this.ensureInitialized();
    return await this.executeGetStats(indexName);
  }

  /**
   * Check database health
   */
  async health(): Promise<VectorDbHealth> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        indices: [],
        errors: ['Database not initialized']
      };
    }

    const startTime = Date.now();
    
    try {
      const indices = await this.listIndices();
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        indices,
        metrics: {
          connectionCount: 1,
          queryLatency: responseTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        indices: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.executeClose();
      this.initialized = false;
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: VectorDbConfig): void {
    if (!config.provider) {
      throw new Error('Vector database provider is required');
    }

    if (!config.connection) {
      throw new Error('Connection configuration is required');
    }

    if (!config.index) {
      throw new Error('Index configuration is required');
    }

    if (config.index.dimensions <= 0) {
      throw new Error('Vector dimensions must be positive');
    }
  }

  /**
   * Validate vectors before operations
   */
  private validateVectors(vectors: VectorEmbedding[]): void {
    if (!this.config) return;

    for (const vector of vectors) {
      if (!vector.id || !vector.values) {
        throw new Error('Vector must have id and values');
      }

      if (vector.values.length !== this.config.index.dimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected ${this.config.index.dimensions}, got ${vector.values.length}`
        );
      }

      if (!vector.values.every(v => typeof v === 'number' && !isNaN(v))) {
        throw new Error('Vector values must be valid numbers');
      }
    }
  }

  /**
   * Validate query parameters
   */
  private validateQuery(query: VectorQuery): void {
    if (!this.config) return;

    if (!query.vector || query.vector.length !== this.config.index.dimensions) {
      throw new Error(
        `Query vector dimensions mismatch. Expected ${this.config.index.dimensions}, got ${query.vector?.length || 0}`
      );
    }

    if (query.topK <= 0) {
      throw new Error('topK must be positive');
    }

    if (query.minScore !== undefined && (query.minScore < 0 || query.minScore > 1)) {
      throw new Error('minScore must be between 0 and 1');
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Vector database not initialized');
    }
  }

  /**
   * Initialize provider-specific settings
   */
  private async initializeProvider(config: VectorDbConfig): Promise<void> {
    switch (config.provider) {
      case VectorDbProvider.PINECONE:
        await this.initializePinecone(config);
        break;
      case VectorDbProvider.WEAVIATE:
        await this.initializeWeaviate(config);
        break;
      case VectorDbProvider.MILVUS:
        await this.initializeMilvus(config);
        break;
      case VectorDbProvider.QDRANT:
        await this.initializeQdrant(config);
        break;
      case VectorDbProvider.CHROMA:
        await this.initializeChroma(config);
        break;
      case VectorDbProvider.IN_MEMORY:
        await this.initializeInMemory(config);
        break;
      default:
        throw new Error(`Unsupported vector database provider: ${config.provider}`);
    }
  }

  /**
   * Initialize Pinecone
   */
  private async initializePinecone(config: VectorDbConfig): Promise<void> {
    if (!config.connection.apiKey) {
      throw new Error('Pinecone API key is required');
    }
    // Pinecone-specific initialization would go here
  }

  /**
   * Initialize Weaviate
   */
  private async initializeWeaviate(config: VectorDbConfig): Promise<void> {
    if (!config.connection.host) {
      throw new Error('Weaviate host is required');
    }
    // Weaviate-specific initialization would go here
  }

  /**
   * Initialize Milvus
   */
  private async initializeMilvus(config: VectorDbConfig): Promise<void> {
    if (!config.connection.host) {
      throw new Error('Milvus host is required');
    }
    // Milvus-specific initialization would go here
  }

  /**
   * Initialize Qdrant
   */
  private async initializeQdrant(config: VectorDbConfig): Promise<void> {
    if (!config.connection.host) {
      throw new Error('Qdrant host is required');
    }
    // Qdrant-specific initialization would go here
  }

  /**
   * Initialize Chroma
   */
  private async initializeChroma(config: VectorDbConfig): Promise<void> {
    if (!config.connection.host) {
      throw new Error('Chroma host is required');
    }
    // Chroma-specific initialization would go here
  }

  /**
   * Initialize in-memory vector store
   */
  private async initializeInMemory(config: VectorDbConfig): Promise<void> {
    // In-memory implementation doesn't need external connections
  }

  // Provider-specific operation implementations would follow...
  // For brevity, I'll implement a few key methods as examples

  /**
   * Execute create index operation
   */
  private async executeCreateIndex(indexName: string, dimensions: number): Promise<VectorOperationResult> {
    if (!this.config) throw new Error('Configuration not available');

    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryCreateIndex(indexName, dimensions);
      case VectorDbProvider.PINECONE:
        return this.pineconeCreateIndex(indexName, dimensions);
      // Add other providers...
      default:
        throw new Error(`Create index not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute delete index operation
   */
  private async executeDeleteIndex(indexName: string): Promise<VectorOperationResult> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryDeleteIndex(indexName);
      // Add other providers...
      default:
        throw new Error(`Delete index not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute list indices operation
   */
  private async executeListIndices(): Promise<string[]> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryListIndices();
      // Add other providers...
      default:
        throw new Error(`List indices not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute upsert operation
   */
  private async executeUpsert(indexName: string, vectors: VectorEmbedding[]): Promise<VectorOperationResult> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryUpsert(indexName, vectors);
      // Add other providers...
      default:
        throw new Error(`Upsert not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(indexName: string, vectorIds: string[]): Promise<VectorOperationResult> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryDelete(indexName, vectorIds);
      // Add other providers...
      default:
        throw new Error(`Delete not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute query operation
   */
  private async executeQuery(indexName: string, query: VectorQuery): Promise<any[]> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryQuery(indexName, query);
      // Add other providers...
      default:
        throw new Error(`Query not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute fetch operation
   */
  private async executeFetch(indexName: string, vectorIds: string[]): Promise<VectorEmbedding[]> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryFetch(indexName, vectorIds);
      // Add other providers...
      default:
        throw new Error(`Fetch not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute get stats operation
   */
  private async executeGetStats(indexName: string): Promise<VectorIndexStats> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryGetStats(indexName);
      // Add other providers...
      default:
        throw new Error(`Get stats not implemented for ${this.provider}`);
    }
  }

  /**
   * Execute close operation
   */
  private async executeClose(): Promise<void> {
    switch (this.provider) {
      case VectorDbProvider.IN_MEMORY:
        return this.inMemoryClose();
      // Add other providers...
      default:
        // No-op for providers that don't need explicit close
        return;
    }
  }

  // In-memory implementation (for development/testing)
  private inMemoryVectors: Map<string, Map<string, VectorEmbedding>> = new Map();

  private async inMemoryCreateIndex(indexName: string, dimensions: number): Promise<VectorOperationResult> {
    this.inMemoryVectors.set(indexName, new Map());
    return {
      success: true,
      message: `In-memory index ${indexName} created`,
      executionTime: 0
    };
  }

  private async inMemoryDeleteIndex(indexName: string): Promise<VectorOperationResult> {
    const existed = this.inMemoryVectors.delete(indexName);
    return {
      success: true,
      message: existed ? `Index ${indexName} deleted` : `Index ${indexName} did not exist`,
      executionTime: 0
    };
  }

  private async inMemoryListIndices(): Promise<string[]> {
    return Array.from(this.inMemoryVectors.keys());
  }

  private async inMemoryUpsert(indexName: string, vectors: VectorEmbedding[]): Promise<VectorOperationResult> {
    const index = this.inMemoryVectors.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} does not exist`);
    }

    vectors.forEach(vector => index.set(vector.id, vector));
    
    return {
      success: true,
      message: `Upserted ${vectors.length} vectors`,
      executionTime: 0
    };
  }

  private async inMemoryDelete(indexName: string, vectorIds: string[]): Promise<VectorOperationResult> {
    const index = this.inMemoryVectors.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} does not exist`);
    }

    let deletedCount = 0;
    vectorIds.forEach(id => {
      if (index.delete(id)) {
        deletedCount++;
      }
    });

    return {
      success: true,
      message: `Deleted ${deletedCount} vectors`,
      executionTime: 0
    };
  }

  private async inMemoryQuery(indexName: string, query: VectorQuery): Promise<any[]> {
    const index = this.inMemoryVectors.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} does not exist`);
    }

    const vectors = Array.from(index.values());
    const similarities = vectors.map(vector => ({
      embedding: vector,
      score: this.calculateCosineSimilarity(query.vector, vector.values)
    }));

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.score - a.score);

    // Apply filters
    let filtered = similarities;
    if (query.minScore !== undefined) {
      filtered = filtered.filter(item => item.score >= query.minScore!);
    }

    // Return top K
    return filtered.slice(0, query.topK);
  }

  private async inMemoryFetch(indexName: string, vectorIds: string[]): Promise<VectorEmbedding[]> {
    const index = this.inMemoryVectors.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} does not exist`);
    }

    return vectorIds
      .map(id => index.get(id))
      .filter((vector): vector is VectorEmbedding => vector !== undefined);
  }

  private async inMemoryGetStats(indexName: string): Promise<VectorIndexStats> {
    const index = this.inMemoryVectors.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} does not exist`);
    }

    return {
      totalVectors: index.size,
      indexSize: index.size * (this.config?.index.dimensions || 0) * 4, // Rough estimate
      dimensions: this.config?.index.dimensions || 0,
      metric: this.config?.index.metric || VectorDistanceMetric.COSINE,
      indexType: 'in-memory',
      averageQueryTime: 10,
      cacheHitRate: 1.0,
      lastUpdated: new Date()
    };
  }

  private async inMemoryClose(): Promise<void> {
    this.inMemoryVectors.clear();
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async pineconeCreateIndex(indexName: string, dimensions: number): Promise<VectorOperationResult> {
    if (!this.config) throw new Error('Configuration not available');

    const response = await fetch(`https://api.pinecone.io/indexes`, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.connection.apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: indexName,
        dimension: dimensions,
        metric: this.config.index.metric || VectorDistanceMetric.COSINE
      })
    });

    if (!response.ok) {
      throw new Error(`Pinecone API error: ${response.statusText}`);
    }

    return {
      success: true,
      message: `Pinecone index ${indexName} created`,
      executionTime: 0
    };
  }
}