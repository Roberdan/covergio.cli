/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { UniversalAgentAdapter } from '../bridges/UniversalAgentAdapter';
import { PythonAutoGenBridge } from '../bridges/PythonAutoGenBridge';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  AutoGenTool,
  BridgeError
} from '../types';
import {
  IAgent,
  AgentDefinition,
  AgentConfig,
  AgentRequest,
  AgentResponse,
  Capability,
  PersonalityTrait,
  ToolDefinition,
  AgentContext
} from '../../universal/agents/types';

// Mock PythonAutoGenBridge
class MockPythonAutoGenBridge extends EventEmitter {
  async createAgent(config: AutoGenAgentConfig): Promise<void> {
    // Mock implementation
  }

  async sendMessage(agentName: string, message: ConversationMessage): Promise<ConversationMessage> {
    return {
      role: 'assistant',
      content: `Mock response from ${agentName}`,
      timestamp: new Date().toISOString(),
      agent_id: agentName
    };
  }
}

// Mock Universal Agent
class MockUniversalAgent extends EventEmitter implements IAgent {
  constructor(
    public readonly id: string,
    public readonly definition: AgentDefinition
  ) {
    super();
  }

  readonly state = 'ready' as const;
  readonly memory = {
    store: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn()
  };

  async execute(request: AgentRequest): Promise<AgentResponse> {
    return {
      type: 'text',
      content: 'Mock response',
      context: request.context,
      executionTime: 100,
      confidence: 0.9
    };
  }

  getCapabilities(): Capability[] {
    return this.definition.capabilities;
  }

  getPersonality(): PersonalityTrait[] {
    return this.definition.personalityTraits;
  }

  getTools(): ToolDefinition[] {
    return this.definition.tools;
  }

  async initialize(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async terminate(): Promise<void> {}

  getHealth() {
    return {
      status: 'healthy' as const,
      uptime: 1000,
      memoryUsage: 50,
      executionCount: 10,
      errorCount: 0,
      lastActivity: new Date()
    };
  }

  async updateConfig(config: Partial<AgentConfig>): Promise<void> {}
  async serialize(): Promise<string> { return '{}'; }
  async deserialize(data: string): Promise<void> {}
}

describe('UniversalAgentAdapter', () => {
  let adapter: UniversalAgentAdapter;
  let mockBridge: MockPythonAutoGenBridge;
  let mockAgent: MockUniversalAgent;
  let mockDefinition: AgentDefinition;

  beforeEach(() => {
    mockBridge = new MockPythonAutoGenBridge();
    adapter = new UniversalAgentAdapter(mockBridge as any);

    const mockCapabilities: Capability[] = [
      {
        id: 'analysis',
        name: 'Data Analysis',
        description: 'Analyze and interpret data',
        category: 'analytical',
        level: 'advanced',
        keywords: ['data', 'analysis']
      },
      {
        id: 'communication',
        name: 'Communication',
        description: 'Communicate effectively',
        category: 'communication',
        level: 'expert',
        keywords: ['communication', 'writing']
      }
    ];

    const mockPersonalityTraits: PersonalityTrait[] = [
      {
        name: 'analytical',
        value: 0.8,
        description: 'Approaches problems systematically',
        category: 'analytical'
      },
      {
        name: 'creative',
        value: 0.6,
        description: 'Generates innovative solutions',
        category: 'creativity'
      }
    ];

    const mockTools: ToolDefinition[] = [
      {
        id: 'calculator',
        name: 'Calculator',
        description: 'Perform mathematical calculations',
        parameters: [
          {
            name: 'expression',
            type: 'string',
            description: 'Mathematical expression'
          }
        ],
        category: 'utility',
        accessLevel: 'public'
      }
    ];

    mockDefinition = {
      id: 'test-agent-1',
      domain: 'data-science',
      role: 'Data Analyst',
      description: 'Specialist in data analysis and visualization',
      capabilities: mockCapabilities,
      personalityTraits: mockPersonalityTraits,
      tools: mockTools,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        preferredModel: 'gpt-4'
      }
    };

    mockAgent = new MockUniversalAgent('test-agent-1', mockDefinition);
  });

  describe('convertToAutoGen', () => {
    it('should convert Universal Agent definition to AutoGen configuration', () => {
      const autoGenConfig = adapter.convertToAutoGen(mockDefinition);

      expect(autoGenConfig.name).toBe('data-analyst');
      expect(autoGenConfig.role).toBe('Data Analyst');
      expect(autoGenConfig.system_message).toContain('You are Data Analyst in the data-science domain');
      expect(autoGenConfig.system_message).toContain('Personality characteristics');
      expect(autoGenConfig.system_message).toContain('Your capabilities include');
      expect(autoGenConfig.llm_config.model).toBe('gpt-4');
      expect(autoGenConfig.tools).toHaveLength(2); // capabilities mapped to tools
      expect(autoGenConfig.code_execution_config).toBeDefined(); // data-science domain supports code execution
    });

    it('should handle agent without personality traits', () => {
      const definitionWithoutTraits = {
        ...mockDefinition,
        personalityTraits: []
      };

      const autoGenConfig = adapter.convertToAutoGen(definitionWithoutTraits);
      expect(autoGenConfig.system_message).toContain('You are a helpful AI assistant');
    });

    it('should throw BridgeError on conversion failure', () => {
      const invalidDefinition = {
        ...mockDefinition,
        role: undefined as any
      };

      expect(() => adapter.convertToAutoGen(invalidDefinition)).toThrow(BridgeError);
    });
  });

  describe('convertFromAutoGen', () => {
    it('should convert AutoGen configuration to Universal Agent definition', () => {
      const autoGenConfig: AutoGenAgentConfig = {
        name: 'test-agent',
        role: 'Assistant',
        system_message: 'You are a helpful assistant with analytical capabilities',
        llm_config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.7
        },
        description: 'Test agent for conversion',
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_data',
              description: 'Analyze provided data',
              parameters: {
                type: 'object',
                properties: {
                  data: {
                    type: 'string',
                    description: 'Data to analyze'
                  }
                },
                required: ['data']
              }
            },
            implementation: async (args: any) => `Analyzed: ${args.data}`
          }
        ]
      };

      const definition = adapter.convertFromAutoGen(autoGenConfig);

      expect(definition.role).toBe('Assistant');
      expect(definition.description).toBe('Test agent for conversion');
      expect(definition.capabilities).toHaveLength(1);
      expect(definition.capabilities[0].name).toBe('analyze_data');
      expect(definition.personalityTraits).toHaveLength(1);
      expect(definition.personalityTraits[0].name).toBe('analytical');
      expect(definition.tools).toHaveLength(1);
      expect(definition.metadata?.source).toBe('autogen');
    });
  });

  describe('mapCapabilities', () => {
    it('should map Universal Agent capabilities to AutoGen tools', () => {
      const capabilities: Capability[] = [
        {
          id: 'search',
          name: 'Web Search',
          description: 'Search the internet for information',
          category: 'technical',
          level: 'intermediate',
          keywords: ['search', 'web']
        }
      ];

      const tools = adapter.mapCapabilities(capabilities);

      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function.name).toBe('web_search');
      expect(tools[0].function.description).toBe('Search the internet for information');
      expect(tools[0].function.parameters.type).toBe('object');
      expect(tools[0].implementation).toBeDefined();
    });
  });

  describe('mapPersonality', () => {
    it('should map personality traits to system message', () => {
      const traits: PersonalityTrait[] = [
        {
          name: 'analytical',
          value: 0.9,
          description: 'Highly analytical',
          category: 'analytical'
        },
        {
          name: 'creative',
          value: 0.7,
          description: 'Creative thinker',
          category: 'creativity'
        }
      ];

      const systemMessage = adapter.mapPersonality(traits);

      expect(systemMessage).toContain('You are an AI assistant with the following characteristics');
      expect(systemMessage).toContain('analytical (90%)');
      expect(systemMessage).toContain('creative (70%)');
      expect(systemMessage).toContain('Analytical:');
      expect(systemMessage).toContain('Creativity:');
    });

    it('should handle empty personality traits', () => {
      const systemMessage = adapter.mapPersonality([]);
      expect(systemMessage).toBe('You are a helpful AI assistant.');
    });
  });

  describe('registerUniversalAgent', () => {
    it('should register Universal Agent with AutoGen bridge', async () => {
      const createAgentSpy = vi.spyOn(mockBridge, 'createAgent');
      
      const autoGenName = await adapter.registerUniversalAgent(mockAgent);

      expect(createAgentSpy).toHaveBeenCalled();
      expect(autoGenName).toBe('data-analyst');
      
      const mapping = adapter.getAgentMapping(mockAgent.id);
      expect(mapping).toBeDefined();
      expect(mapping!.universalAgentId).toBe('test-agent-1');
      expect(mapping!.autoGenAgentName).toBe('data-analyst');
      expect(mapping!.syncStatus).toBe('synchronized');
    });

    it('should emit registration event', async () => {
      const eventListener = vi.fn();
      adapter.on('universalAgentRegistered', eventListener);

      await adapter.registerUniversalAgent(mockAgent);

      expect(eventListener).toHaveBeenCalledWith({
        universalAgentId: 'test-agent-1',
        autoGenName: 'data-analyst',
        mapping: expect.any(Object)
      });
    });
  });

  describe('executeUniversalRequest', () => {
    it('should execute Universal Agent request through AutoGen', async () => {
      // First register the agent
      await adapter.registerUniversalAgent(mockAgent);

      const context: AgentContext = {
        sessionId: 'session-123',
        executionId: 'exec-456',
        timestamp: new Date(),
        environment: {}
      };

      const request: AgentRequest = {
        input: 'Analyze this data set',
        context
      };

      const response = await adapter.executeUniversalRequest(mockAgent.id, request);

      expect(response.type).toBe('text');
      expect(response.content).toContain('Mock response from data-analyst');
      expect(response.context).toBe(context);
      expect(response.metadata?.autoGenAgent).toBe('data-analyst');
      expect(response.metadata?.conversationId).toBeDefined();
    });

    it('should throw error for unregistered agent', async () => {
      const context: AgentContext = {
        sessionId: 'session-123',
        executionId: 'exec-456',
        timestamp: new Date(),
        environment: {}
      };

      const request: AgentRequest = {
        input: 'Test request',
        context
      };

      await expect(
        adapter.executeUniversalRequest('unknown-agent', request)
      ).rejects.toThrow(BridgeError);
    });
  });

  describe('getAgentMappings', () => {
    it('should return all agent mappings', async () => {
      await adapter.registerUniversalAgent(mockAgent);

      const mappings = adapter.getAgentMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0].universalAgentId).toBe('test-agent-1');
    });
  });

  describe('unregisterUniversalAgent', () => {
    it('should remove agent mapping and clean up conversations', async () => {
      await adapter.registerUniversalAgent(mockAgent);
      
      expect(adapter.getAgentMapping(mockAgent.id)).toBeDefined();

      await adapter.unregisterUniversalAgent(mockAgent.id);

      expect(adapter.getAgentMapping(mockAgent.id)).toBeUndefined();
    });

    it('should emit unregistration event', async () => {
      await adapter.registerUniversalAgent(mockAgent);

      const eventListener = vi.fn();
      adapter.on('universalAgentUnregistered', eventListener);

      await adapter.unregisterUniversalAgent(mockAgent.id);

      expect(eventListener).toHaveBeenCalledWith({
        universalAgentId: 'test-agent-1',
        autoGenName: 'data-analyst'
      });
    });

    it('should handle unregistering non-existent agent gracefully', async () => {
      await expect(
        adapter.unregisterUniversalAgent('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('event handling', () => {
    it('should handle bridge events correctly', () => {
      const errorListener = vi.fn();
      adapter.on('bridgeError', errorListener);

      mockBridge.emit('error.occurred', { error: 'Test error' });

      expect(errorListener).toHaveBeenCalledWith({ error: 'Test error' });
    });

    it('should handle Universal Agent events and trigger sync', async () => {
      await adapter.registerUniversalAgent(mockAgent);

      const syncListener = vi.fn();
      adapter.on('syncRequired', syncListener);

      mockAgent.emit('execution-completed', { result: 'success' });

      expect(syncListener).toHaveBeenCalledWith({
        universalAgentId: 'test-agent-1'
      });
    });
  });

  describe('error handling', () => {
    it('should handle conversion errors gracefully', () => {
      const invalidDefinition = null as any;

      expect(() => adapter.convertToAutoGen(invalidDefinition)).toThrow(BridgeError);
    });

    it('should handle synchronization errors', async () => {
      await adapter.registerUniversalAgent(mockAgent);

      // Mock a synchronization failure
      const mapping = adapter.getAgentMapping(mockAgent.id)!;
      
      await expect(
        adapter.synchronizeState(mockAgent, {})
      ).resolves.not.toThrow();
    });
  });
});