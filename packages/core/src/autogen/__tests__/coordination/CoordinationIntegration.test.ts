/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CoordinationIntegration, SessionIntegration } from '../../coordination/CoordinationIntegration';
import { ToolRegistry, ToolDefinition } from '../../coordination/ToolRegistry';
import { ContextManager } from '../../coordination/ContextManager';
import { GroupChatManager, GroupChatConfig } from '../../collaboration/GroupChatManager';
import { CollaborationPattern, ConversationMessage } from '../../types';
import { AgentParticipation, TurnTakingRules } from '../../collaboration/CollaborationPattern';

describe('CoordinationIntegration', () => {
  let integration: CoordinationIntegration;
  let toolRegistry: ToolRegistry;
  let contextManager: ContextManager;
  let groupChatManager: GroupChatManager;
  let mockTool: ToolDefinition;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    contextManager = new ContextManager();
    groupChatManager = new GroupChatManager();
    integration = new CoordinationIntegration(toolRegistry, contextManager, groupChatManager);

    mockTool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      version: '1.0.0',
      category: 'testing',
      permissionLevel: 'public',
      schema: {
        parameters: {
          input: {
            type: 'string',
            description: 'Input text',
            required: true
          }
        },
        returns: {
          type: 'string',
          description: 'Output text'
        }
      },
      execute: vi.fn().mockResolvedValue({
        success: true,
        result: 'processed output',
        executionTime: 100
      })
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Integration Management', () => {
    it('should create session integration', async () => {
      const sessionId = 'test-session-1';
      const sessionIntegration = await integration.createSessionIntegration(sessionId);

      expect(sessionIntegration).toBeInstanceOf(SessionIntegration);
      expect(integration.getSessionIntegration(sessionId)).toBe(sessionIntegration);
    });

    it('should emit session-integration-created event', async () => {
      const eventListener = vi.fn();
      integration.on('session-integration-created', eventListener);

      const sessionId = 'test-session-1';
      await integration.createSessionIntegration(sessionId);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId,
        timestamp: expect.any(Date)
      });
    });

    it('should remove session integration', async () => {
      const sessionId = 'test-session-1';
      const sessionIntegration = await integration.createSessionIntegration(sessionId);

      await integration.removeSessionIntegration(sessionId);

      expect(integration.getSessionIntegration(sessionId)).toBeUndefined();
    });

    it('should emit session-integration-removed event', async () => {
      const eventListener = vi.fn();
      integration.on('session-integration-removed', eventListener);

      const sessionId = 'test-session-1';
      await integration.createSessionIntegration(sessionId);
      await integration.removeSessionIntegration(sessionId);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId,
        timestamp: expect.any(Date)
      });
    });

    it('should get all active integrations', async () => {
      await integration.createSessionIntegration('session-1');
      await integration.createSessionIntegration('session-2');

      const activeIntegrations = integration.getActiveIntegrations();
      expect(activeIntegrations).toHaveLength(2);
    });

    it('should provide integration statistics', async () => {
      await integration.createSessionIntegration('session-1');
      await integration.createSessionIntegration('session-2');

      const stats = integration.getIntegrationStats();
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalToolExecutions).toBeGreaterThanOrEqual(0);
      expect(stats.totalContextItems).toBeGreaterThanOrEqual(0);
      expect(stats.averageSessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup all session integrations', async () => {
      await integration.createSessionIntegration('session-1');
      await integration.createSessionIntegration('session-2');

      await integration.cleanup();

      expect(integration.getActiveIntegrations()).toHaveLength(0);
    });
  });

  describe('Event Coordination', () => {
    it('should coordinate tool execution events', async () => {
      await toolRegistry.registerTool(mockTool);

      const eventListener = vi.fn();
      integration.on('tool-execution-coordinated', eventListener);

      await toolRegistry.executeTool('test-tool', {
        agentId: 'test-agent',
        timestamp: new Date(),
        parameters: { input: 'test' },
        environment: {}
      });

      expect(eventListener).toHaveBeenCalled();
    });

    it('should coordinate context management events', async () => {
      const eventListener = vi.fn();
      integration.on('context-coordination-updated', eventListener);

      await contextManager.addContext(
        'Test content',
        'fact',
        { agentId: 'test-agent' }
      );

      expect(eventListener).toHaveBeenCalled();
    });
  });
});

describe('SessionIntegration', () => {
  let sessionIntegration: SessionIntegration;
  let toolRegistry: ToolRegistry;
  let contextManager: ContextManager;
  let groupChatManager: GroupChatManager;
  let mockTool: ToolDefinition;

  beforeEach(async () => {
    toolRegistry = new ToolRegistry();
    contextManager = new ContextManager();
    groupChatManager = new GroupChatManager();

    mockTool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      version: '1.0.0',
      category: 'testing',
      permissionLevel: 'public',
      schema: {
        parameters: {
          input: {
            type: 'string',
            description: 'Input text',
            required: true
          }
        },
        returns: {
          type: 'string',
          description: 'Output text'
        }
      },
      execute: vi.fn().mockResolvedValue({
        success: true,
        result: 'processed output',
        executionTime: 100
      })
    };

    await toolRegistry.registerTool(mockTool);

    // Create a group chat session
    const participants: AgentParticipation[] = [
      {
        agentName: 'agent1',
        role: 'moderator',
        priority: 10,
        canInitiate: true,
        canInterrupt: true,
        maxConsecutiveTurns: 3
      },
      {
        agentName: 'agent2',
        role: 'participant',
        priority: 8,
        canInitiate: true,
        canInterrupt: false,
        maxConsecutiveTurns: 2
      }
    ];

    const rules: TurnTakingRules = {
      maxTurnsPerAgent: 3,
      allowConsecutiveTurns: false,
      prioritizeExpertise: true,
      interruptionPolicy: 'moderator-only',
      timeoutBetweenTurns: 5000,
      maxConversationTurns: 20
    };

    const config: GroupChatConfig = {
      id: 'test-session',
      name: 'Test Session',
      description: 'A test session',
      pattern: CollaborationPattern.SEQUENTIAL,
      participants,
      rules,
      settings: {
        autoArchive: false,
        maxParticipants: 10,
        allowSpectators: false,
        enableRecording: true,
        moderationLevel: 'basic'
      }
    };

    await groupChatManager.createGroupChat(config);

    sessionIntegration = new SessionIntegration(
      'test-session',
      toolRegistry,
      contextManager,
      groupChatManager
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Execution in Session', () => {
    it('should execute tool with session context', async () => {
      const result = await sessionIntegration.executeTool(
        'test-tool',
        'agent1',
        { input: 'test input' }
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('processed output');
      expect(mockTool.execute).toHaveBeenCalledWith({
        agentId: 'agent1',
        conversationId: 'test-session',
        sessionId: 'test-session',
        timestamp: expect.any(Date),
        parameters: { input: 'test input' },
        environment: {
          sessionType: 'group-chat',
          participantCount: 2,
          sessionDuration: expect.any(Number)
        }
      });
    });

    it('should emit tool-executed-in-session event', async () => {
      const eventListener = vi.fn();
      sessionIntegration.on('tool-executed-in-session', eventListener);

      await sessionIntegration.executeTool('test-tool', 'agent1', { input: 'test' });

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session',
        toolId: 'test-tool',
        agentId: 'agent1',
        result: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });

    it('should add tool execution to context', async () => {
      await sessionIntegration.executeTool('test-tool', 'agent1', { input: 'test' });

      const contexts = await sessionIntegration.querySessionContext('agent1', {
        types: ['metadata'],
        tags: ['tool-execution']
      });

      expect(contexts).toHaveLength(1);
      expect(contexts[0].content.toolId).toBe('test-tool');
      expect(contexts[0].content.agentId).toBe('agent1');
    });

    it('should handle tool execution errors', async () => {
      const failingTool = {
        ...mockTool,
        id: 'failing-tool',
        execute: vi.fn().mockRejectedValue(new Error('Tool failed'))
      };

      await toolRegistry.registerTool(failingTool);

      const eventListener = vi.fn();
      sessionIntegration.on('tool-execution-failed-in-session', eventListener);

      await expect(sessionIntegration.executeTool('failing-tool', 'agent1', { input: 'test' }))
        .rejects.toThrow('Tool failed');

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session',
        toolId: 'failing-tool',
        agentId: 'agent1',
        error: 'Tool failed',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Context Management in Session', () => {
    it('should add context to session', async () => {
      const contextId = await sessionIntegration.addContext(
        'Test content',
        'fact',
        'agent1',
        { relevance: 'high', tags: ['important'] }
      );

      expect(contextId).toBeDefined();

      const contexts = await sessionIntegration.querySessionContext('agent1', {
        types: ['fact']
      });

      expect(contexts).toHaveLength(1);
      expect(contexts[0].content).toBe('Test content');
      expect(contexts[0].tags).toContain('session');
      expect(contexts[0].tags).toContain('test-session');
      expect(contexts[0].tags).toContain('important');
    });

    it('should emit context-added-to-session event', async () => {
      const eventListener = vi.fn();
      sessionIntegration.on('context-added-to-session', eventListener);

      const contextId = await sessionIntegration.addContext('Test', 'fact', 'agent1');

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session',
        contextId,
        type: 'fact',
        agentId: 'agent1',
        timestamp: expect.any(Date)
      });
    });

    it('should query session context', async () => {
      await sessionIntegration.addContext('Fact 1', 'fact', 'agent1');
      await sessionIntegration.addContext('Decision 1', 'decision', 'agent1');

      const facts = await sessionIntegration.querySessionContext('agent1', {
        types: ['fact']
      });

      const decisions = await sessionIntegration.querySessionContext('agent1', {
        types: ['decision']
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].content).toBe('Fact 1');
      expect(decisions).toHaveLength(1);
      expect(decisions[0].content).toBe('Decision 1');
    });
  });

  describe('Available Tools in Session', () => {
    it('should get available tools for moderator', async () => {
      const adminTool = {
        ...mockTool,
        id: 'admin-tool',
        permissionLevel: 'admin' as const
      };

      await toolRegistry.registerTool(adminTool);

      const tools = sessionIntegration.getAvailableTools('admin-agent1'); // Need admin prefix for admin tools
      expect(tools).toHaveLength(2); // Both tools available to admin

      const moderatorTools = sessionIntegration.getAvailableTools('agent1'); // moderator
      expect(moderatorTools).toHaveLength(1); // Only public tool available to regular moderator
    });

    it('should get available tools for regular participant', async () => {
      const restrictedTool = {
        ...mockTool,
        id: 'restricted-tool',
        permissionLevel: 'restricted' as const,
        allowedAgents: ['agent1']
      };

      await toolRegistry.registerTool(restrictedTool);

      const tools = sessionIntegration.getAvailableTools('agent2'); // regular participant
      expect(tools).toHaveLength(1); // Only public tool available
      expect(tools[0].id).toBe('test-tool');
    });

    it('should return tools for non-participant (public tools still available)', async () => {
      const tools = sessionIntegration.getAvailableTools('non-participant');
      expect(tools).toHaveLength(1); // Public tools are still available
      expect(tools[0].permissionLevel).toBe('public');
    });
  });

  describe('Message Processing', () => {
    it('should process message and extract context', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'We decided to proceed with the plan. The data shows positive results.',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      const eventListener = vi.fn();
      sessionIntegration.on('message-processed-in-session', eventListener);

      await sessionIntegration.processMessage(message);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session',
        message,
        contextsExtracted: expect.any(Number),
        timestamp: expect.any(Date)
      });

      // Check that contexts were extracted
      const contexts = await sessionIntegration.querySessionContext('agent1', {});
      expect(contexts.length).toBeGreaterThan(0);
    });

    it('should extract decisions from messages', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'After careful consideration, we decided to implement the new feature.',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await sessionIntegration.processMessage(message);

      const decisions = await sessionIntegration.querySessionContext('agent1', {
        types: ['decision'],
        tags: ['extracted']
      });

      expect(decisions).toHaveLength(1);
      expect(decisions[0].content).toContain('decided');
    });

    it('should extract facts from messages', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'The research data indicates a 95% success rate.',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await sessionIntegration.processMessage(message);

      const facts = await sessionIntegration.querySessionContext('agent1', {
        types: ['fact'],
        tags: ['extracted']
      });

      expect(facts).toHaveLength(1);
      expect(facts[0].content).toContain('data');
    });

    it('should extract goals from messages', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Our goal is to achieve 100% test coverage by next month.',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await sessionIntegration.processMessage(message);

      const goals = await sessionIntegration.querySessionContext('agent1', {
        types: ['goal'],
        tags: ['extracted']
      });

      expect(goals).toHaveLength(1);
      expect(goals[0].content).toContain('goal');
    });
  });

  describe('Session Statistics and Summary', () => {
    it('should track session statistics', async () => {
      await sessionIntegration.executeTool('test-tool', 'agent1', { input: 'test' });
      await sessionIntegration.addContext('Test fact', 'fact', 'agent1');

      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Test message',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };
      await sessionIntegration.processMessage(message);

      const stats = sessionIntegration.getStats();
      expect(stats.toolExecutions).toBe(1);
      expect(stats.contextItems).toBeGreaterThanOrEqual(1);
      expect(stats.messagesProcessed).toBe(1);
      expect(stats.duration).toBeGreaterThan(0);
    });

    it('should generate session summary', async () => {
      await sessionIntegration.addContext('Important fact', 'fact', 'agent1');
      await sessionIntegration.addContext('Key decision', 'decision', 'agent1');
      await sessionIntegration.executeTool('test-tool', 'agent1', { input: 'test' });

      const summary = await sessionIntegration.getSessionSummary();

      expect(summary.sessionId).toBe('test-session');
      expect(summary.participantCount).toBe(2);
      expect(summary.toolExecutions).toBe(1);
      expect(summary.contextItems).toBeGreaterThanOrEqual(2);
      expect(summary.duration).toBeGreaterThan(0);
      expect(summary.keyInsights).toBeDefined();
      expect(summary.unresolvedIssues).toBeDefined();
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup session resources', async () => {
      await sessionIntegration.addContext('Test content', 'fact', 'agent1');

      const eventListener = vi.fn();
      sessionIntegration.on('session-integration-cleaned', eventListener);

      await sessionIntegration.cleanup();

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session',
        stats: expect.any(Object),
        timestamp: expect.any(Date)
      });

      // Context should be cleared
      const contexts = await sessionIntegration.querySessionContext('agent1', {});
      expect(contexts).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock context manager to throw error during cleanup
      const originalClearConversationContext = contextManager.clearConversationContext;
      contextManager.clearConversationContext = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(sessionIntegration.cleanup()).resolves.not.toThrow();

      // Restore original method
      contextManager.clearConversationContext = originalClearConversationContext;
    });
  });
});