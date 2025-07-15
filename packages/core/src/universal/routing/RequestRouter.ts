/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IRequestRouter, IRequestHandler, RequestAnalysis } from '../interfaces/IRequestHandler.js';
import { OrchestrationRequest } from '../interfaces/IOrchestrator.js';
import { HandlerRegistry } from './handlers/HandlerRegistry.js';

export interface RoutingDecision {
  handler: IRequestHandler;
  confidence: number;
  reasoning: string;
  alternativeHandlers: IRequestHandler[];
}

export interface RoutingMetrics {
  routingTime: number;
  handlersConsidered: number;
  fallbacksUsed: number;
  avgConfidence: number;
}

export class RequestRouter implements IRequestRouter {
  private registry: HandlerRegistry;
  private routingHistory: Map<string, RoutingDecision> = new Map();
  private metrics: RoutingMetrics = {
    routingTime: 0,
    handlersConsidered: 0,
    fallbacksUsed: 0,
    avgConfidence: 0,
  };

  constructor(registry?: HandlerRegistry) {
    this.registry = registry || new HandlerRegistry();
  }

  registerHandler(handler: IRequestHandler): void {
    this.registry.register(handler);
  }

  unregisterHandler(handlerId: string): boolean {
    return this.registry.unregister(handlerId);
  }

  getHandlers(): IRequestHandler[] {
    return this.registry.getAllHandlers();
  }

  async route(request: OrchestrationRequest, analysis: RequestAnalysis): Promise<IRequestHandler> {
    const startTime = Date.now();
    
    try {
      const decision = await this.makeRoutingDecision(request, analysis);
      
      // Store routing decision for future reference
      this.routingHistory.set(request.id, decision);
      
      // Update metrics
      this.updateMetrics(startTime, decision);
      
      return decision.handler;
    } catch (_error) {
      // Fallback to general handlers
      const fallbackHandler = await this.findFallbackHandler(request, analysis);
      if (fallbackHandler) {
        this.metrics.fallbacksUsed++;
        return fallbackHandler;
      }
      
      throw new Error(`No suitable handler found for request: ${request.id}`);
    }
  }

  async makeRoutingDecision(
    request: OrchestrationRequest, 
    analysis: RequestAnalysis
  ): Promise<RoutingDecision> {
    const candidates = await this.findCandidateHandlers(analysis);
    
    if (candidates.length === 0) {
      throw new Error('No candidate handlers found');
    }

    // Score each candidate
    const scoredCandidates = await Promise.all(
      candidates.map(handler => this.scoreHandler(handler, request, analysis))
    );

    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const bestCandidate = scoredCandidates[0];
    const alternatives = scoredCandidates.slice(1, 4).map(c => c.handler); // Top 3 alternatives

    return {
      handler: bestCandidate.handler,
      confidence: bestCandidate.score,
      reasoning: bestCandidate.reasoning,
      alternativeHandlers: alternatives,
    };
  }

  private async findCandidateHandlers(analysis: RequestAnalysis): Promise<IRequestHandler[]> {
    const candidates = new Set<IRequestHandler>();

    // Find handlers by required capabilities
    for (const capability of analysis.requiredCapabilities) {
      const handlers = this.registry.getHandlersByCapability(capability);
      handlers.forEach(handler => candidates.add(handler));
    }

    // If no specific capability matches, get all available handlers
    if (candidates.size === 0) {
      const allHandlers = this.registry.getAllHandlers();
      allHandlers.forEach(handler => candidates.add(handler));
    }

    // Filter by canHandle check
    const validCandidates: IRequestHandler[] = [];
    for (const handler of candidates) {
      try {
        const canHandle = await handler.canHandle(analysis);
        if (canHandle) {
          validCandidates.push(handler);
        }
      } catch (_error) {
        // Skip handlers that error during canHandle check
        continue;
      }
    }

    return validCandidates;
  }

  private async scoreHandler(
    handler: IRequestHandler,
    request: OrchestrationRequest,
    analysis: RequestAnalysis
  ): Promise<{ handler: IRequestHandler; score: number; reasoning: string }> {
    let score = 0;
    const reasons: string[] = [];

    // Capability match score (40%)
    const handlerCapabilities = handler.getCapabilities();
    const requiredCapabilities = analysis.requiredCapabilities;
    const capabilityMatch = this.calculateCapabilityMatch(handlerCapabilities, requiredCapabilities);
    score += capabilityMatch * 0.4;
    reasons.push(`Capability match: ${(capabilityMatch * 100).toFixed(1)}%`);

    // Priority alignment score (25%)
    const handlerPriority = await handler.getPriority(analysis);
    const priorityScore = this.calculatePriorityScore(handlerPriority, analysis.priority);
    score += priorityScore * 0.25;
    reasons.push(`Priority alignment: ${(priorityScore * 100).toFixed(1)}%`);

    // Performance metrics score (20%)
    const registration = this.registry.getHandlerRegistration(handler.getId());
    if (registration) {
      const performanceScore = this.calculatePerformanceScore(registration);
      score += performanceScore * 0.2;
      reasons.push(`Performance: ${(performanceScore * 100).toFixed(1)}%`);
    }

    // Complexity handling score (15%)
    const complexityScore = this.calculateComplexityScore(handler, analysis.complexity);
    score += complexityScore * 0.15;
    reasons.push(`Complexity handling: ${(complexityScore * 100).toFixed(1)}%`);

    return {
      handler,
      score: Math.min(1, score), // Cap at 1.0
      reasoning: reasons.join(', '),
    };
  }

  private calculateCapabilityMatch(
    handlerCapabilities: string[],
    requiredCapabilities: string[]
  ): number {
    if (requiredCapabilities.length === 0) return 0.5; // Neutral if no specific requirements
    
    const matches = requiredCapabilities.filter(req => 
      handlerCapabilities.some(cap => cap.includes(req) || req.includes(cap))
    );
    
    return matches.length / requiredCapabilities.length;
  }

  private calculatePriorityScore(
    handlerPriority: number,
    requestPriority: 'low' | 'medium' | 'high' | 'critical'
  ): number {
    const priorityValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const requestValue = priorityValues[requestPriority];
    
    // Higher score for handlers that can handle the priority level
    return Math.max(0, 1 - Math.abs(handlerPriority - requestValue) / 4);
  }

  private calculatePerformanceScore(registration: { successRate: number; averageResponseTime: number; usageCount: number }): number {
    // Weight success rate heavily (70%)
    const successScore = registration.successRate * 0.7;
    
    // Factor in response time (20%)
    const timeScore = registration.usageCount > 0 
      ? Math.min(1, 1000 / registration.averageResponseTime) * 0.2
      : 0.2; // Neutral for unused handlers
    
    // Experience bonus (10%)
    const experienceScore = Math.min(1, registration.usageCount / 100) * 0.1;
    
    return successScore + timeScore + experienceScore;
  }

  private calculateComplexityScore(handler: IRequestHandler, complexity: string): number {
    const capabilities = handler.getCapabilities();
    
    // Check if handler has capabilities that suggest it can handle complex tasks
    const complexCapabilities = [
      'code-generation', 'analysis', 'orchestration', 'workflow-management',
      'multi-step', 'reasoning', 'planning'
    ];
    
    const hasComplexCapabilities = capabilities.some(cap => 
      complexCapabilities.some(complex => cap.includes(complex))
    );

    switch (complexity) {
      case 'simple':
        return 0.8; // Most handlers can handle simple tasks
      case 'medium':
        return hasComplexCapabilities ? 0.9 : 0.6;
      case 'complex':
        return hasComplexCapabilities ? 1.0 : 0.3;
      default:
        return 0.5;
    }
  }

  private async findFallbackHandler(
    request: OrchestrationRequest,
    analysis: RequestAnalysis
  ): Promise<IRequestHandler | null> {
    // Try to find any handler with general capabilities
    const generalHandlers = this.registry.getHandlersByCapability('text-generation')
      .concat(this.registry.getHandlersByCapability('general-assistance'));
    
    for (const handler of generalHandlers) {
      try {
        if (await handler.canHandle(analysis)) {
          return handler;
        }
      } catch (_error) {
        continue;
      }
    }
    
    // Last resort: try all available handlers
    const allHandlers = this.registry.getAllHandlers();
    for (const handler of allHandlers) {
      try {
        if (await handler.canHandle(analysis)) {
          return handler;
        }
      } catch (_error) {
        continue;
      }
    }
    
    return null;
  }

  private updateMetrics(startTime: number, decision: RoutingDecision): void {
    const routingTime = Date.now() - startTime;
    
    // Update running averages
    this.metrics.routingTime = this.metrics.routingTime === 0 ? routingTime : (this.metrics.routingTime + routingTime) / 2;
    this.metrics.handlersConsidered = this.metrics.handlersConsidered === 0 ? 
      decision.alternativeHandlers.length + 1 : 
      (this.metrics.handlersConsidered + decision.alternativeHandlers.length + 1) / 2;
    this.metrics.avgConfidence = this.metrics.avgConfidence === 0 ? 
      decision.confidence : 
      (this.metrics.avgConfidence + decision.confidence) / 2;
  }

  getRoutingMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  getRoutingHistory(requestId?: string): Map<string, RoutingDecision> | RoutingDecision | undefined {
    if (requestId) {
      return this.routingHistory.get(requestId);
    }
    return new Map(this.routingHistory);
  }

  clearHistory(): void {
    this.routingHistory.clear();
  }

  getRegistry(): HandlerRegistry {
    return this.registry;
  }
}