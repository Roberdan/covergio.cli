/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Vector Database Integration and Embedding System
 * 
 * This module provides comprehensive vector database integration with support for
 * multiple providers and advanced embedding capabilities for semantic search.
 */

// Core types and interfaces
export * from './types.js';
export * from './interfaces.js';

// Core implementations
export { UniversalEmbeddingGenerator } from './EmbeddingGenerator.js';
export { UniversalVectorDatabase } from './VectorDatabase.js';
export { DefaultVectorMemoryEngine } from './VectorMemoryEngine.js';
export { DefaultSimilarityCalculator } from './SimilarityCalculator.js';
export { InMemoryVectorCache } from './VectorCache.js';

// Re-export commonly used types for convenience
export type {
  VectorEmbedding,
  VectorQuery,
  VectorSearchResult,
  VectorOperationResult,
  VectorDbConfig,
  EmbeddingModelConfig,
  VectorIndexStats,
  VectorDbHealth,
  EmbeddingRequest,
  EmbeddingResult,
  MultiModalEmbeddingRequest,
  VectorNamespace
} from './types.js';

// Re-export enums
export {
  VectorDbProvider,
  VectorDistanceMetric,
  EmbeddingProvider
} from './types.js';

// Re-export key interfaces
export type {
  VectorDatabase,
  EmbeddingGenerator,
  VectorMemoryEngine,
  VectorCache,
  SimilarityCalculator,
  ContentPreprocessor,
  VectorIndexManager,
  NamespaceManager,
  HybridSearchEngine,
  VectorAnalytics
} from './interfaces.js';