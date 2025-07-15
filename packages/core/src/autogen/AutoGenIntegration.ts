/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { PythonAutoGenBridge, PythonBridgeConfig } from './bridges/PythonAutoGenBridge';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  GroupChatConfig,
  CollaborationPattern,
  CollaborationConfig,
  AutoGenConfig,
  AutoGenEvents,
  ConversationStats,
  AutoGenError
} from './types';
import { AgentDefinition } from '../universal/agents/types';

/**
 * Main AutoGen Integration class
 * 
 * This class provides the primary interface for integrating with
 * Microsoft AutoGen framework through a Python bridge.
 */
export class AutoGenIntegration extends EventEmitter {
  private bridge: PythonAutoGenBridge;
  private config: AutoGenConfig;
  private activeConversations: Map<string, {
    participants: string[];
    messages: ConversationMessage[];
    startTime: Date;
    pattern?: CollaborationPattern;
  }> = new Map();
  private agents: Map<string, AutoGenAgentConfig> = new Map();
  private groupChats: Map<string, string> = new Map(); // chatId -> description

  constructor(config: Partial<AutoGenConfig> = {}) {
    super();
    
    this.config = {
      defaultLLM: config.defaultLLM || 'gpt-4',
      defaultTimeout: config.defaultTimeout || 30000,
      enableLogging: config.enableLogging !== false,
      logLevel: config.logLevel || 'info',
      cacheEnabled: config.cacheEnabled !== false,
      maxCacheSize: config.maxCacheSize || 1000,
      workingDirectory: config.workingDirectory || './autogen_workspace',
      enableCodeExecution: config.enableCodeExecution === true,
      dockerEnabled: config.dockerEnabled === true,
      ...config
    };

    // Initialize Python bridge
    const bridgeConfig: Partial<PythonBridgeConfig> = {
      pythonServerHost: process.env.AUTOGEN_PYTHON_HOST || 'localhost',
      pythonServerPort: parseInt(process.env.AUTOGEN_PYTHON_PORT || '8765'),
      httpPort: parseInt(process.env.AUTOGEN_HTTP_PORT || '8766'),
      enableWebSocket: true,
      connectionTimeout: this.config.defaultTimeout,
      retryAttempts: 3,
      retryDelay: 5000
    };

    this.bridge = new PythonAutoGenBridge(bridgeConfig);
    this.setupEventHandlers();
  }

  /**
   * Initialize the AutoGen integration
   */
  async initialize(): Promise<void> {
    try {
      await this.bridge.initialize();
      
      if (this.config.enableLogging) {
        console.log('AutoGen integration initialized successfully');
      }
      
      this.emit('initialized', {
        timestamp: new Date().toISOString(),
        config: this.config
      });
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to initialize AutoGen integration: ${error.message}`,
        'INITIALIZATION_ERROR',
        { config: this.config, error }
      );
    }
  }

  /**
   * Setup event handlers for the bridge
   */
  private setupEventHandlers(): void {
    this.bridge.on('connected', () => {
      this.emit('bridgeConnected');
    });

    this.bridge.on('disconnected', (data) => {
      this.emit('bridgeDisconnected', data);
    });

    this.bridge.on('agent.created', (event) => {
      this.emit('agent.created', event);
    });

    this.bridge.on('agent.messageGenerated', (event) => {
      this.emit('agent.messageGenerated', event);
      this.trackConversationMessage(event.message);
    });

    this.bridge.on('groupChat.started', (event) => {
      this.emit('groupChat.started', event);
    });

    this.bridge.on('error.occurred', (event) => {
      this.emit('error.occurred', event);
    });
  }

  /**
   * Create an agent from Universal Agent definition
   */
  async createAgentFromDefinition(definition: AgentDefinition): Promise<string> {
    try {
      const autoGenConfig = this.bridge.convertToAutoGen(definition);
      
      // Enhance with default LLM configuration
      autoGenConfig.llm_config = {
        model: this.config.defaultLLM,
        temperature: definition.temperature || 0.7,
        max_tokens: definition.maxTokens || 2000,
        ...autoGenConfig.llm_config
      };

      // Add code execution if enabled
      if (this.config.enableCodeExecution) {
        autoGenConfig.code_execution_config = {
          work_dir: this.config.workingDirectory,
          use_docker: this.config.dockerEnabled,
          timeout: 60
        };
      }

      await this.bridge.createAgent(autoGenConfig);
      this.agents.set(autoGenConfig.name, autoGenConfig);
      
      if (this.config.enableLogging) {
        console.log(`Created AutoGen agent: ${autoGenConfig.name}`);
      }

      return autoGenConfig.name;
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to create agent from definition: ${error.message}`,
        'AGENT_CREATION_ERROR',
        { definition, error }
      );
    }
  }

  /**
   * Create an agent with custom configuration
   */
  async createAgent(config: AutoGenAgentConfig): Promise<string> {
    try {
      // Apply defaults
      const fullConfig: AutoGenAgentConfig = {
        ...config,
        llm_config: {
          model: this.config.defaultLLM,
          ...config.llm_config
        }
      };

      await this.bridge.createAgent(fullConfig);
      this.agents.set(fullConfig.name, fullConfig);
      
      if (this.config.enableLogging) {
        console.log(`Created AutoGen agent: ${fullConfig.name}`);
      }

      return fullConfig.name;
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to create agent: ${error.message}`,
        'AGENT_CREATION_ERROR',
        { config, error }
      );
    }
  }

  /**
   * Start a conversation between two agents
   */
  async startConversation(
    initiator: string,
    recipient: string,
    message: string,
    options: {
      maxTurns?: number;
      pattern?: CollaborationPattern;
      trackStats?: boolean;
    } = {}
  ): Promise<ConversationMessage[]> {
    try {
      const { maxTurns = 10, pattern, trackStats = true } = options;
      
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (trackStats) {
        this.activeConversations.set(conversationId, {
          participants: [initiator, recipient],
          messages: [],
          startTime: new Date(),
          pattern
        });
      }

      const conversation = await this.bridge.startConversation(
        initiator,
        recipient,
        message,
        maxTurns
      );

      if (trackStats) {
        const conversationData = this.activeConversations.get(conversationId)!;
        conversationData.messages = conversation;
      }

      if (this.config.enableLogging) {
        console.log(`Started conversation between ${initiator} and ${recipient}`);
      }

      return conversation;
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to start conversation: ${error.message}`,
        'CONVERSATION_ERROR',
        { initiator, recipient, message, error }
      );
    }
  }

  /**
   * Create a group chat with collaboration pattern
   */
  async createGroupChat(
    agents: string[],
    config: Partial<GroupChatConfig> = {},
    collaborationConfig?: CollaborationConfig
  ): Promise<string> {
    try {
      const groupConfig: GroupChatConfig = {
        agents,
        max_round: config.max_round || 10,
        admin_name: config.admin_name || 'Admin',
        speaker_selection_method: config.speaker_selection_method || 'auto',
        allow_repeat_speaker: config.allow_repeat_speaker !== false,
        ...config
      };

      const chatId = await this.bridge.createGroupChat(groupConfig);
      
      let description = `Group chat with ${agents.join(', ')}`;
      if (collaborationConfig) {
        description += ` using ${collaborationConfig.pattern} pattern`;
      }
      
      this.groupChats.set(chatId, description);

      if (this.config.enableLogging) {
        console.log(`Created group chat: ${chatId}`);
      }

      return chatId;
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to create group chat: ${error.message}`,
        'GROUP_CHAT_ERROR',
        { agents, config, error }
      );
    }
  }

  /**
   * Implement collaboration patterns
   */
  async executeCollaborationPattern(
    pattern: CollaborationPattern,
    agents: string[],
    initialMessage: string,
    config: Partial<CollaborationConfig> = {}
  ): Promise<ConversationMessage[]> {
    try {
      const collaborationConfig: CollaborationConfig = {
        pattern,
        roles: agents,
        maxIterations: config.maxIterations || 5,
        consensusThreshold: config.consensusThreshold || 0.8,
        ...config
      };

      switch (pattern) {
        case CollaborationPattern.SEQUENTIAL:
          return await this.executeSequentialPattern(agents, initialMessage, collaborationConfig);
          
        case CollaborationPattern.PARALLEL:
          return await this.executeParallelPattern(agents, initialMessage, collaborationConfig);
          
        case CollaborationPattern.DEBATE:
          return await this.executeDebatePattern(agents, initialMessage, collaborationConfig);
          
        case CollaborationPattern.CONSULTATION:
          return await this.executeConsultationPattern(agents, initialMessage, collaborationConfig);
          
        case CollaborationPattern.BRAINSTORM:
          return await this.executeBrainstormPattern(agents, initialMessage, collaborationConfig);
          
        default:
          throw new Error(`Unsupported collaboration pattern: ${pattern}`);
      }
      
    } catch (error) {
      throw new AutoGenError(
        `Failed to execute collaboration pattern: ${error.message}`,
        'COLLABORATION_ERROR',
        { pattern, agents, error }
      );
    }
  }

  /**
   * Execute sequential collaboration pattern
   */
  private async executeSequentialPattern(
    agents: string[],
    message: string,
    config: CollaborationConfig
  ): Promise<ConversationMessage[]> {
    const conversation: ConversationMessage[] = [];
    let currentMessage = message;

    for (let iteration = 0; iteration < config.maxIterations!; iteration++) {
      for (let i = 0; i < agents.length - 1; i++) {
        const sender = agents[i];
        const receiver = agents[i + 1];
        
        const result = await this.bridge.startConversation(
          sender,
          receiver,
          currentMessage,
          1 // Single turn for sequential pattern
        );
        
        conversation.push(...result);
        
        // Use the last response as input for next agent
        if (result.length > 0) {
          currentMessage = result[result.length - 1].content;
        }
      }
    }

    return conversation;
  }

  /**
   * Execute parallel collaboration pattern
   */
  private async executeParallelPattern(
    agents: string[],
    message: string,
    config: CollaborationConfig
  ): Promise<ConversationMessage[]> {
    // Create individual conversations in parallel
    const promises = agents.slice(1).map(agent =>
      this.bridge.startConversation(agents[0], agent, message, 1)
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Execute debate collaboration pattern
   */
  private async executeDebatePattern(
    agents: string[],
    message: string,
    config: CollaborationConfig
  ): Promise<ConversationMessage[]> {
    if (agents.length < 2) {
      throw new Error('Debate pattern requires at least 2 agents');
    }

    const chatId = await this.createGroupChat(agents, {
      max_round: config.maxIterations! * 2,
      speaker_selection_method: 'round_robin'
    });

    // For now, return a placeholder conversation
    // In a full implementation, this would manage the debate flow
    return [];
  }

  /**
   * Execute consultation collaboration pattern
   */
  private async executeConsultationPattern(
    agents: string[],
    message: string,
    config: CollaborationConfig
  ): Promise<ConversationMessage[]> {
    if (agents.length < 2) {
      throw new Error('Consultation pattern requires at least 2 agents');
    }

    const consultant = agents[0];
    const clients = agents.slice(1);
    const conversation: ConversationMessage[] = [];

    // Each client consults with the main consultant
    for (const client of clients) {
      const result = await this.bridge.startConversation(
        client,
        consultant,
        message,
        2
      );
      conversation.push(...result);
    }

    return conversation;
  }

  /**
   * Execute brainstorm collaboration pattern
   */
  private async executeBrainstormPattern(
    agents: string[],
    message: string,
    config: CollaborationConfig
  ): Promise<ConversationMessage[]> {
    const chatId = await this.createGroupChat(agents, {
      max_round: config.maxIterations!,
      speaker_selection_method: 'auto',
      allow_repeat_speaker: true
    });

    // For now, return a placeholder conversation
    // In a full implementation, this would manage the brainstorming flow
    return [];
  }

  /**
   * Get list of all agents
   */
  async listAgents(): Promise<Array<{
    name: string;
    role: string;
    description: string;
  }>> {
    return await this.bridge.listAgents();
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(conversationId?: string): ConversationStats | ConversationStats[] {
    if (conversationId) {
      const conversation = this.activeConversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      return this.calculateStats(conversation);
    }

    // Return stats for all conversations
    return Array.from(this.activeConversations.values()).map(conv => 
      this.calculateStats(conv)
    );
  }

  /**
   * Calculate statistics for a conversation
   */
  private calculateStats(conversation: {
    participants: string[];
    messages: ConversationMessage[];
    startTime: Date;
    pattern?: CollaborationPattern;
  }): ConversationStats {
    const messagesByAgent: Record<string, number> = {};
    let totalTokens = 0;

    conversation.messages.forEach(msg => {
      messagesByAgent[msg.agent_id] = (messagesByAgent[msg.agent_id] || 0) + 1;
      // Rough token estimation (1 token ≈ 4 characters)
      totalTokens += Math.ceil(msg.content.length / 4);
    });

    const turnPattern = conversation.messages.map(msg => msg.agent_id);
    const conversationDuration = Date.now() - conversation.startTime.getTime();

    return {
      totalMessages: conversation.messages.length,
      messagesByAgent,
      averageResponseTime: conversationDuration / Math.max(conversation.messages.length, 1),
      tokenUsage: {
        total: totalTokens,
        byAgent: messagesByAgent // Simplified - would need actual token counts
      },
      toolCallsCount: 0, // Would need to track tool calls
      conversationDuration,
      turnPattern
    };
  }

  /**
   * Track conversation messages
   */
  private trackConversationMessage(message: ConversationMessage): void {
    // Update active conversations with new messages
    for (const [id, conversation] of this.activeConversations) {
      if (conversation.participants.includes(message.agent_id)) {
        conversation.messages.push(message);
      }
    }
  }

  /**
   * Get bridge status
   */
  getBridgeStatus(): any {
    return this.bridge.getStatus();
  }

  /**
   * Close the AutoGen integration
   */
  async close(): Promise<void> {
    await this.bridge.close();
    this.activeConversations.clear();
    this.agents.clear();
    this.groupChats.clear();
    
    this.emit('closed', { timestamp: new Date().toISOString() });
  }
}