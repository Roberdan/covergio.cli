/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Agent Memory and Context Engine
 * 
 * This module provides comprehensive memory management capabilities for AI agents,
 * including storage, retrieval, context management, cross-agent memory sharing,
 * and advanced vector database integration with semantic search capabilities.
 */

// Core types and interfaces
export * from './types.js';
export * from './interfaces.js';

// Vector database and embedding system
export * from './vector/index.js';

// Core implementations
export { AgentMemoryEngine } from './AgentMemoryEngine.js';
export { DefaultRelevanceScorer } from './RelevanceScorer.js';
export { DefaultContextManager } from './ContextManager.js';
export { DefaultMemoryEncoder } from './MemoryEncoder.js';
export { DefaultMemoryChunker } from './MemoryChunker.js';
export { InMemoryStore } from './InMemoryStore.js';

// Re-export commonly used types for convenience
export type {
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStats,
  MemoryConfig,
  MemoryOperationResult,
  ContextWindow,
  MemoryChunk,
  MemoryMetadata,
  MemoryPermissions
} from './types.js';

export {
  MemoryType,
  MemoryScope,
  MemoryContentType,
  MemoryRelevance
} from './types.js';

// Re-export key interfaces
export type {
  AgentMemory,
  MemoryStore,
  MemoryEncoder,
  RelevanceScorer,
  ContextManager,
  MemoryChunker,
  MemorySearchEngine,
  MemoryShareManager,
  MemoryPersistence,
  MemoryOptimizer
} from './interfaces.js';