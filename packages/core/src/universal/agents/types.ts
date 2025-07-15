/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ResourceLimits } from './interfaces.js';

/**
 * Agent state enumeration
 */
export type AgentState = 'initializing' | 'ready' | 'busy' | 'paused' | 'error' | 'terminated';

/**
 * Agent execution result types
 */
export type AgentResponseType = 'text' | 'markdown' | 'json' | 'error' | 'success' | 'partial';

/**
 * Agent memory interface
 */
export interface AgentMemory {
  store(item: MemoryItem): Promise<string>;
  retrieve(query: string, limit?: number): Promise<MemoryItem[]>;
  update(id: string, item: Partial<MemoryItem>): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Memory item structure
 */
export interface MemoryItem {
  id?: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  importance?: number;
}

/**
 * Tool definition for agent capabilities
 */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: string;
  accessLevel: 'public' | 'private' | 'restricted';
  execute?: (params: Record<string, any>) => Promise<any>;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

/**
 * Agent capability definition
 */
export interface Capability {
  id: string;
  name: string;
  description: string;
  category: 'technical' | 'creative' | 'analytical' | 'communication' | 'domain-specific';
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  dependencies?: string[];
  tools?: string[];
  keywords?: string[];
}

/**
 * Agent personality trait
 */
export interface PersonalityTrait {
  name: string;
  value: number; // 0-1 scale
  description: string;
  category: 'communication' | 'problem-solving' | 'creativity' | 'social' | 'analytical';
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id?: string;
  domain: string;
  role: string;
  capabilities?: string[];
  personalityTraits?: PersonalityTrait[];
  tools?: string[];
  memory?: AgentMemory;
  maxConcurrentTasks?: number;
  timeout?: number;
  retryAttempts?: number;
  customSettings?: Record<string, any>;
}

/**
 * Agent definition structure
 */
export interface AgentDefinition {
  id: string;
  domain: string;
  role: string;
  description: string;
  capabilities: Capability[];
  personalityTraits: PersonalityTrait[];
  tools: ToolDefinition[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  sessionId: string;
  userId?: string;
  taskId?: string;
  parentAgentId?: string;
  executionId: string;
  timestamp: Date;
  environment: Record<string, any>;
}

/**
 * Agent response structure
 */
export interface AgentResponse {
  type: AgentResponseType;
  content: string;
  context?: AgentContext;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executionTime?: number;
  confidence?: number;
}

/**
 * Agent execution request
 */
export interface AgentRequest {
  input: string;
  context: AgentContext;
  options?: {
    timeout?: number;
    priority?: 'low' | 'medium' | 'high';
    streaming?: boolean;
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Agent lifecycle events
 */
export interface AgentEvents {
  'state-changed': { previousState: AgentState; newState: AgentState; timestamp: Date };
  'execution-started': { request: AgentRequest; timestamp: Date };
  'execution-completed': { request: AgentRequest; response: AgentResponse; timestamp: Date };
  'execution-failed': { request: AgentRequest; error: Error; timestamp: Date };
  'memory-updated': { operation: string; itemId: string; timestamp: Date };
  'capability-used': { capability: string; context: AgentContext; timestamp: Date };
  'tool-executed': { tool: string; params: Record<string, any>; result: any; timestamp: Date };
  'error': { error: Error; context?: any; timestamp: Date };
}

/**
 * Core agent interface
 */
export interface IAgent extends EventEmitter {
  readonly id: string;
  readonly definition: AgentDefinition;
  readonly state: AgentState;
  readonly memory: AgentMemory;

  /**
   * Execute a task with the given input
   */
  execute(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Get agent capabilities
   */
  getCapabilities(): Capability[];

  /**
   * Get agent personality traits
   */
  getPersonality(): PersonalityTrait[];

  /**
   * Get available tools
   */
  getTools(): ToolDefinition[];

  /**
   * Initialize the agent
   */
  initialize(): Promise<void>;

  /**
   * Pause agent execution
   */
  pause(): Promise<void>;

  /**
   * Resume agent execution
   */
  resume(): Promise<void>;

  /**
   * Terminate the agent
   */
  terminate(): Promise<void>;

  /**
   * Get agent health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memoryUsage: number;
    executionCount: number;
    errorCount: number;
    lastActivity: Date;
  };

  /**
   * Update agent configuration
   */
  updateConfig(config: Partial<AgentConfig>): Promise<void>;

  /**
   * Serialize agent state
   */
  serialize(): Promise<string>;

  /**
   * Deserialize agent state
   */
  deserialize(data: string): Promise<void>;
}

/**
 * Agent factory interface
 */
export interface IAgentFactory {
  /**
   * Create a new agent instance
   */
  createAgent(config: AgentConfig): Promise<IAgent>;

  /**
   * Register a new agent type
   */
  registerAgentType(type: string, creator: AgentCreator): void;

  /**
   * Unregister an agent type
   */
  unregisterAgentType(type: string): void;

  /**
   * Get available agent types
   */
  getAvailableTypes(): string[];

  /**
   * Create agent from definition
   */
  createFromDefinition(definition: AgentDefinition): Promise<IAgent>;

  /**
   * Validate agent configuration
   */
  validateConfig(config: AgentConfig): ValidationResult;

  /**
   * Get agent template
   */
  getTemplate(domain: string, role: string): AgentTemplate | null;

  /**
   * Register component
   */
  registerComponent(name: string, component: any): void;

  /**
   * Get component
   */
  getComponent(name: string): any;

  /**
   * Get factory statistics
   */
  getStatistics(): FactoryStatistics;
}

/**
 * Agent creator function type
 */
export type AgentCreator = (config: AgentConfig) => Promise<IAgent>;

/**
 * Agent template structure
 */
export interface AgentTemplate {
  id: string;
  domain: string;
  role: string;
  description: string;
  defaultCapabilities: string[];
  defaultPersonalityTraits: PersonalityTrait[];
  defaultTools: string[];
  configSchema: Record<string, any>;
  examples: string[];
  documentation: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  recommendation?: string;
}

/**
 * Factory statistics
 */
export interface FactoryStatistics {
  totalAgentsCreated: number;
  activeAgents: number;
  agentsByType: Record<string, number>;
  agentsByDomain: Record<string, number>;
  averageCreationTime: number;
  errorRate: number;
  memoryUsage: number;
  uptime: number;
}

/**
 * Component registry interface
 */
export interface ComponentRegistry {
  register(name: string, component: any): void;
  unregister(name: string): void;
  get(name: string): any;
  has(name: string): boolean;
  getAll(): Record<string, any>;
  clear(): void;
}

/**
 * Dependency injection container interface
 */
export interface DIContainer {
  bind<T>(token: string, value: T): void;
  bindFactory<T>(token: string, factory: () => T): void;
  get<T>(token: string): T;
  has(token: string): boolean;
  resolve<T>(constructor: new (...args: any[]) => T): T;
}

/**
 * Agent factory configuration
 */
export interface AgentFactoryConfig {
  defaultMemoryProvider?: () => AgentMemory;
  defaultTimeout?: number;
  defaultRetryAttempts?: number;
  maxConcurrentAgents?: number;
  enableMetrics?: boolean;
  enableValidation?: boolean;
  customValidators?: Record<string, (value: any) => boolean>;
  componentRegistry?: ComponentRegistry;
  diContainer?: DIContainer;
  
  // Lifecycle management configuration
  resourceLimits?: Partial<ResourceLimits>;
  healthMonitoringInterval?: number;
  enableHealthMonitoring?: boolean;
}

/**
 * Type the EventEmitter properly for IAgent
 */
export interface IAgent {
  on<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): this;
  emit<K extends keyof AgentEvents>(event: K, data: AgentEvents[K]): boolean;
}