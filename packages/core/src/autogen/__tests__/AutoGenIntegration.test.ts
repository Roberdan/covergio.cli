/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoGenIntegration } from '../AutoGenIntegration';
import { PythonAutoGenBridge } from '../bridges/PythonAutoGenBridge';
import {
  AutoGenAgentConfig,
  CollaborationPattern,
  AutoGenConfig
} from '../types';
import { AgentDefinition } from '../../universal/agents/types';

// Mock the bridge
vi.mock('../bridges/PythonAutoGenBridge');

describe('AutoGenIntegration', () => {
  let integration: AutoGenIntegration;
  let mockBridge: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock bridge
    mockBridge = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createAgent: vi.fn().mockResolvedValue(undefined),
      listAgents: vi.fn().mockResolvedValue([]),
      startConversation: vi.fn().mockResolvedValue([]),
      createGroupChat: vi.fn().mockResolvedValue('chat_123'),
      convertToAutoGen: vi.fn().mockReturnValue({
        name: 'test-agent',
        role: 'assistant',
        system_message: 'Test system message',
        llm_config: { model: 'gpt-4' }
      }),
      getStatus: vi.fn().mockReturnValue({
        connected: true,
        httpUrl: 'http://localhost:8766',
        websocketUrl: 'ws://localhost:8765',
        clientId: 'test-client',
        reconnectAttempts: 0
      }),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      emit: vi.fn()
    };

    // Mock the PythonAutoGenBridge constructor
    (PythonAutoGenBridge as any).mockImplementation(() => mockBridge);

    // Create integration instance
    const config: Partial<AutoGenConfig> = {
      defaultLLM: 'gpt-4',
      enableLogging: false
    };
    
    integration = new AutoGenIntegration(config);
  });

  afterEach(async () => {
    if (integration) {
      await integration.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await integration.initialize();
      
      expect(mockBridge.initialize).toHaveBeenCalledOnce();
    });

    it('should handle initialization errors', async () => {
      mockBridge.initialize.mockRejectedValueOnce(new Error('Bridge connection failed'));
      
      await expect(integration.initialize()).rejects.toThrow('Failed to initialize AutoGen integration');
    });

    it('should emit initialized event on successful initialization', async () => {
      const emitSpy = vi.spyOn(integration, 'emit');
      
      await integration.initialize();
      
      expect(emitSpy).toHaveBeenCalledWith('initialized', expect.objectContaining({
        timestamp: expect.any(String),
        config: expect.any(Object)
      }));
    });
  });

  describe('Agent Creation', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should create agent from Universal Agent definition', async () => {
      const definition: AgentDefinition = {
        role: 'analyst',
        description: 'Data analysis agent',
        capabilities: [],
        personality: {
          traits: ['analytical', 'thorough'],
          communicationStyle: 'professional',
          expertise: ['data analysis'],
          approach: 'methodical'
        },
        temperature: 0.3,
        maxTokens: 1500
      };

      const agentName = await integration.createAgentFromDefinition(definition);
      
      expect(agentName).toBe('test-agent');
      expect(mockBridge.convertToAutoGen).toHaveBeenCalledWith(definition);
      expect(mockBridge.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          llm_config: expect.objectContaining({
            model: 'gpt-4',
            temperature: 0.3,
            max_tokens: 1500
          })
        })
      );
    });

    it('should create agent with custom configuration', async () => {
      const config: AutoGenAgentConfig = {
        name: 'custom-agent',
        role: 'researcher',
        system_message: 'You are a research assistant',
        llm_config: {
          model: 'gpt-3.5-turbo',
          temperature: 0.5
        }
      };

      const agentName = await integration.createAgent(config);
      
      expect(agentName).toBe('custom-agent');
      expect(mockBridge.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'custom-agent',
          llm_config: expect.objectContaining({
            model: 'gpt-3.5-turbo',
            temperature: 0.5
          })
        })
      );
    });

    it('should handle agent creation errors', async () => {
      mockBridge.createAgent.mockRejectedValueOnce(new Error('Agent creation failed'));
      
      const config: AutoGenAgentConfig = {
        name: 'failing-agent',
        role: 'test',
        system_message: 'Test message',
        llm_config: { model: 'gpt-4' }
      };

      await expect(integration.createAgent(config)).rejects.toThrow('Failed to create agent');
    });
  });

  describe('Conversations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should start conversation between two agents', async () => {
      const mockConversation = [
        {
          role: 'user',
          content: 'Hello',
          name: 'initiator',
          timestamp: new Date().toISOString(),
          agent_id: 'initiator'
        },
        {
          role: 'assistant',
          content: 'Hello! How can I help?',
          name: 'recipient',
          timestamp: new Date().toISOString(),
          agent_id: 'recipient'
        }
      ];
      
      mockBridge.startConversation.mockResolvedValueOnce(mockConversation);

      const result = await integration.startConversation(
        'initiator',
        'recipient',
        'Hello',
        { maxTurns: 5 }
      );

      expect(result).toEqual(mockConversation);
      expect(mockBridge.startConversation).toHaveBeenCalledWith(
        'initiator',
        'recipient',
        'Hello',
        5
      );
    });

    it('should handle conversation errors', async () => {
      mockBridge.startConversation.mockRejectedValueOnce(new Error('Conversation failed'));

      await expect(
        integration.startConversation('agent1', 'agent2', 'test message')
      ).rejects.toThrow('Failed to start conversation');
    });
  });

  describe('Group Chats', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should create group chat', async () => {
      const agents = ['agent1', 'agent2', 'agent3'];
      
      const chatId = await integration.createGroupChat(agents);
      
      expect(chatId).toBe('chat_123');
      expect(mockBridge.createGroupChat).toHaveBeenCalledWith(
        expect.objectContaining({
          agents,
          max_round: 10,
          admin_name: 'Admin',
          speaker_selection_method: 'auto',
          allow_repeat_speaker: true
        })
      );
    });

    it('should create group chat with custom configuration', async () => {
      const agents = ['agent1', 'agent2'];
      const config = {
        max_round: 5,
        admin_name: 'CustomAdmin',
        speaker_selection_method: 'round_robin' as const
      };
      
      await integration.createGroupChat(agents, config);
      
      expect(mockBridge.createGroupChat).toHaveBeenCalledWith(
        expect.objectContaining({
          agents,
          max_round: 5,
          admin_name: 'CustomAdmin',
          speaker_selection_method: 'round_robin'
        })
      );
    });
  });

  describe('Collaboration Patterns', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should execute sequential collaboration pattern', async () => {
      const agents = ['agent1', 'agent2', 'agent3'];
      const message = 'Start sequential collaboration';
      
      mockBridge.startConversation
        .mockResolvedValueOnce([{ role: 'assistant', content: 'Response 1', name: 'agent2', timestamp: new Date().toISOString(), agent_id: 'agent2' }])
        .mockResolvedValueOnce([{ role: 'assistant', content: 'Response 2', name: 'agent3', timestamp: new Date().toISOString(), agent_id: 'agent3' }]);

      const result = await integration.executeCollaborationPattern(
        CollaborationPattern.SEQUENTIAL,
        agents,
        message
      );

      expect(result).toHaveLength(2);
      expect(mockBridge.startConversation).toHaveBeenCalledTimes(2);
    });

    it('should execute parallel collaboration pattern', async () => {
      const agents = ['agent1', 'agent2', 'agent3'];
      const message = 'Start parallel collaboration';
      
      mockBridge.startConversation
        .mockResolvedValueOnce([{ role: 'assistant', content: 'Response from agent2', name: 'agent2', timestamp: new Date().toISOString(), agent_id: 'agent2' }])
        .mockResolvedValueOnce([{ role: 'assistant', content: 'Response from agent3', name: 'agent3', timestamp: new Date().toISOString(), agent_id: 'agent3' }]);

      const result = await integration.executeCollaborationPattern(
        CollaborationPattern.PARALLEL,
        agents,
        message
      );

      expect(result).toHaveLength(2);
      expect(mockBridge.startConversation).toHaveBeenCalledTimes(2);
    });

    it('should handle unsupported collaboration patterns', async () => {
      const agents = ['agent1', 'agent2'];
      const message = 'Test message';
      
      await expect(
        integration.executeCollaborationPattern(
          'unsupported_pattern' as CollaborationPattern,
          agents,
          message
        )
      ).rejects.toThrow('Unsupported collaboration pattern');
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should list agents', async () => {
      const mockAgents = [
        { name: 'agent1', role: 'assistant', description: 'First agent' },
        { name: 'agent2', role: 'researcher', description: 'Second agent' }
      ];
      
      mockBridge.listAgents.mockResolvedValueOnce(mockAgents);

      const result = await integration.listAgents();
      
      expect(result).toEqual(mockAgents);
      expect(mockBridge.listAgents).toHaveBeenCalledOnce();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should calculate conversation statistics', async () => {
      // Start a tracked conversation
      const mockConversation = [
        {
          role: 'user',
          content: 'Hello there, how are you doing today?',
          name: 'agent1',
          timestamp: new Date().toISOString(),
          agent_id: 'agent1'
        },
        {
          role: 'assistant',
          content: 'I am doing well, thank you for asking!',
          name: 'agent2',
          timestamp: new Date().toISOString(),
          agent_id: 'agent2'
        }
      ];
      
      mockBridge.startConversation.mockResolvedValueOnce(mockConversation);

      await integration.startConversation('agent1', 'agent2', 'Hello', { trackStats: true });
      
      const stats = integration.getConversationStats();
      
      expect(Array.isArray(stats)).toBe(true);
      if (Array.isArray(stats) && stats.length > 0) {
        expect(stats[0]).toHaveProperty('totalMessages');
        expect(stats[0]).toHaveProperty('messagesByAgent');
        expect(stats[0]).toHaveProperty('tokenUsage');
        expect(stats[0]).toHaveProperty('conversationDuration');
        expect(stats[0]).toHaveProperty('turnPattern');
      }
    });
  });

  describe('Bridge Status', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should get bridge status', () => {
      const status = integration.getBridgeStatus();
      
      expect(status).toEqual({
        connected: true,
        httpUrl: 'http://localhost:8766',
        websocketUrl: 'ws://localhost:8765',
        clientId: 'test-client',
        reconnectAttempts: 0
      });
    });
  });

  describe('Cleanup', () => {
    it('should close integration properly', async () => {
      await integration.initialize();
      
      const emitSpy = vi.spyOn(integration, 'emit');
      
      await integration.close();
      
      expect(mockBridge.close).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith('closed', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });
  });
});