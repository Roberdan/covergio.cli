/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  volumeThreshold: number;
  errorPercentageThreshold: number;
  maxRetries: number;
  retryDelayMs: number;
  fallbackEnabled: boolean;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  errorPercentage: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedTime: number | null;
  halfOpenTime: number | null;
  stateTransitions: {
    openCount: number;
    halfOpenCount: number;
    closedCount: number;
  };
}

/**
 * Request result interface
 */
interface RequestResult {
  success: boolean;
  timestamp: number;
  duration: number;
  error?: Error;
}

/**
 * Circuit breaker implementation for external service protection
 */
export class CircuitBreaker<T = any, R = any> extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private requestHistory: RequestResult[] = [];
  private resetTimer: NodeJS.Timeout | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private fallbackFunction?: (error: Error, ...args: T[]) => R | Promise<R>;

  constructor(
    private serviceFunction: (...args: T[]) => R | Promise<R>,
    config: Partial<CircuitBreakerConfig> = {},
    fallbackFunction?: (error: Error, ...args: T[]) => R | Promise<R>
  ) {
    super();

    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 5000,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 60000,
      volumeThreshold: 10,
      errorPercentageThreshold: 50,
      maxRetries: 3,
      retryDelayMs: 1000,
      fallbackEnabled: true,
      ...config
    };

    this.fallbackFunction = fallbackFunction;

    this.metrics = {
      state: this.state,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      errorPercentage: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      openedTime: null,
      halfOpenTime: null,
      stateTransitions: {
        openCount: 0,
        halfOpenCount: 0,
        closedCount: 0
      }
    };

    this.startMonitoring();
  }

  /**
   * Execute the protected function
   */
  async execute(...args: T[]): Promise<R> {
    this.metrics.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const error = new Error(`Circuit breaker is OPEN for service`);
      this.emit('rejected', { args, error });
      
      if (this.config.fallbackEnabled && this.fallbackFunction) {
        this.emit('fallback-executed', { args });
        return await this.fallbackFunction(error, ...args);
      }
      
      throw error;
    }

    // Attempt to execute the service function
    return await this.attemptExecution(...args);
  }

  /**
   * Attempt to execute the service function with retry logic
   */
  private async attemptExecution(...args: T[]): Promise<R> {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts <= this.config.maxRetries) {
      const startTime = Date.now();
      
      try {
        this.emit('execution-started', { attempt: attempts + 1, args });

        // Execute with timeout
        const result = await this.executeWithTimeout(...args);
        
        // Record success
        const duration = Date.now() - startTime;
        this.recordResult({ success: true, timestamp: startTime, duration });
        
        this.emit('execution-succeeded', { 
          attempt: attempts + 1, 
          duration, 
          args 
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        attempts++;
        
        const duration = Date.now() - startTime;
        this.recordResult({ 
          success: false, 
          timestamp: startTime, 
          duration, 
          error: lastError 
        });

        this.emit('execution-failed', { 
          attempt: attempts, 
          error: lastError, 
          duration, 
          args 
        });

        // If not the last attempt, wait before retry
        if (attempts <= this.config.maxRetries) {
          await this.sleep(this.config.retryDelayMs * attempts);
        }
      }
    }

    // All attempts failed
    if (this.config.fallbackEnabled && this.fallbackFunction) {
      this.emit('fallback-executed', { args, lastError });
      return await this.fallbackFunction(lastError!, ...args);
    }

    throw lastError!;
  }

  /**
   * Execute service function with timeout
   */
  private async executeWithTimeout(...args: T[]): Promise<R> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Service call timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      Promise.resolve(this.serviceFunction(...args))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record execution result and update circuit state
   */
  private recordResult(result: RequestResult): void {
    this.requestHistory.push(result);

    // Keep only recent history
    const cutoffTime = Date.now() - this.config.monitoringPeriodMs;
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoffTime);

    if (result.success) {
      this.metrics.successCount++;
      this.metrics.lastSuccessTime = result.timestamp;
      this.onSuccess();
    } else {
      this.metrics.failureCount++;
      this.metrics.lastFailureTime = result.timestamp;
      this.onFailure();
    }

    this.updateMetrics();
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      const recentSuccesses = this.getRecentSuccessCount();
      if (recentSuccesses >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      const recentFailures = this.getRecentFailureCount();
      const recentTotal = this.getRecentRequestCount();
      const errorPercentage = recentTotal > 0 ? (recentFailures / recentTotal) * 100 : 0;

      // Check if we should open the circuit
      if (
        recentTotal >= this.config.volumeThreshold &&
        (recentFailures >= this.config.failureThreshold || 
         errorPercentage >= this.config.errorPercentageThreshold)
      ) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Transition to a new circuit state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.state = newState;

    // Update state transition counts
    this.metrics.stateTransitions[`${newState}Count` as keyof typeof this.metrics.stateTransitions]++;

    switch (newState) {
      case CircuitState.OPEN:
        this.metrics.openedTime = Date.now();
        this.scheduleReset();
        break;
      case CircuitState.HALF_OPEN:
        this.metrics.halfOpenTime = Date.now();
        break;
      case CircuitState.CLOSED:
        this.clearResetTimer();
        break;
    }

    this.emit('state-changed', { 
      from: oldState, 
      to: newState, 
      timestamp: Date.now() 
    });
  }

  /**
   * Schedule circuit reset from OPEN to HALF_OPEN
   */
  private scheduleReset(): void {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }, this.config.resetTimeoutMs);
  }

  /**
   * Clear reset timer
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Get recent failure count
   */
  private getRecentFailureCount(): number {
    return this.requestHistory.filter(r => !r.success).length;
  }

  /**
   * Get recent success count
   */
  private getRecentSuccessCount(): number {
    return this.requestHistory.filter(r => r.success).length;
  }

  /**
   * Get recent request count
   */
  private getRecentRequestCount(): number {
    return this.requestHistory.length;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const recentRequests = this.getRecentRequestCount();
    const recentFailures = this.getRecentFailureCount();
    
    this.metrics.errorPercentage = recentRequests > 0 ? (recentFailures / recentRequests) * 100 : 0;
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics-updated', this.getMetrics());
    }, this.config.monitoringPeriodMs);
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
    this.emit('force-opened');
  }

  /**
   * Force close the circuit
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.emit('force-closed');
  }

  /**
   * Reset circuit to closed state and clear history
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.requestHistory = [];
    this.metrics.failureCount = 0;
    this.metrics.successCount = 0;
    this.metrics.totalRequests = 0;
    this.metrics.errorPercentage = 0;
    this.emit('reset');
  }

  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    state: CircuitState;
    errorPercentage: number;
    recentFailures: number;
    lastFailureTime: number | null;
  } {
    const recentFailures = this.getRecentFailureCount();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.state === CircuitState.HALF_OPEN || this.metrics.errorPercentage > 10) {
      status = 'degraded';
    }

    if (this.state === CircuitState.OPEN || this.metrics.errorPercentage > 25) {
      status = 'unhealthy';
    }

    return {
      status,
      state: this.state,
      errorPercentage: this.metrics.errorPercentage,
      recentFailures,
      lastFailureTime: this.metrics.lastFailureTime
    };
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearResetTimer();
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.requestHistory = [];
    this.emit('destroyed');
  }
}

/**
 * Circuit breaker factory for managing multiple circuit breakers
 */
export class CircuitBreakerFactory {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Create or get a circuit breaker for a service
   */
  getCircuitBreaker<T = any, R = any>(
    name: string,
    serviceFunction: (...args: T[]) => R | Promise<R>,
    config?: Partial<CircuitBreakerConfig>,
    fallbackFunction?: (error: Error, ...args: T[]) => R | Promise<R>
  ): CircuitBreaker<T, R> {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(
        serviceFunction,
        { ...this.defaultConfig, ...config },
        fallbackFunction
      );
      this.breakers.set(name, breaker);
    }

    return this.breakers.get(name) as CircuitBreaker<T, R>;
  }

  /**
   * Remove a circuit breaker
   */
  removeCircuitBreaker(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.destroy();
      return this.breakers.delete(name);
    }
    return false;
  }

  /**
   * Get all circuit breaker names
   */
  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Get health status for all circuit breakers
   */
  getAllHealth(): Record<string, ReturnType<CircuitBreaker['getHealth']>> {
    const health: Record<string, ReturnType<CircuitBreaker['getHealth']>> = {};
    for (const [name, breaker] of this.breakers.entries()) {
      health[name] = breaker.getHealth();
    }
    return health;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Cleanup all circuit breakers
   */
  destroy(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}