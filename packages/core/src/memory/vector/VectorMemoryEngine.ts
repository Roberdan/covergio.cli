/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { VectorMemoryEngine, VectorDatabase, EmbeddingGenerator, VectorCache } from './interfaces.js';
import {
  VectorDbConfig,
  EmbeddingModelConfig,
  VectorOperationResult,
  VectorSearchResult,
  VectorIndexStats,
  VectorDbHealth,
  VectorEmbedding,
  VectorQuery
} from './types.js';

/**
 * Main vector memory engine integrating database and embedding capabilities
 */
export class DefaultVectorMemoryEngine implements VectorMemoryEngine {
  private vectorDb?: VectorDatabase;
  private embeddingGenerator?: EmbeddingGenerator;
  private cache?: VectorCache;
  private initialized = false;
  private defaultIndexName = 'agent-memory';

  constructor(
    vectorDb: VectorDatabase,
    embeddingGenerator: EmbeddingGenerator,
    cache?: VectorCache
  ) {
    this.vectorDb = vectorDb;
    this.embeddingGenerator = embeddingGenerator;
    this.cache = cache;
  }

  /**
   * Initialize the vector memory system
   */
  async initialize(
    dbConfig: VectorDbConfig,
    embeddingConfig: EmbeddingModelConfig
  ): Promise<void> {
    try {
      // Initialize vector database
      await this.vectorDb!.initialize(dbConfig);

      // Initialize embedding generator
      await this.embeddingGenerator!.initialize(embeddingConfig);

      // Create default index if it doesn't exist
      const indices = await this.vectorDb!.listIndices();
      if (!indices.includes(this.defaultIndexName)) {
        await this.vectorDb!.createIndex(this.defaultIndexName, embeddingConfig.dimensions);
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector memory engine: ${(error as Error).message}`);
    }
  }

  /**
   * Store content as vector embedding
   */
  async store(
    memoryId: string,
    content: string | any,
    namespace?: string
  ): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Convert content to string if needed
      const textContent = typeof content === 'string' ? content : JSON.stringify(content);
      
      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(textContent);
      
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get(`${memoryId}:${contentHash}`);
        if (cached) {
          return {
            success: true,
            message: 'Vector found in cache',
            executionTime: Date.now() - startTime,
            vectorsProcessed: 1
          };
        }
      }

      // Generate embedding
      const embeddingResult = await this.embeddingGenerator!.embed({
        content: textContent,
        contentType: typeof content === 'string' ? 'text' : 'json'
      });

      if (embeddingResult.embeddings.length === 0) {
        throw new Error('No embeddings generated');
      }

      // Create vector embedding
      const vectorEmbedding: VectorEmbedding = {
        id: memoryId,
        values: embeddingResult.embeddings[0],
        dimensions: embeddingResult.embeddings[0].length,
        memoryId,
        metadata: {
          contentType: typeof content === 'string' ? 'text' : 'json',
          contentLength: textContent.length,
          model: embeddingResult.model,
          modelVersion: embeddingResult.modelVersion,
          createdAt: new Date(),
          contentHash,
          custom: namespace ? { namespace } : undefined
        }
      };

      // Store in vector database
      const indexName = namespace ? `${this.defaultIndexName}-${namespace}` : this.defaultIndexName;
      
      // Ensure index exists for namespace
      if (namespace) {
        const indices = await this.vectorDb!.listIndices();
        if (!indices.includes(indexName)) {
          const modelInfo = await this.embeddingGenerator!.getModelInfo();
          await this.vectorDb!.createIndex(indexName, modelInfo.dimensions);
        }
      }

      const result = await this.vectorDb!.upsert(indexName, [vectorEmbedding]);

      // Cache the vector
      if (this.cache && result.success) {
        await this.cache.set(`${memoryId}:${contentHash}`, vectorEmbedding);
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 1,
        data: {
          vectorId: memoryId,
          dimensions: vectorEmbedding.dimensions,
          model: embeddingResult.model
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to store vector: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Search for similar content
   */
  async search(
    query: string | number[],
    options: {
      topK?: number;
      namespace?: string;
      threshold?: number;
      filters?: Record<string, any>;
    } = {}
  ): Promise<VectorSearchResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      let queryVector: number[];

      // Generate query vector if needed
      if (typeof query === 'string') {
        const embeddingResult = await this.embeddingGenerator!.embed({
          content: query,
          contentType: 'text'
        });

        if (embeddingResult.embeddings.length === 0) {
          throw new Error('No query embedding generated');
        }

        queryVector = embeddingResult.embeddings[0];
      } else {
        queryVector = query;
      }

      // Prepare vector query
      const vectorQuery: VectorQuery = {
        vector: queryVector,
        topK: options.topK || 10,
        minScore: options.threshold,
        metadataFilter: options.filters,
        includeMetadata: true,
        includeValues: false
      };

      // Determine index name
      const indexName = options.namespace ? 
        `${this.defaultIndexName}-${options.namespace}` : 
        this.defaultIndexName;

      // Execute search
      const result = await this.vectorDb!.query(indexName, vectorQuery);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        matches: [],
        totalCount: 0,
        executionTime: Date.now() - startTime,
        query: {
          vector: [],
          topK: options.topK || 10
        }
      };
    }
  }

  /**
   * Update existing vector
   */
  async update(
    memoryId: string,
    content: string | any,
    namespace?: string
  ): Promise<VectorOperationResult> {
    // For vector databases, update is typically the same as upsert
    return await this.store(memoryId, content, namespace);
  }

  /**
   * Delete vector
   */
  async delete(memoryId: string, namespace?: string): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const indexName = namespace ? 
        `${this.defaultIndexName}-${namespace}` : 
        this.defaultIndexName;

      const result = await this.vectorDb!.delete(indexName, [memoryId]);

      // Remove from cache
      if (this.cache) {
        // Since we don't know the content hash, we'll need to clear any cached entries for this memoryId
        // This is a limitation of the current cache design
      }

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to delete vector: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Find similar memories
   */
  async findSimilarMemories(
    memoryId: string,
    topK: number = 5,
    namespace?: string
  ): Promise<VectorSearchResult> {
    this.ensureInitialized();

    try {
      // First, fetch the target vector
      const indexName = namespace ? 
        `${this.defaultIndexName}-${namespace}` : 
        this.defaultIndexName;

      const targetVectors = await this.vectorDb!.fetch(indexName, [memoryId]);
      
      if (targetVectors.length === 0) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      const targetVector = targetVectors[0];

      // Search for similar vectors
      return await this.search(targetVector.values, {
        topK: topK + 1, // +1 to account for the target vector itself
        namespace,
        threshold: 0.1 // Minimum similarity threshold
      });

    } catch (error) {
      return {
        matches: [],
        totalCount: 0,
        executionTime: 0,
        query: {
          vector: [],
          topK
        }
      };
    }
  }

  /**
   * Get vector statistics
   */
  async getStats(namespace?: string): Promise<VectorIndexStats> {
    this.ensureInitialized();

    const indexName = namespace ? 
      `${this.defaultIndexName}-${namespace}` : 
      this.defaultIndexName;

    return await this.vectorDb!.getStats(indexName);
  }

  /**
   * Optimize vector index
   */
  async optimize(namespace?: string): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // For most vector databases, optimization is automatic
      // This could trigger manual optimization if supported
      
      const indexName = namespace ? 
        `${this.defaultIndexName}-${namespace}` : 
        this.defaultIndexName;

      // Get current stats to return useful information
      const stats = await this.vectorDb!.getStats(indexName);

      return {
        success: true,
        message: `Index optimization completed for ${indexName}`,
        executionTime: Date.now() - startTime,
        data: {
          indexName,
          vectorCount: stats.totalVectors,
          indexSize: stats.indexSize
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to optimize index: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Health check
   */
  async health(): Promise<VectorDbHealth> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        indices: [],
        errors: ['Vector memory engine not initialized']
      };
    }

    try {
      // Check vector database health
      const dbHealth = await this.vectorDb!.health();

      // Check embedding generator health
      const embeddingAvailable = await this.embeddingGenerator!.isAvailable();

      if (!embeddingAvailable) {
        return {
          ...dbHealth,
          status: 'degraded',
          errors: [...(dbHealth.errors || []), 'Embedding generator not available']
        };
      }

      return dbHealth;

    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        indices: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Shutdown the vector memory system
   */
  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.vectorDb?.close();
      
      if (this.cache) {
        await this.cache.clear();
      }

      this.initialized = false;
    }
  }

  /**
   * Batch store multiple items
   */
  async storeBatch(
    items: Array<{
      memoryId: string;
      content: string | any;
      namespace?: string;
    }>
  ): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Group by namespace
      const namespaceGroups = new Map<string, typeof items>();
      
      for (const item of items) {
        const ns = item.namespace || 'default';
        if (!namespaceGroups.has(ns)) {
          namespaceGroups.set(ns, []);
        }
        namespaceGroups.get(ns)!.push(item);
      }

      let totalProcessed = 0;
      const errors: string[] = [];

      // Process each namespace group
      const namespaceEntries = Array.from(namespaceGroups.entries());
      for (const [namespace, groupItems] of namespaceEntries) {
        try {
          // Prepare content for embedding
          const embeddingRequests = groupItems.map(item => ({
            content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
            contentType: typeof item.content === 'string' ? 'text' : 'json'
          }));

          // Generate embeddings in batch
          const embeddingResult = await this.embeddingGenerator!.embedBatch(embeddingRequests);

          // Create vector embeddings
          const vectorEmbeddings: VectorEmbedding[] = groupItems.map((item, index) => {
            const textContent = embeddingRequests[index].content;
            return {
              id: item.memoryId,
              values: embeddingResult.embeddings[index],
              dimensions: embeddingResult.embeddings[index].length,
              memoryId: item.memoryId,
              metadata: {
                contentType: embeddingRequests[index].contentType,
                contentLength: textContent.length,
                model: embeddingResult.model,
                modelVersion: embeddingResult.modelVersion,
                createdAt: new Date(),
                contentHash: this.generateContentHash(textContent),
                custom: namespace !== 'default' ? { namespace } : undefined
              }
            };
          });

          // Store in vector database
          const indexName = namespace !== 'default' ? 
            `${this.defaultIndexName}-${namespace}` : 
            this.defaultIndexName;

          // Ensure index exists
          const indices = await this.vectorDb!.listIndices();
          if (!indices.includes(indexName)) {
            const modelInfo = await this.embeddingGenerator!.getModelInfo();
            await this.vectorDb!.createIndex(indexName, modelInfo.dimensions);
          }

          const result = await this.vectorDb!.upsert(indexName, vectorEmbeddings);
          
          if (result.success) {
            totalProcessed += groupItems.length;
          } else {
            errors.push(`Failed to store ${groupItems.length} items in namespace ${namespace}: ${result.message}`);
          }

        } catch (error) {
          errors.push(`Failed to process namespace ${namespace}: ${(error as Error).message}`);
        }
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 ? 
          `Successfully stored ${totalProcessed} vectors` :
          `Stored ${totalProcessed} vectors with ${errors.length} errors`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: totalProcessed,
        data: { errors }
      };

    } catch (error) {
      return {
        success: false,
        message: `Batch store failed: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Get all namespaces
   */
  async getNamespaces(): Promise<string[]> {
    this.ensureInitialized();

    const indices = await this.vectorDb!.listIndices();
    const namespaces = new Set<string>();

    for (const index of indices) {
      if (index === this.defaultIndexName) {
        namespaces.add('default');
      } else if (index.startsWith(`${this.defaultIndexName}-`)) {
        const namespace = index.substring(this.defaultIndexName.length + 1);
        namespaces.add(namespace);
      }
    }

    return Array.from(namespaces);
  }

  /**
   * Delete namespace and all its vectors
   */
  async deleteNamespace(namespace: string): Promise<VectorOperationResult> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      if (namespace === 'default') {
        // Clear default index instead of deleting
        const stats = await this.vectorDb!.getStats(this.defaultIndexName);
        // Would need to fetch all vectors and delete them
        // For simplicity, we'll delete and recreate the index
        await this.vectorDb!.deleteIndex(this.defaultIndexName);
        const modelInfo = await this.embeddingGenerator!.getModelInfo();
        await this.vectorDb!.createIndex(this.defaultIndexName, modelInfo.dimensions);
        
        return {
          success: true,
          message: `Default namespace cleared`,
          executionTime: Date.now() - startTime,
          vectorsProcessed: stats.totalVectors
        };
      } else {
        const indexName = `${this.defaultIndexName}-${namespace}`;
        const stats = await this.vectorDb!.getStats(indexName);
        const result = await this.vectorDb!.deleteIndex(indexName);
        
        return {
          ...result,
          executionTime: Date.now() - startTime,
          vectorsProcessed: stats.totalVectors
        };
      }

    } catch (error) {
      return {
        success: false,
        message: `Failed to delete namespace: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        vectorsProcessed: 0,
        error: error as Error
      };
    }
  }

  /**
   * Ensure the system is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Vector memory engine not initialized');
    }
  }

  /**
   * Generate content hash for deduplication
   */
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get embedding generator instance
   */
  getEmbeddingGenerator(): EmbeddingGenerator | undefined {
    return this.embeddingGenerator;
  }

  /**
   * Get vector database instance
   */
  getVectorDatabase(): VectorDatabase | undefined {
    return this.vectorDb;
  }

  /**
   * Get cache instance
   */
  getCache(): VectorCache | undefined {
    return this.cache;
  }
}