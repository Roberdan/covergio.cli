/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ToolRegistry, ToolDefinition, ToolExecutionContext, ToolExecutionResult } from './ToolRegistry';
import { ContextManager, ContextItem, ContextQuery } from './ContextManager';
import { GroupChatManager } from '../collaboration/GroupChatManager';
import { ConversationMessage } from '../types';
import { BaseCollaborationPattern } from '../collaboration/CollaborationPattern';

/**
 * Integration layer that coordinates tools and context across collaboration patterns
 */
export class CoordinationIntegration extends EventEmitter {
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private groupChatManager: GroupChatManager;
  private activeIntegrations: Map<string, SessionIntegration> = new Map();

  constructor(
    toolRegistry?: ToolRegistry,
    contextManager?: ContextManager,
    groupChatManager?: GroupChatManager
  ) {
    super();
    
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.contextManager = contextManager || new ContextManager();
    this.groupChatManager = groupChatManager || new GroupChatManager();

    this.setupEventHandlers();
  }

  /**
   * Create a session integration for a group chat
   */
  async createSessionIntegration(sessionId: string): Promise<SessionIntegration> {
    const integration = new SessionIntegration(
      sessionId,
      this.toolRegistry,
      this.contextManager,
      this.groupChatManager
    );

    this.activeIntegrations.set(sessionId, integration);

    this.emit('session-integration-created', {
      sessionId,
      timestamp: new Date()
    });

    return integration;
  }

  /**
   * Remove session integration
   */
  async removeSessionIntegration(sessionId: string): Promise<void> {
    const integration = this.activeIntegrations.get(sessionId);
    if (integration) {
      await integration.cleanup();
      this.activeIntegrations.delete(sessionId);

      this.emit('session-integration-removed', {
        sessionId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get session integration
   */
  getSessionIntegration(sessionId: string): SessionIntegration | undefined {
    return this.activeIntegrations.get(sessionId);
  }

  /**
   * Get all active session integrations
   */
  getActiveIntegrations(): SessionIntegration[] {
    return Array.from(this.activeIntegrations.values());
  }

  /**
   * Get integration statistics
   */
  getIntegrationStats(): {
    activeSessions: number;
    totalToolExecutions: number;
    totalContextItems: number;
    averageSessionDuration: number;
  } {
    const activeSessions = this.activeIntegrations.size;
    let totalToolExecutions = 0;
    let totalContextItems = 0;
    let totalDuration = 0;

    for (const integration of this.activeIntegrations.values()) {
      const stats = integration.getStats();
      totalToolExecutions += stats.toolExecutions;
      totalContextItems += stats.contextItems;
      totalDuration += stats.duration;
    }

    return {
      activeSessions,
      totalToolExecutions,
      totalContextItems,
      averageSessionDuration: activeSessions > 0 ? totalDuration / activeSessions : 0
    };
  }

  /**
   * Cleanup all session integrations
   */
  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.activeIntegrations.keys());
    await Promise.all(sessionIds.map(sessionId => this.removeSessionIntegration(sessionId)));
  }

  /**
   * Setup event handlers for coordination
   */
  private setupEventHandlers(): void {
    // Tool execution coordination
    this.toolRegistry.on('tool-executed', (event) => {
      this.emit('tool-execution-coordinated', event);
    });

    this.toolRegistry.on('tool-execution-failed', (event) => {
      this.emit('tool-execution-error', event);
    });

    // Context management coordination
    this.contextManager.on('context-added', (event) => {
      this.emit('context-coordination-updated', event);
    });

    this.contextManager.on('context-conflicts-detected', (event) => {
      this.emit('context-conflicts-coordinated', event);
    });

    // Group chat coordination
    this.groupChatManager.on('message-added', (event) => {
      this.handleMessageAdded(event);
    });

    this.groupChatManager.on('session-completed', (event) => {
      this.removeSessionIntegration(event.sessionId);
    });
  }

  /**
   * Handle message added to group chat
   */
  private async handleMessageAdded(event: { sessionId: string; message: ConversationMessage }): Promise<void> {
    const integration = this.activeIntegrations.get(event.sessionId);
    if (integration) {
      await integration.processMessage(event.message);
    }
  }
}

/**
 * Session-specific integration that manages tools and context for a single group chat
 */
export class SessionIntegration extends EventEmitter {
  private sessionId: string;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private groupChatManager: GroupChatManager;
  private createdAt: Date;
  private stats: {
    toolExecutions: number;
    contextItems: number;
    messagesProcessed: number;
  };

  constructor(
    sessionId: string,
    toolRegistry: ToolRegistry,
    contextManager: ContextManager,
    groupChatManager: GroupChatManager
  ) {
    super();
    
    this.sessionId = sessionId;
    this.toolRegistry = toolRegistry;
    this.contextManager = contextManager;
    this.groupChatManager = groupChatManager;
    this.createdAt = new Date();
    this.stats = {
      toolExecutions: 0,
      contextItems: 0,
      messagesProcessed: 0
    };
  }

  /**
   * Execute a tool with session context
   */
  async executeTool(
    toolId: string,
    agentId: string,
    parameters: Record<string, any>,
    options: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<ToolExecutionResult> {
    // Create execution context with session information
    const context: ToolExecutionContext = {
      agentId,
      conversationId: this.sessionId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      parameters,
      environment: {
        sessionType: 'group-chat',
        participantCount: this.getParticipantCount(),
        sessionDuration: this.getSessionDuration()
      }
    };

    try {
      const result = await this.toolRegistry.executeTool(toolId, context, options);
      
      this.stats.toolExecutions++;
      
      // Add tool execution to context
      await this.contextManager.addContext(
        {
          toolId,
          agentId,
          parameters,
          result: result.success ? result.result : result.error,
          executionTime: result.executionTime
        },
        'metadata',
        { agentId, messageId: `tool-${Date.now()}` },
        {
          conversationId: this.sessionId,
          relevance: result.success ? 'medium' : 'high',
          scope: 'conversation',
          tags: ['tool-execution', toolId, agentId]
        }
      );

      this.emit('tool-executed-in-session', {
        sessionId: this.sessionId,
        toolId,
        agentId,
        result,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      this.emit('tool-execution-failed-in-session', {
        sessionId: this.sessionId,
        toolId,
        agentId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Add context to the session
   */
  async addContext(
    content: any,
    type: ContextItem['type'],
    agentId: string,
    options: {
      relevance?: ContextItem['relevance'];
      tags?: string[];
      relationships?: Partial<ContextItem['relationships']>;
    } = {}
  ): Promise<string> {
    const contextId = await this.contextManager.addContext(
      content,
      type,
      { agentId },
      {
        conversationId: this.sessionId,
        relevance: options.relevance || 'medium',
        scope: 'conversation',
        tags: ['session', this.sessionId, ...(options.tags || [])],
        relationships: options.relationships
      }
    );

    this.stats.contextItems++;

    this.emit('context-added-to-session', {
      sessionId: this.sessionId,
      contextId,
      type,
      agentId,
      timestamp: new Date()
    });

    return contextId;
  }

  /**
   * Query context for the session
   */
  async querySessionContext(
    agentId: string,
    query: Omit<ContextQuery, 'conversationId'>
  ): Promise<ContextItem[]> {
    return this.contextManager.queryContext({
      ...query,
      conversationId: this.sessionId
    });
  }

  /**
   * Get available tools for an agent in this session
   */
  getAvailableTools(agentId: string): ToolDefinition[] {
    const sessionState = this.groupChatManager.getSessionState(this.sessionId);
    if (!sessionState) return [];

    // Filter tools based on session type and agent role
    const allTools = this.toolRegistry.getAvailableTools(agentId);
    const agentParticipation = sessionState.participants.find(p => p.agentName === agentId);
    
    if (!agentParticipation) return allTools;

    // Filter tools based on agent role
    return allTools.filter(tool => {
      if (agentParticipation.role === 'moderator') {
        return true; // Moderators have access to all tools
      }
      
      if (agentParticipation.role === 'specialist') {
        // Specialists get tools related to their specializations
        return tool.category === 'analysis' || tool.category === 'specialized';
      }

      // Regular participants get basic tools
      return tool.permissionLevel === 'public';
    });
  }

  /**
   * Process a message and extract context
   */
  async processMessage(message: ConversationMessage): Promise<void> {
    this.stats.messagesProcessed++;

    // Extract different types of context from the message
    const contexts: Array<{
      content: any;
      type: ContextItem['type'];
      tags: string[];
    }> = [];

    // Add the message itself as context
    contexts.push({
      content: message.content,
      type: 'message',
      tags: ['message', message.role]
    });

    // Extract decisions
    if (this.containsDecision(message.content)) {
      contexts.push({
        content: this.extractDecision(message.content),
        type: 'decision',
        tags: ['decision', 'extracted']
      });
    }

    // Extract facts
    if (this.containsFacts(message.content)) {
      contexts.push({
        content: this.extractFacts(message.content),
        type: 'fact',
        tags: ['fact', 'extracted']
      });
    }

    // Extract goals
    if (this.containsGoals(message.content)) {
      contexts.push({
        content: this.extractGoals(message.content),
        type: 'goal',
        tags: ['goal', 'extracted']
      });
    }

    // Store all extracted contexts
    for (const context of contexts) {
      await this.addContext(
        context.content,
        context.type,
        message.agent_id,
        {
          relevance: context.type === 'message' ? 'medium' : 'high',
          tags: context.tags
        }
      );
    }

    this.emit('message-processed-in-session', {
      sessionId: this.sessionId,
      message,
      contextsExtracted: contexts.length,
      timestamp: new Date()
    });
  }

  /**
   * Get session statistics
   */
  getStats(): {
    toolExecutions: number;
    contextItems: number;
    messagesProcessed: number;
    duration: number;
  } {
    return {
      ...this.stats,
      duration: Date.now() - this.createdAt.getTime()
    };
  }

  /**
   * Get session summary
   */
  async getSessionSummary(): Promise<{
    sessionId: string;
    duration: number;
    participantCount: number;
    toolExecutions: number;
    contextItems: number;
    messagesProcessed: number;
    keyInsights: string[];
    unresolvedIssues: string[];
  }> {
    const contextSummary = await this.contextManager.generateContextSummary(
      { conversationId: this.sessionId },
      { maxItems: 50 }
    );

    return {
      sessionId: this.sessionId,
      duration: this.getSessionDuration(),
      participantCount: this.getParticipantCount(),
      toolExecutions: this.stats.toolExecutions,
      contextItems: this.stats.contextItems,
      messagesProcessed: this.stats.messagesProcessed,
      keyInsights: contextSummary.keyFacts.slice(0, 5),
      unresolvedIssues: contextSummary.unresolvedIssues
    };
  }

  /**
   * Cleanup session resources
   */
  async cleanup(): Promise<void> {
    // Clear conversation context
    try {
      await this.contextManager.clearConversationContext(this.sessionId, 'system');
    } catch (error) {
      console.warn(`Failed to clear context for session ${this.sessionId}:`, error.message);
    }

    this.emit('session-integration-cleaned', {
      sessionId: this.sessionId,
      stats: this.getStats(),
      timestamp: new Date()
    });
  }

  /**
   * Helper methods
   */
  private getParticipantCount(): number {
    const sessionState = this.groupChatManager.getSessionState(this.sessionId);
    return sessionState?.participants.length || 0;
  }

  private getSessionDuration(): number {
    return Date.now() - this.createdAt.getTime();
  }

  private containsDecision(content: string): boolean {
    const decisionKeywords = ['decided', 'decision', 'conclude', 'resolved', 'agreed'];
    return decisionKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  private extractDecision(content: string): string {
    // Simple extraction - could be enhanced with NLP
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    const decisionSentences = sentences.filter(sentence => 
      this.containsDecision(sentence)
    );
    return decisionSentences.join('. ').trim();
  }

  private containsFacts(content: string): boolean {
    const factKeywords = ['fact', 'data', 'evidence', 'statistics', 'research', 'study'];
    return factKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  private extractFacts(content: string): string {
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    const factSentences = sentences.filter(sentence => 
      this.containsFacts(sentence)
    );
    return factSentences.join('. ').trim();
  }

  private containsGoals(content: string): boolean {
    const goalKeywords = ['goal', 'objective', 'aim', 'target', 'plan', 'intend'];
    return goalKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  private extractGoals(content: string): string {
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    const goalSentences = sentences.filter(sentence => 
      this.containsGoals(sentence)
    );
    return goalSentences.join('. ').trim();
  }
}