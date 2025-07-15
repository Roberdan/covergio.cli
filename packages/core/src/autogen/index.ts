/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Main AutoGen integration
export { AutoGenIntegration } from './AutoGenIntegration';

// Bridge implementations
export { PythonAutoGenBridge, PythonBridgeConfig } from './bridges/PythonAutoGenBridge';

// Agent implementations
export { AutoGenAgent } from './agents/AutoGenAgent';

// Types and interfaces
export * from './types';

// Re-export for convenience
export {
  AutoGenAgentConfig,
  ConversationMessage,
  GroupChatConfig,
  CollaborationPattern,
  CollaborationConfig,
  AutoGenConfig,
  AutoGenEvents,
  ConversationStats,
  LLMConfig,
  AutoGenTool,
  CodeExecutionConfig,
  AutoGenAgent as IAutoGenAgent,
  AutoGenGroupChat,
  AgentBridge,
  AutoGenMemoryConfig,
  AutoGenPerformanceConfig,
  AutoGenError,
  AgentCreationError,
  ConversationError,
  ToolExecutionError,
  BridgeError
} from './types';