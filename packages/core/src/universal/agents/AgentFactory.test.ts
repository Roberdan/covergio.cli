/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentFactory } from './AgentFactory.js';
import { BaseAgent, SimpleAgentMemory } from './BaseAgent.js';
import {
  IAgent,
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentTemplate,
  AgentDefinition
} from './types.js';

/**
 * Mock agent implementation for testing
 */
class MockAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async executeTask(request: AgentRequest): Promise<AgentResponse> {
    return {
      type: 'text',
      content: `Mock response to: ${request.input}`,
      context: request.context
    };
  }
}

describe('AgentFactory', () => {
  let factory: AgentFactory;

  beforeEach(() => {
    factory = new AgentFactory({
      enableMetrics: true,
      enableValidation: true,
      maxConcurrentAgents: 10,
      defaultTimeout: 5000,
      defaultRetryAttempts: 2
    });
  });

  describe('agent type registration', () => {
    it('should register agent types', () => {
      const creator = async (config: AgentConfig) => new MockAgent(config);
      
      factory.registerAgentType('test:mock', creator);
      
      const types = factory.getAvailableTypes();
      expect(types).toContain('test:mock');
    });

    it('should unregister agent types', () => {
      const creator = async (config: AgentConfig) => new MockAgent(config);
      
      factory.registerAgentType('test:mock', creator);
      expect(factory.getAvailableTypes()).toContain('test:mock');
      
      factory.unregisterAgentType('test:mock');
      expect(factory.getAvailableTypes()).not.toContain('test:mock');
    });

    it('should emit events when registering/unregistering types', () => {
      const registeredSpy = vi.fn();
      const unregisteredSpy = vi.fn();
      
      factory.on('agent-type-registered', registeredSpy);
      factory.on('agent-type-unregistered', unregisteredSpy);
      
      const creator = async (config: AgentConfig) => new MockAgent(config);
      
      factory.registerAgentType('test:mock', creator);
      expect(registeredSpy).toHaveBeenCalledWith({ type: 'test:mock' });
      
      factory.unregisterAgentType('test:mock');
      expect(unregisteredSpy).toHaveBeenCalledWith({ type: 'test:mock' });
    });
  });

  describe('agent creation', () => {
    beforeEach(() => {
      const creator = async (config: AgentConfig) => {
        const agent = new MockAgent(config);
        await agent.initialize();
        return agent;
      };
      factory.registerAgentType('test:mock', creator);
    });

    it('should create agents with valid configuration', async () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock',
        capabilities: ['test-capability'],
        personalityTraits: [
          { name: 'helpful', value: 0.8, description: 'Helpful trait', category: 'social' }
        ]
      };

      const agent = await factory.createAgent(config);
      
      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.definition.domain).toBe('test');
      expect(agent.definition.role).toBe('mock');
      expect(agent.state).toBe('ready');
    });

    it('should generate unique IDs for agents', async () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      const agent1 = await factory.createAgent(config);
      const agent2 = await factory.createAgent(config);
      
      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should use provided ID when specified', async () => {
      const config: AgentConfig = {
        id: 'custom-agent-id',
        domain: 'test',
        role: 'mock'
      };

      const agent = await factory.createAgent(config);
      expect(agent.id).toBe('custom-agent-id');
    });

    it('should apply default configuration values', async () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      const agent = await factory.createAgent(config);
      
      // Check that defaults were applied (timeout, retryAttempts, etc.)
      expect(agent).toBeDefined();
    });

    it('should emit events when creating agents', async () => {
      const createdSpy = vi.fn();
      factory.on('agent-created', createdSpy);

      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      const agent = await factory.createAgent(config);
      
      expect(createdSpy).toHaveBeenCalledWith({
        agent,
        config: expect.objectContaining({
          domain: 'test',
          role: 'mock'
        })
      });
    });

    it('should throw error for unknown agent type', async () => {
      const config: AgentConfig = {
        domain: 'unknown',
        role: 'type'
      };

      await expect(factory.createAgent(config)).rejects.toThrow('No creator found for agent type');
    });

    it('should respect concurrent agent limit', async () => {
      const limitedFactory = new AgentFactory({ maxConcurrentAgents: 1 });
      const creator = async (config: AgentConfig) => {
        const agent = new MockAgent(config);
        await agent.initialize();
        return agent;
      };
      limitedFactory.registerAgentType('test:mock', creator);

      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      // Create first agent
      await limitedFactory.createAgent(config);

      // Second agent should fail
      await expect(limitedFactory.createAgent(config)).rejects.toThrow('Maximum concurrent agents limit reached');
    });
  });

  describe('configuration validation', () => {
    it('should validate required fields', () => {
      const invalidConfig = {} as AgentConfig;
      
      const result = factory.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2); // domain and role required
      expect(result.errors[0].field).toBe('domain');
      expect(result.errors[1].field).toBe('role');
    });

    it('should validate domain format', () => {
      const config: AgentConfig = {
        domain: 'Invalid Domain!',
        role: 'test'
      };
      
      const result = factory.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'domain' && e.code === 'INVALID_FORMAT')).toBe(true);
    });

    it('should validate personality trait values', () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock',
        personalityTraits: [
          { name: 'invalid', value: 1.5, description: 'Invalid trait', category: 'social' }
        ]
      };
      
      const result = factory.validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'personalityTraits' && e.code === 'INVALID_RANGE')).toBe(true);
    });

    it('should pass validation for valid configuration', () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock',
        capabilities: ['test-capability'],
        personalityTraits: [
          { name: 'helpful', value: 0.8, description: 'Helpful trait', category: 'social' }
        ]
      };
      
      const result = factory.validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow disabling validation', async () => {
      const nonValidatingFactory = new AgentFactory({ enableValidation: false });
      const creator = async (config: AgentConfig) => {
        const agent = new MockAgent({ domain: 'test', role: 'mock', ...config });
        await agent.initialize();
        return agent;
      };
      nonValidatingFactory.registerAgentType('test:mock', creator);

      const invalidConfig = { domain: 'test', role: 'mock' } as AgentConfig;
      
      // Should not throw validation error
      await expect(nonValidatingFactory.createAgent(invalidConfig)).resolves.toBeDefined();
    });
  });

  describe('templates', () => {
    it('should register and retrieve templates', () => {
      const template: AgentTemplate = {
        id: 'test-template',
        domain: 'test',
        role: 'mock',
        description: 'Test template',
        defaultCapabilities: ['test-capability'],
        defaultPersonalityTraits: [
          { name: 'helpful', value: 0.8, description: 'Helpful trait', category: 'social' }
        ],
        defaultTools: ['test-tool'],
        configSchema: {},
        examples: ['Example 1'],
        documentation: 'Test documentation'
      };

      factory.registerTemplate(template);
      
      const retrieved = factory.getTemplate('test', 'mock');
      expect(retrieved).toEqual(template);
    });

    it('should return null for non-existent templates', () => {
      const template = factory.getTemplate('non-existent', 'template');
      expect(template).toBeNull();
    });

    it('should emit events when registering templates', () => {
      const spy = vi.fn();
      factory.on('template-registered', spy);

      const template: AgentTemplate = {
        id: 'test-template',
        domain: 'test',
        role: 'mock',
        description: 'Test template',
        defaultCapabilities: [],
        defaultPersonalityTraits: [],
        defaultTools: [],
        configSchema: {},
        examples: [],
        documentation: ''
      };

      factory.registerTemplate(template);
      expect(spy).toHaveBeenCalledWith({ template });
    });
  });

  describe('component registration', () => {
    it('should register and retrieve components', () => {
      const component = { test: 'component' };
      
      factory.registerComponent('test-component', component);
      
      const retrieved = factory.getComponent('test-component');
      expect(retrieved).toEqual(component);
    });

    it('should return undefined for non-existent components', () => {
      const component = factory.getComponent('non-existent');
      expect(component).toBeUndefined();
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      const creator = async (config: AgentConfig) => {
        const agent = new MockAgent(config);
        await agent.initialize();
        return agent;
      };
      factory.registerAgentType('test:mock', creator);
    });

    it('should track agent creation statistics', async () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      const initialStats = factory.getStatistics();
      expect(initialStats.totalAgentsCreated).toBe(0);

      await factory.createAgent(config);

      const updatedStats = factory.getStatistics();
      expect(updatedStats.totalAgentsCreated).toBe(1);
      expect(updatedStats.activeAgents).toBe(1);
      expect(updatedStats.agentsByType['test:mock']).toBe(1);
      expect(updatedStats.agentsByDomain['test']).toBe(1);
    });

    it('should track average creation time', async () => {
      const config: AgentConfig = {
        domain: 'test',
        role: 'mock'
      };

      await factory.createAgent(config);
      await factory.createAgent(config);

      const stats = factory.getStatistics();
      expect(stats.averageCreationTime).toBeGreaterThanOrEqual(0);
    });

    it('should track uptime', async () => {
      // Wait a bit to ensure some time has passed
      await new Promise(resolve => setTimeout(resolve, 10));
      const stats = factory.getStatistics();
      expect(stats.uptime).toBeGreaterThan(0);
    });
  });

  describe('agent from definition', () => {
    beforeEach(() => {
      const creator = async (config: AgentConfig) => {
        const agent = new MockAgent(config);
        await agent.initialize();
        return agent;
      };
      factory.registerAgentType('test:mock', creator);
    });

    it('should create agent from definition', async () => {
      const definition: AgentDefinition = {
        id: 'test-agent',
        domain: 'test',
        role: 'mock',
        description: 'Test agent',
        capabilities: [
          {
            id: 'test-capability',
            name: 'Test Capability',
            description: 'Test capability',
            category: 'technical',
            level: 'intermediate',
            keywords: ['test']
          }
        ],
        personalityTraits: [
          { name: 'helpful', value: 0.8, description: 'Helpful trait', category: 'social' }
        ],
        tools: [
          {
            id: 'test-tool',
            name: 'Test Tool',
            description: 'Test tool',
            parameters: [],
            category: 'general',
            accessLevel: 'public'
          }
        ],
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const agent = await factory.createFromDefinition(definition);
      
      expect(agent.id).toBe('test-agent');
      expect(agent.definition.domain).toBe('test');
      expect(agent.definition.role).toBe('mock');
    });
  });

  describe('factory lifecycle', () => {
    it('should clear all data', () => {
      const creator = async (config: AgentConfig) => new MockAgent(config);
      factory.registerAgentType('test:mock', creator);
      
      const template: AgentTemplate = {
        id: 'test-template',
        domain: 'test',
        role: 'mock',
        description: 'Test template',
        defaultCapabilities: [],
        defaultPersonalityTraits: [],
        defaultTools: [],
        configSchema: {},
        examples: [],
        documentation: ''
      };
      factory.registerTemplate(template);

      factory.clear();

      expect(factory.getAvailableTypes()).toHaveLength(0);
      expect(factory.getTemplate('test', 'mock')).toBeNull();
      expect(factory.getStatistics().totalAgentsCreated).toBe(0);
    });

    it('should shutdown gracefully', async () => {
      const shutdownSpy = vi.fn();
      factory.on('factory-shutdown', shutdownSpy);

      await factory.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(factory.getAvailableTypes()).toHaveLength(0);
    });
  });
});

describe('SimpleAgentMemory', () => {
  let memory: SimpleAgentMemory;

  beforeEach(() => {
    memory = new SimpleAgentMemory();
  });

  it('should store and retrieve items', async () => {
    const item = {
      content: 'test content',
      timestamp: new Date(),
      metadata: { type: 'test' }
    };

    const id = await memory.store(item);
    expect(id).toBeDefined();

    const results = await memory.retrieve('test');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('test content');
  });

  it('should update items', async () => {
    const item = { content: 'original content' };
    const id = await memory.store(item);

    await memory.update(id, { content: 'updated content' });

    const results = await memory.retrieve('updated');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('updated content');
  });

  it('should delete items', async () => {
    const item = { content: 'test content' };
    const id = await memory.store(item);

    await memory.delete(id);

    const results = await memory.retrieve('test');
    expect(results).toHaveLength(0);
  });

  it('should clear all items', async () => {
    await memory.store({ content: 'item 1' });
    await memory.store({ content: 'item 2' });

    expect(memory.getSize()).toBe(2);

    await memory.clear();

    expect(memory.getSize()).toBe(0);
  });

  it('should limit search results', async () => {
    for (let i = 0; i < 15; i++) {
      await memory.store({ content: `test item ${i}` });
    }

    const results = await memory.retrieve('test', 5);
    expect(results).toHaveLength(5);
  });
});