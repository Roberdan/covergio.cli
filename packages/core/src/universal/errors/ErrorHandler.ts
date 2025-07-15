/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  OrchestratorError, 
  ErrorUtils, 
  ErrorCategory, 
  ErrorSeverity, 
  StructuredError 
} from './ErrorTypes.js';
import { CircuitBreakerRegistry, globalCircuitBreakerRegistry } from './CircuitBreaker.js';

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableMetrics: boolean;
  enableNotifications: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxRetries: number;
  retryDelay: number;
  fallbackEnabled: boolean;
  circuitBreakerEnabled: boolean;
}

export interface ErrorContext {
  operation: string;
  component: string;
  requestId?: string;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorHandlerStrategy {
  canHandle(error: unknown, context: ErrorContext): boolean;
  handle(error: unknown, context: ErrorContext): Promise<ErrorHandlerResult>;
}

export interface ErrorHandlerResult {
  handled: boolean;
  retry: boolean;
  delay?: number;
  fallback?: () => Promise<unknown>;
  escalate?: boolean;
  notifications?: ErrorNotification[];
}

export interface ErrorNotification {
  type: 'email' | 'slack' | 'webhook' | 'log';
  severity: ErrorSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  recentErrors: StructuredError[];
  averageResolutionTime: number;
}

/**
 * Comprehensive error handler with strategies, metrics, and recovery mechanisms
 */
export class ErrorHandler {
  private strategies: ErrorHandlerStrategy[] = [];
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCategory: {
      configuration: 0,
      routing: 0,
      workflow: 0,
      agent: 0,
      network: 0,
      validation: 0,
      resource: 0,
      timeout: 0,
      security: 0,
      system: 0,
    },
    errorsBySeverity: {
      warning: 0,
      error: 0,
      critical: 0,
    },
    errorsByComponent: {},
    recentErrors: [],
    averageResolutionTime: 0,
  };
  private resolutionTimes: number[] = [];

  constructor(
    private config: ErrorHandlerConfig = {
      enableLogging: true,
      enableMetrics: true,
      enableNotifications: true,
      logLevel: 'error',
      maxRetries: 3,
      retryDelay: 1000,
      fallbackEnabled: true,
      circuitBreakerEnabled: true,
    },
    private circuitBreakerRegistry: CircuitBreakerRegistry = globalCircuitBreakerRegistry
  ) {
    this.initializeDefaultStrategies();
  }

  /**
   * Handle an error with full error handling pipeline
   */
  async handleError(
    error: unknown,
    context: ErrorContext,
    attempt = 1
  ): Promise<ErrorHandlerResult> {
    const startTime = Date.now();
    const structuredError = ErrorUtils.toStructured(error);
    
    // Update metrics
    this.updateMetrics(structuredError, context);
    
    // Log the error
    if (this.config.enableLogging) {
      this.logError(structuredError, context, attempt);
    }
    
    // Find appropriate strategy
    const strategy = this.findStrategy(error, context);
    
    let result: ErrorHandlerResult;
    
    if (strategy) {
      result = await strategy.handle(error, context);
    } else {
      // Default handling if no strategy matches
      result = await this.defaultErrorHandling(error, context, attempt);
    }
    
    // Record resolution time
    if (result.handled) {
      this.recordResolutionTime(Date.now() - startTime);
    }
    
    // Handle notifications
    if (this.config.enableNotifications && result.notifications) {
      await this.sendNotifications(result.notifications, context);
    }
    
    return result;
  }

  /**
   * Handle error with retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Use circuit breaker if enabled
        if (this.config.circuitBreakerEnabled) {
          return await this.circuitBreakerRegistry.execute(
            context.component,
            operation
          );
        } else {
          return await operation();
        }
      } catch (error) {
        lastError = error;
        
        // Handle the error
        const result = await this.handleError(error, context, attempt);
        
        // If not retryable or max retries reached, throw
        if (!result.retry || attempt === retries) {
          // Try fallback if available
          if (result.fallback) {
            try {
              return await result.fallback() as T;
            } catch (fallbackError) {
              // Log fallback failure but throw original error
              this.logError(
                ErrorUtils.toStructured(fallbackError),
                { ...context, operation: `${context.operation}-fallback` }
              );
            }
          }
          throw error;
        }
        
        // Wait before retrying
        const delay = result.delay ?? this.config.retryDelay * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Register a custom error handling strategy
   */
  registerStrategy(strategy: ErrorHandlerStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategy: ErrorHandlerStrategy): boolean {
    const index = this.strategies.indexOf(strategy);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return {
      ...this.metrics,
      averageResolutionTime: this.calculateAverageResolutionTime(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCategory: {
        configuration: 0,
        routing: 0,
        workflow: 0,
        agent: 0,
        network: 0,
        validation: 0,
        resource: 0,
        timeout: 0,
        security: 0,
        system: 0,
      },
      errorsBySeverity: {
        warning: 0,
        error: 0,
        critical: 0,
      },
      errorsByComponent: {} as Record<string, number>,
      recentErrors: [],
      averageResolutionTime: 0,
    };
    this.resolutionTimes = [];
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50): StructuredError[] {
    return this.metrics.recentErrors.slice(-limit);
  }

  /**
   * Check if error should be escalated
   */
  shouldEscalate(error: unknown, context: ErrorContext): boolean {
    const structuredError = ErrorUtils.toStructured(error);
    
    // Escalate critical errors
    if (structuredError.severity === 'critical') {
      return true;
    }
    
    // Escalate security errors
    if (structuredError.category === 'security') {
      return true;
    }
    
    // Escalate if too many errors from same component
    const componentErrorCount = this.metrics.errorsByComponent[context.component] || 0;
    if (componentErrorCount > 10) {
      return true;
    }
    
    return false;
  }

  private initializeDefaultStrategies(): void {
    // Network error strategy
    this.strategies.push(new NetworkErrorStrategy());
    
    // Validation error strategy
    this.strategies.push(new ValidationErrorStrategy());
    
    // Configuration error strategy
    this.strategies.push(new ConfigurationErrorStrategy());
    
    // Workflow error strategy
    this.strategies.push(new WorkflowErrorStrategy());
    
    // Agent error strategy
    this.strategies.push(new AgentErrorStrategy());
    
    // Timeout error strategy
    this.strategies.push(new TimeoutErrorStrategy());
    
    // Resource error strategy
    this.strategies.push(new ResourceErrorStrategy());
    
    // Security error strategy
    this.strategies.push(new SecurityErrorStrategy());
  }

  private findStrategy(error: unknown, context: ErrorContext): ErrorHandlerStrategy | null {
    return this.strategies.find(strategy => strategy.canHandle(error, context)) || null;
  }

  private async defaultErrorHandling(
    error: unknown,
    context: ErrorContext,
    attempt: number
  ): Promise<ErrorHandlerResult> {
    const isRetryable = ErrorUtils.isRetryable(error);
    const shouldEscalate = this.shouldEscalate(error, context);
    
    return {
      handled: true,
      retry: isRetryable && attempt < this.config.maxRetries,
      delay: this.config.retryDelay * Math.pow(2, attempt - 1),
      escalate: shouldEscalate,
      notifications: shouldEscalate ? [{
        type: 'log',
        severity: 'critical',
        message: `Error escalated: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { context, attempt },
      }] : [],
    };
  }

  private updateMetrics(error: StructuredError, context: ErrorContext): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[error.category]++;
    this.metrics.errorsBySeverity[error.severity]++;
    
    // Update component error count
    this.metrics.errorsByComponent[context.component] = 
      (this.metrics.errorsByComponent[context.component] || 0) + 1;
    
    // Add to recent errors (keep last 1000)
    this.metrics.recentErrors.push(error);
    if (this.metrics.recentErrors.length > 1000) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(-1000);
    }
  }

  private logError(error: StructuredError, context: ErrorContext, attempt = 1): void {
    const logLevel = this.getLogLevel(error.severity);
    
    if (this.shouldLog(logLevel)) {
      const logData = {
        error,
        context,
        attempt,
        timestamp: new Date().toISOString(),
      };
      
      // In a real implementation, this would use a proper logging library
      console.log(`[${logLevel.toUpperCase()}] ${error.message}`, logData);
    }
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      case 'critical':
        return 'error';
      default:
        return 'error';
    }
  }

  private shouldLog(logLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const errorLevelIndex = levels.indexOf(logLevel);
    
    return errorLevelIndex >= configLevelIndex;
  }

  private async sendNotifications(notifications: ErrorNotification[], context: ErrorContext): Promise<void> {
    for (const notification of notifications) {
      try {
        await this.sendNotification(notification, context);
      } catch (error) {
        // Log notification failure but don't throw
        console.error('Failed to send notification:', error);
      }
    }
  }

  private async sendNotification(notification: ErrorNotification, context: ErrorContext): Promise<void> {
    // In a real implementation, this would integrate with actual notification services
    switch (notification.type) {
      case 'log':
        console.log(`[NOTIFICATION] ${notification.message}`, { context, metadata: notification.metadata });
        break;
      case 'email':
        // Would send email notification
        break;
      case 'slack':
        // Would send Slack notification
        break;
      case 'webhook':
        // Would send webhook notification
        break;
    }
  }

  private recordResolutionTime(time: number): void {
    this.resolutionTimes.push(time);
    
    // Keep only recent resolution times (last 1000)
    if (this.resolutionTimes.length > 1000) {
      this.resolutionTimes = this.resolutionTimes.slice(-1000);
    }
  }

  private calculateAverageResolutionTime(): number {
    if (this.resolutionTimes.length === 0) return 0;
    
    const sum = this.resolutionTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.resolutionTimes.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default error handling strategies
 */
class NetworkErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'network';
  }

  async handle(error: unknown, context: ErrorContext): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: true,
      delay: 2000, // 2 second delay for network errors
      notifications: [{
        type: 'log',
        severity: 'warning',
        message: `Network error in ${context.component}: ${error instanceof Error ? error.message : String(error)}`,
      }],
    };
  }
}

class ValidationErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'validation';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: false, // Validation errors are not retryable
      escalate: false,
      notifications: [{
        type: 'log',
        severity: 'warning',
        message: 'Validation error occurred',
      }],
    };
  }
}

class ConfigurationErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'configuration';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: false,
      escalate: true, // Configuration errors should be escalated
      notifications: [{
        type: 'log',
        severity: 'error',
        message: 'Configuration error requires attention',
      }],
    };
  }
}

class WorkflowErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'workflow';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: true,
      delay: 5000, // 5 second delay for workflow errors
      notifications: [{
        type: 'log',
        severity: 'warning',
        message: 'Workflow error occurred, retrying...',
      }],
    };
  }
}

class AgentErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'agent';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: true,
      delay: 3000, // 3 second delay for agent errors
      fallback: async () => {
        // Fallback to basic handler
        return { message: 'Agent temporarily unavailable, using fallback' };
      },
    };
  }
}

class TimeoutErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'timeout';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: true,
      delay: 1000, // 1 second delay for timeout errors
      notifications: [{
        type: 'log',
        severity: 'warning',
        message: 'Operation timed out, retrying...',
      }],
    };
  }
}

class ResourceErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'resource';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: true,
      delay: 10000, // 10 second delay for resource errors
      notifications: [{
        type: 'log',
        severity: 'warning',
        message: 'Resource error occurred, waiting before retry...',
      }],
    };
  }
}

class SecurityErrorStrategy implements ErrorHandlerStrategy {
  canHandle(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'security';
  }

  async handle(): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      retry: false, // Security errors are not retryable
      escalate: true, // Always escalate security errors
      notifications: [{
        type: 'log',
        severity: 'critical',
        message: 'Security error detected - immediate attention required',
      }],
    };
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();