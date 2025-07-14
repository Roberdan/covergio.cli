/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OrchestrationRequest, OrchestrationResponse } from './IOrchestrator.js';

export interface RequestAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  intent: string;
  domains: string[];
  requiredCapabilities: string[];
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, unknown>;
}

export interface IRequestAnalyzer {
  /**
   * Analyze the incoming request to determine complexity and requirements
   */
  analyze(request: OrchestrationRequest): Promise<RequestAnalysis>;

  /**
   * Validate if the request is supported
   */
  canHandle(request: OrchestrationRequest): Promise<boolean>;
}

export interface IRequestHandler {
  /**
   * Get handler identifier
   */
  getId(): string;

  /**
   * Get handler capabilities
   */
  getCapabilities(): string[];

  /**
   * Check if this handler can process the request
   */
  canHandle(analysis: RequestAnalysis): Promise<boolean>;

  /**
   * Get priority for handling this request (higher number = higher priority)
   */
  getPriority(analysis: RequestAnalysis): Promise<number>;

  /**
   * Handle the orchestration request
   */
  handle(request: OrchestrationRequest, analysis: RequestAnalysis): Promise<OrchestrationResponse>;
}

export interface IRequestRouter {
  /**
   * Register a request handler
   */
  registerHandler(handler: IRequestHandler): void;

  /**
   * Unregister a request handler
   */
  unregisterHandler(handlerId: string): void;

  /**
   * Route a request to the appropriate handler
   */
  route(request: OrchestrationRequest, analysis: RequestAnalysis): Promise<IRequestHandler>;

  /**
   * Get all registered handlers
   */
  getHandlers(): IRequestHandler[];
}