/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { AutoGenError } from '../types';

/**
 * Tool execution permission levels
 */
export type ToolPermissionLevel = 'public' | 'restricted' | 'private' | 'admin';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  agentId: string;
  conversationId?: string;
  sessionId?: string;
  timestamp: Date;
  parameters: Record<string, any>;
  environment: Record<string, any>;
}

/**
 * Tool definition for registry
 */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  permissionLevel: ToolPermissionLevel;
  allowedAgents?: string[];
  blockedAgents?: string[];
  rateLimits?: {
    maxCallsPerMinute: number;
    maxCallsPerHour: number;
    maxCallsPerDay: number;
  };
  dependencies?: string[];
  schema: {
    parameters: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      default?: any;
      validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        enum?: any[];
      };
    }>;
    returns: {
      type: string;
      description: string;
      schema?: Record<string, any>;
    };
  };
  execute: (context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  metadata?: Record<string, any>;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolId: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  lastUsed: Date;
  usageByAgent: Record<string, number>;
  rateLimitViolations: number;
}

/**
 * Tool conflict detection result
 */
export interface ToolConflict {
  type: 'resource' | 'dependency' | 'permission' | 'timing';
  description: string;
  conflictingTools: string[];
  suggestedResolution?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Tool execution queue item
 */
interface ToolExecutionQueueItem {
  id: string;
  toolId: string;
  context: ToolExecutionContext;
  priority: number;
  scheduledTime: Date;
  timeout: number;
  retryCount: number;
  maxRetries: number;
  resolve: (result: ToolExecutionResult) => void;
  reject: (error: Error) => void;
}

/**
 * Tool registry for managing agent tools and coordinating their execution
 */
export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private usageStats: Map<string, ToolUsageStats> = new Map();
  private rateLimitTracker: Map<string, Map<string, number[]>> = new Map(); // toolId -> agentId -> timestamps
  private executionQueue: ToolExecutionQueueItem[] = [];
  private activeExecutions: Map<string, ToolExecutionQueueItem> = new Map();
  private isProcessingQueue: boolean = false;
  
  // Resource locks for preventing conflicts
  private resourceLocks: Map<string, {
    lockedBy: string;
    lockTime: Date;
    timeout: number;
  }> = new Map();

  constructor() {
    super();
    this.startQueueProcessor();
  }

  /**
   * Register a new tool
   */
  async registerTool(tool: ToolDefinition): Promise<void> {
    try {
      // Validate tool definition
      this.validateToolDefinition(tool);

      // Check for conflicts with existing tools
      const conflicts = this.detectToolConflicts(tool);
      if (conflicts.some(c => c.severity === 'critical')) {
        throw new Error(`Critical conflicts detected: ${conflicts.map(c => c.description).join(', ')}`);
      }

      // Register the tool
      this.tools.set(tool.id, tool);

      // Initialize usage stats
      this.usageStats.set(tool.id, {
        toolId: tool.id,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageExecutionTime: 0,
        lastUsed: new Date(),
        usageByAgent: {},
        rateLimitViolations: 0
      });

      this.emit('tool-registered', {
        toolId: tool.id,
        tool,
        conflicts: conflicts.filter(c => c.severity !== 'critical')
      });

    } catch (error) {
      throw new AutoGenError(
        `Failed to register tool ${tool.id}: ${error.message}`,
        'TOOL_REGISTRATION_ERROR',
        { tool, error }
      );
    }
  }

  /**
   * Unregister a tool
   */
  async unregisterTool(toolId: string): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Check if tool is currently in use
    const activeExecution = Array.from(this.activeExecutions.values())
      .find(item => item.toolId === toolId);
    
    if (activeExecution) {
      throw new Error(`Cannot unregister tool ${toolId}: currently being executed`);
    }

    // Remove from registry
    this.tools.delete(toolId);
    this.usageStats.delete(toolId);
    this.rateLimitTracker.delete(toolId);

    this.emit('tool-unregistered', { toolId, tool });
  }

  /**
   * Execute a tool with coordination and conflict prevention
   */
  async executeTool(
    toolId: string,
    context: ToolExecutionContext,
    options: {
      priority?: number;
      timeout?: number;
      maxRetries?: number;
      skipQueue?: boolean;
    } = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Check permissions
    if (!this.checkToolPermission(toolId, context.agentId)) {
      throw new Error(`Agent ${context.agentId} does not have permission to use tool ${toolId}`);
    }

    // Check rate limits
    if (!this.checkRateLimit(toolId, context.agentId)) {
      const stats = this.usageStats.get(toolId)!;
      stats.rateLimitViolations++;
      throw new Error(`Rate limit exceeded for tool ${toolId} by agent ${context.agentId}`);
    }

    // Validate parameters
    this.validateToolParameters(tool, context.parameters);

    return new Promise((resolve, reject) => {
      const executionItem: ToolExecutionQueueItem = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        toolId,
        context,
        priority: options.priority || 5,
        scheduledTime: new Date(),
        timeout: options.timeout || 30000,
        retryCount: 0,
        maxRetries: options.maxRetries || 2,
        resolve,
        reject
      };

      if (options.skipQueue) {
        this.executeToolDirectly(executionItem);
      } else {
        this.enqueueExecution(executionItem);
      }
    });
  }

  /**
   * Get list of available tools for an agent
   */
  getAvailableTools(agentId: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(tool => this.checkToolPermission(tool.id, agentId));
  }

  /**
   * Get tool by ID
   */
  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get tool usage statistics
   */
  getToolStats(toolId?: string): ToolUsageStats | ToolUsageStats[] {
    if (toolId) {
      const stats = this.usageStats.get(toolId);
      if (!stats) {
        throw new Error(`Tool ${toolId} not found`);
      }
      return stats;
    }
    
    return Array.from(this.usageStats.values());
  }

  /**
   * Detect potential tool conflicts
   */
  detectToolConflicts(newTool: ToolDefinition): ToolConflict[] {
    const conflicts: ToolConflict[] = [];

    for (const existingTool of this.tools.values()) {
      // Name conflict
      if (existingTool.name === newTool.name && existingTool.id !== newTool.id) {
        conflicts.push({
          type: 'resource',
          description: `Tool name '${newTool.name}' already exists`,
          conflictingTools: [existingTool.id, newTool.id],
          severity: 'high'
        });
      }

      // Dependency conflicts
      if (newTool.dependencies?.includes(existingTool.id) && 
          existingTool.dependencies?.includes(newTool.id)) {
        conflicts.push({
          type: 'dependency',
          description: `Circular dependency detected between ${existingTool.id} and ${newTool.id}`,
          conflictingTools: [existingTool.id, newTool.id],
          severity: 'critical'
        });
      }

      // Resource conflicts (same category with restrictive permissions)
      if (existingTool.category === newTool.category &&
          existingTool.permissionLevel === 'private' &&
          newTool.permissionLevel === 'private') {
        conflicts.push({
          type: 'permission',
          description: `Multiple private tools in category '${newTool.category}'`,
          conflictingTools: [existingTool.id, newTool.id],
          severity: 'medium',
          suggestedResolution: 'Consider making one tool public or use different categories'
        });
      }
    }

    return conflicts;
  }

  /**
   * Lock a resource to prevent conflicts
   */
  async lockResource(
    resourceId: string,
    agentId: string,
    timeout: number = 30000
  ): Promise<boolean> {
    const existingLock = this.resourceLocks.get(resourceId);
    
    if (existingLock) {
      // Check if lock has expired
      if (Date.now() - existingLock.lockTime.getTime() > existingLock.timeout) {
        this.resourceLocks.delete(resourceId);
      } else if (existingLock.lockedBy !== agentId) {
        return false; // Resource is locked by another agent
      }
    }

    this.resourceLocks.set(resourceId, {
      lockedBy: agentId,
      lockTime: new Date(),
      timeout
    });

    this.emit('resource-locked', { resourceId, agentId, timeout });
    return true;
  }

  /**
   * Unlock a resource
   */
  async unlockResource(resourceId: string, agentId: string): Promise<void> {
    const lock = this.resourceLocks.get(resourceId);
    
    if (!lock) {
      throw new Error(`Resource ${resourceId} is not locked`);
    }
    
    if (lock.lockedBy !== agentId) {
      throw new Error(`Resource ${resourceId} is locked by ${lock.lockedBy}, not ${agentId}`);
    }

    this.resourceLocks.delete(resourceId);
    this.emit('resource-unlocked', { resourceId, agentId });
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Clear all resource locks (emergency use)
   */
  clearAllLocks(): void {
    const lockedResources = Array.from(this.resourceLocks.keys());
    this.resourceLocks.clear();
    
    this.emit('all-locks-cleared', { clearedResources: lockedResources });
  }

  /**
   * Private helper methods
   */

  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.id || !tool.name || !tool.execute) {
      throw new Error('Tool must have id, name, and execute function');
    }

    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with id ${tool.id} already exists`);
    }

    // Validate schema
    if (!tool.schema || !tool.schema.parameters || !tool.schema.returns) {
      throw new Error('Tool must have valid schema with parameters and returns');
    }
  }

  private checkToolPermission(toolId: string, agentId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    switch (tool.permissionLevel) {
      case 'public':
        return true;
        
      case 'restricted':
        return tool.allowedAgents?.includes(agentId) || false;
        
      case 'private':
        return tool.allowedAgents?.includes(agentId) || false;
        
      case 'admin':
        return agentId.includes('admin') || agentId.includes('moderator');
        
      default:
        return false;
    }
  }

  private checkRateLimit(toolId: string, agentId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool?.rateLimits) return true;

    if (!this.rateLimitTracker.has(toolId)) {
      this.rateLimitTracker.set(toolId, new Map());
    }

    const toolTracker = this.rateLimitTracker.get(toolId)!;
    if (!toolTracker.has(agentId)) {
      toolTracker.set(agentId, []);
    }

    const agentTimestamps = toolTracker.get(agentId)!;
    const now = Date.now();

    // Clean old timestamps
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    // Filter out old timestamps
    const recentTimestamps = agentTimestamps.filter(timestamp => 
      (now - timestamp) < oneDay
    );

    // Check limits
    const minuteCount = recentTimestamps.filter(timestamp => 
      (now - timestamp) < oneMinute
    ).length;

    const hourCount = recentTimestamps.filter(timestamp => 
      (now - timestamp) < oneHour
    ).length;

    const dayCount = recentTimestamps.length;

    if (tool.rateLimits.maxCallsPerMinute && minuteCount >= tool.rateLimits.maxCallsPerMinute) {
      return false;
    }

    if (tool.rateLimits.maxCallsPerHour && hourCount >= tool.rateLimits.maxCallsPerHour) {
      return false;
    }

    if (tool.rateLimits.maxCallsPerDay && dayCount >= tool.rateLimits.maxCallsPerDay) {
      return false;
    }

    // Add current timestamp
    recentTimestamps.push(now);
    toolTracker.set(agentId, recentTimestamps);

    return true;
  }

  private validateToolParameters(tool: ToolDefinition, parameters: Record<string, any>): void {
    for (const [paramName, paramDef] of Object.entries(tool.schema.parameters)) {
      const value = parameters[paramName];

      // Check required parameters
      if (paramDef.required && (value === undefined || value === null)) {
        throw new Error(`Required parameter '${paramName}' is missing`);
      }

      // Type validation
      if (value !== undefined && value !== null) {
        if (!this.validateParameterType(value, paramDef.type)) {
          throw new Error(`Parameter '${paramName}' must be of type ${paramDef.type}`);
        }

        // Validation rules
        if (paramDef.validation) {
          this.validateParameterRules(value, paramDef.validation, paramName);
        }
      }
    }
  }

  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private validateParameterRules(
    value: any,
    validation: any,
    paramName: string
  ): void {
    if (validation.min !== undefined && value < validation.min) {
      throw new Error(`Parameter '${paramName}' must be >= ${validation.min}`);
    }

    if (validation.max !== undefined && value > validation.max) {
      throw new Error(`Parameter '${paramName}' must be <= ${validation.max}`);
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        throw new Error(`Parameter '${paramName}' does not match required pattern`);
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      throw new Error(`Parameter '${paramName}' must be one of: ${validation.enum.join(', ')}`);
    }
  }

  private enqueueExecution(item: ToolExecutionQueueItem): void {
    // Insert in priority order
    const insertIndex = this.executionQueue.findIndex(
      queueItem => queueItem.priority < item.priority
    );
    
    if (insertIndex === -1) {
      this.executionQueue.push(item);
    } else {
      this.executionQueue.splice(insertIndex, 0, item);
    }

    this.emit('tool-queued', {
      executionId: item.id,
      toolId: item.toolId,
      agentId: item.context.agentId,
      queuePosition: insertIndex === -1 ? this.executionQueue.length : insertIndex + 1
    });

    this.processQueue();
  }

  private async executeToolDirectly(item: ToolExecutionQueueItem): Promise<void> {
    const tool = this.tools.get(item.toolId)!;
    const startTime = Date.now();

    try {
      this.activeExecutions.set(item.id, item);

      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), item.timeout);
      });

      const executionPromise = tool.execute(item.context);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const executionTime = Date.now() - startTime;

      // Update statistics
      this.updateToolStats(item.toolId, item.context.agentId, true, executionTime);

      this.emit('tool-executed', {
        executionId: item.id,
        toolId: item.toolId,
        agentId: item.context.agentId,
        result,
        executionTime
      });

      item.resolve(result);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update statistics
      this.updateToolStats(item.toolId, item.context.agentId, false, executionTime);

      // Retry logic
      if (item.retryCount < item.maxRetries) {
        item.retryCount++;
        setTimeout(() => this.executeToolDirectly(item), 1000 * item.retryCount);
        return;
      }

      this.emit('tool-execution-failed', {
        executionId: item.id,
        toolId: item.toolId,
        agentId: item.context.agentId,
        error: error.message,
        retryCount: item.retryCount
      });

      item.reject(error);
    } finally {
      this.activeExecutions.delete(item.id);
    }
  }

  private updateToolStats(
    toolId: string,
    agentId: string,
    success: boolean,
    executionTime: number
  ): void {
    const stats = this.usageStats.get(toolId)!;
    
    stats.totalCalls++;
    stats.lastUsed = new Date();
    
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    // Update average execution time
    stats.averageExecutionTime = 
      (stats.averageExecutionTime * (stats.totalCalls - 1) + executionTime) / stats.totalCalls;

    // Update usage by agent
    stats.usageByAgent[agentId] = (stats.usageByAgent[agentId] || 0) + 1;
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100); // Process queue every 100ms
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const item = this.executionQueue.shift()!;
      await this.executeToolDirectly(item);
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }
}