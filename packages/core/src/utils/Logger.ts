/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, json, errors } = format;

/**
 * Centralized logger for the application
 */
class Logger {
  private static instance: Logger;
  private logger: any;
  private correlationId: string = '';
  
  private constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
        errors({ stack: true }),
        timestamp(),
        json()
      ),
      defaultMeta: { service: 'convergio-core' },
      transports: [
        new transports.Console()
      ]
    });
  }

  /**
   * Get logger instance (singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set correlation ID for request tracing
   */
  public setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Generate a new correlation ID
   */
  public generateCorrelationId(): string {
    this.correlationId = uuidv4();
    return this.correlationId;
  }

  /**
   * Log error message
   */
  public error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  /**
   * Log warning message
   */
  public warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  /**
   * Log info message
   */
  public info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  /**
   * Log debug message
   */
  public debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  /**
   * Log with custom level
   */
  private log(level: string, message: string, meta: Record<string, any> = {}): void {
    const logData = {
      ...meta,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      message
    };

    this.logger.log(level, logData);
  }
}

export const logger = Logger.getInstance();
