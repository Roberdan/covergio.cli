/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent, AgentConfig, AgentConstructor } from '../types/agent';

export class AgentFactory {
  private static instance: AgentFactory;
  private agentConstructors: Map<string, AgentConstructor> = new Map();
  private agentCache: Map<string, BaseAgent> = new Map();
  private cacheEnabled: boolean = true;

  private constructor() {}

  public static getInstance(): AgentFactory {
    if (!AgentFactory.instance) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  public registerAgentType(type: string, constructor: AgentConstructor): void {
    if (this.agentConstructors.has(type)) {
      console.warn(`Agent type '${type}' is already registered and will be overwritten`);
    }
    this.agentConstructors.set(type, constructor);
  }

  public async createAgent(config: AgentConfig): Promise<BaseAgent> {
    const cacheKey = this.getCacheKey(config);
    
    // Return cached instance if available and caching is enabled
    if (this.cacheEnabled && this.agentCache.has(cacheKey)) {
      return this.agentCache.get(cacheKey)!;
    }

    // Create new agent instance
    const agent = await this.instantiateAgent(config);
    
    // Cache the new instance if caching is enabled
    if (this.cacheEnabled) {
      this.agentCache.set(cacheKey, agent);
    }
    
    return agent;
  }

  public clearCache(): void {
    this.agentCache.clear();
  }

  public enableCaching(enable: boolean = true): void {
    this.cacheEnabled = enable;
    if (!enable) {
      this.clearCache();
    }
  }

  public getRegisteredTypes(): string[] {
    return Array.from(this.agentConstructors.keys());
  }

  private async instantiateAgent(config: AgentConfig): Promise<BaseAgent> {
    const Constructor = this.agentConstructors.get(config.type);
    
    if (!Constructor) {
      throw new Error(`No agent type registered for: ${config.type}`);
    }

    try {
      // Dynamically import the agent module if it's not already loaded
      if (typeof Constructor !== 'function') {
        throw new Error(`Invalid agent constructor for type: ${config.type}`);
      }
      
      // Create the agent instance
      const agent = new Constructor(config);
      
      // Verify the instance is valid
      if (!(agent instanceof BaseAgent)) {
        throw new Error(`Agent of type ${config.type} does not extend BaseAgent`);
      }
      
      return agent;
    } catch (error) {
      throw new Error(`Failed to instantiate agent ${config.type}: ${error.message}`);
    }
  }

  private getCacheKey(config: AgentConfig): string {
    // Create a unique cache key based on agent configuration
    return `${config.type}:${config.id}:${JSON.stringify(config.config || {})}`;
  }

  // Singleton pattern
  public static resetInstance(): void {
    if (AgentFactory.instance) {
      AgentFactory.instance.clearCache();
      AgentFactory.instance = new AgentFactory();
    }
  }
}
