/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { RelevanceScorer } from './interfaces.js';
import { MemoryItem, MemoryType, MemoryRelevance } from './types.js';

/**
 * Implementation of memory relevance scoring algorithm
 */
export class DefaultRelevanceScorer implements RelevanceScorer {
  private readonly DECAY_FACTORS = {
    [MemoryType.PROCEDURAL]: 0.001, // Very slow decay for procedures
    [MemoryType.SEMANTIC]: 0.005,   // Slow decay for facts
    [MemoryType.EPISODIC]: 0.01,    // Medium decay for experiences
    [MemoryType.WORKING]: 0.1,      // Fast decay for temporary info
    [MemoryType.SHARED]: 0.002      // Very slow decay for shared info
  };

  private readonly ACCESS_BOOST_FACTOR = 0.1;
  private readonly TIME_DECAY_MULTIPLIER = 0.0001;
  private readonly CONTEXT_RELEVANCE_BOOST = 0.2;

  /**
   * Calculate initial relevance score for a memory
   */
  calculateInitialScore(memory: MemoryItem): number {
    let score = memory.relevance;

    // Boost based on memory type importance
    switch (memory.type) {
      case MemoryType.PROCEDURAL:
        score += 0.2; // Procedures are generally important
        break;
      case MemoryType.SHARED:
        score += 0.15; // Shared memories are valuable
        break;
      case MemoryType.SEMANTIC:
        score += 0.1; // Facts are moderately important
        break;
      case MemoryType.EPISODIC:
        score += 0.05; // Experiences have base importance
        break;
      case MemoryType.WORKING:
        score -= 0.1; // Working memory starts with lower importance
        break;
    }

    // Boost based on explicit importance
    score += memory.metadata.importance * 0.3;

    // Boost for memories with tags (indicates organization)
    if (memory.metadata.tags.length > 0) {
      score += Math.min(memory.metadata.tags.length * 0.02, 0.1);
    }

    // Boost for memories with related memories (indicates connections)
    if (memory.metadata.relatedMemories.length > 0) {
      score += Math.min(memory.metadata.relatedMemories.length * 0.01, 0.05);
    }

    // Boost for memories with rich context
    if (memory.metadata.context && Object.keys(memory.metadata.context).length > 0) {
      score += 0.05;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Update relevance score based on access patterns and context
   */
  updateScore(memory: MemoryItem, accessContext?: Record<string, any>): number {
    const currentTime = new Date();
    
    // Start with current relevance or calculate initial if not set
    let score = memory.currentRelevance || this.calculateInitialScore(memory);

    // Apply time-based decay
    const decay = this.calculateDecay(memory, currentTime);
    score = score * (1 - decay);

    // Boost based on access frequency
    const accessBoost = this.calculateAccessBoost(memory);
    score += accessBoost;

    // Boost based on recent access
    const recentAccessBoost = this.calculateRecentAccessBoost(memory, currentTime);
    score += recentAccessBoost;

    // Context-based relevance boost
    if (accessContext) {
      const contextBoost = this.calculateContextBoost(memory, accessContext);
      score += contextBoost;
    }

    // Co-activation boost (memories accessed together become more relevant)
    const coActivationBoost = this.calculateCoActivationBoost(memory);
    score += coActivationBoost;

    // Ensure score is within bounds
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate memory decay based on time and type
   */
  calculateDecay(memory: MemoryItem, currentTime: Date): number {
    const timeDiff = currentTime.getTime() - memory.metadata.lastAccessedAt.getTime();
    const daysSinceAccess = timeDiff / (1000 * 60 * 60 * 24);

    // Get decay factor for memory type
    const baseDayRate = this.DECAY_FACTORS[memory.type] || 0.01;
    
    // Apply custom decay rate from memory metadata
    const customDecayRate = memory.metadata.decayRate || baseDayRate;
    
    // Calculate exponential decay
    const decay = 1 - Math.exp(-customDecayRate * daysSinceAccess);

    // Slower decay for frequently accessed memories
    const accessFrequencyFactor = Math.max(0.1, 1 - (memory.metadata.accessCount * 0.01));
    
    return decay * accessFrequencyFactor;
  }

  /**
   * Determine if memory should be retained based on threshold
   */
  shouldRetain(memory: MemoryItem, threshold: number): boolean {
    const currentScore = memory.currentRelevance || this.calculateInitialScore(memory);
    
    // Always retain critical memories
    if (memory.relevance === MemoryRelevance.CRITICAL) {
      return true;
    }

    // Always retain recently created high-importance memories
    const daysSinceCreation = (Date.now() - memory.metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7 && memory.relevance >= MemoryRelevance.HIGH) {
      return true;
    }

    // Always retain procedural memories (they don't decay much)
    if (memory.type === MemoryType.PROCEDURAL && currentScore > 0.3) {
      return true;
    }

    // Always retain shared memories with high access
    if (memory.type === MemoryType.SHARED && memory.metadata.accessCount > 5) {
      return true;
    }

    return currentScore >= threshold;
  }

  /**
   * Calculate boost based on access frequency
   */
  private calculateAccessBoost(memory: MemoryItem): number {
    const accessCount = memory.metadata.accessCount;
    
    // Logarithmic boost to prevent runaway growth
    const boost = Math.log(1 + accessCount) * this.ACCESS_BOOST_FACTOR;
    
    return Math.min(boost, 0.3); // Cap the boost
  }

  /**
   * Calculate boost based on recent access
   */
  private calculateRecentAccessBoost(memory: MemoryItem, currentTime: Date): number {
    const timeDiff = currentTime.getTime() - memory.metadata.lastAccessedAt.getTime();
    const hoursSinceAccess = timeDiff / (1000 * 60 * 60);

    // Boost memories accessed in the last 24 hours
    if (hoursSinceAccess < 24) {
      const boost = (24 - hoursSinceAccess) / 24 * 0.1;
      return boost;
    }

    return 0;
  }

  /**
   * Calculate boost based on access context
   */
  private calculateContextBoost(memory: MemoryItem, accessContext: Record<string, any>): number {
    let boost = 0;

    // Check for context matches
    const memoryContext = memory.metadata.context || {};
    
    for (const [key, value] of Object.entries(accessContext)) {
      if (memoryContext[key] === value) {
        boost += this.CONTEXT_RELEVANCE_BOOST / Object.keys(accessContext).length;
      }
    }

    // Check for tag matches
    const contextTags = accessContext.tags as string[] || [];
    const memoryTags = memory.metadata.tags;
    
    const tagMatches = contextTags.filter(tag => memoryTags.includes(tag)).length;
    if (tagMatches > 0) {
      boost += (tagMatches / Math.max(contextTags.length, memoryTags.length)) * 0.1;
    }

    return Math.min(boost, 0.2); // Cap the context boost
  }

  /**
   * Calculate boost for memories that are often accessed together
   */
  private calculateCoActivationBoost(memory: MemoryItem): number {
    // This would require tracking co-activation patterns
    // For now, provide a small boost for memories with related memories
    const relatedCount = memory.metadata.relatedMemories.length;
    
    if (relatedCount > 0) {
      return Math.min(relatedCount * 0.01, 0.05);
    }

    return 0;
  }

  /**
   * Calculate relevance score for a query-memory pair
   */
  calculateQueryRelevance(memory: MemoryItem, query: string, queryContext?: Record<string, any>): number {
    let score = memory.currentRelevance || this.calculateInitialScore(memory);

    // Text relevance (simplified - in practice would use more sophisticated NLP)
    const textRelevance = this.calculateTextRelevance(memory, query);
    score += textRelevance * 0.3;

    // Context relevance
    if (queryContext) {
      const contextRelevance = this.calculateContextBoost(memory, queryContext);
      score += contextRelevance;
    }

    // Boost for exact tag matches
    if (memory.metadata.tags.some(tag => query.toLowerCase().includes(tag.toLowerCase()))) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate text relevance between memory content and query
   */
  private calculateTextRelevance(memory: MemoryItem, query: string): number {
    const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    // Simple word matching (in practice would use embeddings/TF-IDF)
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);

    const matches = queryWords.filter(word => contentWords.some(cWord => cWord.includes(word)));
    const relevance = matches.length / queryWords.length;

    return Math.min(relevance, 1);
  }

  /**
   * Get relevance explanation for debugging
   */
  explainRelevance(memory: MemoryItem, accessContext?: Record<string, any>): {
    totalScore: number;
    breakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {};
    
    breakdown.initialScore = this.calculateInitialScore(memory);
    breakdown.timeDecay = -this.calculateDecay(memory, new Date());
    breakdown.accessBoost = this.calculateAccessBoost(memory);
    breakdown.recentAccessBoost = this.calculateRecentAccessBoost(memory, new Date());
    
    if (accessContext) {
      breakdown.contextBoost = this.calculateContextBoost(memory, accessContext);
    }
    
    breakdown.coActivationBoost = this.calculateCoActivationBoost(memory);

    const totalScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

    return {
      totalScore: Math.max(0, Math.min(1, totalScore)),
      breakdown
    };
  }
}