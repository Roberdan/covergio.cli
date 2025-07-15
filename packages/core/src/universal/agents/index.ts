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

// Integrated personality and capability systems
export type {
  IPersonality,
  ICapability,
  IPersonalityCapabilityManager,
  IAgentFactoryIntegration,
  ResponseTemplate,
  DecisionWeights,
  CompatibilityCheck,
  BehaviorContext,
  BehaviorResponse,
  CapabilityDependency,
  CompatibilityRequirement,
  ResourceRequirement,
  CombinationResult,
  CapabilityContext,
  CapabilityResult,
  PerformanceMetrics,
  CompatibilityMatrix,
  CompositionStrategy,
  PersonalityGenerationContext,
  CapabilityAssignmentContext,
  OptimizationRecommendation,
  PerformanceAnalytics
} from './interfaces.js';

// Personality system
export { PersonalityGenerator } from './personality/PersonalityGenerator.js';
export type { 
  PersonalityProfile, 
  CommunicationStyle, 
  BehaviorPattern, 
  PersonalityPreferences,
  PersonalityGenerationConfig,
  PersonalityTemplate,
  PersonalityVariation,
  CompatibilityResult
} from './personality/PersonalityGenerator.js';
export { IntegratedPersonality } from './personality/IntegratedPersonality.js';

// Capability system
export { CapabilityRegistry } from './capabilities/CapabilityRegistry.js';
export type { 
  ExtendedCapability, 
  CapabilityMetrics, 
  CapabilityComposition,
  CompositionRule,
  CapabilityConflict,
  CapabilityValidationResult,
  CapabilitySearchCriteria,
  CapabilityAssignmentResult
} from './capabilities/CapabilityRegistry.js';
export { IntegratedCapability } from './capabilities/IntegratedCapability.js';

// Personality-Capability Manager
export { PersonalityCapabilityManager } from './PersonalityCapabilityManager.js';