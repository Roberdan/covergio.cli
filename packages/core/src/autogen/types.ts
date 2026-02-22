/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentDefinition, AgentCapability, AgentPersonality, IAgent } from '../universal/agents/types';

/**
 * AutoGen Agent Configuration (matches Python AutoGen structure)
 */
export interface AutoGenAgentConfig {
  name: string;
  role: string;
  system_message: string;  // Snake case to match Python
  llm_config: LLMConfig;   // Snake case to match Python
  tools?: AutoGenTool[];
  max_consecutive_auto_reply?: number;  // Snake case to match Python
  human_input_mode?: 'ALWAYS' | 'NEVER' | 'TERMINATE';  // Snake case to match Python
  code_execution_config?: CodeExecutionConfig;  // Snake case to match Python
  description?: string;
}

/**
 * LLM Configuration for AutoGen agents
 */
export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  cache?: boolean;
}

/**
 * AutoGen Tool Definition
 */
export interface AutoGenTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
  implementation: (...args: any[]) => Promise<any> | any;
}

/**
 * Code Execution Configuration
 */
export interface CodeExecutionConfig {
  workDir?: string;
  useDocker?: boolean;
  timeout?: number;
  lastNMessages?: number;
}

/**
 * Conversation Message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  timestamp: string;
  agentId: string;
}

/**
 * Group Chat Configuration
 */
export interface GroupChatConfig {
  agents: AutoGenAgent[];
  messages?: ConversationMessage[];
  maxRounds?: number;
  adminName?: string;
  speakerSelectionMethod?: 'auto' | 'manual' | 'random' | 'round_robin';
  allowRepeatSpeaker?: boolean;
  terminationCondition?: (messages: ConversationMessage[]) => boolean;
}

/**
 * Collaboration Pattern Types
 */
export enum CollaborationPattern {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HIERARCHICAL = 'hierarchical',
  DEBATE = 'debate',
  CONSULTATION = 'consultation',
  BRAINSTORM = 'brainstorm'
}

/**
 * Collaboration Pattern Configuration
 */
export interface CollaborationConfig {
  pattern: CollaborationPattern;
  roles: string[];
  turnOrder?: string[];
  maxIterations?: number;
  consensusThreshold?: number;
  moderator?: string;
  rules?: string[];
}

/**
 * AutoGen Agent Interface
 */
export interface AutoGenAgent {
  name: string;
  role: string;
  config: AutoGenAgentConfig;
  
  generateReply(
    messages: ConversationMessage[],
    sender?: AutoGenAgent
  ): Promise<ConversationMessage>;
  
  receiveMessage(
    message: ConversationMessage,
    sender?: AutoGenAgent
  ): Promise<void>;
  
  initializeChat(
    message: string,
    recipient: AutoGenAgent
  ): Promise<ConversationMessage[]>;
  
  addTool(tool: AutoGenTool): void;
  removeTool(toolName: string): void;
  
  updateSystemMessage(message: string): void;
  updateLLMConfig(config: Partial<LLMConfig>): void;
  
  getAgentInfo(): {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
  };
}

/**
 * Group Chat Interface
 */
export interface AutoGenGroupChat {
  agents: AutoGenAgent[];
  messages: ConversationMessage[];
  config: GroupChatConfig;
  
  addAgent(agent: AutoGenAgent): void;
  removeAgent(agentName: string): void;
  
  initiate(message: string, sender: AutoGenAgent): Promise<ConversationMessage[]>;
  sendMessage(message: string, sender: AutoGenAgent): Promise<ConversationMessage[]>;
  
  selectNextSpeaker(
    lastSpeaker: AutoGenAgent,
    selector?: AutoGenAgent
  ): Promise<AutoGenAgent>;
  
  checkTerminationCondition(): boolean;
  exportConversation(): ConversationMessage[];
  
  addCollaborationPattern(config: CollaborationConfig): void;
  executePattern(patternName: string): Promise<ConversationMessage[]>;
}

/**
 * Agent Bridge Interface for converting between systems
 */
export interface AgentBridge {
  convertToAutoGen(definition: AgentDefinition): AutoGenAgentConfig;
  convertFromAutoGen(config: AutoGenAgentConfig): AgentDefinition;
  
  mapCapabilities(capabilities: AgentCapability[]): AutoGenTool[];
  mapPersonality(personality: AgentPersonality): string;
  
  synchronizeState(
    universalAgent: IAgent,
    autoGenAgent: AutoGenAgent
  ): Promise<void>;
}

/**
 * Conversation Statistics
 */
export interface ConversationStats {
  totalMessages: number;
  messagesByAgent: Record<string, number>;
  averageResponseTime: number;
  tokenUsage: {
    total: number;
    byAgent: Record<string, number>;
  };
  toolCallsCount: number;
  conversationDuration: number;
  turnPattern: string[];
}

/**
 * AutoGen Integration Events
 */
export interface AutoGenEvents {
  'agent.created': {
    agent: AutoGenAgent;
    timestamp: string;
  };
  
  'agent.messageGenerated': {
    agent: AutoGenAgent;
    message: ConversationMessage;
    timestamp: string;
  };
  
  'groupChat.started': {
    groupChat: AutoGenGroupChat;
    initiator: AutoGenAgent;
    timestamp: string;
  };
  
  'groupChat.terminated': {
    groupChat: AutoGenGroupChat;
    reason: string;
    stats: ConversationStats;
    timestamp: string;
  };
  
  'tool.executed': {
    agent: AutoGenAgent;
    toolName: string;
    input: any;
    output: any;
    timestamp: string;
  };
  
  'error.occurred': {
    error: Error;
    context: string;
    agent?: AutoGenAgent;
    timestamp: string;
  };
}

/**
 * AutoGen Configuration
 */
export interface AutoGenConfig {
  defaultLLM: string;
  defaultApiKey?: string;
  defaultBaseUrl?: string;
  defaultTimeout: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cacheEnabled: boolean;
  maxCacheSize: number;
  workingDirectory: string;
  enableCodeExecution: boolean;
  dockerEnabled: boolean;
}

/**
 * Memory Integration for AutoGen
 */
export interface AutoGenMemoryConfig {
  enabled: boolean;
  vectorStoreConfig?: {
    provider: 'pinecone' | 'qdrant' | 'milvus' | 'local';
    connectionString?: string;
    dimension: number;
    namespace?: string;
  };
  embeddingModel: string;
  contextWindow: number;
  relevanceThreshold: number;
  maxMemorySize: number;
  persistMemory: boolean;
}

/**
 * Performance Monitoring Configuration
 */
export interface AutoGenPerformanceConfig {
  enabled: boolean;
  metricsEndpoint?: string;
  metricsPort?: number;
  enableTracing: boolean;
  enableCircuitBreaker: boolean;
  circuitBreakerConfig?: {
    failureThreshold: number;
    resetTimeout: number;
    fallbackEnabled: boolean;
  };
}

/**
 * Error types for AutoGen integration
 */
export class AutoGenError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AutoGenError';
  }
}

export class AgentCreationError extends AutoGenError {
  constructor(message: string, context?: any) {
    super(message, 'AGENT_CREATION_ERROR', context);
    this.name = 'AgentCreationError';
  }
}

export class ConversationError extends AutoGenError {
  constructor(message: string, context?: any) {
    super(message, 'CONVERSATION_ERROR', context);
    this.name = 'ConversationError';
  }
}

export class ToolExecutionError extends AutoGenError {
  constructor(message: string, context?: any) {
    super(message, 'TOOL_EXECUTION_ERROR', context);
    this.name = 'ToolExecutionError';
  }
}

export class BridgeError extends AutoGenError {
  constructor(message: string, context?: any) {
    super(message, 'BRIDGE_ERROR', context);
    this.name = 'BridgeError';
  }
}