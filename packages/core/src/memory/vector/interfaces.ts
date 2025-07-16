/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  VectorEmbedding,
  VectorQuery,
  VectorSearchResult,
  VectorOperationResult,
  VectorBatchOperation,
  VectorIndexStats,
  VectorDbHealth,
  VectorDbConfig,
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingModelConfig,
  MultiModalEmbeddingRequest,
  EmbeddingChunkStrategy,
  VectorNamespace
} from './types.js';

/**
 * Core interface for vector database operations
 */
export interface VectorDatabase {
  /**
   * Initialize the vector database connection
   */
  initialize(config: VectorDbConfig): Promise<void>;

  /**
   * Create a new vector index
   */
  createIndex(indexName: string, dimensions: number): Promise<VectorOperationResult>;

  /**
   * Delete a vector index
   */
  deleteIndex(indexName: string): Promise<VectorOperationResult>;

  /**
   * List available indices
   */
  listIndices(): Promise<string[]>;

  /**
   * Insert or update vectors
   */
  upsert(indexName: string, vectors: VectorEmbedding[]): Promise<VectorOperationResult>;

  /**
   * Delete vectors by ID
   */
  delete(indexName: string, vectorIds: string[]): Promise<VectorOperationResult>;

  /**
   * Perform similarity search
   */
  query(indexName: string, query: VectorQuery): Promise<VectorSearchResult>;

  /**
   * Get vectors by ID
   */
  fetch(indexName: string, vectorIds: string[]): Promise<VectorEmbedding[]>;

  /**
   * Perform batch operations
   */
  batch(indexName: string, operations: VectorBatchOperation[]): Promise<VectorOperationResult>;

  /**
   * Get index statistics
   */
  getStats(indexName: string): Promise<VectorIndexStats>;

  /**
   * Check database health
   */
  health(): Promise<VectorDbHealth>;

  /**
   * Close database connection
   */
  close(): Promise<void>;
}

/**
 * Interface for embedding generation
 */
export interface EmbeddingGenerator {
  /**
   * Initialize the embedding generator
   */
  initialize(config: EmbeddingModelConfig): Promise<void>;

  /**
   * Generate embeddings for content
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple items
   */
  embedBatch(requests: EmbeddingRequest[]): Promise<EmbeddingResult>;

  /**
   * Generate multi-modal embeddings
   */
  embedMultiModal(request: MultiModalEmbeddingRequest): Promise<EmbeddingResult>;

  /**
   * Get model information
   */
  getModelInfo(): Promise<{
    name: string;
    dimensions: number;
    maxInputLength: number;
    provider: string;
  }>;

  /**
   * Check if model is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Interface for vector caching operations
 */
export interface VectorCache {
  /**
   * Get cached vector by ID
   */
  get(vectorId: string): Promise<VectorEmbedding | null>;

  /**
   * Cache a vector
   */
  set(vectorId: string, vector: VectorEmbedding, ttl?: number): Promise<void>;

  /**
   * Delete cached vector
   */
  delete(vectorId: string): Promise<void>;

  /**
   * Check if vector is cached
   */
  has(vectorId: string): Promise<boolean>;

  /**
   * Clear all cached vectors
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  }>;
}

/**
 * Interface for content preprocessing before embedding
 */
export interface ContentPreprocessor {
  /**
   * Preprocess text content
   */
  preprocessText(text: string): Promise<string>;

  /**
   * Chunk content for embedding
   */
  chunkContent(content: string, strategy: EmbeddingChunkStrategy): Promise<string[]>;

  /**
   * Extract text from structured data
   */
  extractText(data: any): Promise<string>;

  /**
   * Normalize content for consistent embedding
   */
  normalize(content: string): Promise<string>;

  /**
   * Detect content language
   */
  detectLanguage(content: string): Promise<string>;
}

/**
 * Interface for vector similarity calculations
 */
export interface SimilarityCalculator {
  /**
   * Calculate cosine similarity
   */
  cosine(vector1: number[], vector2: number[]): number;

  /**
   * Calculate euclidean distance
   */
  euclidean(vector1: number[], vector2: number[]): number;

  /**
   * Calculate manhattan distance
   */
  manhattan(vector1: number[], vector2: number[]): number;

  /**
   * Calculate dot product
   */
  dotProduct(vector1: number[], vector2: number[]): number;

  /**
   * Find most similar vectors
   */
  findSimilar(
    queryVector: number[],
    candidateVectors: VectorEmbedding[],
    topK: number,
    metric?: string
  ): VectorEmbedding[];

  /**
   * Calculate similarity matrix
   */
  similarityMatrix(vectors: number[][]): number[][];
}

/**
 * Interface for vector index management
 */
export interface VectorIndexManager {
  /**
   * Create index with optimized configuration
   */
  createOptimizedIndex(
    name: string,
    dimensions: number,
    expectedVectorCount: number
  ): Promise<VectorOperationResult>;

  /**
   * Optimize existing index
   */
  optimizeIndex(indexName: string): Promise<VectorOperationResult>;

  /**
   * Reindex vectors with new configuration
   */
  reindex(
    indexName: string,
    newConfig: any
  ): Promise<VectorOperationResult>;

  /**
   * Monitor index performance
   */
  monitorIndex(indexName: string): Promise<{
    queryLatency: number;
    throughput: number;
    memoryUsage: number;
    diskUsage: number;
  }>;

  /**
   * Get index recommendations
   */
  getOptimizationRecommendations(indexName: string): Promise<string[]>;
}

/**
 * Interface for namespace management (multi-tenancy)
 */
export interface NamespaceManager {
  /**
   * Create a new namespace
   */
  createNamespace(namespace: Omit<VectorNamespace, 'id' | 'createdAt'>): Promise<VectorNamespace>;

  /**
   * Delete a namespace
   */
  deleteNamespace(namespaceId: string): Promise<VectorOperationResult>;

  /**
   * List namespaces for an agent
   */
  listNamespaces(agentId: string): Promise<VectorNamespace[]>;

  /**
   * Get namespace by ID
   */
  getNamespace(namespaceId: string): Promise<VectorNamespace | null>;

  /**
   * Update namespace metadata
   */
  updateNamespace(
    namespaceId: string,
    updates: Partial<VectorNamespace>
  ): Promise<VectorOperationResult>;
}

/**
 * Main interface for vector memory operations
 */
export interface VectorMemoryEngine {
  /**
   * Initialize the vector memory system
   */
  initialize(
    dbConfig: VectorDbConfig,
    embeddingConfig: EmbeddingModelConfig
  ): Promise<void>;

  /**
   * Store content as vector embedding
   */
  store(
    memoryId: string,
    content: string | any,
    namespace?: string
  ): Promise<VectorOperationResult>;

  /**
   * Search for similar content
   */
  search(
    query: string | number[],
    options: {
      topK?: number;
      namespace?: string;
      threshold?: number;
      filters?: Record<string, any>;
    }
  ): Promise<VectorSearchResult>;

  /**
   * Update existing vector
   */
  update(
    memoryId: string,
    content: string | any,
    namespace?: string
  ): Promise<VectorOperationResult>;

  /**
   * Delete vector
   */
  delete(memoryId: string, namespace?: string): Promise<VectorOperationResult>;

  /**
   * Find similar memories
   */
  findSimilarMemories(
    memoryId: string,
    topK?: number,
    namespace?: string
  ): Promise<VectorSearchResult>;

  /**
   * Get vector statistics
   */
  getStats(namespace?: string): Promise<VectorIndexStats>;

  /**
   * Optimize vector index
   */
  optimize(namespace?: string): Promise<VectorOperationResult>;

  /**
   * Health check
   */
  health(): Promise<VectorDbHealth>;

  /**
   * Shutdown the vector memory system
   */
  shutdown(): Promise<void>;
}

/**
 * Interface for hybrid search (vector + text)
 */
export interface HybridSearchEngine {
  /**
   * Perform hybrid search combining vector and text search
   */
  hybridSearch(
    query: string,
    options: {
      vectorWeight?: number;
      textWeight?: number;
      topK?: number;
      namespace?: string;
      filters?: Record<string, any>;
    }
  ): Promise<VectorSearchResult>;

  /**
   * Rerank search results
   */
  rerank(
    query: string,
    results: VectorSearchResult,
    rerankModel?: string
  ): Promise<VectorSearchResult>;
}

/**
 * Interface for vector analytics and insights
 */
export interface VectorAnalytics {
  /**
   * Analyze vector distribution
   */
  analyzeDistribution(indexName: string): Promise<{
    clusters: number;
    outliers: string[];
    density: number;
    coverage: number;
  }>;

  /**
   * Find duplicate or near-duplicate vectors
   */
  findDuplicates(
    indexName: string,
    threshold?: number
  ): Promise<Array<{
    vectors: string[];
    similarity: number;
  }>>;

  /**
   * Generate vector quality metrics
   */
  getQualityMetrics(indexName: string): Promise<{
    averageNorm: number;
    dimensionVariance: number[];
    sparsity: number;
    uniqueness: number;
  }>;

  /**
   * Recommend optimal embedding dimensions
   */
  recommendDimensions(
    sampleVectors: number[][],
    targetAccuracy?: number
  ): Promise<{
    recommendedDimensions: number;
    accuracyLoss: number;
    compressionRatio: number;
  }>;
}