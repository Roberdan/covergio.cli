/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  CollaborationPattern,
  AutoGenError,
  AgentCreationError,
  ConversationError,
  BridgeError
} from '../types';

describe('AutoGen Types', () => {
  describe('AutoGenAgentConfig', () => {
    it('should define agent configuration correctly', () => {
      const config: AutoGenAgentConfig = {
        name: 'test-agent',
        role: 'assistant',
        system_message: 'You are a helpful assistant',
        llm_config: {
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 2000
        },
        description: 'Test agent for validation'
      };

      expect(config.name).toBe('test-agent');
      expect(config.role).toBe('assistant');
      expect(config.system_message).toBe('You are a helpful assistant');
      expect(config.llm_config.model).toBe('gpt-4');
      expect(config.description).toBe('Test agent for validation');
    });

    it('should support optional properties', () => {
      const minimalConfig: AutoGenAgentConfig = {
        name: 'minimal-agent',
        role: 'assistant',
        system_message: 'Minimal configuration',
        llm_config: {
          model: 'gpt-3.5-turbo'
        }
      };

      expect(minimalConfig.tools).toBeUndefined();
      expect(minimalConfig.max_consecutive_auto_reply).toBeUndefined();
      expect(minimalConfig.human_input_mode).toBeUndefined();
    });
  });

  describe('ConversationMessage', () => {
    it('should define message structure correctly', () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Hello, how can I help you?',
        name: 'helpful-assistant',
        timestamp: '2025-07-15T20:00:00Z',
        agent_id: 'agent-123'
      };

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hello, how can I help you?');
      expect(message.name).toBe('helpful-assistant');
      expect(message.timestamp).toBe('2025-07-15T20:00:00Z');
      expect(message.agent_id).toBe('agent-123');
    });

    it('should support optional properties', () => {
      const basicMessage: ConversationMessage = {
        role: 'user',
        content: 'Hello',
        timestamp: '2025-07-15T20:00:00Z',
        agent_id: 'user-123'
      };

      expect(basicMessage.name).toBeUndefined();
      expect(basicMessage.functionCall).toBeUndefined();
      expect(basicMessage.toolCalls).toBeUndefined();
    });
  });

  describe('CollaborationPattern', () => {
    it('should define collaboration patterns', () => {
      expect(CollaborationPattern.SEQUENTIAL).toBe('sequential');
      expect(CollaborationPattern.PARALLEL).toBe('parallel');
      expect(CollaborationPattern.HIERARCHICAL).toBe('hierarchical');
      expect(CollaborationPattern.DEBATE).toBe('debate');
      expect(CollaborationPattern.CONSULTATION).toBe('consultation');
      expect(CollaborationPattern.BRAINSTORM).toBe('brainstorm');
    });
  });

  describe('Error Types', () => {
    it('should create AutoGenError correctly', () => {
      const error = new AutoGenError('Test error', 'TEST_ERROR', { context: 'test' });

      expect(error.name).toBe('AutoGenError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.context).toEqual({ context: 'test' });
      expect(error instanceof Error).toBe(true);
    });

    it('should create AgentCreationError correctly', () => {
      const error = new AgentCreationError('Agent creation failed', { agentName: 'test' });

      expect(error.name).toBe('AgentCreationError');
      expect(error.message).toBe('Agent creation failed');
      expect(error.code).toBe('AGENT_CREATION_ERROR');
      expect(error.context).toEqual({ agentName: 'test' });
      expect(error instanceof AutoGenError).toBe(true);
    });

    it('should create ConversationError correctly', () => {
      const error = new ConversationError('Conversation failed', { conversationId: 'conv-123' });

      expect(error.name).toBe('ConversationError');
      expect(error.message).toBe('Conversation failed');
      expect(error.code).toBe('CONVERSATION_ERROR');
      expect(error.context).toEqual({ conversationId: 'conv-123' });
      expect(error instanceof AutoGenError).toBe(true);
    });

    it('should create BridgeError correctly', () => {
      const error = new BridgeError('Bridge connection failed', { host: 'localhost' });

      expect(error.name).toBe('BridgeError');
      expect(error.message).toBe('Bridge connection failed');
      expect(error.code).toBe('BRIDGE_ERROR');
      expect(error.context).toEqual({ host: 'localhost' });
      expect(error instanceof AutoGenError).toBe(true);
    });
  });

  describe('Type Validation', () => {
    it('should validate LLM config structure', () => {
      const llmConfig = {
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      };

      // All properties should be defined correctly
      expect(typeof llmConfig.model).toBe('string');
      expect(typeof llmConfig.temperature).toBe('number');
      expect(typeof llmConfig.max_tokens).toBe('number');
      expect(llmConfig.temperature).toBeGreaterThanOrEqual(0);
      expect(llmConfig.temperature).toBeLessThanOrEqual(2);
    });

    it('should validate AutoGen tool structure', () => {
      const tool = {
        type: 'function' as const,
        function: {
          name: 'calculate',
          description: 'Perform mathematical calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate'
              }
            },
            required: ['expression']
          }
        },
        implementation: (args: any) => {
          return `Result: ${args.expression}`;
        }
      };

      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('calculate');
      expect(tool.function.description).toBe('Perform mathematical calculations');
      expect(tool.function.parameters.type).toBe('object');
      expect(typeof tool.implementation).toBe('function');
    });

    it('should validate group chat configuration', () => {
      const groupConfig = {
        agents: ['agent1', 'agent2', 'agent3'],
        max_round: 10,
        admin_name: 'Admin',
        speaker_selection_method: 'auto' as const,
        allow_repeat_speaker: true
      };

      expect(Array.isArray(groupConfig.agents)).toBe(true);
      expect(groupConfig.agents.length).toBeGreaterThan(1);
      expect(typeof groupConfig.max_round).toBe('number');
      expect(groupConfig.max_round).toBeGreaterThan(0);
      expect(['auto', 'manual', 'random', 'round_robin']).toContain(groupConfig.speaker_selection_method);
    });
  });

  describe('Event Types', () => {
    it('should define event structure correctly', () => {
      const agentCreatedEvent = {
        agent: {
          name: 'test-agent',
          role: 'assistant'
        },
        timestamp: '2025-07-15T20:00:00Z'
      };

      expect(agentCreatedEvent.agent.name).toBe('test-agent');
      expect(agentCreatedEvent.agent.role).toBe('assistant');
      expect(agentCreatedEvent.timestamp).toBe('2025-07-15T20:00:00Z');
    });

    it('should validate message generated event', () => {
      const messageEvent = {
        agent: {
          name: 'assistant',
          role: 'helper'
        },
        message: {
          role: 'assistant' as const,
          content: 'Test message',
          timestamp: '2025-07-15T20:00:00Z',
          agent_id: 'assistant'
        },
        timestamp: '2025-07-15T20:00:00Z'
      };

      expect(messageEvent.agent.name).toBe('assistant');
      expect(messageEvent.message.content).toBe('Test message');
      expect(messageEvent.message.role).toBe('assistant');
    });
  });
});