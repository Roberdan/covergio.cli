/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
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
import { logger } from '../../utils/Logger.js';
import { CircuitBreaker } from '../../utils/CircuitBreaker.js';

// Default circuit breaker configuration
const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,
  resetTimeoutMs: 30000, // 30 seconds
  name: 'agent-operation'
};

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
  private _stateLock: Promise<void> = Promise.resolve();
  private _circuitBreaker: CircuitBreaker;
  private _initializationAttempts = 0;
  private _maxInitializationAttempts = 3;
  private _initializationDelayMs = 1000; // 1 second
  private _correlationId: string = '';

  constructor(config: AgentConfig) {
    super();
    
    this.id = config.id || this.generateId();
    this._config = config;
    this.memory = config.memory || new SimpleAgentMemory();
    this._correlationId = uuidv4();
    
    // Initialize circuit breaker with config or defaults
    this._circuitBreaker = new CircuitBreaker(
      config.circuitBreakerConfig || DEFAULT_CIRCUIT_BREAKER_CONFIG
    );
    
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
      metadata: {
        ...(config.customSettings || {}),
        correlationId: this._correlationId
      }
    };

    this.setupEventHandlers();
    
    // Log agent creation
    logger.info('Agent created', {
      agentId: this.id,
      domain: this.definition.domain,
      role: this.definition.role,
      correlationId: this._correlationId
    });
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
    const startTime = Date.now();
    const requestId = uuidv4();
    const requestCorrelationId = request.context?.correlationId || uuidv4();
    
    // Set correlation ID for logging
    const originalCorrelationId = logger.correlationId;
    logger.setCorrelationId(requestCorrelationId);
    
    try {
      logger.info('Agent execution started', {
        agentId: this.id,
        requestId,
        correlationId: requestCorrelationId,
        input: request.input ? JSON.stringify(request.input).substring(0, 500) : undefined,
        context: request.context
      });
      
      this._lastActivity = new Date();
      
      // Check agent state with circuit breaker protection
      const stateCheck = await this._circuitBreaker.execute(async () => {
        if (this._state !== 'ready') {
          throw new Error(`AGENT_NOT_READY: Current state is ${this._state}`);
        }
        return true;
      });
      
      if (!stateCheck) {
        throw new Error('Agent state check failed');
      }

      // Execute with circuit breaker protection
      const response = await this._circuitBreaker.execute(async () => {
        this._executionCount++;
        
        // Use a lock to prevent concurrent state changes
        await this.withStateLock(async () => {
          if (this._state !== 'ready') {
            throw new Error(`Cannot execute in current state: ${this._state}`);
          }
          this._state = 'busy';
        });

        this.emit('execution-started', { 
          request, 
          timestamp: new Date(),
          requestId,
          correlationId: requestCorrelationId
        });

        try {
          // Validate request
          this.validateRequest(request);

          // Store request in memory with metadata
          await this.memory.store({
            content: `Request: ${JSON.stringify(request.input)}`,
            timestamp: new Date(),
            metadata: {
              type: 'request',
              context: request.context,
              requestId,
              correlationId: requestCorrelationId,
              agentId: this.id
            }
          });

          logger.debug('Executing agent task', {
            agentId: this.id,
            requestId,
            correlationId: requestCorrelationId
          });

          // Execute the actual task
          const response = await this.executeTask(request);

          // Store response in memory
          await this.memory.store({
            content: `Response: ${JSON.stringify(response.content)}`,
            timestamp: new Date(),
            metadata: {
              type: 'response',
              context: request.context,
              responseType: response.type,
              requestId,
              correlationId: requestCorrelationId,
              agentId: this.id
            }
          });

          // Add execution time
          response.executionTime = Date.now() - startTime;
          
          // Update state in a thread-safe way
          await this.withStateLock(() => {
            this._state = 'ready';
          });
          
          this.emit('execution-completed', { 
            request, 
            response, 
            timestamp: new Date(),
            requestId,
            correlationId: requestCorrelationId,
            executionTime: response.executionTime
          });
          
          logger.info('Agent execution completed', {
            agentId: this.id,
            requestId,
            correlationId: requestCorrelationId,
            executionTime: response.executionTime,
            responseType: response.type
          });

          return response;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          
          this._errorCount++;
          
          // Log the error with context
          logger.error('Agent execution failed', {
            agentId: this.id,
            requestId,
            correlationId: requestCorrelationId,
            error: errorMessage,
            stack: errorStack,
            state: this._state,
            executionTime: Date.now() - startTime
          });
          
          // Set error state with recovery
          await this.withStateLock(async () => {
            this._state = 'error';
            // Schedule recovery after a delay
            setTimeout(() => this.recoverFromError(), 5000);
          });
          
          const errorResponse: AgentResponse = {
            type: 'error',
            content: `Execution failed: ${errorMessage}`,
            context: {
              ...request.context,
              requestId,
              correlationId: requestCorrelationId
            },
            error: {
              code: 'EXECUTION_FAILED',
              message: errorMessage,
              details: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
              } : error
            },
            executionTime: Date.now() - startTime,
            metadata: {
              requestId,
              correlationId: requestCorrelationId,
              agentId: this.id
            }
          };

          this.emit('execution-failed', { 
            request, 
            error: error as Error, 
            timestamp: new Date(),
            requestId,
            correlationId: requestCorrelationId,
            response: errorResponse
          });
          
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
    const operation = async (): Promise<void> => {
      try {
        logger.debug('Initializing agent', { agentId: this.id, state: this._state });
        await this.onInitialize();
        await this.setState('ready');
        this._initializationAttempts = 0; // Reset attempts on success
      } catch (error) {
        this._initializationAttempts++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.error('Agent initialization failed', {
          agentId: this.id,
          attempt: this._initializationAttempts,
          error: errorMessage,
          state: this._state,
          stack: error instanceof Error ? error.stack : undefined
        });

        if (this._initializationAttempts >= this._maxInitializationAttempts) {
          logger.error('Max initialization attempts reached', {
            agentId: this.id,
            maxAttempts: this._maxInitializationAttempts
          });
          await this.setState('error');
          throw new Error(`Failed to initialize agent after ${this._maxInitializationAttempts} attempts: ${errorMessage}`);
        }

        // Exponential backoff before retry
        const delay = this._initializationDelayMs * Math.pow(2, this._initializationAttempts - 1);
        logger.info(`Retrying initialization in ${delay}ms`, {
          agentId: this.id,
          attempt: this._initializationAttempts,
          nextAttemptInMs: delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initialize(); // Recursive retry
      }
    };

    // Execute with circuit breaker protection
    return this._circuitBreaker.execute(operation);
  }

  /**
   * Force a state transition (admin only)
   */
  async forceTransition(newState: AgentState): Promise<void> {
    if (!this.canTransitionTo(newState)) {
      console.warn(`Forcing invalid state transition from ${this._state} to ${newState}`);
    }

    const previousState = this._state;
    await this.setState(newState);
    
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
   * Set agent state with validation and locking
   */
  private async setState(newState: AgentState): Promise<void> {
    return this.withStateLock(async () => {
      if (this._state === newState) return;
      
      if (!this.canTransitionTo(newState)) {
        const error = new Error(`Invalid state transition from ${this._state} to ${newState}`);
        logger.error('State transition failed', {
          agentId: this.id,
          fromState: this._state,
          toState: newState,
          error: error.message
        });
        throw error;
      }
      
      const oldState = this._state;
      this._state = newState;
      this._lastActivity = new Date();
      
      logger.debug('Agent state changed', {
        agentId: this.id,
        fromState: oldState,
        toState: newState,
        correlationId: this._correlationId
      });
      
      this.emit('state-changed', {
        previousState: oldState,
        newState,
        timestamp: new Date(),
        agentId: this.id,
        correlationId: this._correlationId
      });
    });
  }
  
  /**
   * Execute a function with state lock to prevent race conditions
   */
  private async withStateLock<T>(fn: () => T | Promise<T>): Promise<T> {
    // Chain the operation to ensure sequential execution
    this._stateLock = this._stateLock.then(async () => {
      try {
        return await Promise.resolve(fn());
      } catch (error) {
        logger.error('Error in state-locked operation', {
          agentId: this.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          correlationId: this._correlationId
        });
        throw error;
      }
    });
    
    return this._stateLock;
  }
  
  /**
   * Attempt to recover from error state
   */
  private async recoverFromError(): Promise<void> {
    try {
      logger.info('Attempting to recover agent from error state', {
        agentId: this.id,
        correlationId: this._correlationId
      });
      
      // Reset error count and attempt recovery
      this._errorCount = 0;
      await this.initialize();
      
      logger.info('Agent recovered from error state', {
        agentId: this.id,
        correlationId: this._correlationId,
        newState: this._state
      });
    } catch (error) {
      logger.error('Failed to recover agent from error state', {
        agentId: this.id,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this._correlationId,
        nextRetryInMs: 30000 // 30 seconds
      });
      
      // Schedule another recovery attempt
      setTimeout(() => this.recoverFromError(), 30000);
    }
  }

  /**
   * Validate request
   */
  private validateRequest(request: AgentRequest): void {
    try {
      if (!request || typeof request !== 'object') {
        throw new Error('Invalid request: must be an object');
      }
      
      if (!request.input && !request.context) {
        throw new Error('Invalid request: must have either input or context');
      }
      
      // Validate input size if present
      if (request.input) {
        const inputStr = JSON.stringify(request.input);
        const maxInputSize = this._config.maxInputSize || 1024 * 1024; // 1MB default
        
        if (inputStr.length > maxInputSize) {
          throw new Error(`Input size (${inputStr.length} bytes) exceeds maximum allowed size (${maxInputSize} bytes)`);
        }
      }
      
      // Validate context if present
      if (request.context) {
        if (typeof request.context !== 'object') {
          throw new Error('Context must be an object');
        }
        
        // Add any additional context validation here
      }
      
    } catch (error) {
      logger.error('Request validation failed', {
        agentId: this.id,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this._correlationId,
        request: {
          hasInput: !!request.input,
          inputType: request.input ? typeof request.input : undefined,
          hasContext: !!request.context,
          contextType: request.context ? typeof request.context : undefined
        }
      });
      throw error; // Re-throw to be handled by the caller
    }
  }

  // ... (rest of the class remains the same)
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