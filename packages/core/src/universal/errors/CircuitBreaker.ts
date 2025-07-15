/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrchestratorError, ErrorUtils } from './ErrorTypes.js';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
  maxRetries: number;
  retryDelay: number;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  halfOpenSuccesses: number;
  nextRetryTime?: Date;
}

export class CircuitBreakerError extends OrchestratorError {
  readonly code = 'CIRCUIT_BREAKER_OPEN';
  readonly category = 'system' as const;

  constructor(serviceName: string, nextRetryTime?: Date) {
    super(
      `Circuit breaker is open for service '${serviceName}'${
        nextRetryTime ? ` (next retry at ${nextRetryTime.toISOString()})` : ''
      }`,
      { serviceName, nextRetryTime },
      true,
      'error'
    );
  }
}

/**
 * Circuit breaker implementation with configurable thresholds and recovery
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private halfOpenSuccesses = 0;
  private nextRetryTime?: Date;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      successThreshold: 3,
      maxRetries: 3,
      retryDelay: 1000,
    }
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit breaker should allow the request
    if (!this.shouldAllowRequest()) {
      if (fallback) {
        return await fallback();
      }
      throw new CircuitBreakerError(this.serviceName, this.nextRetryTime);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        return await this.execute(operation, fallback);
      } catch (error) {
        lastError = error;
        attempt++;

        // Don't retry if circuit breaker is open
        if (error instanceof CircuitBreakerError) {
          throw error;
        }

        // Don't retry non-retryable errors
        if (!ErrorUtils.isRetryable(error)) {
          throw error;
        }

        // If we've reached max retries, try fallback if available
        if (attempt >= this.config.maxRetries) {
          if (fallback) {
            try {
              return await fallback();
            } catch (fallbackError) {
              // If fallback fails, throw original error
              throw error;
            }
          }
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      halfOpenSuccesses: this.halfOpenSuccesses,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.halfOpenSuccesses = 0;
    this.nextRetryTime = undefined;
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.state = 'open';
    this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Force circuit breaker to closed state
   */
  forceClosed(): void {
    this.state = 'closed';
    this.nextRetryTime = undefined;
  }

  private shouldAllowRequest(): boolean {
    const now = new Date();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if recovery timeout has passed
        if (this.nextRetryTime && now >= this.nextRetryTime) {
          this.state = 'half-open';
          this.halfOpenSuccesses = 0;
          return true;
        }
        return false;

      case 'half-open':
        // Allow limited requests to test if service has recovered
        return this.halfOpenSuccesses < this.config.successThreshold;

      default:
        return false;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;
      
      // If we've had enough successes, close the circuit
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.nextRetryTime = undefined;
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = new Date();

    if (this.state === 'half-open') {
      // Return to open state if we fail during half-open
      this.state = 'open';
      this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
    } else if (this.state === 'closed') {
      // Open circuit if we've exceeded failure threshold
      if (this.failures >= this.config.failureThreshold) {
        this.state = 'open';
        this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig?: Partial<CircuitBreakerConfig>) {
    this.defaultConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      successThreshold: 3,
      maxRetries: 3,
      retryDelay: 1000,
      ...defaultConfig,
    };
  }

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breakerConfig = config ? { ...this.defaultConfig, ...config } : this.defaultConfig;
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, breakerConfig));
    }
    
    return this.breakers.get(serviceName)!;
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(serviceName: string): boolean {
    return this.breakers.delete(serviceName);
  }

  /**
   * Get all circuit breaker names
   */
  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
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
   * Get circuit breakers in open state
   */
  getOpenBreakers(): string[] {
    const openBreakers: string[] = [];
    
    for (const [name, breaker] of this.breakers) {
      if (breaker.getStats().state === 'open') {
        openBreakers.push(name);
      }
    }
    
    return openBreakers;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName, config);
    return breaker.execute(operation, fallback);
  }

  /**
   * Execute operation with circuit breaker protection and retry logic
   */
  async executeWithRetry<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName, config);
    return breaker.executeWithRetry(operation, fallback);
  }
}

/**
 * Global circuit breaker registry instance
 */
export const globalCircuitBreakerRegistry = new CircuitBreakerRegistry();