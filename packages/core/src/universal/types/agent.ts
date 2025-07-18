/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentInstance, AgentCapability } from './common';

export interface AgentConfig {
  id: string;
  type: string;
  domain: string;
  role: string;
  capabilities: string[];
  config?: Record<string, unknown>;
  dependencies?: string[];
  version?: string;
}

export interface AgentConstructor {
  new (config: AgentConfig): BaseAgent;
}

export abstract class BaseAgent {
  public readonly id: string;
  public readonly type: string;
  public readonly domain: string;
  public readonly role: string;
  public readonly capabilities: AgentCapability[];
  protected config: Record<string, unknown>;
  protected status: 'idle' | 'busy' | 'error' | 'offline' = 'idle';

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.type = config.type;
    this.domain = config.domain;
    this.role = config.role;
    this.capabilities = (config.capabilities || []).map(capability => ({
      name: capability,
      version: '1.0.0',
      enabled: true,
    }));
    this.config = config.config || {};
  }

  abstract execute(input: unknown): Promise<unknown>;

  getStatus() {
    return this.status;
  }

  updateConfig(newConfig: Record<string, unknown>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export interface AgentTeam {
  id: string;
  name: string;
  agents: BaseAgent[];
  addAgent(agent: BaseAgent): void;
  removeAgent(agentId: string): void;
  getAgent(agentId: string): BaseAgent | undefined;
  getAgentsByCapability(capability: string): BaseAgent[];
}

export class DefaultAgentTeam implements AgentTeam {
  public readonly id: string;
  public readonly name: string;
  private agentMap: Map<string, BaseAgent> = new Map();

  constructor(id: string, name: string, agents: BaseAgent[] = []) {
    this.id = id;
    this.name = name;
    agents.forEach(agent => this.addAgent(agent));
  }

  addAgent(agent: BaseAgent): void {
    this.agentMap.set(agent.id, agent);
  }

  removeAgent(agentId: string): void {
    this.agentMap.delete(agentId);
  }

  getAgent(agentId: string): BaseAgent | undefined {
    return this.agentMap.get(agentId);
  }

  get agents(): BaseAgent[] {
    return Array.from(this.agentMap.values());
  }

  getAgentsByCapability(capability: string): BaseAgent[] {
    return this.agents.filter(agent => 
      agent.capabilities.some(cap => cap.name === capability)
    );
  }
}
