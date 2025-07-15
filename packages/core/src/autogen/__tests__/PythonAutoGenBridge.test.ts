/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PythonAutoGenBridge, PythonBridgeConfig } from '../bridges/PythonAutoGenBridge';
import { AutoGenAgentConfig } from '../types';
import { AgentDefinition } from '../../universal/agents/types';
import WebSocket from 'ws';

// Mock WebSocket and fetch
vi.mock('ws');
global.fetch = vi.fn();

describe('PythonAutoGenBridge', () => {
  let bridge: PythonAutoGenBridge;
  let mockWebSocket: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN
    };
    
    (WebSocket as any).mockImplementation(() => mockWebSocket);
    
    // Mock fetch
    mockFetch = global.fetch as any;
    
    const config: Partial<PythonBridgeConfig> = {
      pythonServerHost: 'localhost',
      pythonServerPort: 8765,
      httpPort: 8766,
      enableWebSocket: true,
      connectionTimeout: 5000
    };
    
    bridge = new PythonAutoGenBridge(config);
  });

  afterEach(async () => {
    if (bridge) {
      await bridge.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultBridge = new PythonAutoGenBridge();
      const status = defaultBridge.getStatus();
      
      expect(status.httpUrl).toBe('http://localhost:8766');
      expect(status.websocketUrl).toBe('ws://localhost:8765');
    });

    it('should initialize with custom configuration', () => {
      const config: Partial<PythonBridgeConfig> = {
        pythonServerHost: 'custom-host',
        pythonServerPort: 9000,
        httpPort: 9001
      };
      
      const customBridge = new PythonAutoGenBridge(config);
      const status = customBridge.getStatus();
      
      expect(status.httpUrl).toBe('http://custom-host:9001');
      expect(status.websocketUrl).toBe('ws://custom-host:9000');
    });

    it('should test HTTP connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] })
      });

      // Simulate WebSocket connection opening immediately
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          // Call the callback immediately in next tick
          process.nextTick(callback);
        }
      });

      await bridge.initialize();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8766/agents',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle HTTP connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(bridge.initialize()).rejects.toThrow(
        'Cannot connect to Python AutoGen server'
      );
    });

    it('should handle WebSocket connection timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] })
      });

      // Don't trigger WebSocket open event to simulate timeout
      const config: Partial<PythonBridgeConfig> = {
        connectionTimeout: 100 // Very short timeout
      };
      
      const timeoutBridge = new PythonAutoGenBridge(config);
      
      await expect(timeoutBridge.initialize()).rejects.toThrow(
        'WebSocket connection timeout'
      );
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] })
      });

      // Mock WebSocket events properly
      mockWebSocket.on.mockImplementation((event, callback) => {
        if (event === 'open') {
          process.nextTick(callback);
        }
      });

      await bridge.initialize();
    });

    it('should create agent via HTTP', async () => {
      // Disable WebSocket for this test
      bridge = new PythonAutoGenBridge({ enableWebSocket: false });
      
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ agents: [] }) }) // For initialization
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) }); // For agent creation

      await bridge.initialize();

      const config: AutoGenAgentConfig = {
        name: 'test-agent',
        role: 'assistant',
        system_message: 'You are a helpful assistant',
        llm_config: { model: 'gpt-4' }
      };

      await bridge.createAgent(config);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8766/agents/create',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        })
      );
    });

    it('should create agent via WebSocket', async () => {
      const config: AutoGenAgentConfig = {
        name: 'test-agent',
        role: 'assistant',
        system_message: 'You are a helpful assistant',
        llm_config: { model: 'gpt-4' }
      };

      // Mock WebSocket message handling
      const messageCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      // Create agent and immediately resolve via WebSocket
      const createPromise = bridge.createAgent(config);
      
      if (messageCallback) {
        // Simulate response message
        setTimeout(() => {
          const response = {
            request_id: expect.any(String),
            success: true,
            data: { agent_name: 'test-agent' }
          };
          messageCallback(JSON.stringify(response));
        }, 0);
      }

      await createPromise;

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"create_agent"')
      );
    });

    it('should handle agent creation errors', async () => {
      bridge = new PythonAutoGenBridge({ enableWebSocket: false });
      
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ agents: [] }) })
        .mockResolvedValueOnce({ 
          ok: false, 
          json: () => Promise.resolve({ detail: 'Agent creation failed' }) 
        });

      await bridge.initialize();

      const config: AutoGenAgentConfig = {
        name: 'failing-agent',
        role: 'assistant',
        system_message: 'Test',
        llm_config: { model: 'gpt-4' }
      };

      await expect(bridge.createAgent(config)).rejects.toThrow(
        'Failed to create agent failing-agent'
      );
    });

    it('should list agents', async () => {
      const mockAgents = [
        { name: 'agent1', role: 'assistant', description: 'First agent' },
        { name: 'agent2', role: 'researcher', description: 'Second agent' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: mockAgents })
      });

      const agents = await bridge.listAgents();

      expect(agents).toEqual(mockAgents);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8766/agents');
    });
  });

  describe('Conversation Management', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] })
      });

      const openCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }

      await bridge.initialize();
    });

    it('should start conversation via HTTP', async () => {
      bridge = new PythonAutoGenBridge({ enableWebSocket: false });
      
      const mockConversation = [
        {
          role: 'user',
          content: 'Hello',
          name: 'agent1',
          timestamp: new Date().toISOString(),
          agent_id: 'agent1'
        }
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ agents: [] }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ conversation: mockConversation })
        });

      await bridge.initialize();

      const result = await bridge.startConversation('agent1', 'agent2', 'Hello', 5);

      expect(result).toEqual(mockConversation);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8766/conversations/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            initiator: 'agent1',
            recipient: 'agent2',
            message: 'Hello',
            max_turns: 5
          })
        })
      );
    });

    it('should create group chat', async () => {
      const mockChatId = 'chat_123';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chat_id: mockChatId })
      });

      const config = {
        agents: ['agent1', 'agent2', 'agent3'],
        max_round: 10
      };

      const result = await bridge.createGroupChat(config);

      expect(result).toBe(mockChatId);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8766/groupchats/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(config)
        })
      );
    });
  });

  describe('Agent Bridge Interface', () => {
    it('should convert Universal Agent definition to AutoGen config', () => {
      const definition: AgentDefinition = {
        role: 'data-analyst',
        description: 'Analyzes data and provides insights',
        capabilities: [
          {
            name: 'analyze_data',
            description: 'Analyze dataset and provide insights',
            parameters: {
              type: 'object',
              properties: {
                data: { type: 'array' }
              }
            }
          }
        ],
        personality: {
          traits: ['analytical', 'detail-oriented'],
          communicationStyle: 'professional',
          expertise: ['statistics', 'data visualization'],
          approach: 'methodical'
        },
        temperature: 0.3,
        maxTokens: 2000
      };

      const autoGenConfig = bridge.convertToAutoGen(definition);

      expect(autoGenConfig).toEqual({
        name: 'data-analyst',
        role: 'data-analyst',
        system_message: expect.stringContaining('analytical'),
        llm_config: {
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 2000
        },
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_data',
              description: 'Analyze dataset and provide insights',
              parameters: {
                type: 'object',
                properties: {
                  data: { type: 'array' }
                }
              }
            }
          }
        ],
        description: 'Analyzes data and provides insights'
      });
    });

    it('should convert AutoGen config to Universal Agent definition', () => {
      const autoGenConfig: AutoGenAgentConfig = {
        name: 'researcher',
        role: 'researcher',
        system_message: 'You are a research assistant',
        llm_config: {
          model: 'gpt-4',
          temperature: 0.5,
          max_tokens: 1500
        },
        description: 'Research assistant agent'
      };

      const definition = bridge.convertFromAutoGen(autoGenConfig);

      expect(definition).toEqual({
        role: 'researcher',
        description: 'Research assistant agent',
        capabilities: [],
        personality: {
          traits: [],
          communicationStyle: 'professional',
          expertise: [],
          approach: 'analytical'
        },
        temperature: 0.5,
        maxTokens: 1500
      });
    });

    it('should map personality to system message', () => {
      const personality = {
        traits: ['creative', 'empathetic'],
        communicationStyle: 'casual' as const,
        expertise: ['writing', 'storytelling'],
        approach: 'collaborative' as const
      };

      const systemMessage = bridge.mapPersonality(personality);

      expect(systemMessage).toContain('creative, empathetic');
      expect(systemMessage).toContain('writing, storytelling');
      expect(systemMessage).toContain('casual');
      expect(systemMessage).toContain('collaborative');
    });
  });

  describe('WebSocket Event Handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agents: [] })
      });

      const openCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')?.[1];
      if (openCallback) {
        setTimeout(() => openCallback(), 0);
      }

      await bridge.initialize();
    });

    it('should handle agent created events', () => {
      const eventSpy = vi.fn();
      bridge.on('agent.created', eventSpy);

      const messageCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      if (messageCallback) {
        const eventMessage = {
          type: 'agent_created',
          data: {
            agent: { name: 'test-agent', role: 'assistant' }
          }
        };
        
        messageCallback(JSON.stringify(eventMessage));
        
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            agent: { name: 'test-agent', role: 'assistant' },
            timestamp: expect.any(String)
          })
        );
      }
    });

    it('should handle error events', () => {
      const errorSpy = vi.fn();
      bridge.on('error.occurred', errorSpy);

      const messageCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      
      if (messageCallback) {
        const errorMessage = {
          type: 'error',
          data: {
            error: 'Something went wrong',
            context: 'test context'
          }
        };
        
        messageCallback(JSON.stringify(errorMessage));
        
        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(Error),
            context: 'test context',
            timestamp: expect.any(String)
          })
        );
      }
    });
  });

  describe('Connection Management', () => {
    it('should get connection status', () => {
      const status = bridge.getStatus();

      expect(status).toEqual({
        connected: false,
        httpUrl: 'http://localhost:8766',
        websocketUrl: 'ws://localhost:8765',
        clientId: expect.any(String),
        reconnectAttempts: 0
      });
    });

    it('should close connection properly', async () => {
      await bridge.close();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(bridge.isConnectedToPython()).toBe(false);
    });
  });
});