/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Core types and interfaces
export type {
  IAgent,
  IAgentFactory,
  AgentState,
  AgentResponseType,
  AgentMemory,
  MemoryItem,
  ToolDefinition,
  ToolParameter,
  Capability,
  PersonalityTrait,
  AgentConfig,
  AgentDefinition,
  AgentContext,
  AgentResponse,
  AgentRequest,
  AgentEvents,
  AgentCreator,
  AgentTemplate,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  FactoryStatistics,
  ComponentRegistry,
  DIContainer,
  AgentFactoryConfig
} from './types.js';

// Factory implementation
export { AgentFactory } from './AgentFactory.js';
export type { FactoryEvents } from './AgentFactory.js';

// Base agent implementation
export { BaseAgent, SimpleAgentMemory } from './BaseAgent.js';