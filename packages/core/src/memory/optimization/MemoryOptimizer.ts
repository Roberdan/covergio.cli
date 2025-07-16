/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryOptimizer } from './interfaces.js';
import {
  MemoryOptimizationConfig,
  MemoryOptimizationResult,
  ConsolidationRule,
  PruningCriteria,
  OptimizationStrategy
} from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory optimizer
 */
export class DefaultMemoryOptimizer implements MemoryOptimizer {
  private memoryStore: MemoryStore;
  private config: MemoryOptimizationConfig;
  private autoOptimizationTimer?: NodeJS.Timeout;
  private isOptimizing = false;
  private lastOptimization?: Date;

  constructor(memoryStore: MemoryStore, config?: Partial<MemoryOptimizationConfig>) {
    this.memoryStore = memoryStore;
    this.config = {
      maxMemoriesPerAgent: 10000,
      pruningThreshold: 0.1,
      consolidationInterval: 24 * 60 * 60 * 1000, // 24 hours
      minRelevanceScore: 0.1,
      maxAgeBeforeArchiving: 30 * 24 * 60 * 60 * 1000, // 30 days
      enableAutoOptimization: true,
      strategy: OptimizationStrategy.HYBRID,
      ...config
    };
  }

  /**
   * Configure optimization settings
   */
  async configure(config: MemoryOptimizationConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Restart auto-optimization if it was running
    if (this.autoOptimizationTimer) {
      await this.stopAutoOptimization();
      await this.startAutoOptimization();
    }
  }

  /**
   * Optimize memory for a specific agent
   */
  async optimizeAgent(agentId: string): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      if (this.isOptimizing) {
        return {
          success: false,
          message: 'Optimization already in progress',
          memoriesProcessed: 0,
          memoriesPruned: 0,
          memoriesConsolidated: 0,
          memoriesArchived: 0,
          duration: 0,
          memoryUsageBefore: 0,
          memoryUsageAfter: 0,
          error: new Error('Optimization already in progress')
        };
      }

      this.isOptimizing = true;

      // Get all memories for the agent
      const searchResult = await this.memoryStore.search({ agentId });
      const memories = searchResult.items;

      const memoryUsageBefore = this.calculateMemoryUsage(memories);
      let memoriesPruned = 0;
      let memoriesConsolidated = 0;
      let memoriesArchived = 0;

      // Apply optimization strategy
      const optimizedMemories = await this.applyOptimizationStrategy(memories, agentId);

      // Calculate differences
      memoriesPruned = memories.length - optimizedMemories.length;
      memoriesConsolidated = await this.countConsolidatedMemories(memories, optimizedMemories);
      memoriesArchived = await this.countArchivedMemories(memories);

      const memoryUsageAfter = this.calculateMemoryUsage(optimizedMemories);

      this.lastOptimization = new Date();

      return {
        success: true,
        message: `Successfully optimized ${memories.length} memories for agent ${agentId}`,
        memoriesProcessed: memories.length,
        memoriesPruned,
        memoriesConsolidated,
        memoriesArchived,
        duration: Date.now() - startTime,
        memoryUsageBefore,
        memoryUsageAfter
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to optimize agent ${agentId}: ${(error as Error).message}`,
        memoriesProcessed: 0,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: 0,
        error: error as Error
      };
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Optimize all memories
   */
  async optimizeAll(): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      if (this.isOptimizing) {
        return {
          success: false,
          message: 'Optimization already in progress',
          memoriesProcessed: 0,
          memoriesPruned: 0,
          memoriesConsolidated: 0,
          memoriesArchived: 0,
          duration: 0,
          memoryUsageBefore: 0,
          memoryUsageAfter: 0,
          error: new Error('Optimization already in progress')
        };
      }

      this.isOptimizing = true;

      // Get all memories
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      const memoryUsageBefore = this.calculateMemoryUsage(memories);
      let totalPruned = 0;
      let totalConsolidated = 0;
      let totalArchived = 0;

      // Group memories by agent
      const memoriesByAgent = new Map<string, MemoryItem[]>();
      for (const memory of memories) {
        if (!memoriesByAgent.has(memory.agentId)) {
          memoriesByAgent.set(memory.agentId, []);
        }
        memoriesByAgent.get(memory.agentId)!.push(memory);
      }

      // Optimize each agent's memories
      for (const [agentId, agentMemories] of Array.from(memoriesByAgent.entries())) {
        const optimizedMemories = await this.applyOptimizationStrategy(agentMemories, agentId);
        
        totalPruned += agentMemories.length - optimizedMemories.length;
        totalConsolidated += await this.countConsolidatedMemories(agentMemories, optimizedMemories);
        totalArchived += await this.countArchivedMemories(agentMemories);
      }

      // Recalculate memory usage after optimization
      const finalSearchResult = await this.memoryStore.search({});
      const finalMemories = finalSearchResult.items;
      const memoryUsageAfter = this.calculateMemoryUsage(finalMemories);

      this.lastOptimization = new Date();

      return {
        success: true,
        message: `Successfully optimized ${memories.length} memories across all agents`,
        memoriesProcessed: memories.length,
        memoriesPruned: totalPruned,
        memoriesConsolidated: totalConsolidated,
        memoriesArchived: totalArchived,
        duration: Date.now() - startTime,
        memoryUsageBefore,
        memoryUsageAfter
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to optimize all memories: ${(error as Error).message}`,
        memoriesProcessed: 0,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: 0,
        error: error as Error
      };
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Prune memories based on criteria
   */
  async pruneMemories(criteria: PruningCriteria): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      const memoryUsageBefore = this.calculateMemoryUsage(memories);
      const memoriesToPrune = memories.filter(memory => this.shouldPruneMemory(memory, criteria));

      let memoriesPruned = 0;
      for (const memory of memoriesToPrune) {
        await this.memoryStore.delete(memory.id);
        memoriesPruned++;
      }

      const remainingMemories = memories.filter(memory => !memoriesToPrune.includes(memory));
      const memoryUsageAfter = this.calculateMemoryUsage(remainingMemories);

      return {
        success: true,
        message: `Successfully pruned ${memoriesPruned} memories`,
        memoriesProcessed: memories.length,
        memoriesPruned,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore,
        memoryUsageAfter
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to prune memories: ${(error as Error).message}`,
        memoriesProcessed: 0,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: 0,
        error: error as Error
      };
    }
  }

  /**
   * Consolidate similar memories
   */
  async consolidateMemories(rules: ConsolidationRule[]): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      const memoryUsageBefore = this.calculateMemoryUsage(memories);
      let memoriesConsolidated = 0;

      // Sort rules by priority
      const sortedRules = rules.filter(rule => rule.enabled).sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        const applicableMemories = memories.filter(memory => rule.condition([memory]));
        
        if (applicableMemories.length > 1) {
          // Group similar memories
          const groups = this.groupSimilarMemories(applicableMemories, rule);
          
          for (const group of groups) {
            if (group.length > 1) {
              const consolidatedMemory = rule.action(group);
              
              // Remove original memories
              for (const memory of group) {
                await this.memoryStore.delete(memory.id);
              }
              
              // Store consolidated memory
              await this.memoryStore.store(consolidatedMemory);
              memoriesConsolidated += group.length - 1;
            }
          }
        }
      }

      const finalSearchResult = await this.memoryStore.search({});
      const finalMemories = finalSearchResult.items;
      const memoryUsageAfter = this.calculateMemoryUsage(finalMemories);

      return {
        success: true,
        message: `Successfully consolidated ${memoriesConsolidated} memories`,
        memoriesProcessed: memories.length,
        memoriesPruned: 0,
        memoriesConsolidated,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore,
        memoryUsageAfter
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to consolidate memories: ${(error as Error).message}`,
        memoriesProcessed: 0,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: 0,
        error: error as Error
      };
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(agentId?: string): Promise<string[]> {
    const recommendations: string[] = [];
    
    try {
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Check memory count
      if (agentId) {
        if (memories.length > this.config.maxMemoriesPerAgent) {
          recommendations.push(`Agent ${agentId} has ${memories.length} memories, exceeding limit of ${this.config.maxMemoriesPerAgent}. Consider pruning.`);
        }
      } else {
        const memoriesByAgent = new Map<string, number>();
        for (const memory of memories) {
          memoriesByAgent.set(memory.agentId, (memoriesByAgent.get(memory.agentId) || 0) + 1);
        }

        for (const [id, count] of Array.from(memoriesByAgent.entries())) {
          if (count > this.config.maxMemoriesPerAgent) {
            recommendations.push(`Agent ${id} has ${count} memories, exceeding limit of ${this.config.maxMemoriesPerAgent}. Consider pruning.`);
          }
        }
      }

      // Check memory age
      const now = Date.now();
      const oldMemories = memories.filter(memory => 
        now - (memory.metadata?.createdAt as Date)?.getTime() > this.config.maxAgeBeforeArchiving
      );

      if (oldMemories.length > 0) {
        recommendations.push(`Found ${oldMemories.length} old memories that could be archived.`);
      }

      // Check for low relevance memories
      const lowRelevanceMemories = memories.filter(memory => 
        (memory.metadata?.importance || 0) < this.config.minRelevanceScore
      );

      if (lowRelevanceMemories.length > 0) {
        recommendations.push(`Found ${lowRelevanceMemories.length} memories with low relevance scores that could be pruned.`);
      }

      // Check for duplicate or similar memories
      const duplicateGroups = this.findDuplicateMemories(memories);
      if (duplicateGroups.length > 0) {
        recommendations.push(`Found ${duplicateGroups.length} groups of similar memories that could be consolidated.`);
      }

      // Check memory access patterns
      const unaccessed = memories.filter(memory => 
        (memory.metadata?.accessCount || 0) === 0
      );

      if (unaccessed.length > 0) {
        recommendations.push(`Found ${unaccessed.length} memories that have never been accessed.`);
      }

      if (recommendations.length === 0) {
        recommendations.push('Memory usage appears optimal. No immediate optimizations needed.');
      }

    } catch (error) {
      recommendations.push(`Error analyzing memories: ${(error as Error).message}`);
    }

    return recommendations;
  }

  /**
   * Start automatic optimization
   */
  async startAutoOptimization(): Promise<void> {
    if (this.autoOptimizationTimer) {
      return;
    }

    this.autoOptimizationTimer = setInterval(async () => {
      if (!this.isOptimizing) {
        try {
          await this.optimizeAll();
        } catch (error) {
          console.error('Auto-optimization failed:', error);
        }
      }
    }, this.config.consolidationInterval);
  }

  /**
   * Stop automatic optimization
   */
  async stopAutoOptimization(): Promise<void> {
    if (this.autoOptimizationTimer) {
      clearInterval(this.autoOptimizationTimer);
      this.autoOptimizationTimer = undefined;
    }
  }

  /**
   * Get optimization status
   */
  async getOptimizationStatus(): Promise<{
    enabled: boolean;
    lastOptimization: Date;
    nextOptimization: Date;
    config: MemoryOptimizationConfig;
  }> {
    const now = new Date();
    const nextOptimization = new Date(now.getTime() + this.config.consolidationInterval);

    return {
      enabled: !!this.autoOptimizationTimer,
      lastOptimization: this.lastOptimization || new Date(0),
      nextOptimization,
      config: this.config
    };
  }

  /**
   * Apply optimization strategy to memories
   */
  private async applyOptimizationStrategy(memories: MemoryItem[], agentId: string): Promise<MemoryItem[]> {
    switch (this.config.strategy) {
      case OptimizationStrategy.RELEVANCE_BASED:
        return this.optimizeByRelevance(memories);
      
      case OptimizationStrategy.TIME_BASED:
        return this.optimizeByTime(memories);
      
      case OptimizationStrategy.FREQUENCY_BASED:
        return this.optimizeByFrequency(memories);
      
      case OptimizationStrategy.HYBRID:
        return this.optimizeHybrid(memories);
      
      default:
        return memories;
    }
  }

  /**
   * Optimize memories by relevance score
   */
  private optimizeByRelevance(memories: MemoryItem[]): MemoryItem[] {
    return memories
      .filter(memory => (memory.metadata?.importance || 0) >= this.config.minRelevanceScore)
      .sort((a, b) => (b.metadata?.importance || 0) - (a.metadata?.importance || 0))
      .slice(0, this.config.maxMemoriesPerAgent);
  }

  /**
   * Optimize memories by time (keep recent)
   */
  private optimizeByTime(memories: MemoryItem[]): MemoryItem[] {
    return memories
      .sort((a, b) => (b.metadata?.createdAt as Date)?.getTime() - (a.metadata?.createdAt as Date)?.getTime())
      .slice(0, this.config.maxMemoriesPerAgent);
  }

  /**
   * Optimize memories by access frequency
   */
  private optimizeByFrequency(memories: MemoryItem[]): MemoryItem[] {
    return memories
      .sort((a, b) => (b.metadata?.accessCount || 0) - (a.metadata?.accessCount || 0))
      .slice(0, this.config.maxMemoriesPerAgent);
  }

  /**
   * Optimize memories using hybrid approach
   */
  private optimizeHybrid(memories: MemoryItem[]): MemoryItem[] {
    const now = Date.now();
    
    // Calculate composite score
    const scoredMemories = memories.map(memory => {
      const relevance = memory.metadata?.importance || 0;
      const recency = Math.max(0, 1 - (now - (memory.metadata?.createdAt as Date)?.getTime()) / this.config.maxAgeBeforeArchiving);
      const frequency = Math.min(1, (memory.metadata?.accessCount || 0) / 10);
      
      const compositeScore = (relevance * 0.4) + (recency * 0.3) + (frequency * 0.3);
      
      return { memory, score: compositeScore };
    });

    return scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxMemoriesPerAgent)
      .map(item => item.memory);
  }

  /**
   * Check if a memory should be pruned based on criteria
   */
  private shouldPruneMemory(memory: MemoryItem, criteria: PruningCriteria): boolean {
    if (criteria.excludeTypes && criteria.excludeTypes.includes(memory.type)) {
      return false;
    }

    if (criteria.excludeAgents && criteria.excludeAgents.includes(memory.agentId)) {
      return false;
    }

    if (criteria.minRelevanceScore && (memory.metadata?.importance || 0) < criteria.minRelevanceScore) {
      return true;
    }

    if (criteria.maxAge) {
      const age = Date.now() - (memory.metadata?.createdAt as Date)?.getTime();
      if (age > criteria.maxAge) {
        return true;
      }
    }

    if (criteria.minAccessCount && (memory.metadata?.accessCount || 0) < criteria.minAccessCount) {
      return true;
    }

    if (criteria.maxLastAccessedTime) {
      const lastAccessed = (memory.metadata?.lastAccessedAt as Date)?.getTime() || 0;
      if (lastAccessed < criteria.maxLastAccessedTime) {
        return true;
      }
    }

    if (criteria.customFilter && criteria.customFilter(memory)) {
      return true;
    }

    return false;
  }

  /**
   * Group similar memories for consolidation
   */
  private groupSimilarMemories(memories: MemoryItem[], rule: ConsolidationRule): MemoryItem[][] {
    const groups: MemoryItem[][] = [];
    const used = new Set<string>();

    for (const memory of memories) {
      if (used.has(memory.id)) {
        continue;
      }

      const group = [memory];
      used.add(memory.id);

      for (const otherMemory of memories) {
        if (used.has(otherMemory.id)) {
          continue;
        }

        if (this.areMemoriesSimilar(memory, otherMemory)) {
          group.push(otherMemory);
          used.add(otherMemory.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two memories are similar
   */
  private areMemoriesSimilar(memory1: MemoryItem, memory2: MemoryItem): boolean {
    // Basic similarity check - can be enhanced with more sophisticated algorithms
    if (memory1.type !== memory2.type) {
      return false;
    }

    if (memory1.agentId !== memory2.agentId) {
      return false;
    }

    const content1 = JSON.stringify(memory1.content);
    const content2 = JSON.stringify(memory2.content);

    // Simple content similarity check
    const similarity = this.calculateStringSimilarity(content1, content2);
    return similarity > 0.8;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Calculate memory usage in bytes
   */
  private calculateMemoryUsage(memories: MemoryItem[]): number {
    return memories.reduce((total, memory) => {
      return total + JSON.stringify(memory).length;
    }, 0);
  }

  /**
   * Count consolidated memories
   */
  private async countConsolidatedMemories(original: MemoryItem[], optimized: MemoryItem[]): Promise<number> {
    // This would need more sophisticated tracking in a real implementation
    return 0;
  }

  /**
   * Count archived memories
   */
  private async countArchivedMemories(memories: MemoryItem[]): Promise<number> {
    // This would need integration with archiving system
    return 0;
  }

  /**
   * Find duplicate memories
   */
  private findDuplicateMemories(memories: MemoryItem[]): MemoryItem[][] {
    const duplicateGroups: MemoryItem[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id)) {
        continue;
      }

      const duplicates = memories.filter(m => 
        m.id !== memory.id && 
        this.areMemoriesSimilar(memory, m)
      );

      if (duplicates.length > 0) {
        duplicateGroups.push([memory, ...duplicates]);
        processed.add(memory.id);
        duplicates.forEach(d => processed.add(d.id));
      }
    }

    return duplicateGroups;
  }
}