/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { ContextMerger } from './interfaces.js';
import {
  ContextMergeConfig,
  MergedContext,
  MemoryConflict,
  ConflictResolution
} from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of context merger
 */
export class DefaultContextMerger implements ContextMerger {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Merge contexts from multiple agents
   */
  async mergeContexts(
    agentIds: string[],
    config: ContextMergeConfig
  ): Promise<MergedContext> {
    const startTime = Date.now();
    const allMemories: MemoryItem[] = [];

    // Collect memories from all agents
    for (const agentId of agentIds) {
      const agentMemories = await this.memoryStore.search({ agentId });
      allMemories.push(...agentMemories.items);
    }

    return await this.mergeMemories(allMemories, config);
  }

  /**
   * Merge specific memories
   */
  async mergeMemories(
    memories: MemoryItem[],
    config: ContextMergeConfig
  ): Promise<MergedContext> {
    const startTime = Date.now();
    let mergedMemories: MemoryItem[] = [];
    let duplicatesRemoved = 0;
    let conflictsResolved = 0;

    // Apply merge strategy
    switch (config.strategy) {
      case 'union':
        mergedMemories = await this.mergeUnion(memories);
        break;
      case 'intersection':
        mergedMemories = await this.mergeIntersection(memories);
        break;
      case 'priority':
        mergedMemories = await this.mergePriority(memories, config.priorityOrder || []);
        break;
      case 'weighted':
        mergedMemories = await this.mergeWeighted(memories, config.weights || new Map());
        break;
      default:
        throw new Error(`Unknown merge strategy: ${config.strategy}`);
    }

    // Remove duplicates
    const { unique, removed } = await this.removeDuplicates(mergedMemories);
    mergedMemories = unique;
    duplicatesRemoved = removed;

    // Detect and resolve conflicts
    const conflicts = await this.detectConflicts(mergedMemories);
    if (conflicts.length > 0) {
      const resolvedMemories = await this.resolveContextConflicts(conflicts, config.conflictResolution);
      mergedMemories = resolvedMemories;
      conflictsResolved = conflicts.length;
    }

    // Apply size limit if specified
    if (config.maxSize && mergedMemories.length > config.maxSize) {
      mergedMemories = await this.applySizeLimit(mergedMemories, config.maxSize);
    }

    // Extract unique contributors
    const contributors = [...new Set(mergedMemories.map(m => m.agentId))];

    const result: MergedContext = {
      memories: mergedMemories,
      contributors,
      mergeStats: {
        totalMemories: mergedMemories.length,
        duplicatesRemoved,
        conflictsResolved,
        mergeDuration: Date.now() - startTime
      },
      config,
      mergedAt: new Date(),
      metadata: {
        originalMemoriesCount: memories.length,
        finalMemoriesCount: mergedMemories.length,
        compressionRatio: memories.length > 0 ? mergedMemories.length / memories.length : 0
      }
    };

    return result;
  }

  /**
   * Resolve context conflicts
   */
  async resolveContextConflicts(
    conflicts: MemoryConflict[],
    resolution: ConflictResolution
  ): Promise<MemoryItem[]> {
    const resolvedMemories: MemoryItem[] = [];
    const memoryGroups = new Map<string, MemoryItem[]>();

    // Group memories by conflict ID
    for (const conflict of conflicts) {
      const conflictMemories = await this.getConflictMemories(conflict);
      memoryGroups.set(conflict.id, conflictMemories);
    }

    // Resolve each conflict group
    for (const [conflictId, conflictMemories] of memoryGroups) {
      const resolvedMemory = await this.resolveConflictGroup(conflictMemories, resolution);
      if (resolvedMemory) {
        resolvedMemories.push(resolvedMemory);
      }
    }

    return resolvedMemories;
  }

  /**
   * Calculate context similarity
   */
  async calculateContextSimilarity(
    context1: MemoryItem[],
    context2: MemoryItem[]
  ): Promise<number> {
    if (context1.length === 0 && context2.length === 0) {
      return 1.0;
    }

    if (context1.length === 0 || context2.length === 0) {
      return 0.0;
    }

    // Calculate Jaccard similarity based on content hashes
    const set1 = new Set(context1.map(m => this.getContentHash(m)));
    const set2 = new Set(context2.map(m => this.getContentHash(m)));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Optimize merged context
   */
  async optimizeMergedContext(
    context: MergedContext,
    maxSize?: number
  ): Promise<MergedContext> {
    let optimizedMemories = [...context.memories];

    // Sort by relevance score (descending) - use importance as fallback
    optimizedMemories.sort((a, b) => ((b.metadata?.importance as number) || 0) - ((a.metadata?.importance as number) || 0));

    // Apply size limit if specified
    if (maxSize && optimizedMemories.length > maxSize) {
      optimizedMemories = optimizedMemories.slice(0, maxSize);
    }

    // Remove low-relevance memories - use importance as fallback
    const relevanceThreshold = 0.1;
    optimizedMemories = optimizedMemories.filter(m => ((m.metadata?.importance as number) || 0) >= relevanceThreshold);

    // Update merge stats
    const newStats = {
      ...context.mergeStats,
      totalMemories: optimizedMemories.length
    };

    return {
      ...context,
      memories: optimizedMemories,
      mergeStats: newStats,
      metadata: {
        ...context.metadata,
        optimized: true,
        optimizedAt: new Date().toISOString(),
        originalSize: context.memories.length,
        optimizedSize: optimizedMemories.length
      }
    };
  }

  /**
   * Merge using union strategy
   */
  private async mergeUnion(memories: MemoryItem[]): Promise<MemoryItem[]> {
    return memories;
  }

  /**
   * Merge using intersection strategy
   */
  private async mergeIntersection(memories: MemoryItem[]): Promise<MemoryItem[]> {
    if (memories.length === 0) {
      return [];
    }

    const contentHashes = new Map<string, MemoryItem[]>();
    
    // Group memories by content hash
    for (const memory of memories) {
      const hash = this.getContentHash(memory);
      if (!contentHashes.has(hash)) {
        contentHashes.set(hash, []);
      }
      contentHashes.get(hash)!.push(memory);
    }

    // Only keep memories that appear in multiple agents
    const intersectionMemories: MemoryItem[] = [];
    for (const [hash, memoryGroup] of contentHashes) {
      const uniqueAgents = new Set(memoryGroup.map(m => m.agentId));
      if (uniqueAgents.size > 1) {
        // Take the most recent version
        const sortedGroup = memoryGroup.sort((a, b) => 
          (b.metadata?.createdAt as Date).getTime() - (a.metadata?.createdAt as Date).getTime()
        );
        intersectionMemories.push(sortedGroup[0]);
      }
    }

    return intersectionMemories;
  }

  /**
   * Merge using priority strategy
   */
  private async mergePriority(memories: MemoryItem[], priorityOrder: string[]): Promise<MemoryItem[]> {
    const priorityMap = new Map<string, number>();
    priorityOrder.forEach((agentId, index) => {
      priorityMap.set(agentId, index);
    });

    // Sort by priority (lower index = higher priority)
    return memories.sort((a, b) => {
      const priorityA = priorityMap.get(a.agentId) ?? Number.MAX_SAFE_INTEGER;
      const priorityB = priorityMap.get(b.agentId) ?? Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });
  }

  /**
   * Merge using weighted strategy
   */
  private async mergeWeighted(memories: MemoryItem[], weights: Map<string, number>): Promise<MemoryItem[]> {
    // Apply weights to relevance scores
    const weightedMemories = memories.map(memory => {
      const weight = weights.get(memory.agentId) || 1.0;
      return {
        ...memory,
        metadata: {
          ...memory.metadata,
          importance: ((memory.metadata?.importance as number) || 0) * weight
        }
      };
    });

    // Sort by weighted relevance score - use importance
    return weightedMemories.sort((a, b) => ((b.metadata?.importance as number) || 0) - ((a.metadata?.importance as number) || 0));
  }

  /**
   * Remove duplicate memories
   */
  private async removeDuplicates(memories: MemoryItem[]): Promise<{ unique: MemoryItem[]; removed: number }> {
    const contentHashes = new Map<string, MemoryItem>();
    let removed = 0;

    for (const memory of memories) {
      const hash = this.getContentHash(memory);
      if (contentHashes.has(hash)) {
        // Keep the most recent version
        const existing = contentHashes.get(hash)!;
        if ((memory.metadata?.createdAt as Date) > (existing.metadata?.createdAt as Date)) {
          contentHashes.set(hash, memory);
        }
        removed++;
      } else {
        contentHashes.set(hash, memory);
      }
    }

    return {
      unique: Array.from(contentHashes.values()),
      removed
    };
  }

  /**
   * Detect conflicts in memories
   */
  private async detectConflicts(memories: MemoryItem[]): Promise<MemoryConflict[]> {
    const conflicts: MemoryConflict[] = [];
    const seenIds = new Map<string, MemoryItem[]>();

    // Group memories by ID
    for (const memory of memories) {
      if (!seenIds.has(memory.id)) {
        seenIds.set(memory.id, []);
      }
      seenIds.get(memory.id)!.push(memory);
    }

    // Check for conflicts
    for (const [id, memoryGroup] of seenIds) {
      if (memoryGroup.length > 1) {
        // Check if they have different content
        const uniqueContents = new Set(memoryGroup.map(m => JSON.stringify(m.content)));
        if (uniqueContents.size > 1) {
          const conflict: MemoryConflict = {
            id: uuidv4(),
            memoryId: id,
            agents: memoryGroup.map(m => m.agentId),
            type: 'content',
            description: `Multiple versions of memory ${id} with different content`,
            values: new Map(memoryGroup.map(m => [m.agentId, m.content])),
            timestamp: new Date()
          };
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Get memories involved in a conflict
   */
  private async getConflictMemories(conflict: MemoryConflict): Promise<MemoryItem[]> {
    const memories: MemoryItem[] = [];
    
    for (const agentId of conflict.agents) {
      const memory = await this.memoryStore.retrieve(conflict.memoryId);
      if (memory && memory.agentId === agentId) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Resolve a conflict group
   */
  private async resolveConflictGroup(
    conflictMemories: MemoryItem[],
    resolution: ConflictResolution
  ): Promise<MemoryItem | null> {
    if (conflictMemories.length === 0) {
      return null;
    }

    switch (resolution) {
      case ConflictResolution.LATEST_WINS:
        return conflictMemories.reduce((latest, current) => 
          (current.metadata?.createdAt as Date) > (latest.metadata?.createdAt as Date) ? current : latest
        );

      case ConflictResolution.OLDEST_WINS:
        return conflictMemories.reduce((oldest, current) => 
          (current.metadata?.createdAt as Date) < (oldest.metadata?.createdAt as Date) ? current : oldest
        );

      case ConflictResolution.PRIORITY:
        // For now, use the first memory as highest priority
        return conflictMemories[0];

      case ConflictResolution.MERGE:
        return await this.mergeConflictedMemories(conflictMemories);

      case ConflictResolution.MANUAL:
        // For manual resolution, return the first memory and log the conflict
        console.warn('Manual conflict resolution required for memories:', conflictMemories.map(m => m.id));
        return conflictMemories[0];

      default:
        return conflictMemories[0];
    }
  }

  /**
   * Merge conflicted memories
   */
  private async mergeConflictedMemories(conflictMemories: MemoryItem[]): Promise<MemoryItem> {
    const baseMemory = conflictMemories[0];
    const mergedContent = {
      ...baseMemory.content,
      __merged: true,
      __sources: conflictMemories.map(m => ({
        agentId: m.agentId,
        content: m.content,
        timestamp: m.metadata?.createdAt as Date
      }))
    };

    return {
      ...baseMemory,
      content: mergedContent,
      metadata: {
        ...baseMemory.metadata,
        context: {
          ...baseMemory.metadata?.context,
          mergedAt: new Date(),
          sourceAgents: conflictMemories.map(m => m.agentId)
        }
      }
    };
  }

  /**
   * Apply size limit to memories
   */
  private async applySizeLimit(memories: MemoryItem[], maxSize: number): Promise<MemoryItem[]> {
    if (memories.length <= maxSize) {
      return memories;
    }

    // Sort by relevance score (descending) and take top memories - use importance
    const sortedMemories = memories.sort((a, b) => ((b.metadata?.importance as number) || 0) - ((a.metadata?.importance as number) || 0));
    return sortedMemories.slice(0, maxSize);
  }

  /**
   * Get content hash for a memory
   */
  private getContentHash(memory: MemoryItem): string {
    const crypto = require('crypto');
    const content = JSON.stringify(memory.content);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}