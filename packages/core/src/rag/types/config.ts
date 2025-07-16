/**
 * Configuration types for the RAG system
 */

import { ChunkingStrategy, IndexType, DistanceMetric } from './core.js';

export interface RAGSystemConfig {
  embedding: EmbeddingConfig;
  vectorStore: VectorStoreConfig;
  chunking: ChunkingConfig;
  agents: AgentDefaultConfig;
  performance: PerformanceConfig;
}

export interface EmbeddingConfig {
  modelName: string;
  modelPath?: string;
  dimensions: number;
  batchSize: number;
  device: 'cpu' | 'gpu';
  maxTokens: number;
  cacheSize: number;
}

export interface VectorStoreConfig {
  storePath: string;
  dimensions: number;
  indexType: IndexType;
  distanceMetric: DistanceMetric;
  maxVectors: number;
  persistToDisk: boolean;
}

export interface ChunkingConfig {
  defaultSize: number;
  defaultOverlap: number;
  maxSize: number;
  minSize: number;
  strategy: ChunkingStrategy;
  preserveStructure: boolean;
}

export interface AgentDefaultConfig {
  maxContextLength: number;
  defaultTemperature: number;
  maxTokensPerResponse: number;
  enableSourceAttribution: boolean;
}

export interface PerformanceConfig {
  maxConcurrentProcessing: number;
  memoryLimitMB: number;
  timeoutMs: number;
  enableCaching: boolean;
  cacheExpiryMs: number;
}

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  strategy: ChunkingStrategy;
  preserveStructure: boolean;
}

export interface QueryOptions {
  maxResults: number;
  minSimilarity: number;
  includeMetadata: boolean;
  contextWindow: number;
}

export interface SearchFilter {
  documentIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  metadata?: Record<string, any>;
}