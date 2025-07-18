/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  IAgent, 
  AgentState, 
  AgentConfig, 
  AgentEvents, 
  AgentHealthStatus,
  AgentResourceUsage,
  AgentPerformanceMetrics
} from './types.js';
import { IAgentLifecycle } from './interfaces.js';
import { logger } from '../../utils/Logger.js';
import { CircuitBreaker } from '../../utils/CircuitBreaker.js';

// Default resource limits
const DEFAULT_RESOURCE_LIMITS = {
  maxMemoryMB: 500, // 500MB
  maxExecutionTimeMs: 30000, // 30 seconds
  maxConcurrentRequests: 10,
  rateLimitPerMinute: 100
};

// Default circuit breaker configuration
const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  name: 'agent-lifecycle-manager'
};

/**
 * Agent lifecycle manager implementation
 */
export class AgentLifecycleManager extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private agentHealth: Map<string, AgentHealthStatus> = new Map();
  private resourceUsage: Map<string, AgentResourceUsage> = new Map();
  private performanceMetrics: Map<string, AgentPerformanceMetrics> = new Map();
  private circuitBreaker: CircuitBreaker;
  private resourceLimits: typeof DEFAULT_RESOURCE_LIMITS;
  private isShuttingDown: boolean = false;
  private maintenanceInterval?: NodeJS.Timeout;
  private readonly MAINTENANCE_INTERVAL_MS = 30000; // 30 seconds
  
  /**
   * Normalize error objects for consistent handling
   */
  private normalizeError(error: unknown): { message: string; stack?: string; code?: string; cause?: unknown } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        ...(error as any).code && { code: (error as any).code },
        ...(error as any).cause && { cause: (error as any).cause }
      };
    }
    return { message: String(error) };
  }
  
  /**
   * Sanitize context object to prevent circular references
   */
  private sanitizeContext(context: unknown): Record<string, unknown> {
    try {
      if (!context || typeof context !== 'object') {
        return {};
      }
      
      // Simple sanitization to prevent circular references
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(context)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'function') continue;
        
        if (typeof value === 'object' && !Array.isArray(value)) {
          sanitized[key] = { ...value };
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    } catch (error) {
      return { sanitizationError: 'Failed to sanitize context' };
    }
  }
  
  /**
   * Update agent health status with error information
   */
  private updateAgentHealthStatus(
    agentId: string, 
    options: { 
      error: unknown; 
      timestamp: Date; 
      errorId: string; 
      isRecoverable: boolean 
    }
  ): void {
    const { error, timestamp, errorId, isRecoverable } = options;
    const normalizedError = this.normalizeError(error);
    const currentHealth = this.agentHealth.get(agentId) || { status: 'unknown' };
    const errorCount = (currentHealth.errorCount || 0) + 1;
    
    this.agentHealth.set(agentId, {
      ...currentHealth,
      status: isRecoverable ? 'degraded' : 'unhealthy',
      lastError: {
        id: errorId,
        message: normalizedError.message,
        timestamp,
        stack: normalizedError.stack,
        isRecoverable,
        ...(normalizedError.code && { code: normalizedError.code }),
        ...(normalizedError.cause && { cause: normalizedError.cause })
      },
      errorCount,
      lastChecked: timestamp,
      errorRate: this.calculateErrorRate(agentId, errorCount),
      lastUpdated: timestamp,
      isRecoverable
    });
  }
  
  /**
   * Emit agent error event with proper typing
   */
  private emitAgentErrorEvent(event: {
    agentId: string;
    error: unknown;
    timestamp: Date;
    errorId: string;
    correlationId: string;
    context: Record<string, unknown>;
  }): void {
    const normalizedError = this.normalizeError(event.error);
    
    this.emit('agent-error', {
      agentId: event.agentId,
      error: new Error(normalizedError.message, { cause: event.error }),
      timestamp: event.timestamp,
      errorId: event.errorId,
      correlationId: event.correlationId,
      context: event.context
    });
  }
  
  /**
   * Attempt to recover an agent from an error state
   */
  private async attemptAgentRecovery(
    agentId: string,
    options: {
      error: unknown;
      errorId: string;
      correlationId: string;
      context: Record<string, unknown>;
    }
  ): Promise<void> {
    const { error, errorId, correlationId, context } = options;
    const normalizedError = this.normalizeError(error);
    
    logger.info('Attempting agent recovery', {
      agentId,
      errorId,
      correlationId,
      error: normalizedError.message
    });
    
    try {
      // Implement recovery logic here
      // For example: Reset agent state, clear caches, etc.
      
      // Emit recovery event
      this.emit('agent-recovery-attempt', {
        agentId,
        errorId,
        correlationId,
        timestamp: new Date(),
        success: true
      });
      
    } catch (recoveryError) {
      const normalizedRecoveryError = this.normalizeError(recoveryError);
      
      logger.error('Agent recovery failed', {
        agentId,
        errorId,
        correlationId,
        originalError: normalizedError.message,
        recoveryError: normalizedRecoveryError.message
      });
      
      // Emit recovery failure event
      this.emit('agent-recovery-failed', {
        agentId,
        errorId,
        correlationId,
        timestamp: new Date(),
        error: normalizedRecoveryError,
        context
      });
      
      throw recoveryError;
    }
  }
  
  /**
   * Handle critical errors that cannot be recovered from
   */
  private handleCriticalError(
    agentId: string,
    options: {
      error: unknown;
      errorId: string;
      correlationId: string;
      context: Record<string, unknown>;
    }
  ): void {
    const { error, errorId, correlationId, context } = options;
    const normalizedError = this.normalizeError(error);
    
    logger.fatal('Critical agent error - initiating emergency procedures', {
      agentId,
      errorId,
      correlationId,
      error: normalizedError.message,
      stack: normalizedError.stack
    });
    
    // Emit critical error event
    this.emit('agent-critical-error', {
      agentId,
      error: new Error(normalizedError.message, { cause: error }),
      errorId,
      correlationId,
      timestamp: new Date(),
      context
    });
    
    // Attempt to gracefully terminate the agent
    this.terminateAgent(agentId, {
      emergency: true,
      reason: 'critical_error',
      error: normalizedError.message
    }).catch(terminationError => {
      logger.error('Failed to terminate agent after critical error', {
        agentId,
        errorId,
        correlationId,
        terminationError: this.normalizeError(terminationError).message
      });
    });
  }
  
  /**
   * Calculate error rate for an agent
   */
  private calculateErrorRate(agentId: string, newErrorCount?: number): number {
    const metrics = this.performanceMetrics.get(agentId);
    if (!metrics) return 0;
    
    const totalRequests = metrics.requestCount || 1; // Avoid division by zero
    const errorCount = newErrorCount !== undefined ? newErrorCount : metrics.errorCount || 0;
    
    return Math.min(1, errorCount / totalRequests);
  }
  
  /**
   * Check if an error is recoverable
   */
  private isRecoverableError(error: unknown): boolean {
    if (!(error instanceof Error)) return true;
    
    // Non-recoverable error codes
    const FATAL_ERROR_CODES = [
      'ENOMEM',      // Out of memory
      'EACCES',      // Permission denied
      'EADDRINUSE',  // Port already in use
      'ECONNREFUSED' // Connection refused
    ];
    
    // Check error code
    if ((error as any).code && FATAL_ERROR_CODES.includes((error as any).code)) {
      return false;
    }
    
    // Check error message for fatal patterns
    const FATAL_ERROR_PATTERNS = [
      /out of memory/i,
      /fatal error/i,
      /unrecoverable/i,
      /corrupted state/i
    ];
    
    return !FATAL_ERROR_PATTERNS.some(pattern => pattern.test(error.message));
  }

  constructor(resourceLimits: Partial<typeof DEFAULT_RESOURCE_LIMITS> = {}) {
    super();
    
    this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...resourceLimits };
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      name: 'agent-lifecycle-manager'
    });
    
    // Start maintenance tasks
    this.startMaintenance();
    
    logger.info('AgentLifecycleManager initialized', {
      resourceLimits: this.resourceLimits,
      circuitBreakerConfig: DEFAULT_CIRCUIT_BREAKER_CONFIG
    });
  }

  /**
   * Register an agent for lifecycle management
   */
  async registerAgent(agent: IAgent): Promise<void> {
    const operation = async () => {
      const agentId = agent.id;
      
      try {
        logger.info('Registering agent', { agentId });
        
        if (this.agents.has(agentId)) {
          const error = new Error(`Agent with ID ${agentId} is already registered`);
          logger.error('Agent registration failed', { agentId, error: error.message });
          throw error;
        }

        // Check resource limits before registering
        await this.checkResourceLimits(agentId);
        
        // Register the agent
        this.agents.set(agentId, agent);
        this.agentStates.set(agentId, 'initializing');
        this.agentHealth.set(agentId, { 
          status: 'healthy', 
          lastChecked: new Date(),
          uptime: 0,
          errorRate: 0,
          metrics: {}
        });
        
        // Initialize performance metrics
        this.initializePerformanceMetrics(agentId);
        
        // Set up event listeners with proper error handling
        agent.on('state-changed', this.handleAgentStateChange.bind(this, agentId));
        agent.on('error', this.handleAgentError.bind(this, agentId));
        agent.on('execution-started', this.handleExecutionStart.bind(this, agentId));
        agent.on('execution-completed', this.handleExecutionComplete.bind(this, agentId));
        agent.on('execution-failed', this.handleExecutionFail.bind(this, agentId));
        
        logger.debug('Agent event listeners registered', { agentId });
        
        // Initialize the agent with circuit breaker protection
        await this.initializeAgent(agentId);
        
        logger.info('Agent registered successfully', { agentId, state: 'initializing' });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to register agent', { 
          agentId: agent.id, 
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Clean up if registration fails
        this.cleanupAgent(agent.id);
        throw error;
      }
    };
    
    // Execute with circuit breaker protection
    return this.circuitBreaker.execute(operation);
  }

  /**
   * Unregister an agent from lifecycle management
   */
  async unregisterAgent(agentId: string): Promise<void> {
    try {
      logger.info('Unregistering agent', { agentId });
      
      // Check if agent is registered
      if (!this.agents.has(agentId)) {
        logger.error('Agent not registered', { agentId });
        return;
      }
      
      // Unregister the agent
      this.agents.delete(agentId);
      this.agentStates.delete(agentId);
      this.agentHealth.delete(agentId);
      this.resourceUsage.delete(agentId);
      this.performanceMetrics.delete(agentId);
      
      logger.info('Agent unregistered successfully', { agentId });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to unregister agent', { 
        agentId, 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Get resource usage for an agent
   */
  async getResourceUsage(agentId: string): AgentResourceUsage {
    try {
      const usage = this.resourceUsage.get(agentId) || {};
      const metrics = this.performanceMetrics.get(agentId);
      
      // Calculate current memory usage
      const memoryUsage = process.memoryUsage();
      
      return {
        ...usage,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        },
        cpu: {
          // Placeholder for CPU usage metrics
          user: 0,
          system: 0
        },
        lastUpdated: new Date(),
        metrics: metrics ? {
          avgResponseTime: metrics.avgResponseTime,
          requestCount: metrics.requestCount,
          errorRate: metrics.errorRate,
          activeRequests: metrics.activeRequests
        } : undefined
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting resource usage', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        status: 'error',
        error: errorMessage,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get agent state
   */
  getAgentState(agentId: string): AgentState {
    try {
      const state = this.agentStates.get(agentId);
      if (!state) {
        logger.warn('Agent state not found', { agentId });
        return 'unknown';
      }
      return state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting agent state', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return 'error';
    }
  }

  /**
   * Get agent health
   */
  getAgentHealth(agentId: string): AgentHealthStatus {
    try {
      const health = this.agentHealth.get(agentId);
      if (!health) {
        logger.warn('Agent health not found', { agentId });
        return { 
          status: 'unknown',
          lastChecked: new Date(),
          uptime: 0,
          errorRate: 0,
          metrics: {}
        };
      }
      
      // Calculate uptime if possible
      const metrics = this.performanceMetrics.get(agentId);
      const uptime = metrics?.startTime ? Date.now() - metrics.startTime : 0;
      
      return {
        ...health,
        uptime,
        lastChecked: new Date()
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting agent health', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return { 
        status: 'error', 
        lastChecked: new Date(),
        uptime: 0,
        errorRate: 1,
        metrics: {},
        error: errorMessage
      };
    }
  }

  /**
   * Handle agent state change
   */
  private handleAgentStateChange(agentId: string, event: any): void {
    try {
      const { newState } = event;
      logger.info('Agent state changed', { agentId, newState });
      
      // Update agent state
      this.agentStates.set(agentId, newState);
      
      // Update performance metrics
      this.updatePerformanceMetrics(agentId, {
        lastStateChange: new Date(),
        stateChanges: (this.performanceMetrics.get(agentId)?.stateChanges || 0) + 1
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling agent state change', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Handle agent error
   */
  /**
   * Handle agent errors with comprehensive logging and recovery
   */
  private handleAgentError(agentId: string, event: any): void {
    const { error, context = {} } = event;
    const timestamp = new Date();
    const errorId = uuidv4();
    const correlationId = event.correlationId || uuidv4();
    
    try {
      // Validate inputs
      if (!agentId) {
        throw new Error('Agent ID is required');
      }
      
      // Extract error details with proper type checking
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack;
      const errorCode = error?.code || 'UNKNOWN_ERROR';
      const isRecoverable = this.isRecoverableError(error);
      
      // Create structured error context
      const errorContext = {
        errorId,
        agentId,
        correlationId,
        timestamp: timestamp.toISOString(),
        error: {
          message: errorMessage,
          code: errorCode,
          stack: errorStack,
          isRecoverable,
          ...(error?.cause && { cause: error.cause })
        },
        context: this.sanitizeContext(context)
      };
      
      // Log error with appropriate level
      if (isRecoverable) {
        logger.warn('Recoverable agent error occurred', errorContext);
      } else {
        logger.error('Critical agent error occurred', errorContext);
      }
      
      // Update health status with circuit breaker pattern
      this.updateAgentHealthStatus(agentId, {
        error,
        timestamp,
        errorId,
        isRecoverable
      });
      
      // Emit error event with correlation ID
      this.emitAgentErrorEvent({
        agentId,
        error,
        timestamp,
        errorId,
        correlationId,
        context: {
          ...context,
          currentState: this.agentStates.get(agentId),
          healthStatus: this.agentHealth.get(agentId)?.status || 'unknown',
          isRecoverable
        }
      });
      
      // Attempt recovery for recoverable errors
      if (isRecoverable) {
        this.attemptAgentRecovery(agentId, {
          error,
          errorId,
          correlationId,
          context
        }).catch(recoveryError => {
          logger.error('Agent recovery attempt failed', {
            errorId,
            agentId,
            correlationId,
            recoveryError: this.normalizeError(recoveryError),
            originalError: this.normalizeError(error),
            timestamp: new Date().toISOString()
          });
        });
      } else {
        // For critical errors, trigger emergency procedures
        this.handleCriticalError(agentId, {
          error,
          errorId,
          correlationId,
          context
        });
      }
      
    } catch (handlerError) {
      // Critical error in error handler - use minimal logging to avoid recursive errors
      console.error(`CRITICAL ERROR in handleAgentError: ${this.normalizeError(handlerError).message}`, {
        agentId,
        errorId,
        originalError: this.normalizeError(error),
        handlerError: this.normalizeError(handlerError),
        timestamp: new Date().toISOString()
      });
      
      // Use process.nextTick to prevent unhandled promise rejections
      process.nextTick(() => {
        throw Object.assign(new Error('Unrecoverable error in error handler'), {
          code: 'ERROR_HANDLER_FAILURE',
          cause: handlerError,
          originalError: error,
          agentId,
          errorId,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  /**
   * Handle execution start
   */
  private handleExecutionStart(agentId: string, event: any): void {
    try {
      const { executionId } = event;
      logger.debug('Execution started', { agentId, executionId });
      
      // Update performance metrics
      this.updatePerformanceMetrics(agentId, {
        activeRequests: (this.performanceMetrics.get(agentId)?.activeRequests || 0) + 1
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling execution start', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Handle execution complete
   */
  private handleExecutionComplete(agentId: string, event: any): void {
    try {
      const { executionId, responseTime } = event;
      logger.debug('Execution completed', { agentId, executionId, responseTime });
      
      // Update performance metrics
      this.updatePerformanceMetrics(agentId, {
        requestCount: (this.performanceMetrics.get(agentId)?.requestCount || 0) + 1,
        avgResponseTime: this.calculateAverageResponseTime(this.performanceMetrics.get(agentId)?.avgResponseTime, responseTime),
        activeRequests: (this.performanceMetrics.get(agentId)?.activeRequests || 0) - 1
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error handling execution complete', {
        agentId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Get default resource usage metrics
   */
  private getDefaultResourceUsage() {
    return {
      memory: {
        used: 0,
        peak: 0,
        limit: this.resourceLimits.maxMemoryMB,
        unit: 'MB'
      },
      cpu: {
        usage: 0,
        peak: 0,
        limit: 100, // percentage
        unit: '%'
      },
      storage: {
        used: 0,
        limit: 0, // Not used by default
        unit: 'MB'
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        connections: 0
      },
      executionTime: {
        total: 0,
        average: 0,
        peak: 0,
        unit: 'milliseconds'
      }
    };
  }
}

/**
 * Performance tracker for agents
 */
class PerformanceTracker {
  public executionCount = 0;
  public errorCount = 0;
  public totalExecutionTime = 0;
  public peakExecutionTime = 0;
  public peakMemoryUsage = 0;
  public peakCpuUsage = 0;
  public networkBytesIn = 0;
  public networkBytesOut = 0;
  
  private responseTimesMs: number[] = [];
  private currentExecutionStart: number = 0;

  recordExecutionStart(): void {
    this.currentExecutionStart = Date.now();
  }

  recordExecutionComplete(executionTime: number): void {
    this.executionCount++;
    this.totalExecutionTime += executionTime;
    this.peakExecutionTime = Math.max(this.peakExecutionTime, executionTime);
    
    this.responseTimesMs.push(executionTime);
    
    // Keep only last 100 response times
    if (this.responseTimesMs.length > 100) {
      this.responseTimesMs.shift();
    }
  }

  recordExecutionError(): void {
    this.errorCount++;
    this.executionCount++;
  }

  getAverageResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    return this.responseTimesMs.reduce((sum, time) => sum + time, 0) / this.responseTimesMs.length;
  }

  getMedianResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }

  getPercentile95ResponseTime(): number {
    if (this.responseTimesMs.length === 0) return 0;
    const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }
}

/**
 * Configuration for AgentLifecycleManager
 */
export interface AgentLifecycleManagerConfig {
  resourceLimits?: Partial<ResourceLimits>;
  healthMonitoringInterval?: number;
  enableHealthMonitoring?: boolean;
}

/**
 * Lifecycle manager events
 */
export interface AgentLifecycleManagerEvents {
  'agent-registered': { agentId: string; agent: IAgent };
  'agent-unregistered': { agentId: string };
  'agent-state-changed': { agentId: string; transition: StateTransition };
  'agent-unhealthy': { agentId: string; health: AgentHealthMetrics };
  'agent-upgraded': { agentId: string; newVersion: string; previousVersion: string };
}

/**
 * Type the EventEmitter properly
 */
export interface AgentLifecycleManager {
  on<K extends keyof AgentLifecycleManagerEvents>(event: K, listener: (data: AgentLifecycleManagerEvents[K]) => void): this;
  emit<K extends keyof AgentLifecycleManagerEvents>(event: K, data: AgentLifecycleManagerEvents[K]): boolean;
}