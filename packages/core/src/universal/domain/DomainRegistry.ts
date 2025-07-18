/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentFactory } from '../agent/AgentFactory';
import { BaseAgent } from '../types/agent';

export interface DomainDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  agentTemplates: AgentTemplate[];
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentTemplate {
  id: string;
  type: string;
  role: string;
  capabilities: string[];
  config?: Record<string, unknown>;
  factoryMethod?: string;
}

export class DomainRegistry {
  private static instance: DomainRegistry;
  private domains: Map<string, DomainDefinition> = new Map();
  private agentFactory: AgentFactory;

  private constructor(agentFactory: AgentFactory) {
    this.agentFactory = agentFactory;
  }

  public static getInstance(agentFactory?: AgentFactory): DomainRegistry {
    if (!DomainRegistry.instance && agentFactory) {
      DomainRegistry.instance = new DomainRegistry(agentFactory);
    } else if (!DomainRegistry.instance) {
      throw new Error('DomainRegistry must be initialized with an AgentFactory');
    }
    return DomainRegistry.instance;
  }

  public registerDomain(domain: DomainDefinition): void {
    // Validate domain definition
    if (!domain.id || !domain.name) {
      throw new Error('Domain must have an id and name');
    }

    // Check for circular dependencies
    this.checkForCircularDependencies(domain);

    this.domains.set(domain.id, domain);
  }

  public getDomain(domainId: string): DomainDefinition | undefined {
    return this.domains.get(domainId);
  }

  public getDomains(): DomainDefinition[] {
    return Array.from(this.domains.values());
  }

  public async getAgentsForDomains(domainIds: string[]): Promise<BaseAgent[]> {
    const agents: BaseAgent[] = [];
    const processedDomains = new Set<string>();

    // Process domains in order, handling dependencies
    const processDomain = async (domainId: string) => {
      if (processedDomains.has(domainId)) return;
      
      const domain = this.domains.get(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      // Process dependencies first
      if (domain.dependencies) {
        for (const depId of domain.dependencies) {
          await processDomain(depId);
        }
      }

      // Create agents for this domain
      for (const template of domain.agentTemplates) {
        const agent = await this.agentFactory.createAgent({
          id: `${domainId}:${template.id}`,
          type: template.type,
          domain: domainId,
          role: template.role,
          capabilities: template.capabilities,
          config: template.config,
        });
        agents.push(agent);
      }

      processedDomains.add(domainId);
    };

    // Process all requested domains
    for (const domainId of domainIds) {
      await processDomain(domainId);
    }

    return agents;
  }

  public getAgentTemplates(domainId: string): AgentTemplate[] {
    const domain = this.domains.get(domainId);
    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }
    return [...domain.agentTemplates];
  }

  private checkForCircularDependencies(domain: DomainDefinition, path: string[] = []): void {
    if (path.includes(domain.id)) {
      throw new Error(`Circular dependency detected: ${[...path, domain.id].join(' -> ')}`);
    }

    if (!domain.dependencies) return;

    for (const depId of domain.dependencies) {
      const depDomain = this.domains.get(depId);
      if (depDomain) {
        this.checkForCircularDependencies(depDomain, [...path, domain.id]);
      }
    }
  }

  public clear(): void {
    this.domains.clear();
  }
}
