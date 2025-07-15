/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContextManager, ContextItem, ContextQuery } from '../../coordination/ContextManager';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager({
      maxContextItems: 100,
      defaultLifespan: 60000, // 1 minute for tests
      enableCompression: false, // Disable for easier testing
      enableConflictDetection: true,
      autoCleanupInterval: 10000 // 10 seconds
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Context Storage and Retrieval', () => {
    it('should add context item successfully', async () => {
      const contextId = await contextManager.addContext(
        'This is a test fact',
        'fact',
        { agentId: 'test-agent' },
        {
          relevance: 'high',
          scope: 'conversation',
          tags: ['test', 'fact'],
          conversationId: 'conv-1'
        }
      );

      expect(contextId).toBeDefined();
      expect(contextId).toMatch(/^ctx_/);
    });

    it('should emit context-added event', async () => {
      const eventListener = vi.fn();
      contextManager.on('context-added', eventListener);

      const contextId = await contextManager.addContext(
        'Test content',
        'message',
        { agentId: 'test-agent' }
      );

      expect(eventListener).toHaveBeenCalledWith({
        contextId,
        type: 'message',
        agentId: 'test-agent',
        conversationId: undefined,
        relevance: 'medium'
      });
    });

    it('should query context items by type', async () => {
      await contextManager.addContext('Fact 1', 'fact', { agentId: 'agent-1' });
      await contextManager.addContext('Decision 1', 'decision', { agentId: 'agent-1' });
      await contextManager.addContext('Fact 2', 'fact', { agentId: 'agent-2' });

      const query: ContextQuery = {
        types: ['fact']
      };

      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(2);
      expect(results.every(item => item.type === 'fact')).toBe(true);
    });

    it('should query context items by agent', async () => {
      await contextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' });
      await contextManager.addContext('Content 2', 'fact', { agentId: 'agent-2' });
      await contextManager.addContext('Content 3', 'fact', { agentId: 'agent-1' });

      const query: ContextQuery = {
        agentId: 'agent-1'
      };

      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(2);
      expect(results.every(item => item.source.agentId === 'agent-1')).toBe(true);
    });

    it('should query context items by tags', async () => {
      await contextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' }, { tags: ['urgent', 'important'] });
      await contextManager.addContext('Content 2', 'fact', { agentId: 'agent-1' }, { tags: ['normal'] });
      await contextManager.addContext('Content 3', 'fact', { agentId: 'agent-1' }, { tags: ['urgent'] });

      const query: ContextQuery = {
        tags: ['urgent']
      };

      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(2);
      expect(results.every(item => item.tags.includes('urgent'))).toBe(true);
    });

    it('should query context items by conversation', async () => {
      await contextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' });
      await contextManager.addContext('Content 2', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-2' });
      await contextManager.addContext('Content 3', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' });

      const query: ContextQuery = {
        conversationId: 'conv-1'
      };

      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(2);
    });

    it('should apply query limits and sorting', async () => {
      // Add multiple items with different relevance
      await contextManager.addContext('Critical', 'fact', { agentId: 'agent-1' }, { relevance: 'critical' });
      await contextManager.addContext('High', 'fact', { agentId: 'agent-1' }, { relevance: 'high' });
      await contextManager.addContext('Medium', 'fact', { agentId: 'agent-1' }, { relevance: 'medium' });
      await contextManager.addContext('Low', 'fact', { agentId: 'agent-1' }, { relevance: 'low' });

      const query: ContextQuery = {
        limit: 2,
        sortBy: 'relevance',
        sortOrder: 'desc'
      };

      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(2);
      expect(results[0].relevance).toBe('critical');
      expect(results[1].relevance).toBe('high');
    });

    it('should cache query results', async () => {
      await contextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' });

      const query: ContextQuery = { types: ['fact'] };

      // First query
      const results1 = await contextManager.queryContext(query);
      
      // Second identical query should use cache
      const results2 = await contextManager.queryContext(query);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results1[0].id).toBe(results2[0].id);
    });
  });

  describe('Context Updates and Deletion', () => {
    let contextId: string;

    beforeEach(async () => {
      contextId = await contextManager.addContext(
        'Original content',
        'fact',
        { agentId: 'test-agent' },
        { relevance: 'medium', tags: ['original'] }
      );
    });

    it('should update context item', async () => {
      await contextManager.updateContext(
        contextId,
        {
          content: 'Updated content',
          relevance: 'high',
          tags: ['updated']
        },
        'test-agent'
      );

      const query: ContextQuery = { types: ['fact'] };
      const results = await contextManager.queryContext(query);
      
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Updated content');
      expect(results[0].relevance).toBe('high');
      expect(results[0].tags).toContain('updated');
      expect(results[0].metadata.version).toBe(2);
    });

    it('should emit context-updated event', async () => {
      const eventListener = vi.fn();
      contextManager.on('context-updated', eventListener);

      await contextManager.updateContext(
        contextId,
        { content: 'Updated content' },
        'test-agent'
      );

      expect(eventListener).toHaveBeenCalledWith({
        contextId,
        updates: { content: 'Updated content' },
        agentId: 'test-agent',
        version: 2
      });
    });

    it('should reject update from unauthorized agent', async () => {
      // Create context with private scope to test unauthorized access
      const privateContextId = await contextManager.addContext(
        'Private content',
        'fact',
        { agentId: 'original-agent' },
        { scope: 'private' }
      );

      await expect(contextManager.updateContext(
        privateContextId,
        { content: 'Updated content' },
        'unauthorized-agent'
      )).rejects.toThrow('does not have permission to update');
    });

    it('should delete context item', async () => {
      await contextManager.deleteContext(contextId, 'test-agent');

      const query: ContextQuery = { types: ['fact'] };
      const results = await contextManager.queryContext(query);
      
      expect(results).toHaveLength(0);
    });

    it('should emit context-deleted event', async () => {
      const eventListener = vi.fn();
      contextManager.on('context-deleted', eventListener);

      await contextManager.deleteContext(contextId, 'test-agent');

      expect(eventListener).toHaveBeenCalledWith({
        contextId,
        agentId: 'test-agent'
      });
    });

    it('should reject deletion of non-existent context', async () => {
      await expect(contextManager.deleteContext('non-existent', 'test-agent'))
        .rejects.toThrow('Context non-existent not found');
    });
  });

  describe('Context Summaries', () => {
    beforeEach(async () => {
      // Add various types of context
      await contextManager.addContext('Important fact', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' });
      await contextManager.addContext('We decided to proceed', 'decision', { agentId: 'agent-1' }, { conversationId: 'conv-1' });
      await contextManager.addContext('Our goal is to succeed', 'goal', { agentId: 'agent-2' }, { conversationId: 'conv-1' });
      await contextManager.addContext('We achieved the target', 'outcome', { agentId: 'agent-2' }, { conversationId: 'conv-1' });
      await contextManager.addContext('Regular message', 'message', { agentId: 'agent-3' }, { conversationId: 'conv-1' });
    });

    it('should generate conversation summary', async () => {
      const summary = await contextManager.generateContextSummary(
        { conversationId: 'conv-1' },
        { maxItems: 10 }
      );

      expect(summary.contextSize).toBe(5);
      expect(summary.participants).toContain('agent-1');
      expect(summary.participants).toContain('agent-2');
      expect(summary.participants).toContain('agent-3');
      expect(summary.keyFacts).toContain('Important fact');
      expect(summary.decisions).toContain('We decided to proceed');
      expect(summary.goals).toContain('Our goal is to succeed');
      expect(summary.outcomes).toContain('We achieved the target');
    });

    it('should identify unresolved issues', async () => {
      // Add a goal without corresponding outcome
      await contextManager.addContext('Unresolved goal', 'goal', { agentId: 'agent-1' }, { conversationId: 'conv-2' });

      const summary = await contextManager.generateContextSummary(
        { conversationId: 'conv-2' }
      );

      expect(summary.unresolvedIssues).toContain('Unresolved goal');
    });

    it('should calculate average relevance', async () => {
      const summary = await contextManager.generateContextSummary(
        { conversationId: 'conv-1' }
      );

      expect(summary.averageRelevance).toBeGreaterThan(0);
      expect(summary.averageRelevance).toBeLessThanOrEqual(5);
    });
  });

  describe('Synchronization Points', () => {
    it('should create sync point', async () => {
      await contextManager.addContext('Test content', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' });

      const syncId = await contextManager.createSyncPoint(
        'test-trigger',
        ['agent-1', 'agent-2'],
        'conv-1'
      );

      expect(syncId).toBeDefined();
      expect(syncId).toMatch(/^sync_/);
    });

    it('should emit sync-point-created event', async () => {
      const eventListener = vi.fn();
      contextManager.on('sync-point-created', eventListener);

      await contextManager.addContext('Test content', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' });

      const syncId = await contextManager.createSyncPoint(
        'test-trigger',
        ['agent-1'],
        'conv-1'
      );

      expect(eventListener).toHaveBeenCalledWith({
        syncId,
        triggeredBy: 'test-trigger',
        participants: ['agent-1'],
        conversationId: 'conv-1',
        contextCount: 1
      });
    });
  });

  describe('Context Statistics', () => {
    beforeEach(async () => {
      await contextManager.addContext('Fact 1', 'fact', { agentId: 'agent-1' }, { relevance: 'high' });
      await contextManager.addContext('Decision 1', 'decision', { agentId: 'agent-2' }, { relevance: 'critical' });
      await contextManager.addContext('Message 1', 'message', { agentId: 'agent-1' }, { relevance: 'medium' });
    });

    it('should provide context statistics', () => {
      const stats = contextManager.getContextStats();

      expect(stats.totalContexts).toBe(3);
      expect(stats.byType.fact).toBe(1);
      expect(stats.byType.decision).toBe(1);
      expect(stats.byType.message).toBe(1);
      expect(stats.byRelevance.high).toBe(1);
      expect(stats.byRelevance.critical).toBe(1);
      expect(stats.byRelevance.medium).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.oldestContext).toBeDefined();
      expect(stats.newestContext).toBeDefined();
    });
  });

  describe('Conversation Context Management', () => {
    let contextIds: string[];

    beforeEach(async () => {
      contextIds = [];
      contextIds.push(await contextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' }, { conversationId: 'conv-1' }));
      contextIds.push(await contextManager.addContext('Content 2', 'decision', { agentId: 'agent-1' }, { conversationId: 'conv-1' }));
      contextIds.push(await contextManager.addContext('Content 3', 'goal', { agentId: 'agent-1' }, { conversationId: 'conv-1' }));
    });

    it('should clear all context for a conversation', async () => {
      const eventListener = vi.fn();
      contextManager.on('conversation-context-cleared', eventListener);

      await contextManager.clearConversationContext('conv-1', 'agent-1');

      expect(eventListener).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        agentId: 'agent-1',
        deletedCount: 3
      });

      const query: ContextQuery = { conversationId: 'conv-1' };
      const results = await contextManager.queryContext(query);
      expect(results).toHaveLength(0);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect duplicate content', async () => {
      const eventListener = vi.fn();
      contextManager.on('context-conflicts-detected', eventListener);

      await contextManager.addContext('Exact duplicate content for testing', 'fact', { agentId: 'agent-1' });
      await contextManager.addContext('Exact duplicate content for testing', 'fact', { agentId: 'agent-2' });

      expect(eventListener).toHaveBeenCalled();
      const conflicts = eventListener.mock.calls[0][0].conflicts;
      expect(conflicts.some((c: any) => c.type === 'duplicate')).toBe(true);
    });

    it('should detect contradictions', async () => {
      const eventListener = vi.fn();
      contextManager.on('context-conflicts-detected', eventListener);

      const contextId1 = await contextManager.addContext('Fact A', 'fact', { agentId: 'agent-1' });
      await contextManager.addContext('Fact B', 'fact', { agentId: 'agent-2' }, {
        relationships: { contradicts: [contextId1] }
      });

      expect(eventListener).toHaveBeenCalled();
      const conflicts = eventListener.mock.calls[0][0].conflicts;
      expect(conflicts.some((c: any) => c.type === 'contradiction')).toBe(true);
    });
  });

  describe('Cleanup and Performance', () => {
    it('should perform cleanup when storage limit exceeded', async () => {
      const smallContextManager = new ContextManager({
        maxContextItems: 3,
        defaultLifespan: 60000
      });

      const eventListener = vi.fn();
      smallContextManager.on('cleanup-performed', eventListener);

      // Add more items than the limit
      await smallContextManager.addContext('Content 1', 'fact', { agentId: 'agent-1' });
      await smallContextManager.addContext('Content 2', 'fact', { agentId: 'agent-1' });
      await smallContextManager.addContext('Content 3', 'fact', { agentId: 'agent-1' });
      await smallContextManager.addContext('Content 4', 'fact', { agentId: 'agent-1' }); // Should trigger cleanup

      expect(eventListener).toHaveBeenCalled();
      const cleanupEvent = eventListener.mock.calls[0][0];
      expect(cleanupEvent.deletedCount).toBeGreaterThan(0);
    });

    it('should handle expired contexts', async () => {
      vi.useFakeTimers();

      const contextId = await contextManager.addContext(
        'Expiring content',
        'fact',
        { agentId: 'agent-1' },
        { lifespan: 1000 } // 1 second
      );

      // Fast forward past expiration
      vi.advanceTimersByTime(2000);

      // Force cleanup by exceeding storage limit
      const smallContextManager = new ContextManager({
        maxContextItems: 1,
        defaultLifespan: 60000
      });
      
      // Add content to small manager to trigger cleanup
      await smallContextManager.addContext(
        'Expiring content',
        'fact',
        { agentId: 'agent-1' },
        { lifespan: 1000 }
      );
      
      vi.advanceTimersByTime(2000);
      
      await smallContextManager.addContext('New content', 'fact', { agentId: 'agent-1' });

      const query: ContextQuery = { types: ['fact'] };
      const results = await smallContextManager.queryContext(query);
      
      // Should only have the new content, expired one should be removed
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('New content');

      vi.useRealTimers();
    });

    it('should update access tracking', async () => {
      const contextId = await contextManager.addContext('Content', 'fact', { agentId: 'agent-1' });

      // Query multiple times - note that cache might prevent multiple access counts
      const query: ContextQuery = { types: ['fact'] };
      
      // Clear cache to ensure each query hits the context
      (contextManager as any).queryCache.clear();
      await contextManager.queryContext(query);
      
      (contextManager as any).queryCache.clear();
      await contextManager.queryContext(query);
      
      (contextManager as any).queryCache.clear();
      await contextManager.queryContext(query);

      (contextManager as any).queryCache.clear();
      const results = await contextManager.queryContext(query);
      expect(results[0].metadata.accessCount).toBe(4); // 3 previous + 1 current
    });
  });
});