/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  IAgent,
  AgentDefinition,
  AgentState,
  AgentMemory,
  AgentRequest,
  AgentResponse,
  AgentConfig,
  Capability,
  PersonalityTrait,
  ToolDefinition,
  AgentContext,
  AgentEvents
} from './types.js';
import { IAgentLifecycle, AgentLifecycleState } from './interfaces.js';

/**
 * Simple in-memory agent memory implementation
 */
export class SimpleAgentMemory implements AgentMemory {
  private items = new Map<string, any>();
  private nextId = 1;

  async store(item: any): Promise<string> {
    const id = `mem-${this.nextId++}`;
    this.items.set(id, {
      id,
      ...item,
      timestamp: item.timestamp || new Date()
    });
    return id;
  }

  async retrieve(query: string, limit = 10): Promise<any[]> {
    const results = Array.from(this.items.values())
      .filter(item => item.content && item.content.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return results;
  }

  async update(id: string, item: Partial<any>): Promise<void> {
    const existing = this.items.get(id);
    if (existing) {
      this.items.set(id, { ...existing, ...item });
    }
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async clear(): Promise<void> {
    this.items.clear();
  }

  getSize(): number {
    return this.items.size;
  }
}

/**
 * Base agent implementation
 */
export abstract class BaseAgent extends EventEmitter implements IAgent, IAgentLifecycle {
  public readonly id: string;
  public readonly definition: AgentDefinition;
  public readonly memory: AgentMemory;
  
  private _state: AgentState = 'initializing';
  private _startTime: Date = new Date();
  private _executionCount = 0;
  private _errorCount = 0;
  private _lastActivity: Date = new Date();
  private _config: AgentConfig;

  constructor(config: AgentConfig) {
    super();
    
    this.id = config.id || this.generateId();
    this._config = config;
    this.memory = config.memory || new SimpleAgentMemory();
    
    // Create agent definition
    this.definition = {
      id: this.id,
      domain: config.domain,
      role: config.role,
      description: `${config.role} agent for ${config.domain} domain`,
      capabilities: this.initializeCapabilities(config.capabilities || []),
      personalityTraits: config.personalityTraits || [],
      tools: this.initializeTools(config.tools || []),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: config.customSettings || {}
    };

    this.setupEventHandlers();
  }

  /**
   * Get current agent state
   */
  get state(): AgentState {
    return this._state;
  }

  /**
   * Execute a task with the given input
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    this._lastActivity = new Date();
    
    if (this._state !== 'ready') {
      return {
        type: 'error',
        content: `Agent is not ready. Current state: ${this._state}`,
        context: request.context,
        error: {
          code: 'AGENT_NOT_READY',
          message: `Agent state is ${this._state}`,
          details: { currentState: this._state }
        }
      };
    }

    const startTime = Date.now();
    this._executionCount++;
    this.setState('busy');

    this.emit('execution-started', { request, timestamp: new Date() });

    try {
      // Validate request
      this.validateRequest(request);

      // Store request in memory
      await this.memory.store({
        content: `Request: ${request.input}`,
        timestamp: new Date(),
        metadata: {
          type: 'request',
          context: request.context
        }
      });

      // Execute the actual task
      const response = await this.executeTask(request);

      // Store response in memory
      await this.memory.store({
        content: `Response: ${response.content}`,
        timestamp: new Date(),
        metadata: {
          type: 'response',
          context: request.context,
          responseType: response.type
        }
      });

      // Add execution time
      response.executionTime = Date.now() - startTime;
      
      this.setState('ready');
      this.emit('execution-completed', { request, response, timestamp: new Date() });

      return response;

    } catch (error) {
      this._errorCount++;
      this.setState('error');
      
      const errorResponse: AgentResponse = {
        type: 'error',
        content: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        context: request.context,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          details: error
        },
        executionTime: Date.now() - startTime
      };

      this.emit('execution-failed', { request, error: error as Error, timestamp: new Date() });
      
      // Return to ready state after error
      setTimeout(() => this.setState('ready'), 1000);
      
      return errorResponse;
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract executeTask(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Get agent capabilities
   */
  getCapabilities(): Capability[] {
    return this.definition.capabilities;
  }

  /**
   * Get agent personality traits
   */
  getPersonality(): PersonalityTrait[] {
    return this.definition.personalityTraits;
  }

  /**
   * Get available tools
   */
  getTools(): ToolDefinition[] {
    return this.definition.tools;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.setState('initializing');
    
    try {
      await this.onInitialize();
      this.setState('ready');
      this.emit('state-changed', { 
        previousState: 'initializing', 
        newState: 'ready', 
        timestamp: new Date() 
      });
    } catch (error) {
      this.setState('error');
      this.emit('error', { error: error as Error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * Override this method in subclasses for custom initialization
   */
  protected async onInitialize(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Pause agent execution
   */
  async pause(): Promise<void> {
    if (this._state === 'ready' || this._state === 'busy') {
      const previousState = this._state;
      this.setState('paused');
      this.emit('state-changed', { 
        previousState, 
        newState: 'paused', 
        timestamp: new Date() 
      });
    }
  }

  /**
   * Resume agent execution
   */
  async resume(): Promise<void> {
    if (this._state === 'paused') {
      this.setState('ready');
      this.emit('state-changed', { 
        previousState: 'paused', 
        newState: 'ready', 
        timestamp: new Date() 
      });
    }
  }

  /**
   * Terminate the agent
   */
  async terminate(): Promise<void> {
    const previousState = this._state;
    this.setState('terminated');
    
    try {
      await this.onTerminate();
      this.emit('state-changed', { 
        previousState, 
        newState: 'terminated', 
        timestamp: new Date() 
      });
    } catch (error) {
      this.emit('error', { error: error as Error, timestamp: new Date() });
    }
  }

  /**
   * Override this method in subclasses for custom termination
   */
  protected async onTerminate(): Promise<void> {
    // Default implementation clears memory
    await this.memory.clear();
  }

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
  } {
    const uptime = Date.now() - this._startTime.getTime();
    const errorRate = this._executionCount > 0 ? this._errorCount / this._executionCount : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (this._state === 'error' || this._state === 'terminated') {
      status = 'unhealthy';
    } else if (errorRate > 0.1 || this._state === 'paused') {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      memoryUsage: this.memory instanceof SimpleAgentMemory ? this.memory.getSize() : 0,
      executionCount: this._executionCount,
      errorCount: this._errorCount,
      lastActivity: this._lastActivity
    };
  }

  /**
   * Update agent configuration
   */
  async updateConfig(config: Partial<AgentConfig>): Promise<void> {
    this._config = { ...this._config, ...config };
    
    // Update definition if needed
    if (config.personalityTraits) {
      this.definition.personalityTraits = config.personalityTraits;
    }
    
    if (config.capabilities) {
      this.definition.capabilities = this.initializeCapabilities(config.capabilities);
    }
    
    if (config.tools) {
      this.definition.tools = this.initializeTools(config.tools);
    }
    
    this.definition.updatedAt = new Date();
  }

  /**
   * Serialize agent state
   */
  async serialize(): Promise<string> {
    const state = {
      id: this.id,
      definition: this.definition,
      config: this._config,
      state: this._state,
      executionCount: this._executionCount,
      errorCount: this._errorCount,
      startTime: this._startTime,
      lastActivity: this._lastActivity
    };

    return JSON.stringify(state);
  }

  /**
   * Deserialize agent state
   */
  async deserialize(data: string): Promise<void> {
    const state = JSON.parse(data);
    
    this._state = state.state;
    this._executionCount = state.executionCount;
    this._errorCount = state.errorCount;
    this._startTime = new Date(state.startTime);
    this._lastActivity = new Date(state.lastActivity);
  }

  /**
   * Get current lifecycle state
   */
  getLifecycleState(): AgentLifecycleState {
    return {
      agentId: this.id,
      currentState: this._state,
      previousState: null, // Would need to track this separately
      stateHistory: [], // Would need to track this separately
      uptime: Date.now() - this._startTime.getTime(),
      lastStateChange: this._lastActivity,
      isHealthy: this._state !== 'error' && this._state !== 'terminated',
      canPause: this._state === 'ready' || this._state === 'busy',
      canResume: this._state === 'paused',
      canTerminate: this._state !== 'terminated',
      metadata: {}
    };
  }

  /**
   * Check if agent can transition to a new state
   */
  canTransitionTo(newState: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      'initializing': ['ready', 'error', 'terminated'],
      'ready': ['busy', 'paused', 'terminated'],
      'busy': ['ready', 'error', 'paused', 'terminated'],
      'paused': ['ready', 'terminated'],
      'error': ['ready', 'terminated'],
      'terminated': [] // Terminal state
    };

    return validTransitions[this._state]?.includes(newState) || false;
  }

  /**
   * Force a state transition (admin only)
   */
  async forceTransition(newState: AgentState): Promise<void> {
    if (!this.canTransitionTo(newState)) {
      console.warn(`Forcing invalid state transition from ${this._state} to ${newState}`);
    }

    const previousState = this._state;
    this._state = newState;
    this._lastActivity = new Date();

    this.emit('state-changed', {
      previousState,
      newState,
      timestamp: new Date()
    });

    // Handle special state transitions
    switch (newState) {
      case 'terminated':
        await this.onTerminate();
        break;
      case 'ready':
        if (previousState === 'error') {
          // Reset error state
          this._errorCount = 0;
        }
        break;
    }
  }

  /**
   * Generate unique agent ID
   */
  private generateId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set agent state
   */
  private setState(newState: AgentState): void {
    const previousState = this._state;
    this._state = newState;
    this.emit('state-changed', { previousState, newState, timestamp: new Date() });
  }

  /**
   * Validate request
   */
  private validateRequest(request: AgentRequest): void {
    if (!request.input || typeof request.input !== 'string') {
      throw new Error('Invalid request: input must be a non-empty string');
    }
    
    if (!request.context || !request.context.executionId) {
      throw new Error('Invalid request: context with executionId is required');
    }
  }

  /**
   * Initialize capabilities from capability IDs
   */
  private initializeCapabilities(capabilityIds: string[]): Capability[] {
    return capabilityIds.map(id => ({
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `${id} capability`,
      category: 'domain-specific' as const,
      level: 'intermediate' as const,
      keywords: [id]
    }));
  }

  /**
   * Initialize tools from tool IDs
   */
  private initializeTools(toolIds: string[]): ToolDefinition[] {
    return toolIds.map(id => ({
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `${id} tool`,
      parameters: [],
      category: 'general',
      accessLevel: 'public' as const
    }));
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (data) => {
      console.error(`Agent ${this.id} error:`, data.error);
    });
  }
}

/**
 * Type the EventEmitter properly
 */
export interface BaseAgent {
  on<K extends keyof AgentEvents>(event: K, listener: (data: AgentEvents[K]) => void): this;
  emit<K extends keyof AgentEvents>(event: K, data: AgentEvents[K]): boolean;
}