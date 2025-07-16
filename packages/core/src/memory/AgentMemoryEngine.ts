/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentMemory,
  MemoryStore,
  MemoryEncoder,
  RelevanceScorer,
  ContextManager,
  MemorySearchEngine,
  MemoryShareManager,
  MemoryPersistence,
  MemoryOptimizer
} from './interfaces.js';
import {
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStats,
  MemoryConfig,
  MemoryOperationResult,
  ContextWindow,
  MemoryType,
  MemoryScope,
  MemoryContentType,
  MemoryRelevance,
  MemoryMetadata
} from './types.js';

/**
 * Main implementation of the Agent Memory Engine
 */
export class AgentMemoryEngine implements AgentMemory {
  private config: MemoryConfig;
  private memoryStore: MemoryStore;
  private encoder: MemoryEncoder;
  private scorer: RelevanceScorer;
  private contextManager: ContextManager;
  private searchEngine: MemorySearchEngine;
  private shareManager: MemoryShareManager;
  private persistence: MemoryPersistence;
  private optimizer: MemoryOptimizer;
  private initialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    store: MemoryStore,
    encoder: MemoryEncoder,
    scorer: RelevanceScorer,
    contextManager: ContextManager,
    searchEngine: MemorySearchEngine,
    shareManager: MemoryShareManager,
    persistence: MemoryPersistence,
    optimizer: MemoryOptimizer
  ) {
    this.memoryStore = store;
    this.encoder = encoder;
    this.scorer = scorer;
    this.contextManager = contextManager;
    this.searchEngine = searchEngine;
    this.shareManager = shareManager;
    this.persistence = persistence;
    this.optimizer = optimizer;
    
    // Default configuration
    this.config = {
      maxMemoriesPerAgent: 10000,
      defaultDecayRate: 0.01,
      minRelevanceThreshold: 0.1,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      enableCompression: true,
      enableEncryption: false,
      cacheSize: 1000,
      vectorDb: {
        dimensions: 1536,
        metric: 'cosine',
        indexType: 'hnsw'
      }
    };
  }

  /**
   * Initialize the memory system
   */
  async initialize(config: MemoryConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('AgentMemoryEngine is already initialized');
    }

    this.config = { ...this.config, ...config };

    // Start cleanup interval
    if (this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(async () => {
        await this.cleanup();
      }, this.config.cleanupInterval);
    }

    this.initialized = true;
  }

  /**
   * Store a new memory
   */
  async store(
    agentId: string,
    content: any,
    type: MemoryType,
    scope: MemoryScope,
    metadata?: Partial<MemoryItem['metadata']>
  ): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      // Check agent memory limit
      const agentStats = await this.memoryStore.getStats(agentId);
      if (agentStats.totalMemories >= this.config.maxMemoriesPerAgent) {
        // Trigger cleanup for this agent
        await this.optimizer.prune(agentId, this.config.minRelevanceThreshold);
      }

      // Create memory metadata
      const now = new Date();
      const memoryMetadata: MemoryMetadata = {
        createdAt: now,
        lastAccessedAt: now,
        updatedAt: now,
        accessCount: 0,
        source: agentId,
        tags: metadata?.tags || [],
        context: metadata?.context || {},
        importance: metadata?.importance || 0.5,
        decayRate: metadata?.decayRate || this.config.defaultDecayRate,
        embedding: metadata?.embedding,
        relatedMemories: metadata?.relatedMemories || [],
        permissions: metadata?.permissions || {
          read: [agentId],
          write: [agentId],
          delete: [agentId],
          share: [agentId]
        }
      };

      // Determine content type
      const contentType = this.determineContentType(content);

      // Create memory item
      const memory: Omit<MemoryItem, 'id'> = {
        agentId,
        type,
        contentType,
        scope,
        relevance: this.determineRelevance(type, content, metadata?.importance),
        content,
        metadata: memoryMetadata
      };

      // Store the memory
      const result = await this.memoryStore.store(memory);

      if (result.success && result.memoryId) {
        // Update context window
        const fullMemory: MemoryItem = {
          id: result.memoryId,
          ...memory
        };

        await this.contextManager.updateContext(agentId, fullMemory);

        // Index for search
        await this.searchEngine.index(fullMemory);

        // Persist memory
        await this.persistence.save(fullMemory);
      }

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to store memory: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Retrieve memories for an agent
   */
  async retrieve(agentId: string, query?: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();

    try {
      const searchQuery: MemoryQuery = {
        agentId,
        ...query
      };

      const result = await this.memoryStore.search(searchQuery);

      // Update access counts for retrieved memories
      for (const memory of result.items) {
        memory.metadata.lastAccessedAt = new Date();
        memory.metadata.accessCount++;
        
        // Update relevance score
        memory.currentRelevance = this.scorer.updateScore(memory);
      }

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        items: [],
        totalCount: 0,
        query: query || { agentId },
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search across all accessible memories
   */
  async search(agentId: string, query: string, filters?: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();

    try {
      // First check permissions for the searching agent
      const searchQuery: MemoryQuery = {
        query,
        ...filters
      };

      let result: MemorySearchResult;

      // Try semantic search first if available
      try {
        result = await this.searchEngine.semanticSearch(query, searchQuery);
      } catch {
        // Fallback to text search
        result = await this.searchEngine.textSearch(query, searchQuery);
      }

      // Filter results based on agent permissions
      const accessibleItems: MemoryItem[] = [];
      for (const memory of result.items) {
        const hasAccess = await this.shareManager.checkPermissions(memory.id, agentId, 'read');
        if (hasAccess) {
          accessibleItems.push(memory);
          
          // Update access metadata
          memory.metadata.lastAccessedAt = new Date();
          memory.metadata.accessCount++;
          memory.currentRelevance = this.scorer.updateScore(memory);
        }
      }

      return {
        items: accessibleItems,
        totalCount: accessibleItems.length,
        query: searchQuery,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        items: [],
        totalCount: 0,
        query: { query, ...filters },
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update a memory item
   */
  async update(memoryId: string, updates: Partial<MemoryItem>): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      // Update metadata
      if (updates.metadata) {
        updates.metadata.updatedAt = new Date();
      }

      const result = await this.memoryStore.update(memoryId, updates);

      if (result.success) {
        // Update search index
        const updatedMemory = await this.memoryStore.retrieve(memoryId);
        if (updatedMemory) {
          await this.searchEngine.index(updatedMemory);
          await this.persistence.save(updatedMemory);
        }
      }

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update memory: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Delete a memory
   */
  async forget(memoryId: string): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      // Remove from search index
      await this.searchEngine.removeFromIndex(memoryId);

      // Remove from persistence
      await this.persistence.delete(memoryId);

      // Remove from store
      const result = await this.memoryStore.delete(memoryId);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to delete memory: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(agentId?: string): Promise<MemoryStats> {
    return await this.memoryStore.getStats(agentId);
  }

  /**
   * Share memory between agents
   */
  async share(
    memoryId: string,
    fromAgent: string,
    toAgents: string[],
    permissions: string[]
  ): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      // Check if the fromAgent has permission to share
      const canShare = await this.shareManager.checkPermissions(memoryId, fromAgent, 'share');
      if (!canShare) {
        return {
          success: false,
          message: 'Agent does not have permission to share this memory',
          executionTime: Date.now() - startTime
        };
      }

      const result = await this.shareManager.shareMemory(memoryId, toAgents, permissions);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to share memory: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get current context for an agent
   */
  async getContext(agentId: string): Promise<ContextWindow> {
    return await this.contextManager.getContextWindow(agentId);
  }

  /**
   * Clear all memories for an agent
   */
  async clearAgent(agentId: string): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      // Clear context
      await this.contextManager.clearContext(agentId);

      // Clear from store
      const result = await this.memoryStore.clear(agentId);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to clear agent memories: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Cleanup expired memories
   */
  async cleanup(): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const result = await this.memoryStore.cleanup();
      
      // Also run optimizer cleanup
      await this.optimizer.optimize();

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to cleanup memories: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Shutdown the memory system
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.initialized = false;
  }

  /**
   * Get memory configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Update memory configuration
   */
  async updateConfig(config: Partial<MemoryConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Restart cleanup interval if changed
    if (config.cleanupInterval !== undefined) {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      if (this.config.cleanupInterval > 0) {
        this.cleanupInterval = setInterval(async () => {
          await this.cleanup();
        }, this.config.cleanupInterval);
      }
    }
  }

  /**
   * Helper method to determine content type
   */
  private determineContentType(content: any): MemoryContentType {
    if (typeof content === 'string') {
      // Try to detect if it's code
      if (content.includes('function') || content.includes('class') || content.includes('import')) {
        return MemoryContentType.CODE;
      }
      return MemoryContentType.TEXT;
    }
    
    if (typeof content === 'object' && content !== null) {
      return MemoryContentType.JSON;
    }
    
    return MemoryContentType.STRUCTURED;
  }

  /**
   * Helper method to determine relevance
   */
  private determineRelevance(type: MemoryType, content: any, importance?: number): MemoryRelevance {
    if (importance !== undefined) {
      if (importance >= 0.9) return MemoryRelevance.CRITICAL;
      if (importance >= 0.7) return MemoryRelevance.HIGH;
      if (importance >= 0.5) return MemoryRelevance.MEDIUM;
      if (importance >= 0.3) return MemoryRelevance.LOW;
      return MemoryRelevance.MINIMAL;
    }

    // Default relevance based on type
    switch (type) {
      case MemoryType.PROCEDURAL:
        return MemoryRelevance.HIGH;
      case MemoryType.SEMANTIC:
        return MemoryRelevance.MEDIUM;
      case MemoryType.EPISODIC:
        return MemoryRelevance.MEDIUM;
      case MemoryType.WORKING:
        return MemoryRelevance.LOW;
      case MemoryType.SHARED:
        return MemoryRelevance.HIGH;
      default:
        return MemoryRelevance.MEDIUM;
    }
  }
}