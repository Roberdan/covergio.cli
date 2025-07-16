/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryStore } from './interfaces.js';
import {
  MemoryItem,
  MemoryQuery,
  MemorySearchResult,
  MemoryStats,
  MemoryOperationResult,
  MemoryType,
  MemoryScope,
  MemoryContentType,
  MemoryRelevance
} from './types.js';

/**
 * In-memory implementation of MemoryStore for development and testing
 */
export class InMemoryStore implements MemoryStore {
  private memories: Map<string, MemoryItem> = new Map();
  private agentMemories: Map<string, Set<string>> = new Map();

  /**
   * Store a memory item
   */
  async store(memory: Omit<MemoryItem, 'id' | 'metadata'>): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const memoryId = uuidv4();
      const fullMemory: MemoryItem = {
        id: memoryId,
        ...memory,
        metadata: {
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
          accessCount: 0,
          source: memory.agentId,
          tags: [],
          context: {},
          importance: 0.5,
          decayRate: 0.01,
          relatedMemories: [],
          permissions: {
            read: [memory.agentId],
            write: [memory.agentId],
            delete: [memory.agentId],
            share: [memory.agentId]
          }
        }
      };

      // Store memory
      this.memories.set(memoryId, fullMemory);

      // Update agent index
      if (!this.agentMemories.has(memory.agentId)) {
        this.agentMemories.set(memory.agentId, new Set());
      }
      this.agentMemories.get(memory.agentId)!.add(memoryId);

      return {
        success: true,
        message: 'Memory stored successfully',
        memoryId,
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
   * Retrieve a specific memory by ID
   */
  async retrieve(memoryId: string): Promise<MemoryItem | null> {
    const memory = this.memories.get(memoryId);
    
    if (memory) {
      // Update access metadata
      memory.metadata.lastAccessedAt = new Date();
      memory.metadata.accessCount++;
    }

    return memory || null;
  }

  /**
   * Search memories based on query
   */
  async search(query: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();
    let items: MemoryItem[] = [];

    try {
      // Get all memories or filter by agent
      if (query.agentId) {
        const agentMemoryIds = this.agentMemories.get(query.agentId) || new Set();
        items = [];
        agentMemoryIds.forEach(id => {
          const memory = this.memories.get(id);
          if (memory) {
            items.push(memory);
          }
        });
      } else {
        items = [];
        this.memories.forEach(memory => {
          items.push(memory);
        });
      }

      // Apply filters
      items = this.applyFilters(items, query);

      // Apply text search if query string provided
      if (query.query) {
        items = this.performTextSearch(items, query.query);
      }

      // Sort results
      items = this.sortResults(items, query);

      // Apply pagination
      const totalCount = items.length;
      if (query.offset || query.limit) {
        const offset = query.offset || 0;
        const limit = query.limit || items.length;
        items = items.slice(offset, offset + limit);
      }

      // Update access metadata for retrieved items
      items.forEach(item => {
        item.metadata.lastAccessedAt = new Date();
        item.metadata.accessCount++;
      });

      return {
        items,
        totalCount,
        query,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        items: [],
        totalCount: 0,
        query,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update an existing memory
   */
  async update(memoryId: string, updates: Partial<MemoryItem>): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const existingMemory = this.memories.get(memoryId);
      if (!existingMemory) {
        return {
          success: false,
          message: 'Memory not found',
          executionTime: Date.now() - startTime
        };
      }

      // Update memory
      const updatedMemory: MemoryItem = {
        ...existingMemory,
        ...updates,
        id: memoryId, // Preserve ID
        metadata: {
          ...existingMemory.metadata,
          ...updates.metadata,
          updatedAt: new Date()
        }
      };

      this.memories.set(memoryId, updatedMemory);

      return {
        success: true,
        message: 'Memory updated successfully',
        memoryId,
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
  async delete(memoryId: string): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        return {
          success: false,
          message: 'Memory not found',
          executionTime: Date.now() - startTime
        };
      }

      // Remove from main storage
      this.memories.delete(memoryId);

      // Remove from agent index
      const agentMemories = this.agentMemories.get(memory.agentId);
      if (agentMemories) {
        agentMemories.delete(memoryId);
        if (agentMemories.size === 0) {
          this.agentMemories.delete(memory.agentId);
        }
      }

      return {
        success: true,
        message: 'Memory deleted successfully',
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
    let memories: MemoryItem[];

    if (agentId) {
      const agentMemoryIds = this.agentMemories.get(agentId) || new Set();
      memories = [];
      agentMemoryIds.forEach(id => {
        const memory = this.memories.get(id);
        if (memory) {
          memories.push(memory);
        }
      });
    } else {
      memories = [];
      this.memories.forEach(memory => {
        memories.push(memory);
      });
    }

    const stats: MemoryStats = {
      totalMemories: memories.length,
      byType: {} as Record<MemoryType, number>,
      byScope: {} as Record<MemoryScope, number>,
      byContentType: {} as Record<MemoryContentType, number>,
      averageRelevance: 0,
      mostAccessed: [],
      recentlyCreated: [],
      memoryUsage: 0,
      performance: {
        averageQueryTime: 50, // Mock value
        averageStoreTime: 10, // Mock value
        cacheHitRate: 0.8 // Mock value
      }
    };

    if (memories.length === 0) {
      return stats;
    }

    // Calculate statistics
    let totalRelevance = 0;
    let totalSize = 0;

    for (const memory of memories) {
      // Count by type
      stats.byType[memory.type] = (stats.byType[memory.type] || 0) + 1;
      
      // Count by scope
      stats.byScope[memory.scope] = (stats.byScope[memory.scope] || 0) + 1;
      
      // Count by content type
      stats.byContentType[memory.contentType] = (stats.byContentType[memory.contentType] || 0) + 1;
      
      // Sum relevance
      totalRelevance += memory.currentRelevance || memory.relevance;
      
      // Estimate size
      totalSize += this.estimateMemorySize(memory);
    }

    stats.averageRelevance = totalRelevance / memories.length;
    stats.memoryUsage = totalSize;

    // Get most accessed memories
    stats.mostAccessed = memories
      .sort((a, b) => b.metadata.accessCount - a.metadata.accessCount)
      .slice(0, 10);

    // Get recently created memories
    stats.recentlyCreated = memories
      .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear all memories for an agent
   */
  async clear(agentId: string): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const agentMemoryIds = this.agentMemories.get(agentId) || new Set();
      let deletedCount = 0;

      agentMemoryIds.forEach(memoryId => {
        if (this.memories.delete(memoryId)) {
          deletedCount++;
        }
      });

      this.agentMemories.delete(agentId);

      return {
        success: true,
        message: `Cleared ${deletedCount} memories for agent ${agentId}`,
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
   * Cleanup expired or low-relevance memories
   */
  async cleanup(): Promise<MemoryOperationResult> {
    const startTime = Date.now();

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      let deletedCount = 0;

      this.memories.forEach(async (memory, memoryId) => {
        let shouldDelete = false;

        // Delete very old working memories
        if (memory.type === MemoryType.WORKING && 
            memory.metadata.lastAccessedAt < thirtyDaysAgo) {
          shouldDelete = true;
        }

        // Delete low-relevance memories that haven't been accessed recently
        if ((memory.currentRelevance || memory.relevance) < 0.2 && 
            memory.metadata.lastAccessedAt < thirtyDaysAgo &&
            memory.relevance !== MemoryRelevance.CRITICAL) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          await this.delete(memoryId);
          deletedCount++;
        }
      });

      return {
        success: true,
        message: `Cleaned up ${deletedCount} memories`,
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
   * Get all memories (for testing/debugging)
   */
  getAllMemories(): MemoryItem[] {
    const memories: MemoryItem[] = [];
    this.memories.forEach(memory => {
      memories.push(memory);
    });
    return memories;
  }

  /**
   * Reset the store (for testing)
   */
  reset(): void {
    this.memories.clear();
    this.agentMemories.clear();
  }

  /**
   * Apply query filters to memories
   */
  private applyFilters(memories: MemoryItem[], query: MemoryQuery): MemoryItem[] {
    let filtered = memories;

    // Filter by types
    if (query.types && query.types.length > 0) {
      filtered = filtered.filter(memory => query.types!.includes(memory.type));
    }

    // Filter by content types
    if (query.contentTypes && query.contentTypes.length > 0) {
      filtered = filtered.filter(memory => query.contentTypes!.includes(memory.contentType));
    }

    // Filter by scopes
    if (query.scopes && query.scopes.length > 0) {
      filtered = filtered.filter(memory => query.scopes!.includes(memory.scope));
    }

    // Filter by relevance range
    if (query.minRelevance !== undefined) {
      filtered = filtered.filter(memory => 
        (memory.currentRelevance || memory.relevance) >= query.minRelevance!
      );
    }

    if (query.maxRelevance !== undefined) {
      filtered = filtered.filter(memory => 
        (memory.currentRelevance || memory.relevance) <= query.maxRelevance!
      );
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter(memory => 
        query.tags!.some(tag => memory.metadata.tags.includes(tag))
      );
    }

    // Filter by date range
    if (query.dateRange) {
      filtered = filtered.filter(memory => 
        memory.metadata.createdAt >= query.dateRange!.from &&
        memory.metadata.createdAt <= query.dateRange!.to
      );
    }

    return filtered;
  }

  /**
   * Perform simple text search on memories
   */
  private performTextSearch(memories: MemoryItem[], searchQuery: string): MemoryItem[] {
    const query = searchQuery.toLowerCase();
    
    return memories.filter(memory => {
      // Search in content
      const content = typeof memory.content === 'string' ? 
        memory.content.toLowerCase() : 
        JSON.stringify(memory.content).toLowerCase();
      
      if (content.includes(query)) return true;

      // Search in tags
      if (memory.metadata.tags.some(tag => tag.toLowerCase().includes(query))) {
        return true;
      }

      // Search in context
      if (memory.metadata.context) {
        const contextStr = JSON.stringify(memory.metadata.context).toLowerCase();
        if (contextStr.includes(query)) return true;
      }

      return false;
    });
  }

  /**
   * Sort search results
   */
  private sortResults(memories: MemoryItem[], query: MemoryQuery): MemoryItem[] {
    const sortBy = query.sortBy || 'relevance';
    const order = query.sortOrder || 'desc';

    return memories.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          const aRelevance = a.currentRelevance || a.relevance;
          const bRelevance = b.currentRelevance || b.relevance;
          comparison = aRelevance - bRelevance;
          break;

        case 'created':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;

        case 'accessed':
          comparison = a.metadata.lastAccessedAt.getTime() - b.metadata.lastAccessedAt.getTime();
          break;

        case 'updated':
          comparison = a.metadata.updatedAt.getTime() - b.metadata.updatedAt.getTime();
          break;

        default:
          comparison = 0;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Estimate memory size in bytes
   */
  private estimateMemorySize(memory: MemoryItem): number {
    const serialized = JSON.stringify(memory);
    return Buffer.byteLength(serialized, 'utf8');
  }
}