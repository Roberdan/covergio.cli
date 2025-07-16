/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { CrossAgentQueryEngine, MemoryShareManager } from './interfaces.js';
import {
  CrossAgentQuery,
  CrossAgentQueryResult,
  MemoryPermission
} from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of cross-agent query engine
 */
export class DefaultCrossAgentQueryEngine implements CrossAgentQueryEngine {
  private memoryStore: MemoryStore;
  private shareManager: MemoryShareManager;
  private queryHistory = new Map<string, CrossAgentQuery[]>();

  constructor(memoryStore: MemoryStore, shareManager: MemoryShareManager) {
    this.memoryStore = memoryStore;
    this.shareManager = shareManager;
  }

  /**
   * Execute cross-agent query
   */
  async executeQuery(query: CrossAgentQuery): Promise<CrossAgentQueryResult> {
    const startTime = Date.now();

    try {
      const result = await this.queryAgents(
        query.requestingAgent,
        query.targetAgents,
        query.query,
        query.requiredPermissions
      );

      // Store query in history
      this.addToHistory(query.requestingAgent, query);

      return {
        ...result,
        queryId: query.id,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        queryId: query.id,
        results: new Map(),
        totalCount: 0,
        executionTime: Date.now() - startTime,
        accessGranted: [],
        accessDenied: query.targetAgents,
        metadata: {
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Query multiple agents
   */
  async queryAgents(
    requestingAgent: string,
    targetAgents: string[],
    query: any,
    requiredPermissions: MemoryPermission[]
  ): Promise<CrossAgentQueryResult> {
    const startTime = Date.now();
    const results = new Map<string, MemoryItem[]>();
    const accessGranted: string[] = [];
    const accessDenied: string[] = [];

    // Query each target agent
    for (const targetAgent of targetAgents) {
      try {
        const agentResults = await this.queryAgent(
          requestingAgent,
          targetAgent,
          query,
          requiredPermissions
        );

        if (agentResults.length > 0) {
          results.set(targetAgent, agentResults);
          accessGranted.push(targetAgent);
        } else {
          // Even if no results, access was granted
          results.set(targetAgent, []);
          accessGranted.push(targetAgent);
        }

      } catch (error) {
        accessDenied.push(targetAgent);
        console.warn(`Query failed for agent ${targetAgent}:`, error);
      }
    }

    // Calculate total count
    let totalCount = 0;
    for (const agentResults of results.values()) {
      totalCount += agentResults.length;
    }

    return {
      queryId: uuidv4(),
      results,
      totalCount,
      executionTime: Date.now() - startTime,
      accessGranted,
      accessDenied,
      metadata: {
        requestingAgent,
        targetAgents,
        query: JSON.stringify(query),
        requiredPermissions: requiredPermissions.join(', ')
      }
    };
  }

  /**
   * Aggregate query results
   */
  async aggregateResults(
    results: Map<string, MemoryItem[]>,
    aggregationType: 'union' | 'intersection' | 'weighted'
  ): Promise<MemoryItem[]> {
    const allResults: MemoryItem[] = [];
    
    for (const [agentId, agentResults] of results) {
      for (const result of agentResults) {
        allResults.push({
          ...result,
          metadata: {
            ...result.metadata,
            sourceAgent: agentId
          } as any
        });
      }
    }

    switch (aggregationType) {
      case 'union':
        return this.aggregateUnion(allResults);
      
      case 'intersection':
        return this.aggregateIntersection(results);
      
      case 'weighted':
        return this.aggregateWeighted(results);
      
      default:
        return allResults;
    }
  }

  /**
   * Get query history
   */
  async getQueryHistory(agentId: string): Promise<CrossAgentQuery[]> {
    return this.queryHistory.get(agentId) || [];
  }

  /**
   * Query a single agent
   */
  private async queryAgent(
    requestingAgent: string,
    targetAgent: string,
    query: any,
    requiredPermissions: MemoryPermission[]
  ): Promise<MemoryItem[]> {
    // Get shared memories from target agent
    const sharedMemories = await this.shareManager.getSharedMemories(requestingAgent);
    
    // Filter memories from target agent
    const targetMemories = sharedMemories.filter(memory => 
      memory.agentId === targetAgent || memory.originalOwner === targetAgent
    );

    // Check permissions for each memory
    const accessibleMemories: MemoryItem[] = [];
    for (const memory of targetMemories) {
      const hasAccess = await this.checkMemoryAccess(
        requestingAgent,
        memory.id,
        requiredPermissions
      );

      if (hasAccess) {
        accessibleMemories.push(memory);
      }
    }

    // Execute query on accessible memories
    return await this.executeMemoryQuery(accessibleMemories, query);
  }

  /**
   * Check if requesting agent has access to memory
   */
  private async checkMemoryAccess(
    requestingAgent: string,
    memoryId: string,
    requiredPermissions: MemoryPermission[]
  ): Promise<boolean> {
    // Check each required permission
    for (const permission of requiredPermissions) {
      const hasPermission = await this.shareManager.checkPermissions(
        memoryId,
        requestingAgent,
        permission
      );

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute query on memories
   */
  private async executeMemoryQuery(memories: MemoryItem[], query: any): Promise<MemoryItem[]> {
    // Handle different query types
    if (typeof query === 'string') {
      return this.executeTextQuery(memories, query);
    } else if (typeof query === 'object' && query !== null) {
      return this.executeStructuredQuery(memories, query);
    }

    return memories;
  }

  /**
   * Execute text-based query
   */
  private async executeTextQuery(memories: MemoryItem[], queryText: string): Promise<MemoryItem[]> {
    const results: MemoryItem[] = [];
    const queryLower = queryText.toLowerCase();

    for (const memory of memories) {
      // Search in content
      const contentText = typeof memory.content === 'string' ? 
        memory.content : JSON.stringify(memory.content);
      
      if (contentText.toLowerCase().includes(queryLower)) {
        results.push(memory);
        continue;
      }

      // Search in metadata
      const metadataText = JSON.stringify(memory.metadata || {});
      if (metadataText.toLowerCase().includes(queryLower)) {
        results.push(memory);
        continue;
      }

      // Search in type
      if (memory.type.toLowerCase().includes(queryLower)) {
        results.push(memory);
        continue;
      }
    }

    return results;
  }

  /**
   * Execute structured query
   */
  private async executeStructuredQuery(memories: MemoryItem[], query: any): Promise<MemoryItem[]> {
    const results: MemoryItem[] = [];

    for (const memory of memories) {
      if (this.matchesStructuredQuery(memory, query)) {
        results.push(memory);
      }
    }

    return results;
  }

  /**
   * Check if memory matches structured query
   */
  private matchesStructuredQuery(memory: MemoryItem, query: any): boolean {
    // Basic field matching
    if (query.id && memory.id !== query.id) return false;
    if (query.type && memory.type !== query.type) return false;
    if (query.agentId && memory.agentId !== query.agentId) return false;
    if (query.scope && memory.scope !== query.scope) return false;

    // Date range filtering
    if (query.createdAfter && (memory.metadata?.createdAt as Date) < new Date(query.createdAfter)) return false;
    if (query.createdBefore && (memory.metadata?.createdAt as Date) > new Date(query.createdBefore)) return false;

    // Content matching
    if (query.content) {
      const contentText = typeof memory.content === 'string' ? 
        memory.content : JSON.stringify(memory.content);
      
      if (typeof query.content === 'string') {
        if (!contentText.includes(query.content)) return false;
      } else if (typeof query.content === 'object') {
        // Deep content matching
        if (!this.deepMatch(memory.content, query.content)) return false;
      }
    }

    // Metadata matching
    if (query.metadata) {
      if (!this.deepMatch(memory.metadata || {}, query.metadata)) return false;
    }

    // Relevance score filtering - use importance
    if (query.minRelevance && ((memory.metadata?.importance as number) || 0) < query.minRelevance) return false;
    if (query.maxRelevance && ((memory.metadata?.importance as number) || 0) > query.maxRelevance) return false;

    return true;
  }

  /**
   * Deep match objects
   */
  private deepMatch(obj: any, pattern: any): boolean {
    if (typeof pattern !== 'object' || pattern === null) {
      return obj === pattern;
    }

    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in pattern) {
      if (!(key in obj)) {
        return false;
      }

      if (!this.deepMatch(obj[key], pattern[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Aggregate results using union
   */
  private aggregateUnion(results: MemoryItem[]): MemoryItem[] {
    const uniqueResults = new Map<string, MemoryItem>();

    for (const result of results) {
      // Use ID as key for deduplication
      if (!uniqueResults.has(result.id)) {
        uniqueResults.set(result.id, result);
      }
    }

    return Array.from(uniqueResults.values());
  }

  /**
   * Aggregate results using intersection
   */
  private aggregateIntersection(results: Map<string, MemoryItem[]>): MemoryItem[] {
    if (results.size === 0) {
      return [];
    }

    const agentResults = Array.from(results.values());
    if (agentResults.length === 1) {
      return agentResults[0];
    }

    // Find memories that appear in all agent results
    const firstAgentResults = agentResults[0];
    const intersection: MemoryItem[] = [];

    for (const memory of firstAgentResults) {
      let foundInAll = true;
      
      for (let i = 1; i < agentResults.length; i++) {
        const found = agentResults[i].some(m => m.id === memory.id);
        if (!found) {
          foundInAll = false;
          break;
        }
      }

      if (foundInAll) {
        intersection.push(memory);
      }
    }

    return intersection;
  }

  /**
   * Aggregate results using weighted scoring
   */
  private aggregateWeighted(results: Map<string, MemoryItem[]>): MemoryItem[] {
    const weightedResults = new Map<string, MemoryItem>();
    const agentCount = results.size;

    // Calculate weight per agent (equal weighting for now)
    const agentWeight = 1.0 / agentCount;

    for (const [agentId, agentResults] of results) {
      for (const result of agentResults) {
        const key = result.id;
        
        if (weightedResults.has(key)) {
          const existing = weightedResults.get(key)!;
          existing.metadata = {
            ...existing.metadata,
            importance: ((existing.metadata?.importance as number) || 0) + 
              ((result.metadata?.importance as number) || 0) * agentWeight
          };
        } else {
          weightedResults.set(key, {
            ...result,
            metadata: {
              ...result.metadata,
              importance: ((result.metadata?.importance as number) || 0) * agentWeight
            }
          });
        }
      }
    }

    // Sort by weighted relevance score - use importance
    const sortedResults = Array.from(weightedResults.values())
      .sort((a, b) => ((b.metadata?.importance as number) || 0) - ((a.metadata?.importance as number) || 0));

    return sortedResults;
  }

  /**
   * Add query to history
   */
  private addToHistory(agentId: string, query: CrossAgentQuery): void {
    if (!this.queryHistory.has(agentId)) {
      this.queryHistory.set(agentId, []);
    }

    const history = this.queryHistory.get(agentId)!;
    history.push(query);

    // Keep only last 100 queries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get query statistics
   */
  getQueryStats(): {
    totalQueries: number;
    queriesPerAgent: Map<string, number>;
    averageExecutionTime: number;
    successRate: number;
  } {
    let totalQueries = 0;
    const queriesPerAgent = new Map<string, number>();
    let totalExecutionTime = 0;
    let successfulQueries = 0;

    for (const [agentId, queries] of this.queryHistory) {
      queriesPerAgent.set(agentId, queries.length);
      totalQueries += queries.length;
      
      for (const query of queries) {
        // Note: We don't track execution time in the query object
        // This would need to be added to the CrossAgentQuery interface
      }
    }

    return {
      totalQueries,
      queriesPerAgent,
      averageExecutionTime: totalQueries > 0 ? totalExecutionTime / totalQueries : 0,
      successRate: totalQueries > 0 ? successfulQueries / totalQueries : 0
    };
  }

  /**
   * Clear query history
   */
  clearHistory(agentId?: string): void {
    if (agentId) {
      this.queryHistory.delete(agentId);
    } else {
      this.queryHistory.clear();
    }
  }
}