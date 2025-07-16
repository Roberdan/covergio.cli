/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContextManager } from './interfaces.js';
import { MemoryItem, ContextWindow, MemoryType } from './types.js';

/**
 * Implementation of context window management for agents
 */
export class DefaultContextManager implements ContextManager {
  private contextWindows: Map<string, ContextWindow> = new Map();
  private readonly DEFAULT_WINDOW_SIZE = 20;
  private readonly DEFAULT_RELEVANCE_THRESHOLD = 0.3;
  private readonly MAX_WORKING_MEMORY_SIZE = 5;

  /**
   * Get current context window for an agent
   */
  async getContextWindow(agentId: string): Promise<ContextWindow> {
    let contextWindow = this.contextWindows.get(agentId);
    
    if (!contextWindow) {
      contextWindow = {
        size: this.DEFAULT_WINDOW_SIZE,
        items: [],
        relevanceThreshold: this.DEFAULT_RELEVANCE_THRESHOLD,
        lastUpdated: new Date()
      };
      this.contextWindows.set(agentId, contextWindow);
    }

    return { ...contextWindow };
  }

  /**
   * Update context window with new memory
   */
  async updateContext(agentId: string, memory: MemoryItem): Promise<void> {
    let contextWindow = this.contextWindows.get(agentId);
    
    if (!contextWindow) {
      contextWindow = {
        size: this.DEFAULT_WINDOW_SIZE,
        items: [],
        relevanceThreshold: this.DEFAULT_RELEVANCE_THRESHOLD,
        lastUpdated: new Date()
      };
    }

    // Add new memory to context
    contextWindow.items.unshift(memory);
    contextWindow.lastUpdated = new Date();

    // Handle different memory types appropriately
    this.organizeByMemoryType(contextWindow, memory);

    // Maintain window size
    this.maintainWindowSize(contextWindow);

    // Update relevance scores and prune if necessary
    await this.updateRelevanceAndPrune(contextWindow);

    this.contextWindows.set(agentId, contextWindow);
  }

  /**
   * Clear context window for an agent
   */
  async clearContext(agentId: string): Promise<void> {
    this.contextWindows.delete(agentId);
  }

  /**
   * Optimize context window based on relevance and usage patterns
   */
  async optimizeContext(agentId: string): Promise<ContextWindow> {
    const contextWindow = await this.getContextWindow(agentId);
    
    if (contextWindow.items.length === 0) {
      return contextWindow;
    }

    // Group memories by type and importance
    const groupedMemories = this.groupMemoriesByType(contextWindow.items);

    // Optimize each group
    const optimizedItems: MemoryItem[] = [];

    // Always keep recent working memory (limited)
    const workingMemories = groupedMemories.get(MemoryType.WORKING) || [];
    optimizedItems.push(...workingMemories.slice(0, this.MAX_WORKING_MEMORY_SIZE));

    // Keep high-relevance procedural memories
    const proceduralMemories = groupedMemories.get(MemoryType.PROCEDURAL) || [];
    const highRelevanceProcedural = proceduralMemories.filter(m => 
      (m.currentRelevance || 0) >= 0.7
    );
    optimizedItems.push(...highRelevanceProcedural);

    // Keep recent and relevant episodic memories
    const episodicMemories = groupedMemories.get(MemoryType.EPISODIC) || [];
    const recentEpisodic = episodicMemories
      .filter(m => this.isRecentMemory(m, 24 * 60 * 60 * 1000)) // Last 24 hours
      .slice(0, 5);
    optimizedItems.push(...recentEpisodic);

    // Keep high-relevance semantic memories
    const semanticMemories = groupedMemories.get(MemoryType.SEMANTIC) || [];
    const relevantSemantic = semanticMemories.filter(m => 
      (m.currentRelevance || 0) >= 0.6
    ).slice(0, 8);
    optimizedItems.push(...relevantSemantic);

    // Always keep shared memories with high access
    const sharedMemories = groupedMemories.get(MemoryType.SHARED) || [];
    const importantShared = sharedMemories.filter(m => 
      m.metadata.accessCount > 2 || (m.currentRelevance || 0) >= 0.7
    );
    optimizedItems.push(...importantShared);

    // Remove duplicates and sort by relevance
    const uniqueItems = this.removeDuplicates(optimizedItems);
    uniqueItems.sort((a, b) => (b.currentRelevance || 0) - (a.currentRelevance || 0));

    // Update context window
    contextWindow.items = uniqueItems.slice(0, contextWindow.size);
    contextWindow.lastUpdated = new Date();

    this.contextWindows.set(agentId, contextWindow);

    return { ...contextWindow };
  }

  /**
   * Get context summary for an agent
   */
  async getContextSummary(agentId: string): Promise<string> {
    const contextWindow = await this.getContextWindow(agentId);
    
    if (contextWindow.items.length === 0) {
      return `Agent ${agentId} has no active context.`;
    }

    const summary = {
      totalItems: contextWindow.items.length,
      byType: {} as Record<string, number>,
      recentActivity: 0,
      averageRelevance: 0
    };

    let totalRelevance = 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const item of contextWindow.items) {
      // Count by type
      summary.byType[item.type] = (summary.byType[item.type] || 0) + 1;
      
      // Count recent activity
      if (item.metadata.lastAccessedAt.getTime() > oneHourAgo) {
        summary.recentActivity++;
      }
      
      // Sum relevance
      totalRelevance += item.currentRelevance || 0;
    }

    summary.averageRelevance = totalRelevance / contextWindow.items.length;

    const typeBreakdown = Object.entries(summary.byType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    return `Agent ${agentId} context: ${summary.totalItems} memories (${typeBreakdown}). ` +
           `Average relevance: ${summary.averageRelevance.toFixed(2)}. ` +
           `Recent activity: ${summary.recentActivity} memories accessed in last hour.`;
  }

  /**
   * Set context window configuration
   */
  async setContextConfig(
    agentId: string, 
    config: { size?: number; relevanceThreshold?: number }
  ): Promise<void> {
    const contextWindow = await this.getContextWindow(agentId);
    
    if (config.size !== undefined) {
      contextWindow.size = Math.max(1, Math.min(100, config.size)); // Reasonable limits
    }
    
    if (config.relevanceThreshold !== undefined) {
      contextWindow.relevanceThreshold = Math.max(0, Math.min(1, config.relevanceThreshold));
    }

    contextWindow.lastUpdated = new Date();
    this.contextWindows.set(agentId, contextWindow);

    // Re-optimize with new configuration
    await this.optimizeContext(agentId);
  }

  /**
   * Get context items by type
   */
  async getContextByType(agentId: string, type: MemoryType): Promise<MemoryItem[]> {
    const contextWindow = await this.getContextWindow(agentId);
    return contextWindow.items.filter(item => item.type === type);
  }

  /**
   * Find related context items
   */
  async findRelatedContext(agentId: string, memoryId: string): Promise<MemoryItem[]> {
    const contextWindow = await this.getContextWindow(agentId);
    const targetMemory = contextWindow.items.find(item => item.id === memoryId);
    
    if (!targetMemory) {
      return [];
    }

    const related: MemoryItem[] = [];

    for (const item of contextWindow.items) {
      if (item.id === memoryId) continue;

      // Check explicit relationships
      if (targetMemory.metadata.relatedMemories.includes(item.id) ||
          item.metadata.relatedMemories.includes(memoryId)) {
        related.push(item);
        continue;
      }

      // Check tag overlap
      const tagOverlap = this.calculateTagOverlap(targetMemory.metadata.tags, item.metadata.tags);
      if (tagOverlap > 0.3) {
        related.push(item);
        continue;
      }

      // Check context similarity
      const contextSimilarity = this.calculateContextSimilarity(
        targetMemory.metadata.context || {},
        item.metadata.context || {}
      );
      if (contextSimilarity > 0.5) {
        related.push(item);
      }
    }

    // Sort by relevance
    related.sort((a, b) => (b.currentRelevance || 0) - (a.currentRelevance || 0));

    return related;
  }

  /**
   * Organize memories by type within the context window
   */
  private organizeByMemoryType(contextWindow: ContextWindow, newMemory: MemoryItem): void {
    // Working memory should be at the front for quick access
    if (newMemory.type === MemoryType.WORKING) {
      // Remove any existing working memory beyond limit
      const workingMemories = contextWindow.items.filter(item => item.type === MemoryType.WORKING);
      if (workingMemories.length >= this.MAX_WORKING_MEMORY_SIZE) {
        // Remove oldest working memory
        const oldestIndex = contextWindow.items.findIndex(item => 
          item.type === MemoryType.WORKING && 
          item.id === workingMemories[workingMemories.length - 1].id
        );
        if (oldestIndex !== -1) {
          contextWindow.items.splice(oldestIndex, 1);
        }
      }
    }
  }

  /**
   * Maintain context window size limits
   */
  private maintainWindowSize(contextWindow: ContextWindow): void {
    if (contextWindow.items.length > contextWindow.size) {
      // Sort by relevance (descending) and recency
      contextWindow.items.sort((a, b) => {
        const aRelevance = a.currentRelevance || 0;
        const bRelevance = b.currentRelevance || 0;
        
        if (Math.abs(aRelevance - bRelevance) < 0.1) {
          // If relevance is similar, prefer more recent
          return b.metadata.lastAccessedAt.getTime() - a.metadata.lastAccessedAt.getTime();
        }
        
        return bRelevance - aRelevance;
      });

      // Keep only the top items
      contextWindow.items = contextWindow.items.slice(0, contextWindow.size);
    }
  }

  /**
   * Update relevance scores and prune low-relevance items
   */
  private async updateRelevanceAndPrune(contextWindow: ContextWindow): Promise<void> {
    // Filter out items below relevance threshold
    contextWindow.items = contextWindow.items.filter(item => {
      const relevance = item.currentRelevance || 0;
      
      // Always keep critical memories regardless of threshold
      if (item.relevance === 1.0) return true;
      
      // Always keep very recent memories
      if (this.isRecentMemory(item, 60 * 60 * 1000)) return true; // Last hour
      
      return relevance >= contextWindow.relevanceThreshold;
    });
  }

  /**
   * Group memories by type
   */
  private groupMemoriesByType(memories: MemoryItem[]): Map<MemoryType, MemoryItem[]> {
    const groups = new Map<MemoryType, MemoryItem[]>();
    
    for (const memory of memories) {
      const group = groups.get(memory.type) || [];
      group.push(memory);
      groups.set(memory.type, group);
    }

    return groups;
  }

  /**
   * Check if memory is recent
   */
  private isRecentMemory(memory: MemoryItem, maxAge: number): boolean {
    const age = Date.now() - memory.metadata.lastAccessedAt.getTime();
    return age <= maxAge;
  }

  /**
   * Remove duplicate memories
   */
  private removeDuplicates(memories: MemoryItem[]): MemoryItem[] {
    const seen = new Set<string>();
    return memories.filter(memory => {
      if (seen.has(memory.id)) {
        return false;
      }
      seen.add(memory.id);
      return true;
    });
  }

  /**
   * Calculate tag overlap between two memory items
   */
  private calculateTagOverlap(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 || tags2.length === 0) return 0;
    
    const set1 = new Set(tags1);
    const overlap = tags2.filter(tag => set1.has(tag)).length;
    
    return overlap / Math.max(tags1.length, tags2.length);
  }

  /**
   * Calculate context similarity between two context objects
   */
  private calculateContextSimilarity(
    context1: Record<string, any>, 
    context2: Record<string, any>
  ): number {
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    
    if (keys1.length === 0 || keys2.length === 0) return 0;

    let matches = 0;
    let total = 0;

    const allKeys = new Set<string>();
    keys1.forEach(key => allKeys.add(key));
    keys2.forEach(key => allKeys.add(key));
    
    allKeys.forEach(key => {
      total++;
      if (context1[key] === context2[key]) {
        matches++;
      }
    });

    return matches / total;
  }

  /**
   * Get context window statistics
   */
  async getContextStats(agentId: string): Promise<{
    windowSize: number;
    itemCount: number;
    averageRelevance: number;
    typeDistribution: Record<string, number>;
    oldestItem: Date;
    newestItem: Date;
  }> {
    const contextWindow = await this.getContextWindow(agentId);
    
    if (contextWindow.items.length === 0) {
      return {
        windowSize: contextWindow.size,
        itemCount: 0,
        averageRelevance: 0,
        typeDistribution: {},
        oldestItem: new Date(),
        newestItem: new Date()
      };
    }

    const typeDistribution: Record<string, number> = {};
    let totalRelevance = 0;
    let oldest = contextWindow.items[0].metadata.createdAt;
    let newest = contextWindow.items[0].metadata.createdAt;

    for (const item of contextWindow.items) {
      typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
      totalRelevance += item.currentRelevance || 0;
      
      if (item.metadata.createdAt < oldest) {
        oldest = item.metadata.createdAt;
      }
      if (item.metadata.createdAt > newest) {
        newest = item.metadata.createdAt;
      }
    }

    return {
      windowSize: contextWindow.size,
      itemCount: contextWindow.items.length,
      averageRelevance: totalRelevance / contextWindow.items.length,
      typeDistribution,
      oldestItem: oldest,
      newestItem: newest
    };
  }
}