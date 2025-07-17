/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './Logger';

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private isOpen: boolean = false;
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly options: {
      failureThreshold: number;
      resetTimeoutMs: number;
      name: string;
    }
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.isOpen) {
      const now = Date.now();
      // Check if we should try to reset the circuit
      if (now - this.lastFailure > this.options.resetTimeoutMs) {
        this.halfOpen();
      } else {
        logger.warn('Circuit is open', { circuit: this.options.name });
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit is open for ${this.options.name}`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      logger.error('Circuit breaker caught error', { 
        error: error instanceof Error ? error.message : String(error),
        circuit: this.options.name,
        failures: this.failures
      });
      
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
    if (this.isOpen) {
      this.close();
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    if (!this.isOpen) {
      this.isOpen = true;
      logger.warn('Circuit opened', { circuit: this.options.name });
      
      // Schedule reset
      this.resetTimeout = setTimeout(() => {
        this.halfOpen();
      }, this.options.resetTimeoutMs);
    }
  }

  private halfOpen(): void {
    this.isOpen = false;
    logger.info('Circuit half-opened', { circuit: this.options.name });
  }

  private close(): void {
    this.isOpen = false;
    this.failures = 0;
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }
    logger.info('Circuit closed', { circuit: this.options.name });
  }

  public getState(): { isOpen: boolean; failures: number } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
    };
  }
}
