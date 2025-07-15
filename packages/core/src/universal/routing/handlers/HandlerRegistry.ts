/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { IRequestHandler } from '../../interfaces/IRequestHandler.js';

export interface HandlerRegistration {
  handler: IRequestHandler;
  registeredAt: Date;
  lastUsed?: Date;
  usageCount: number;
  averageResponseTime: number;
  successRate: number;
  enabled: boolean;
}

export class HandlerRegistry {
  private handlers = new Map<string, HandlerRegistration>();
  private capabilityIndex = new Map<string, Set<string>>(); // capability -> handler IDs

  register(handler: IRequestHandler): void {
    const id = handler.getId();
    
    if (this.handlers.has(id)) {
      throw new Error(`Handler with ID '${id}' already registered`);
    }

    const registration: HandlerRegistration = {
      handler,
      registeredAt: new Date(),
      usageCount: 0,
      averageResponseTime: 0,
      successRate: 1.0,
      enabled: true,
    };

    this.handlers.set(id, registration);
    this.updateCapabilityIndex(id, handler.getCapabilities());
  }

  unregister(handlerId: string): boolean {
    const registration = this.handlers.get(handlerId);
    if (!registration) {
      return false;
    }

    // Remove from capability index
    this.removeFromCapabilityIndex(handlerId, registration.handler.getCapabilities());
    
    // Remove from handlers
    this.handlers.delete(handlerId);
    
    return true;
  }

  getHandler(handlerId: string): IRequestHandler | undefined {
    const registration = this.handlers.get(handlerId);
    return registration?.enabled ? registration.handler : undefined;
  }

  getAllHandlers(): IRequestHandler[] {
    return Array.from(this.handlers.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.handler);
  }

  getHandlersByCapability(capability: string): IRequestHandler[] {
    const handlerIds = this.capabilityIndex.get(capability) || new Set();
    const handlers: IRequestHandler[] = [];

    for (const id of handlerIds) {
      const registration = this.handlers.get(id);
      if (registration?.enabled) {
        handlers.push(registration.handler);
      }
    }

    return handlers;
  }

  getHandlerRegistration(handlerId: string): HandlerRegistration | undefined {
    return this.handlers.get(handlerId);
  }

  updateHandlerMetrics(
    handlerId: string, 
    responseTime: number, 
    success: boolean
  ): void {
    const registration = this.handlers.get(handlerId);
    if (!registration) {
      return;
    }

    // Update usage count
    registration.usageCount++;
    registration.lastUsed = new Date();

    // Update average response time
    const totalPreviousTime = registration.averageResponseTime * (registration.usageCount - 1);
    registration.averageResponseTime = (totalPreviousTime + responseTime) / registration.usageCount;

    // Update success rate
    const totalPreviousSuccess = registration.successRate * (registration.usageCount - 1);
    const currentSuccess = success ? 1 : 0;
    registration.successRate = (totalPreviousSuccess + currentSuccess) / registration.usageCount;
  }

  enableHandler(handlerId: string): boolean {
    const registration = this.handlers.get(handlerId);
    if (registration) {
      registration.enabled = true;
      return true;
    }
    return false;
  }

  disableHandler(handlerId: string): boolean {
    const registration = this.handlers.get(handlerId);
    if (registration) {
      registration.enabled = false;
      return true;
    }
    return false;
  }

  getCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  getHandlerStats(): Record<string, {
    usageCount: number;
    averageResponseTime: number;
    successRate: number;
    lastUsed?: Date;
    enabled: boolean;
  }> {
    const stats: Record<string, {
      usageCount: number;
      averageResponseTime: number;
      successRate: number;
      lastUsed?: Date;
      enabled: boolean;
    }> = {};
    
    for (const [id, registration] of this.handlers.entries()) {
      stats[id] = {
        usageCount: registration.usageCount,
        averageResponseTime: registration.averageResponseTime,
        successRate: registration.successRate,
        lastUsed: registration.lastUsed,
        enabled: registration.enabled,
      };
    }
    
    return stats;
  }

  findBestHandlerForCapability(capability: string): IRequestHandler | undefined {
    const candidates = this.getHandlersByCapability(capability);
    
    if (candidates.length === 0) {
      return undefined;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Score handlers based on success rate and response time
    let bestHandler: IRequestHandler | undefined;
    let bestScore = -1;

    for (const handler of candidates) {
      const registration = this.handlers.get(handler.getId());
      if (!registration || !registration.enabled) {
        continue;
      }

      // Score combines success rate (70%) and inverse response time (30%)
      const successScore = registration.successRate * 0.7;
      const speedScore = registration.usageCount > 0 
        ? Math.min(1, 1000 / registration.averageResponseTime) * 0.3
        : 0.3; // Give new handlers benefit of doubt

      const totalScore = successScore + speedScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestHandler = handler;
      }
    }

    return bestHandler;
  }

  clear(): void {
    this.handlers.clear();
    this.capabilityIndex.clear();
  }

  size(): number {
    return this.handlers.size;
  }

  private updateCapabilityIndex(handlerId: string, capabilities: string[]): void {
    for (const capability of capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(handlerId);
    }
  }

  private removeFromCapabilityIndex(handlerId: string, capabilities: string[]): void {
    for (const capability of capabilities) {
      const handlerSet = this.capabilityIndex.get(capability);
      if (handlerSet) {
        handlerSet.delete(handlerId);
        if (handlerSet.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }
  }
}