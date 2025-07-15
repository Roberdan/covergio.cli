/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ConversationMessage } from '../types';
import { AutoGenError } from '../types';

/**
 * Context item types
 */
export type ContextItemType = 
  | 'message' 
  | 'decision' 
  | 'fact' 
  | 'assumption' 
  | 'goal' 
  | 'constraint' 
  | 'resource' 
  | 'outcome'
  | 'metadata';

/**
 * Context relevance levels
 */
export type ContextRelevance = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

/**
 * Context scope - who can access this context
 */
export type ContextScope = 'global' | 'conversation' | 'agent-pair' | 'private';

/**
 * Context item in the shared knowledge base
 */
export interface ContextItem {
  id: string;
  type: ContextItemType;
  content: any;
  source: {
    agentId: string;
    messageId?: string;
    timestamp: Date;
  };
  relevance: ContextRelevance;
  scope: ContextScope;
  tags: string[];
  relationships: {
    relatedTo: string[];
    contradicts: string[];
    supports: string[];
    dependsOn: string[];
  };
  metadata: {
    confidence: number; // 0-1 scale
    lifespan?: number; // milliseconds, undefined = permanent
    accessCount: number;
    lastAccessed: Date;
    version: number;
  };
  expiresAt?: Date;
}

/**
 * Context query interface
 */
export interface ContextQuery {
  types?: ContextItemType[];
  relevance?: ContextRelevance[];
  scope?: ContextScope;
  agentId?: string;
  conversationId?: string;
  tags?: string[];
  timeRange?: {
    from: Date;
    to: Date;
  };
  content?: {
    keywords: string[];
    similarity?: string; // For semantic search
  };
  limit?: number;
  sortBy?: 'relevance' | 'timestamp' | 'confidence' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Context summary for different time periods
 */
export interface ContextSummary {
  period: string;
  keyFacts: string[];
  decisions: string[];
  goals: string[];
  outcomes: string[];
  participants: string[];
  topicEvolution: string[];
  unresolvedIssues: string[];
  contextSize: number;
  averageRelevance: number;
}

/**
 * Context conflict detection
 */
export interface ContextConflict {
  type: 'contradiction' | 'inconsistency' | 'outdated' | 'duplicate';
  items: string[]; // Context item IDs
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedResolution: string;
  detectedAt: Date;
}

/**
 * Context synchronization point
 */
export interface ContextSyncPoint {
  id: string;
  timestamp: Date;
  triggerEvent: string;
  snapshot: Record<string, any>;
  participants: string[];
  checksum: string;
}

/**
 * Context access control
 */
interface ContextAccessControl {
  agentId: string;
  permissions: {
    read: boolean;
    write: boolean;
    delete: boolean;
    modify: boolean;
  };
  scope: ContextScope[];
  expiresAt?: Date;
}

/**
 * Context manager for maintaining shared knowledge across conversation participants
 */
export class ContextManager extends EventEmitter {
  private contexts: Map<string, ContextItem> = new Map();
  private accessControls: Map<string, ContextAccessControl> = new Map();
  private syncPoints: Map<string, ContextSyncPoint> = new Map();
  private contextRelationships: Map<string, Set<string>> = new Map();
  private conversationContexts: Map<string, Set<string>> = new Map(); // conversationId -> contextItemIds
  
  // Performance optimization
  private indexByType: Map<ContextItemType, Set<string>> = new Map();
  private indexByAgent: Map<string, Set<string>> = new Map();
  private indexByTags: Map<string, Set<string>> = new Map();
  private indexByRelevance: Map<ContextRelevance, Set<string>> = new Map();
  
  // Cache for frequent queries
  private queryCache: Map<string, { result: ContextItem[]; timestamp: Date }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    private options: {
      maxContextItems?: number;
      defaultLifespan?: number;
      enableCompression?: boolean;
      enableConflictDetection?: boolean;
      autoCleanupInterval?: number;
    } = {}
  ) {
    super();
    
    this.options = {
      maxContextItems: 10000,
      defaultLifespan: 24 * 60 * 60 * 1000, // 24 hours
      enableCompression: true,
      enableConflictDetection: true,
      autoCleanupInterval: 60 * 60 * 1000, // 1 hour
      ...options
    };

    this.initializeIndexes();
    this.startPeriodicTasks();
  }

  /**
   * Add context item to shared knowledge
   */
  async addContext(
    content: any,
    type: ContextItemType,
    source: { agentId: string; messageId?: string },
    options: {
      relevance?: ContextRelevance;
      scope?: ContextScope;
      tags?: string[];
      conversationId?: string;
      confidence?: number;
      lifespan?: number;
      relationships?: Partial<ContextItem['relationships']>;
    } = {}
  ): Promise<string> {
    try {
      // Check permissions
      if (!this.hasWritePermission(source.agentId, options.scope || 'conversation')) {
        throw new Error(`Agent ${source.agentId} does not have write permission for scope ${options.scope}`);
      }

      // Check storage limits
      if (this.contexts.size >= this.options.maxContextItems!) {
        await this.performCleanup();
      }

      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const contextItem: ContextItem = {
        id: contextId,
        type,
        content: this.options.enableCompression ? this.compressContent(content) : content,
        source: {
          agentId: source.agentId,
          messageId: source.messageId,
          timestamp: now
        },
        relevance: options.relevance || 'medium',
        scope: options.scope || 'conversation',
        tags: options.tags || [],
        relationships: {
          relatedTo: [],
          contradicts: [],
          supports: [],
          dependsOn: [],
          ...options.relationships
        },
        metadata: {
          confidence: options.confidence || 0.8,
          lifespan: options.lifespan || this.options.defaultLifespan,
          accessCount: 0,
          lastAccessed: now,
          version: 1
        },
        expiresAt: options.lifespan ? new Date(now.getTime() + options.lifespan) : undefined
      };

      // Store context
      this.contexts.set(contextId, contextItem);

      // Update indexes
      this.updateIndexes(contextItem, 'add');

      // Associate with conversation
      if (options.conversationId) {
        this.associateWithConversation(contextId, options.conversationId);
      }

      // Detect conflicts if enabled
      if (this.options.enableConflictDetection) {
        const conflicts = await this.detectConflicts(contextItem);
        if (conflicts.length > 0) {
          this.emit('context-conflicts-detected', { contextId, conflicts });
        }
      }

      // Clear query cache
      this.queryCache.clear();

      this.emit('context-added', {
        contextId,
        type,
        agentId: source.agentId,
        conversationId: options.conversationId,
        relevance: contextItem.relevance
      });

      return contextId;

    } catch (error) {
      throw new AutoGenError(
        `Failed to add context: ${error.message}`,
        'CONTEXT_ADD_ERROR',
        { content, type, source, options, error }
      );
    }
  }

  /**
   * Query context items based on criteria
   */
  async queryContext(query: ContextQuery): Promise<ContextItem[]> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
        return cached.result;
      }

      let candidateIds = new Set<string>(this.contexts.keys());

      // Apply filters using indexes for performance
      if (query.types) {
        candidateIds = this.intersectSets(candidateIds, 
          this.unionSets(...query.types.map(type => this.indexByType.get(type) || new Set()))
        );
      }

      if (query.agentId) {
        candidateIds = this.intersectSets(candidateIds, 
          this.indexByAgent.get(query.agentId) || new Set()
        );
      }

      if (query.relevance) {
        candidateIds = this.intersectSets(candidateIds,
          this.unionSets(...query.relevance.map(rel => this.indexByRelevance.get(rel) || new Set()))
        );
      }

      if (query.tags) {
        candidateIds = this.intersectSets(candidateIds,
          this.unionSets(...query.tags.map(tag => this.indexByTags.get(tag) || new Set()))
        );
      }

      // Filter candidates
      let results: ContextItem[] = [];
      
      for (const contextId of candidateIds) {
        const item = this.contexts.get(contextId);
        if (!item) continue;

        // Check access permissions
        if (query.agentId && !this.hasReadPermission(query.agentId, item.scope)) {
          continue;
        }

        // Apply additional filters
        if (query.scope && item.scope !== query.scope) continue;
        
        if (query.conversationId) {
          const conversationContexts = this.conversationContexts.get(query.conversationId);
          if (!conversationContexts?.has(contextId)) continue;
        }

        if (query.timeRange) {
          const itemTime = item.source.timestamp.getTime();
          if (itemTime < query.timeRange.from.getTime() || 
              itemTime > query.timeRange.to.getTime()) {
            continue;
          }
        }

        if (query.content?.keywords) {
          const contentText = this.extractTextFromContent(item.content);
          const hasKeywords = query.content.keywords.some(keyword =>
            contentText.toLowerCase().includes(keyword.toLowerCase())
          );
          if (!hasKeywords) continue;
        }

        // Update access tracking
        item.metadata.accessCount++;
        item.metadata.lastAccessed = new Date();

        results.push(item);
      }

      // Apply sorting
      if (query.sortBy) {
        results = this.sortResults(results, query.sortBy, query.sortOrder || 'desc');
      }

      // Apply limit
      if (query.limit) {
        results = results.slice(0, query.limit);
      }

      // Cache result
      this.queryCache.set(cacheKey, {
        result: results,
        timestamp: new Date()
      });

      return results;

    } catch (error) {
      throw new AutoGenError(
        `Failed to query context: ${error.message}`,
        'CONTEXT_QUERY_ERROR',
        { query, error }
      );
    }
  }

  /**
   * Update existing context item
   */
  async updateContext(
    contextId: string,
    updates: {
      content?: any;
      relevance?: ContextRelevance;
      tags?: string[];
      confidence?: number;
      relationships?: Partial<ContextItem['relationships']>;
    },
    agentId: string
  ): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    // Check permissions - allow updates by original agent or agents with write permission
    if (context.source.agentId !== agentId && !this.hasWritePermission(agentId, context.scope)) {
      throw new Error(`Agent ${agentId} does not have permission to update context ${contextId}`);
    }

    // Remove from old indexes
    this.updateIndexes(context, 'remove');

    // Apply updates
    if (updates.content !== undefined) {
      context.content = this.options.enableCompression ? 
        this.compressContent(updates.content) : updates.content;
    }
    if (updates.relevance) context.relevance = updates.relevance;
    if (updates.tags) context.tags = updates.tags;
    if (updates.confidence !== undefined) context.metadata.confidence = updates.confidence;
    if (updates.relationships) {
      context.relationships = { ...context.relationships, ...updates.relationships };
    }

    // Update version and timestamp
    context.metadata.version++;
    context.metadata.lastAccessed = new Date();

    // Add to new indexes
    this.updateIndexes(context, 'add');

    // Clear cache
    this.queryCache.clear();

    this.emit('context-updated', {
      contextId,
      updates,
      agentId,
      version: context.metadata.version
    });
  }

  /**
   * Delete context item
   */
  async deleteContext(contextId: string, agentId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    // Check permissions
    if (!this.hasDeletePermission(agentId, context.scope)) {
      throw new Error(`Agent ${agentId} does not have permission to delete context ${contextId}`);
    }

    // Remove from indexes
    this.updateIndexes(context, 'remove');

    // Remove from conversations
    for (const [conversationId, contextIds] of this.conversationContexts) {
      contextIds.delete(contextId);
    }

    // Remove relationships
    this.contextRelationships.delete(contextId);
    for (const [, relatedIds] of this.contextRelationships) {
      relatedIds.delete(contextId);
    }

    // Delete context
    this.contexts.delete(contextId);

    // Clear cache
    this.queryCache.clear();

    this.emit('context-deleted', { contextId, agentId });
  }

  /**
   * Generate context summary for a conversation or time period
   */
  async generateContextSummary(
    criteria: {
      conversationId?: string;
      agentId?: string;
      timeRange?: { from: Date; to: Date };
      scope?: ContextScope;
    },
    options: {
      maxItems?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<ContextSummary> {
    const query: ContextQuery = {
      ...criteria,
      limit: options.maxItems || 100,
      sortBy: 'relevance'
    };

    const contexts = await this.queryContext(query);
    
    const summary: ContextSummary = {
      period: criteria.timeRange ? 
        `${criteria.timeRange.from.toISOString()} to ${criteria.timeRange.to.toISOString()}` :
        'All time',
      keyFacts: [],
      decisions: [],
      goals: [],
      outcomes: [],
      participants: [],
      topicEvolution: [],
      unresolvedIssues: [],
      contextSize: contexts.length,
      averageRelevance: 0
    };

    const relevanceValues: Record<ContextRelevance, number> = {
      critical: 5, high: 4, medium: 3, low: 2, minimal: 1
    };

    let totalRelevance = 0;
    const participants = new Set<string>();

    for (const context of contexts) {
      participants.add(context.source.agentId);
      totalRelevance += relevanceValues[context.relevance];

      switch (context.type) {
        case 'fact':
          summary.keyFacts.push(this.extractTextFromContent(context.content));
          break;
        case 'decision':
          summary.decisions.push(this.extractTextFromContent(context.content));
          break;
        case 'goal':
          summary.goals.push(this.extractTextFromContent(context.content));
          break;
        case 'outcome':
          summary.outcomes.push(this.extractTextFromContent(context.content));
          break;
      }
    }

    summary.participants = Array.from(participants);
    summary.averageRelevance = contexts.length > 0 ? totalRelevance / contexts.length : 0;

    // Identify unresolved issues (goals without corresponding outcomes)
    for (const goal of summary.goals) {
      const hasOutcome = summary.outcomes.some(outcome => 
        this.calculateContentSimilarity(goal, outcome) > 0.5
      );
      if (!hasOutcome) {
        summary.unresolvedIssues.push(goal);
      }
    }

    return summary;
  }

  /**
   * Create context synchronization point
   */
  async createSyncPoint(
    triggeredBy: string,
    participants: string[],
    conversationId?: string
  ): Promise<string> {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create snapshot of relevant context
    const snapshot: Record<string, any> = {};
    
    if (conversationId) {
      const contextIds = this.conversationContexts.get(conversationId) || new Set();
      for (const contextId of contextIds) {
        const context = this.contexts.get(contextId);
        if (context) {
          snapshot[contextId] = {
            content: context.content,
            relevance: context.relevance,
            metadata: context.metadata
          };
        }
      }
    }

    const syncPoint: ContextSyncPoint = {
      id: syncId,
      timestamp: new Date(),
      triggerEvent: triggeredBy,
      snapshot,
      participants,
      checksum: this.calculateChecksum(snapshot)
    };

    this.syncPoints.set(syncId, syncPoint);

    this.emit('sync-point-created', {
      syncId,
      triggeredBy,
      participants,
      conversationId,
      contextCount: Object.keys(snapshot).length
    });

    return syncId;
  }

  /**
   * Get context statistics
   */
  getContextStats(): {
    totalContexts: number;
    byType: Record<ContextItemType, number>;
    byRelevance: Record<ContextRelevance, number>;
    byScope: Record<ContextScope, number>;
    averageConfidence: number;
    oldestContext: Date | null;
    newestContext: Date | null;
    activeConversations: number;
    totalSyncPoints: number;
  } {
    const stats = {
      totalContexts: this.contexts.size,
      byType: {} as Record<ContextItemType, number>,
      byRelevance: {} as Record<ContextRelevance, number>,
      byScope: {} as Record<ContextScope, number>,
      averageConfidence: 0,
      oldestContext: null as Date | null,
      newestContext: null as Date | null,
      activeConversations: this.conversationContexts.size,
      totalSyncPoints: this.syncPoints.size
    };

    let totalConfidence = 0;
    let oldestTime = Number.MAX_SAFE_INTEGER;
    let newestTime = 0;

    for (const context of this.contexts.values()) {
      // Type stats
      stats.byType[context.type] = (stats.byType[context.type] || 0) + 1;
      
      // Relevance stats
      stats.byRelevance[context.relevance] = (stats.byRelevance[context.relevance] || 0) + 1;
      
      // Scope stats
      stats.byScope[context.scope] = (stats.byScope[context.scope] || 0) + 1;
      
      // Confidence
      totalConfidence += context.metadata.confidence;
      
      // Time tracking
      const contextTime = context.source.timestamp.getTime();
      if (contextTime < oldestTime) {
        oldestTime = contextTime;
        stats.oldestContext = context.source.timestamp;
      }
      if (contextTime > newestTime) {
        newestTime = contextTime;
        stats.newestContext = context.source.timestamp;
      }
    }

    stats.averageConfidence = this.contexts.size > 0 ? totalConfidence / this.contexts.size : 0;

    return stats;
  }

  /**
   * Clear all context for a conversation
   */
  async clearConversationContext(conversationId: string, agentId: string): Promise<void> {
    const contextIds = this.conversationContexts.get(conversationId);
    if (!contextIds) return;

    const deletedContexts: string[] = [];

    for (const contextId of contextIds) {
      try {
        await this.deleteContext(contextId, agentId);
        deletedContexts.push(contextId);
      } catch (error) {
        // Log error but continue with other contexts
        console.warn(`Failed to delete context ${contextId}:`, error.message);
      }
    }

    this.conversationContexts.delete(conversationId);

    this.emit('conversation-context-cleared', {
      conversationId,
      agentId,
      deletedCount: deletedContexts.length
    });
  }

  /**
   * Private helper methods
   */

  private initializeIndexes(): void {
    // Initialize type indexes
    const types: ContextItemType[] = [
      'message', 'decision', 'fact', 'assumption', 'goal', 
      'constraint', 'resource', 'outcome', 'metadata'
    ];
    types.forEach(type => this.indexByType.set(type, new Set()));

    // Initialize relevance indexes
    const relevanceLevels: ContextRelevance[] = ['critical', 'high', 'medium', 'low', 'minimal'];
    relevanceLevels.forEach(level => this.indexByRelevance.set(level, new Set()));
  }

  private updateIndexes(context: ContextItem, operation: 'add' | 'remove'): void {
    const { id } = context;

    if (operation === 'add') {
      // Type index
      this.indexByType.get(context.type)?.add(id);
      
      // Agent index
      if (!this.indexByAgent.has(context.source.agentId)) {
        this.indexByAgent.set(context.source.agentId, new Set());
      }
      this.indexByAgent.get(context.source.agentId)?.add(id);
      
      // Tags index
      context.tags.forEach(tag => {
        if (!this.indexByTags.has(tag)) {
          this.indexByTags.set(tag, new Set());
        }
        this.indexByTags.get(tag)?.add(id);
      });
      
      // Relevance index
      this.indexByRelevance.get(context.relevance)?.add(id);
    } else {
      // Remove from all indexes
      this.indexByType.get(context.type)?.delete(id);
      this.indexByAgent.get(context.source.agentId)?.delete(id);
      context.tags.forEach(tag => this.indexByTags.get(tag)?.delete(id));
      this.indexByRelevance.get(context.relevance)?.delete(id);
    }
  }

  private associateWithConversation(contextId: string, conversationId: string): void {
    if (!this.conversationContexts.has(conversationId)) {
      this.conversationContexts.set(conversationId, new Set());
    }
    this.conversationContexts.get(conversationId)!.add(contextId);
  }

  private hasReadPermission(agentId: string, scope: ContextScope): boolean {
    const acl = this.accessControls.get(agentId);
    
    if (!acl) {
      // Default permissions - allow reading global and conversation scope
      return scope === 'global' || scope === 'conversation';
    }

    return acl.permissions.read && acl.scope.includes(scope);
  }

  private hasWritePermission(agentId: string, scope: ContextScope): boolean {
    const acl = this.accessControls.get(agentId);
    
    if (!acl) {
      // Default permissions - allow conversation scope for same agent or any agent for now
      return scope === 'conversation' || scope === 'global';
    }

    return acl.permissions.write && acl.scope.includes(scope);
  }

  private hasDeletePermission(agentId: string, scope: ContextScope): boolean {
    const acl = this.accessControls.get(agentId);
    
    if (!acl) {
      // Default permissions - allow deletion of conversation and private scope
      return scope === 'conversation' || scope === 'private';
    }

    return acl.permissions.delete && acl.scope.includes(scope);
  }

  private compressContent(content: any): any {
    // Simple compression for now - could implement more sophisticated compression
    if (typeof content === 'string' && content.length > 1000) {
      // Implement text compression here
      return content;
    }
    return content;
  }

  private extractTextFromContent(content: any): string {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') return JSON.stringify(content);
    return String(content);
  }

  private generateCacheKey(query: ContextQuery): string {
    return JSON.stringify(query);
  }

  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1].filter(x => set2.has(x)));
  }

  private unionSets<T>(...sets: Set<T>[]): Set<T> {
    const result = new Set<T>();
    sets.forEach(set => set.forEach(item => result.add(item)));
    return result;
  }

  private sortResults(
    results: ContextItem[],
    sortBy: 'relevance' | 'timestamp' | 'confidence' | 'accessCount',
    order: 'asc' | 'desc'
  ): ContextItem[] {
    const relevanceValues: Record<ContextRelevance, number> = {
      critical: 5, high: 4, medium: 3, low: 2, minimal: 1
    };

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = relevanceValues[a.relevance] - relevanceValues[b.relevance];
          break;
        case 'timestamp':
          comparison = a.source.timestamp.getTime() - b.source.timestamp.getTime();
          break;
        case 'confidence':
          comparison = a.metadata.confidence - b.metadata.confidence;
          break;
        case 'accessCount':
          comparison = a.metadata.accessCount - b.metadata.accessCount;
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple similarity calculation - could be improved with more sophisticated algorithms
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = new Set([...words1, ...words2]);
    
    return intersection.length / union.size;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private async detectConflicts(newContext: ContextItem): Promise<ContextConflict[]> {
    const conflicts: ContextConflict[] = [];

    // Find potentially conflicting contexts
    const similarContexts = await this.queryContext({
      types: [newContext.type],
      tags: newContext.tags,
      limit: 10,
      sortBy: 'relevance'
    });

    for (const existingContext of similarContexts) {
      if (existingContext.id === newContext.id) continue;

      const contentSimilarity = this.calculateContentSimilarity(
        this.extractTextFromContent(newContext.content),
        this.extractTextFromContent(existingContext.content)
      );

      // Check for duplicates
      if (contentSimilarity > 0.8) {
        conflicts.push({
          type: 'duplicate',
          items: [newContext.id, existingContext.id],
          description: `Potential duplicate content detected`,
          severity: 'medium',
          suggestedResolution: 'Consider merging or removing duplicate content',
          detectedAt: new Date()
        });
      }

      // Check for contradictions
      if (newContext.relationships.contradicts.includes(existingContext.id) ||
          existingContext.relationships.contradicts.includes(newContext.id)) {
        conflicts.push({
          type: 'contradiction',
          items: [newContext.id, existingContext.id],
          description: `Contradictory information detected`,
          severity: 'high',
          suggestedResolution: 'Review and resolve contradictory information',
          detectedAt: new Date()
        });
      }
    }

    return conflicts;
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const itemsToDelete: string[] = [];

    // Find expired contexts
    for (const [contextId, context] of this.contexts) {
      if (context.expiresAt && context.expiresAt.getTime() < now) {
        itemsToDelete.push(contextId);
      }
    }

    // If still over limit, remove least accessed items
    if (this.contexts.size - itemsToDelete.length >= this.options.maxContextItems!) {
      const sortedByAccess = Array.from(this.contexts.values())
        .filter(context => !itemsToDelete.includes(context.id))
        .sort((a, b) => {
          // Sort by access count and last accessed time
          const accessDiff = a.metadata.accessCount - b.metadata.accessCount;
          if (accessDiff !== 0) return accessDiff;
          return a.metadata.lastAccessed.getTime() - b.metadata.lastAccessed.getTime();
        });

      const excessCount = this.contexts.size - this.options.maxContextItems! + 100; // Clean extra for buffer
      itemsToDelete.push(...sortedByAccess.slice(0, excessCount).map(c => c.id));
    }

    // Delete identified items
    for (const contextId of itemsToDelete) {
      const context = this.contexts.get(contextId);
      if (context) {
        this.updateIndexes(context, 'remove');
        this.contexts.delete(contextId);
      }
    }

    // Clear query cache
    this.queryCache.clear();

    this.emit('cleanup-performed', {
      deletedCount: itemsToDelete.length,
      remainingCount: this.contexts.size
    });
  }

  private startPeriodicTasks(): void {
    // Cleanup task
    if (this.options.autoCleanupInterval) {
      setInterval(() => {
        this.performCleanup();
      }, this.options.autoCleanupInterval);
    }

    // Cache cleanup
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.queryCache) {
        if (now - cached.timestamp.getTime() > this.cacheTimeout) {
          this.queryCache.delete(key);
        }
      }
    }, this.cacheTimeout);
  }
}