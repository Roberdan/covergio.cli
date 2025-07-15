/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Base error class for all orchestrator errors
 */
export abstract class OrchestratorError extends Error {
  abstract get code(): string;
  abstract readonly category: ErrorCategory;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly severity: ErrorSeverity;

  constructor(
    message: string,
    context?: Record<string, unknown>,
    retryable = false,
    severity: ErrorSeverity = 'error'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    this.retryable = retryable;
    this.severity = severity;
    
    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to structured format for logging/monitoring
   */
  toStructured(): StructuredError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      timestamp: this.timestamp,
      context: this.context,
      retryable: this.retryable,
      severity: this.severity,
      stack: this.stack,
    };
  }
}

export type ErrorCategory = 
  | 'configuration'
  | 'routing'
  | 'workflow'
  | 'agent'
  | 'network'
  | 'validation'
  | 'resource'
  | 'timeout'
  | 'security'
  | 'system';

export type ErrorSeverity = 'warning' | 'error' | 'critical';

export interface StructuredError {
  name: string;
  message: string;
  code: string;
  category: ErrorCategory;
  timestamp: Date;
  context?: Record<string, unknown>;
  retryable: boolean;
  severity: ErrorSeverity;
  stack?: string;
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends OrchestratorError {
  get code(): string { return 'CONFIG_ERROR'; }
  readonly category: ErrorCategory = 'configuration';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, false, 'error');
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  get code(): string { return 'INVALID_CONFIG'; }

  constructor(configKey: string, expectedType: string, actualValue: unknown) {
    super(
      `Invalid configuration for '${configKey}': expected ${expectedType}, got ${typeof actualValue}`,
      { configKey, expectedType, actualValue }
    );
  }
}

export class MissingConfigurationError extends ConfigurationError {
  get code(): string { return 'MISSING_CONFIG'; }

  constructor(configKey: string) {
    super(`Missing required configuration: ${configKey}`, { configKey });
  }
}

/**
 * Routing-related errors
 */
export class RoutingError extends OrchestratorError {
  get code(): string { return 'ROUTING_ERROR'; }
  readonly category: ErrorCategory = 'routing';

  constructor(message: string, context?: Record<string, unknown>, retryable = true) {
    super(message, context, retryable, 'error');
  }
}

export class NoHandlerFoundError extends RoutingError {
  get code(): string { return 'NO_HANDLER_FOUND'; }

  constructor(requestType: string, availableHandlers: string[]) {
    super(
      `No suitable handler found for request type: ${requestType}`,
      { requestType, availableHandlers },
      false
    );
  }
}

export class HandlerNotAvailableError extends RoutingError {
  get code(): string { return 'HANDLER_NOT_AVAILABLE'; }

  constructor(handlerId: string, reason: string) {
    super(
      `Handler '${handlerId}' is not available: ${reason}`,
      { handlerId, reason },
      true
    );
  }
}

export class RoutingCapacityExceededError extends RoutingError {
  get code(): string { return 'ROUTING_CAPACITY_EXCEEDED'; }

  constructor(currentLoad: number, maxCapacity: number) {
    super(
      `Routing capacity exceeded: ${currentLoad}/${maxCapacity}`,
      { currentLoad, maxCapacity },
      true
    );
  }
}

/**
 * Workflow-related errors
 */
export class WorkflowError extends OrchestratorError {
  get code(): string { return 'WORKFLOW_ERROR'; }
  readonly category: ErrorCategory = 'workflow';

  constructor(message: string, context?: Record<string, unknown>, retryable = true) {
    super(message, context, retryable, 'error');
  }
}

export class WorkflowValidationError extends WorkflowError {
  get code(): string { return 'WORKFLOW_VALIDATION_ERROR'; }

  constructor(workflowId: string, validationErrors: string[]) {
    super(
      `Workflow validation failed for '${workflowId}': ${validationErrors.join(', ')}`,
      { workflowId, validationErrors },
      false
    );
  }
}

export class WorkflowExecutionError extends WorkflowError {
  get code(): string { return 'WORKFLOW_EXECUTION_ERROR'; }

  constructor(workflowId: string, stepId: string, originalError: Error) {
    super(
      `Workflow execution failed at step '${stepId}' in workflow '${workflowId}': ${originalError.message}`,
      { workflowId, stepId, originalError: originalError.message },
      true
    );
  }
}

export class WorkflowTimeoutError extends WorkflowError {
  get code(): string { return 'WORKFLOW_TIMEOUT'; }

  constructor(workflowId: string, timeoutMs: number) {
    super(
      `Workflow '${workflowId}' timed out after ${timeoutMs}ms`,
      { workflowId, timeoutMs },
      true
    );
  }
}

export class WorkflowDependencyError extends WorkflowError {
  get code(): string { return 'WORKFLOW_DEPENDENCY_ERROR'; }

  constructor(workflowId: string, missingDependencies: string[]) {
    super(
      `Workflow '${workflowId}' has unresolved dependencies: ${missingDependencies.join(', ')}`,
      { workflowId, missingDependencies },
      false
    );
  }
}

/**
 * Agent-related errors
 */
export class AgentError extends OrchestratorError {
  get code(): string { return 'AGENT_ERROR'; }
  readonly category: ErrorCategory = 'agent';

  constructor(message: string, context?: Record<string, unknown>, retryable = true) {
    super(message, context, retryable, 'error');
  }
}

export class AgentNotFoundError extends AgentError {
  get code(): string { return 'AGENT_NOT_FOUND'; }

  constructor(agentId: string, requiredCapabilities: string[]) {
    super(
      `Agent '${agentId}' not found or lacks required capabilities: ${requiredCapabilities.join(', ')}`,
      { agentId, requiredCapabilities },
      false
    );
  }
}

export class AgentOverloadError extends AgentError {
  get code(): string { return 'AGENT_OVERLOAD'; }

  constructor(agentId: string, currentLoad: number, maxCapacity: number) {
    super(
      `Agent '${agentId}' is overloaded: ${currentLoad}/${maxCapacity}`,
      { agentId, currentLoad, maxCapacity },
      true
    );
  }
}

export class AgentCommunicationError extends AgentError {
  get code(): string { return 'AGENT_COMMUNICATION_ERROR'; }

  constructor(agentId: string, operation: string, originalError: Error) {
    super(
      `Communication error with agent '${agentId}' during ${operation}: ${originalError.message}`,
      { agentId, operation, originalError: originalError.message },
      true
    );
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends OrchestratorError {
  get code(): string { return 'NETWORK_ERROR'; }
  readonly category: ErrorCategory = 'network';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, true, 'error');
  }
}

export class ConnectionTimeoutError extends NetworkError {
  get code(): string { return 'CONNECTION_TIMEOUT'; }

  constructor(endpoint: string, timeoutMs: number) {
    super(
      `Connection timeout to ${endpoint} after ${timeoutMs}ms`,
      { endpoint, timeoutMs }
    );
  }
}

export class ServiceUnavailableError extends NetworkError {
  get code(): string { return 'SERVICE_UNAVAILABLE'; }

  constructor(serviceName: string, statusCode?: number) {
    super(
      `Service '${serviceName}' is unavailable${statusCode ? ` (HTTP ${statusCode})` : ''}`,
      { serviceName, statusCode }
    );
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends OrchestratorError {
  get code(): string { return 'VALIDATION_ERROR'; }
  readonly category: ErrorCategory = 'validation';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, false, 'error');
  }
}

export class InvalidInputError extends ValidationError {
  get code(): string { return 'INVALID_INPUT'; }

  constructor(fieldName: string, expectedFormat: string, actualValue: unknown) {
    super(
      `Invalid input for '${fieldName}': expected ${expectedFormat}, got ${typeof actualValue}`,
      { fieldName, expectedFormat, actualValue }
    );
  }
}

export class SchemaValidationError extends ValidationError {
  get code(): string { return 'SCHEMA_VALIDATION_ERROR'; }

  constructor(schemaName: string, validationErrors: string[]) {
    super(
      `Schema validation failed for '${schemaName}': ${validationErrors.join(', ')}`,
      { schemaName, validationErrors }
    );
  }
}

/**
 * Resource-related errors
 */
export class ResourceError extends OrchestratorError {
  get code(): string { return 'RESOURCE_ERROR'; }
  readonly category: ErrorCategory = 'resource';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, true, 'error');
  }
}

export class ResourceExhaustionError extends ResourceError {
  get code(): string { return 'RESOURCE_EXHAUSTION'; }

  constructor(resourceType: string, currentUsage: number, maxCapacity: number) {
    super(
      `Resource exhaustion for ${resourceType}: ${currentUsage}/${maxCapacity}`,
      { resourceType, currentUsage, maxCapacity }
    );
  }
}

export class ResourceLockError extends ResourceError {
  get code(): string { return 'RESOURCE_LOCK_ERROR'; }

  constructor(resourceId: string, lockHolder: string) {
    super(
      `Resource '${resourceId}' is locked by '${lockHolder}'`,
      { resourceId, lockHolder }
    );
  }
}

/**
 * Timeout-related errors
 */
export class TimeoutError extends OrchestratorError {
  get code(): string { return 'TIMEOUT_ERROR'; }
  readonly category: ErrorCategory = 'timeout';

  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      { operation, timeoutMs },
      true,
      'error'
    );
  }
}

/**
 * Security-related errors
 */
export class SecurityError extends OrchestratorError {
  get code(): string { return 'SECURITY_ERROR'; }
  readonly category: ErrorCategory = 'security';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, false, 'critical');
  }
}

export class AuthenticationError extends SecurityError {
  get code(): string { return 'AUTHENTICATION_ERROR'; }

  constructor(reason: string) {
    super(`Authentication failed: ${reason}`, { reason });
  }
}

export class AuthorizationError extends SecurityError {
  get code(): string { return 'AUTHORIZATION_ERROR'; }

  constructor(resource: string, requiredPermissions: string[]) {
    super(
      `Access denied to resource '${resource}': requires ${requiredPermissions.join(', ')}`,
      { resource, requiredPermissions }
    );
  }
}

/**
 * System-related errors
 */
export class SystemError extends OrchestratorError {
  get code(): string { return 'SYSTEM_ERROR'; }
  readonly category: ErrorCategory = 'system';

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context, true, 'critical');
  }
}

export class InternalError extends SystemError {
  get code(): string { return 'INTERNAL_ERROR'; }

  constructor(component: string, originalError: Error) {
    super(
      `Internal error in ${component}: ${originalError.message}`,
      { component, originalError: originalError.message }
    );
  }
}

export class ServiceStartupError extends SystemError {
  get code(): string { return 'SERVICE_STARTUP_ERROR'; }

  constructor(serviceName: string, reason: string) {
    super(
      `Service '${serviceName}' failed to start: ${reason}`,
      { serviceName, reason }
    );
  }
}

/**
 * Error helper functions
 */
export class ErrorUtils {
  /**
   * Check if an error is retryable
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof OrchestratorError) {
      return error.retryable;
    }
    
    // Default handling for non-orchestrator errors
    if (error instanceof Error) {
      // Network errors are usually retryable
      if (error.message.includes('network') || error.message.includes('timeout')) {
        return true;
      }
      
      // Validation errors are usually not retryable
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return false;
      }
    }
    
    // Default to non-retryable for unknown errors
    return false;
  }

  /**
   * Get error severity
   */
  static getSeverity(error: unknown): ErrorSeverity {
    if (error instanceof OrchestratorError) {
      return error.severity;
    }
    
    // Default to error severity for unknown errors
    return 'error';
  }

  /**
   * Get error category
   */
  static getCategory(error: unknown): ErrorCategory {
    if (error instanceof OrchestratorError) {
      return error.category;
    }
    
    // Attempt to categorize based on error message
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('connection')) {
        return 'network';
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return 'timeout';
      }
      if (message.includes('validation') || message.includes('invalid')) {
        return 'validation';
      }
      if (message.includes('config')) {
        return 'configuration';
      }
    }
    
    // Default to system category
    return 'system';
  }

  /**
   * Convert any error to structured format
   */
  static toStructured(error: unknown): StructuredError {
    if (error instanceof OrchestratorError) {
      return error.toStructured();
    }
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        code: 'UNKNOWN_ERROR',
        category: ErrorUtils.getCategory(error),
        timestamp: new Date(),
        retryable: ErrorUtils.isRetryable(error),
        severity: ErrorUtils.getSeverity(error),
        stack: error.stack,
      };
    }
    
    // Handle non-Error objects
    return {
      name: 'UnknownError',
      message: String(error),
      code: 'UNKNOWN_ERROR',
      category: 'system',
      timestamp: new Date(),
      retryable: false,
      severity: 'error',
    };
  }

  /**
   * Create error from code and message
   */
  static createError(code: string, message: string, context?: Record<string, unknown>): OrchestratorError {
    switch (code) {
      case 'CONFIG_ERROR':
        return new ConfigurationError(message, context);
      case 'ROUTING_ERROR':
        return new RoutingError(message, context);
      case 'WORKFLOW_ERROR':
        return new WorkflowError(message, context);
      case 'AGENT_ERROR':
        return new AgentError(message, context);
      case 'NETWORK_ERROR':
        return new NetworkError(message, context);
      case 'VALIDATION_ERROR':
        return new ValidationError(message, context);
      case 'RESOURCE_ERROR':
        return new ResourceError(message, context);
      case 'TIMEOUT_ERROR':
        return new TimeoutError(message, 0);
      case 'SECURITY_ERROR':
        return new SecurityError(message, context);
      case 'SYSTEM_ERROR':
        return new SystemError(message, context);
      default:
        return new InternalError('ErrorUtils', new Error(message));
    }
  }
}