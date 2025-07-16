/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStats,
  MemoryConfig,
  MemoryOperationResult,
  ContextWindow,
  MemoryChunk,
  MemoryType,
  MemoryScope
} from './types.js';

/**
 * Core interface for memory storage operations
 */
export interface MemoryStore {
  /**
   * Store a memory item
   */
  store(memory: Omit<MemoryItem, 'id' | 'metadata'>): Promise<MemoryOperationResult>;

  /**
   * Retrieve a specific memory by ID
   */
  retrieve(memoryId: string): Promise<MemoryItem | null>;

  /**
   * Search memories based on query
   */
  search(query: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Update an existing memory
   */
  update(memoryId: string, updates: Partial<MemoryItem>): Promise<MemoryOperationResult>;

  /**
   * Delete a memory
   */
  delete(memoryId: string): Promise<MemoryOperationResult>;

  /**
   * Get memory statistics
   */
  getStats(agentId?: string): Promise<MemoryStats>;

  /**
   * Clear all memories for an agent
   */
  clear(agentId: string): Promise<MemoryOperationResult>;

  /**
   * Cleanup expired or low-relevance memories
   */
  cleanup(): Promise<MemoryOperationResult>;
}

/**
 * Interface for memory encoding and compression
 */
export interface MemoryEncoder {
  /**
   * Encode content for storage
   */
  encode(content: any, contentType: string): Promise<Buffer>;

  /**
   * Decode content from storage
   */
  decode(data: Buffer, contentType: string): Promise<any>;

  /**
   * Compress encoded data
   */
  compress(data: Buffer): Promise<Buffer>;

  /**
   * Decompress data
   */
  decompress(data: Buffer): Promise<Buffer>;

  /**
   * Generate checksum for data integrity
   */
  checksum(data: Buffer): string;
}

/**
 * Interface for memory relevance scoring
 */
export interface RelevanceScorer {
  /**
   * Calculate initial relevance score
   */
  calculateInitialScore(memory: MemoryItem): number;

  /**
   * Update relevance score based on access patterns
   */
  updateScore(memory: MemoryItem, accessContext?: Record<string, any>): number;

  /**
   * Calculate memory decay
   */
  calculateDecay(memory: MemoryItem, currentTime: Date): number;

  /**
   * Determine if memory should be retained
   */
  shouldRetain(memory: MemoryItem, threshold: number): boolean;
}

/**
 * Interface for context window management
 */
export interface ContextManager {
  /**
   * Get current context window for an agent
   */
  getContextWindow(agentId: string): Promise<ContextWindow>;

  /**
   * Update context window with new memory
   */
  updateContext(agentId: string, memory: MemoryItem): Promise<void>;

  /**
   * Clear context window
   */
  clearContext(agentId: string): Promise<void>;

  /**
   * Optimize context window based on relevance
   */
  optimizeContext(agentId: string): Promise<ContextWindow>;

  /**
   * Get context summary for agent
   */
  getContextSummary(agentId: string): Promise<string>;
}

/**
 * Interface for memory chunking operations
 */
export interface MemoryChunker {
  /**
   * Chunk large content into smaller pieces
   */
  chunk(content: any, maxChunkSize: number): Promise<MemoryChunk[]>;

  /**
   * Reconstruct content from chunks
   */
  reconstruct(chunks: MemoryChunk[]): Promise<any>;

  /**
   * Validate chunk integrity
   */
  validateChunks(chunks: MemoryChunk[]): Promise<boolean>;
}

/**
 * Interface for memory search operations
 */
export interface MemorySearchEngine {
  /**
   * Index memory for search
   */
  index(memory: MemoryItem): Promise<void>;

  /**
   * Remove memory from index
   */
  removeFromIndex(memoryId: string): Promise<void>;

  /**
   * Perform text search
   */
  textSearch(query: string, filters?: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Perform semantic search using embeddings
   */
  semanticSearch(query: string, filters?: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Get similar memories
   */
  findSimilar(memoryId: string, limit?: number): Promise<MemoryItem[]>;

  /**
   * Update search index
   */
  updateIndex(): Promise<void>;
}

/**
 * Interface for cross-agent memory sharing
 */
export interface MemoryShareManager {
  /**
   * Share memory with other agents
   */
  shareMemory(memoryId: string, targetAgents: string[], permissions: string[]): Promise<MemoryOperationResult>;

  /**
   * Unshare memory
   */
  unshareMemory(memoryId: string, targetAgents: string[]): Promise<MemoryOperationResult>;

  /**
   * Get shared memories for an agent
   */
  getSharedMemories(agentId: string): Promise<MemoryItem[]>;

  /**
   * Check memory access permissions
   */
  checkPermissions(memoryId: string, agentId: string, operation: string): Promise<boolean>;

  /**
   * Update memory permissions
   */
  updatePermissions(memoryId: string, permissions: Record<string, string[]>): Promise<MemoryOperationResult>;
}

/**
 * Main interface for the Agent Memory Engine
 */
export interface AgentMemory {
  /**
   * Initialize the memory system
   */
  initialize(config: MemoryConfig): Promise<void>;

  /**
   * Store a new memory
   */
  store(agentId: string, content: any, type: MemoryType, scope: MemoryScope, metadata?: Partial<MemoryItem['metadata']>): Promise<MemoryOperationResult>;

  /**
   * Retrieve memories for an agent
   */
  retrieve(agentId: string, query?: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Search across all accessible memories
   */
  search(agentId: string, query: string, filters?: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Update a memory item
   */
  update(memoryId: string, updates: Partial<MemoryItem>): Promise<MemoryOperationResult>;

  /**
   * Delete a memory
   */
  forget(memoryId: string): Promise<MemoryOperationResult>;

  /**
   * Get memory statistics
   */
  getStats(agentId?: string): Promise<MemoryStats>;

  /**
   * Share memory between agents
   */
  share(memoryId: string, fromAgent: string, toAgents: string[], permissions: string[]): Promise<MemoryOperationResult>;

  /**
   * Get current context for an agent
   */
  getContext(agentId: string): Promise<ContextWindow>;

  /**
   * Clear all memories for an agent
   */
  clearAgent(agentId: string): Promise<MemoryOperationResult>;

  /**
   * Cleanup expired memories
   */
  cleanup(): Promise<MemoryOperationResult>;

  /**
   * Shutdown the memory system
   */
  shutdown(): Promise<void>;

  /**
   * Get memory configuration
   */
  getConfig(): MemoryConfig;

  /**
   * Update memory configuration
   */
  updateConfig(config: Partial<MemoryConfig>): Promise<void>;
}

/**
 * Interface for memory persistence
 */
export interface MemoryPersistence {
  /**
   * Save memory to persistent storage
   */
  save(memory: MemoryItem): Promise<void>;

  /**
   * Load memory from persistent storage
   */
  load(memoryId: string): Promise<MemoryItem | null>;

  /**
   * Load all memories for an agent
   */
  loadForAgent(agentId: string): Promise<MemoryItem[]>;

  /**
   * Delete memory from persistent storage
   */
  delete(memoryId: string): Promise<void>;

  /**
   * Backup memories
   */
  backup(agentId?: string): Promise<string>;

  /**
   * Restore memories from backup
   */
  restore(backupPath: string): Promise<MemoryOperationResult>;

  /**
   * Get storage statistics
   */
  getStorageStats(): Promise<{
    totalSize: number;
    itemCount: number;
    agentCount: number;
  }>;
}

/**
 * Interface for memory optimization
 */
export interface MemoryOptimizer {
  /**
   * Optimize memory storage
   */
  optimize(): Promise<MemoryOperationResult>;

  /**
   * Consolidate similar memories
   */
  consolidate(agentId: string): Promise<MemoryOperationResult>;

  /**
   * Prune low-relevance memories
   */
  prune(agentId: string, threshold: number): Promise<MemoryOperationResult>;

  /**
   * Defragment memory storage
   */
  defragment(): Promise<MemoryOperationResult>;

  /**
   * Get optimization recommendations
   */
  getRecommendations(agentId?: string): Promise<string[]>;
}