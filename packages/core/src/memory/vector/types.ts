/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vector database and embedding types for the Agent Memory System
 */

/**
 * Vector embedding representation
 */
export interface VectorEmbedding {
  /** Unique identifier for the embedding */
  id: string;
  /** The actual vector values */
  values: number[];
  /** Dimensionality of the vector */
  dimensions: number;
  /** Associated memory item ID */
  memoryId: string;
  /** Metadata for the embedding */
  metadata: VectorMetadata;
}

/**
 * Metadata associated with vector embeddings
 */
export interface VectorMetadata {
  /** Content type that was embedded */
  contentType: string;
  /** Original content length */
  contentLength: number;
  /** Embedding model used */
  model: string;
  /** Model version */
  modelVersion: string;
  /** When the embedding was created */
  createdAt: Date;
  /** Content hash for deduplication */
  contentHash: string;
  /** Additional custom metadata */
  custom?: Record<string, any>;
}

/**
 * Vector similarity search query
 */
export interface VectorQuery {
  /** Query vector for similarity search */
  vector: number[];
  /** Number of results to return */
  topK: number;
  /** Minimum similarity score threshold */
  minScore?: number;
  /** Maximum similarity score threshold */
  maxScore?: number;
  /** Filter by metadata */
  metadataFilter?: Record<string, any>;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Include vector values in results */
  includeValues?: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** Matching embeddings with scores */
  matches: VectorMatch[];
  /** Total number of matches found */
  totalCount: number;
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Query that was executed */
  query: VectorQuery;
}

/**
 * Individual vector match result
 */
export interface VectorMatch {
  /** Embedding that matched */
  embedding: VectorEmbedding;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** Distance metric used */
  distance?: number;
}

/**
 * Vector database configuration
 */
export interface VectorDbConfig {
  /** Database provider type */
  provider: VectorDbProvider;
  /** Connection configuration */
  connection: VectorDbConnection;
  /** Index configuration */
  index: VectorIndexConfig;
  /** Performance settings */
  performance: VectorPerformanceConfig;
}

/**
 * Supported vector database providers
 */
export enum VectorDbProvider {
  PINECONE = 'pinecone',
  WEAVIATE = 'weaviate',
  MILVUS = 'milvus',
  QDRANT = 'qdrant',
  CHROMA = 'chroma',
  IN_MEMORY = 'in-memory'
}

/**
 * Vector database connection configuration
 */
export interface VectorDbConnection {
  /** API endpoint or host */
  host: string;
  /** API key or authentication token */
  apiKey?: string;
  /** Database port */
  port?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable SSL/TLS */
  ssl?: boolean;
  /** Additional connection options */
  options?: Record<string, any>;
}

/**
 * Vector index configuration
 */
export interface VectorIndexConfig {
  /** Index name */
  name: string;
  /** Vector dimensions */
  dimensions: number;
  /** Distance metric */
  metric: VectorDistanceMetric;
  /** Index type/algorithm */
  indexType?: string;
  /** Index parameters */
  parameters?: Record<string, any>;
  /** Sharding configuration */
  shards?: number;
  /** Replication factor */
  replicas?: number;
}

/**
 * Vector distance metrics
 */
export enum VectorDistanceMetric {
  COSINE = 'cosine',
  EUCLIDEAN = 'euclidean',
  MANHATTAN = 'manhattan',
  DOT_PRODUCT = 'dotproduct',
  HAMMING = 'hamming'
}

/**
 * Performance configuration for vector operations
 */
export interface VectorPerformanceConfig {
  /** Batch size for bulk operations */
  batchSize: number;
  /** Cache size for vectors */
  cacheSize: number;
  /** Enable vector caching */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Maximum concurrent operations */
  maxConcurrency: number;
  /** Query timeout in milliseconds */
  queryTimeout: number;
  /** Enable compression for vectors */
  enableCompression: boolean;
}

/**
 * Embedding generation request
 */
export interface EmbeddingRequest {
  /** Content to embed */
  content: string | any[];
  /** Content type */
  contentType: string;
  /** Embedding model to use */
  model?: string;
  /** Model-specific options */
  options?: Record<string, any>;
}

/**
 * Embedding generation result
 */
export interface EmbeddingResult {
  /** Generated embeddings */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Model version */
  modelVersion: string;
  /** Generation time in milliseconds */
  generationTime: number;
  /** Token usage for the request */
  tokenUsage?: {
    total: number;
    prompt: number;
  };
}

/**
 * Embedding model configuration
 */
export interface EmbeddingModelConfig {
  /** Model name */
  name: string;
  /** Model provider */
  provider: EmbeddingProvider;
  /** Model dimensions */
  dimensions: number;
  /** Maximum input length */
  maxInputLength: number;
  /** API endpoint */
  endpoint?: string;
  /** API key */
  apiKey?: string;
  /** Model-specific parameters */
  parameters?: Record<string, any>;
}

/**
 * Supported embedding providers
 */
export enum EmbeddingProvider {
  OPENAI = 'openai',
  COHERE = 'cohere',
  HUGGING_FACE = 'hugging_face',
  GOOGLE = 'google',
  ANTHROPIC = 'anthropic',
  SENTENCE_TRANSFORMERS = 'sentence_transformers',
  LOCAL = 'local'
}

/**
 * Vector operation result
 */
export interface VectorOperationResult {
  /** Operation success status */
  success: boolean;
  /** Result message */
  message: string;
  /** Operation execution time */
  executionTime: number;
  /** Number of vectors processed */
  vectorsProcessed?: number;
  /** Operation-specific data */
  data?: any;
  /** Error if operation failed */
  error?: Error;
}

/**
 * Vector batch operation
 */
export interface VectorBatchOperation {
  /** Operation type */
  operation: 'upsert' | 'delete' | 'query';
  /** Vectors for the operation */
  vectors?: VectorEmbedding[];
  /** Vector IDs for delete operations */
  vectorIds?: string[];
  /** Query for batch query operations */
  query?: VectorQuery;
}

/**
 * Vector index statistics
 */
export interface VectorIndexStats {
  /** Total number of vectors */
  totalVectors: number;
  /** Index size in bytes */
  indexSize: number;
  /** Vector dimensions */
  dimensions: number;
  /** Distance metric used */
  metric: VectorDistanceMetric;
  /** Index type */
  indexType: string;
  /** Average query time in milliseconds */
  averageQueryTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Vector database health status
 */
export interface VectorDbHealth {
  /** Database status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Response time in milliseconds */
  responseTime: number;
  /** Available indices */
  indices: string[];
  /** Error messages if any */
  errors?: string[];
  /** Additional health metrics */
  metrics?: Record<string, number>;
}

/**
 * Multi-modal embedding request
 */
export interface MultiModalEmbeddingRequest {
  /** Text content */
  text?: string;
  /** Image content (base64 or URL) */
  image?: string;
  /** Audio content (base64 or URL) */
  audio?: string;
  /** Content type */
  contentType: string;
  /** Embedding model */
  model?: string;
  /** Fusion strategy for multi-modal */
  fusionStrategy?: 'concat' | 'weighted' | 'attention';
}

/**
 * Content chunking strategy for embeddings
 */
export interface EmbeddingChunkStrategy {
  /** Strategy type */
  type: 'fixed' | 'sliding' | 'semantic' | 'sentence';
  /** Chunk size */
  chunkSize: number;
  /** Overlap size for sliding window */
  overlapSize?: number;
  /** Separator for splitting */
  separator?: string;
  /** Preserve structure (paragraphs, sentences) */
  preserveStructure?: boolean;
}

/**
 * Vector namespace for multi-tenancy
 */
export interface VectorNamespace {
  /** Namespace identifier */
  id: string;
  /** Namespace name */
  name: string;
  /** Agent or tenant ID */
  agentId: string;
  /** Vector count in namespace */
  vectorCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Namespace metadata */
  metadata?: Record<string, any>;
}