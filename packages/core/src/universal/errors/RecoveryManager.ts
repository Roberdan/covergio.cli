/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrchestratorError, ErrorUtils } from './ErrorTypes.js';
import { ErrorHandler, ErrorContext } from './ErrorHandler.js';
import { CircuitBreakerRegistry } from './CircuitBreaker.js';

export interface RecoveryStrategy {
  name: string;
  canRecover(error: unknown, context: RecoveryContext): boolean;
  recover(error: unknown, context: RecoveryContext): Promise<RecoveryResult>;
  rollback?(context: RecoveryContext): Promise<void>;
}

export interface RecoveryContext {
  operationId: string;
  component: string;
  operation: string;
  parameters: Record<string, unknown>;
  state: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
  startTime: Date;
  metadata?: Record<string, unknown>;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  message: string;
  newState?: Record<string, unknown>;
  shouldRetry: boolean;
  retryDelay?: number;
  requiresManualIntervention?: boolean;
  diagnostics?: Record<string, unknown>;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  steps: RecoveryStep[];
  rollbackSteps: RecoveryStep[];
  timeout: number;
  maxAttempts: number;
  prerequisites: string[];
}

export interface RecoveryStep {
  id: string;
  name: string;
  action: string;
  parameters: Record<string, unknown>;
  timeout: number;
  retryable: boolean;
  rollbackAction?: string;
  rollbackParameters?: Record<string, unknown>;
}

export interface RecoveryExecution {
  id: string;
  planId: string;
  context: RecoveryContext;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  currentStep: number;
  results: RecoveryResult[];
  error?: string;
}

/**
 * Recovery manager for handling system recovery scenarios
 */
export class RecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private recoveryPlans = new Map<string, RecoveryPlan>();
  private activeRecoveries = new Map<string, RecoveryExecution>();
  private recoveryHistory: RecoveryExecution[] = [];

  constructor(
    private errorHandler: ErrorHandler,
    private circuitBreakerRegistry: CircuitBreakerRegistry
  ) {
    this.initializeDefaultStrategies();
    this.initializeDefaultPlans();
  }

  /**
   * Attempt to recover from an error
   */
  async recover(
    error: unknown,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const strategy = this.findRecoveryStrategy(error, context);
    
    if (!strategy) {
      return {
        success: false,
        strategy: 'none',
        message: 'No recovery strategy found',
        shouldRetry: false,
        requiresManualIntervention: true,
      };
    }

    try {
      const result = await strategy.recover(error, context);
      
      // Log recovery attempt
      await this.logRecoveryAttempt(context, strategy, result);
      
      return result;
    } catch (recoveryError) {
      // Recovery itself failed
      await this.logRecoveryFailure(context, strategy, recoveryError);
      
      return {
        success: false,
        strategy: strategy.name,
        message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
        shouldRetry: false,
        requiresManualIntervention: true,
      };
    }
  }

  /**
   * Execute a recovery plan
   */
  async executeRecoveryPlan(
    planId: string,
    context: RecoveryContext
  ): Promise<RecoveryExecution> {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) {
      throw new Error(`Recovery plan '${planId}' not found`);
    }

    const execution: RecoveryExecution = {
      id: `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      planId,
      context,
      startTime: new Date(),
      status: 'running',
      currentStep: 0,
      results: [],
    };

    this.activeRecoveries.set(execution.id, execution);

    try {
      // Execute each step in the plan
      for (let i = 0; i < plan.steps.length; i++) {
        execution.currentStep = i;
        const step = plan.steps[i];

        const stepResult = await this.executeRecoveryStep(step, context);
        execution.results.push(stepResult);

        if (!stepResult.success) {
          // Step failed, attempt rollback
          await this.rollbackRecoveryPlan(execution, plan);
          execution.status = 'rolled_back';
          execution.error = stepResult.message;
          break;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
    } finally {
      execution.endTime = new Date();
      this.activeRecoveries.delete(execution.id);
      this.recoveryHistory.push(execution);
    }

    return execution;
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Register a recovery plan
   */
  registerRecoveryPlan(plan: RecoveryPlan): void {
    this.recoveryPlans.set(plan.id, plan);
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    strategiesUsed: Record<string, number>;
  } {
    const stats = {
      totalRecoveries: this.recoveryHistory.length,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      strategiesUsed: {} as Record<string, number>,
    };

    let totalTime = 0;

    for (const execution of this.recoveryHistory) {
      if (execution.status === 'completed') {
        stats.successfulRecoveries++;
      } else {
        stats.failedRecoveries++;
      }

      if (execution.endTime) {
        totalTime += execution.endTime.getTime() - execution.startTime.getTime();
      }

      // Count strategies used
      for (const result of execution.results) {
        stats.strategiesUsed[result.strategy] = (stats.strategiesUsed[result.strategy] || 0) + 1;
      }
    }

    stats.averageRecoveryTime = stats.totalRecoveries > 0 ? totalTime / stats.totalRecoveries : 0;

    return stats;
  }

  /**
   * Get active recovery executions
   */
  getActiveRecoveries(): RecoveryExecution[] {
    return Array.from(this.activeRecoveries.values());
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit = 100): RecoveryExecution[] {
    return this.recoveryHistory.slice(-limit);
  }

  /**
   * Cancel an active recovery
   */
  async cancelRecovery(executionId: string): Promise<boolean> {
    const execution = this.activeRecoveries.get(executionId);
    if (!execution) {
      return false;
    }

    const plan = this.recoveryPlans.get(execution.planId);
    if (plan) {
      await this.rollbackRecoveryPlan(execution, plan);
    }

    execution.status = 'failed';
    execution.error = 'Recovery cancelled by user';
    execution.endTime = new Date();
    
    this.activeRecoveries.delete(executionId);
    this.recoveryHistory.push(execution);

    return true;
  }

  private findRecoveryStrategy(error: unknown, context: RecoveryContext): RecoveryStrategy | null {
    return this.strategies.find(strategy => strategy.canRecover(error, context)) || null;
  }

  private async executeRecoveryStep(
    step: RecoveryStep,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const timeout = step.timeout || 30000; // 30 second default timeout
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Recovery step '${step.name}' timed out after ${timeout}ms`));
      }, timeout);

      this.performRecoveryAction(step, context)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async performRecoveryAction(
    step: RecoveryStep,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // This would contain the actual recovery action implementations
    switch (step.action) {
      case 'restart_component':
        return this.restartComponent(step.parameters, context);
      case 'clear_cache':
        return this.clearCache(step.parameters, context);
      case 'reset_circuit_breaker':
        return this.resetCircuitBreaker(step.parameters, context);
      case 'failover':
        return this.performFailover(step.parameters, context);
      case 'scale_up':
        return this.scaleUp(step.parameters, context);
      case 'reconnect':
        return this.reconnect(step.parameters, context);
      default:
        throw new Error(`Unknown recovery action: ${step.action}`);
    }
  }

  private async rollbackRecoveryPlan(
    execution: RecoveryExecution,
    plan: RecoveryPlan
  ): Promise<void> {
    // Execute rollback steps in reverse order
    for (let i = plan.rollbackSteps.length - 1; i >= 0; i--) {
      const step = plan.rollbackSteps[i];
      try {
        await this.executeRollbackStep(step, execution.context);
      } catch (error) {
        // Log rollback failure but continue with other steps
        console.error(`Rollback step '${step.name}' failed:`, error);
      }
    }
  }

  private async executeRollbackStep(
    step: RecoveryStep,
    context: RecoveryContext
  ): Promise<void> {
    if (step.rollbackAction) {
      await this.performRecoveryAction(
        {
          ...step,
          action: step.rollbackAction,
          parameters: step.rollbackParameters || step.parameters,
        },
        context
      );
    }
  }

  private async logRecoveryAttempt(
    context: RecoveryContext,
    strategy: RecoveryStrategy,
    result: RecoveryResult
  ): Promise<void> {
    const logContext: ErrorContext = {
      operation: 'recovery',
      component: context.component,
      requestId: context.operationId,
      metadata: {
        strategy: strategy.name,
        result,
        context,
      },
    };

    console.log(`Recovery attempt: ${strategy.name} - ${result.success ? 'Success' : 'Failed'}`, logContext);
  }

  private async logRecoveryFailure(
    context: RecoveryContext,
    strategy: RecoveryStrategy,
    error: unknown
  ): Promise<void> {
    const logContext: ErrorContext = {
      operation: 'recovery_failure',
      component: context.component,
      requestId: context.operationId,
      metadata: {
        strategy: strategy.name,
        error: ErrorUtils.toStructured(error),
        context,
      },
    };

    await this.errorHandler.handleError(error, logContext);
  }

  private initializeDefaultStrategies(): void {
    this.strategies.push(new RestartStrategy());
    this.strategies.push(new CircuitBreakerResetStrategy(this.circuitBreakerRegistry));
    this.strategies.push(new CacheEvictionStrategy());
    this.strategies.push(new FailoverStrategy());
    this.strategies.push(new ReconnectionStrategy());
    this.strategies.push(new GracefulDegradationStrategy());
  }

  private initializeDefaultPlans(): void {
    // Network failure recovery plan
    this.recoveryPlans.set('network-failure', {
      id: 'network-failure',
      name: 'Network Failure Recovery',
      steps: [
        {
          id: 'reset-circuit-breaker',
          name: 'Reset Circuit Breaker',
          action: 'reset_circuit_breaker',
          parameters: {},
          timeout: 5000,
          retryable: false,
        },
        {
          id: 'reconnect',
          name: 'Reconnect to Service',
          action: 'reconnect',
          parameters: {},
          timeout: 10000,
          retryable: true,
        },
      ],
      rollbackSteps: [],
      timeout: 30000,
      maxAttempts: 3,
      prerequisites: [],
    });

    // Agent failure recovery plan
    this.recoveryPlans.set('agent-failure', {
      id: 'agent-failure',
      name: 'Agent Failure Recovery',
      steps: [
        {
          id: 'restart-agent',
          name: 'Restart Agent',
          action: 'restart_component',
          parameters: { component: 'agent' },
          timeout: 15000,
          retryable: true,
        },
        {
          id: 'failover',
          name: 'Failover to Backup Agent',
          action: 'failover',
          parameters: {},
          timeout: 10000,
          retryable: false,
        },
      ],
      rollbackSteps: [],
      timeout: 60000,
      maxAttempts: 2,
      prerequisites: [],
    });
  }

  // Recovery action implementations
  private async restartComponent(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Implementation would restart the specified component
    return {
      success: true,
      strategy: 'restart',
      message: `Component ${parameters.component} restarted successfully`,
      shouldRetry: false,
    };
  }

  private async clearCache(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Implementation would clear cache
    return {
      success: true,
      strategy: 'cache_clear',
      message: 'Cache cleared successfully',
      shouldRetry: false,
    };
  }

  private async resetCircuitBreaker(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    const serviceName = parameters.serviceName as string || context.component;
    const breaker = this.circuitBreakerRegistry.getBreaker(serviceName);
    breaker.reset();
    
    return {
      success: true,
      strategy: 'circuit_breaker_reset',
      message: `Circuit breaker for ${serviceName} reset successfully`,
      shouldRetry: false,
    };
  }

  private async performFailover(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Implementation would perform failover to backup service
    return {
      success: true,
      strategy: 'failover',
      message: 'Failover completed successfully',
      shouldRetry: false,
    };
  }

  private async scaleUp(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Implementation would scale up resources
    return {
      success: true,
      strategy: 'scale_up',
      message: 'Resources scaled up successfully',
      shouldRetry: false,
    };
  }

  private async reconnect(
    parameters: Record<string, unknown>,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    // Implementation would reconnect to service
    return {
      success: true,
      strategy: 'reconnect',
      message: 'Reconnection successful',
      shouldRetry: false,
    };
  }
}

/**
 * Default recovery strategies
 */
class RestartStrategy implements RecoveryStrategy {
  name = 'restart';

  canRecover(error: unknown, context: RecoveryContext): boolean {
    const category = ErrorUtils.getCategory(error);
    return category === 'system' || category === 'agent';
  }

  async recover(error: unknown, context: RecoveryContext): Promise<RecoveryResult> {
    // Implementation would restart the component
    return {
      success: true,
      strategy: this.name,
      message: `Component ${context.component} restarted`,
      shouldRetry: true,
      retryDelay: 5000,
    };
  }
}

class CircuitBreakerResetStrategy implements RecoveryStrategy {
  name = 'circuit_breaker_reset';

  constructor(private circuitBreakerRegistry: CircuitBreakerRegistry) {}

  canRecover(error: unknown): boolean {
    const category = ErrorUtils.getCategory(error);
    return category === 'network' || category === 'timeout';
  }

  async recover(error: unknown, context: RecoveryContext): Promise<RecoveryResult> {
    const breaker = this.circuitBreakerRegistry.getBreaker(context.component);
    breaker.reset();
    
    return {
      success: true,
      strategy: this.name,
      message: `Circuit breaker for ${context.component} reset`,
      shouldRetry: true,
      retryDelay: 2000,
    };
  }
}

class CacheEvictionStrategy implements RecoveryStrategy {
  name = 'cache_eviction';

  canRecover(error: unknown): boolean {
    const category = ErrorUtils.getCategory(error);
    return category === 'resource' || category === 'validation';
  }

  async recover(): Promise<RecoveryResult> {
    // Implementation would evict relevant cache entries
    return {
      success: true,
      strategy: this.name,
      message: 'Cache evicted successfully',
      shouldRetry: true,
      retryDelay: 1000,
    };
  }
}

class FailoverStrategy implements RecoveryStrategy {
  name = 'failover';

  canRecover(error: unknown): boolean {
    const category = ErrorUtils.getCategory(error);
    return category === 'network' || category === 'agent' || category === 'timeout';
  }

  async recover(): Promise<RecoveryResult> {
    // Implementation would failover to backup service
    return {
      success: true,
      strategy: this.name,
      message: 'Failover completed',
      shouldRetry: false,
    };
  }
}

class ReconnectionStrategy implements RecoveryStrategy {
  name = 'reconnection';

  canRecover(error: unknown): boolean {
    return ErrorUtils.getCategory(error) === 'network';
  }

  async recover(): Promise<RecoveryResult> {
    // Implementation would reconnect to service
    return {
      success: true,
      strategy: this.name,
      message: 'Reconnection successful',
      shouldRetry: true,
      retryDelay: 3000,
    };
  }
}

class GracefulDegradationStrategy implements RecoveryStrategy {
  name = 'graceful_degradation';

  canRecover(): boolean {
    return true; // Can always attempt graceful degradation
  }

  async recover(): Promise<RecoveryResult> {
    // Implementation would enable degraded mode
    return {
      success: true,
      strategy: this.name,
      message: 'Graceful degradation enabled',
      shouldRetry: false,
    };
  }
}