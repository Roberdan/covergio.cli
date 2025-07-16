/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { AgentConversation } from '../AgentConversation.js';
import { ConversationTurn, AgentInstance, CollaborationPattern } from '../../../types/shared.js';

// Mock agents
const mockAgents: AgentInstance[] = [
  {
    id: 'agent-1',
    type: 'coding',
    capabilities: [
      { name: 'javascript', version: '1.0', description: 'JavaScript development' },
      { name: 'typescript', version: '1.0', description: 'TypeScript development' },
      { name: 'react', version: '1.0', description: 'React development' }
    ],
    status: 'busy',
    configuration: {
      model: 'gpt-4',
      temperature: 0.1
    },
    performance: {
      successRate: 0.95,
      averageResponseTime: 1200,
      tasksCompleted: 15
    }
  },
  {
    id: 'agent-2',
    type: 'design',
    capabilities: [
      { name: 'ui-design', version: '1.0', description: 'UI design' },
      { name: 'user-research', version: '1.0', description: 'User research' },
      { name: 'prototyping', version: '1.0', description: 'Prototyping' }
    ],
    status: 'idle',
    configuration: {
      model: 'claude-3',
      temperature: 0.7
    },
    performance: {
      successRate: 0.88,
      averageResponseTime: 800,
      tasksCompleted: 8
    }
  }
];

// Mock conversation turns
const mockConversation: ConversationTurn[] = [
  {
    id: 'turn-1',
    message: {
      id: 'msg-1',
      role: 'user',
      content: 'I need help building a React component',
      timestamp: new Date().toISOString(),
      agentId: 'user',
      type: 'default'
    },
    sequenceNumber: 1,
    turnDuration: 0
  },
  {
    id: 'turn-2',
    message: {
      id: 'msg-2',
      role: 'assistant',
      content: 'I can help you build a React component. What kind of component do you need?',
      timestamp: new Date().toISOString(),
      agentId: 'agent-1',
      type: 'default',
      metadata: {
        toolsUsed: ['react-analyzer'],
        responseTime: 1100
      }
    },
    sequenceNumber: 2,
    turnDuration: 1100,
    metadata: {
      toolsUsed: ['react-analyzer'],
      responseTime: 1100
    }
  },
  {
    id: 'turn-3',
    message: {
      id: 'msg-3',
      role: 'assistant',
      content: 'From a design perspective, what user experience are you targeting?',
      timestamp: new Date().toISOString(),
      agentId: 'agent-2',
      type: 'default',
      metadata: {
        responseTime: 750
      }
    },
    sequenceNumber: 3,
    turnDuration: 750,
    metadata: {
      responseTime: 750
    }
  }
];

describe('AgentConversation Component', () => {
  it('renders agents panel and conversation thread', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    // Should show agents panel
    expect(lastFrame()).toContain('🤖 Active Agents (2)');
    expect(lastFrame()).toContain('agent-1');
    expect(lastFrame()).toContain('agent-2');
    expect(lastFrame()).toContain('[coding]');
    expect(lastFrame()).toContain('[design]');

    // Should show conversation thread
    expect(lastFrame()).toContain('💬 Conversation Thread');
    expect(lastFrame()).toContain('I need help building a React component');
    expect(lastFrame()).toContain('I can help you build a React component');
  });

  it('shows collaboration pattern when provided', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        pattern={CollaborationPattern.PARALLEL}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('⥁ Parallel');
  });

  it('shows session ID when provided', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        pattern={CollaborationPattern.SEQUENTIAL}
        sessionId="session-123"
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('→ Sequential');
    expect(lastFrame()).toContain('(session-123)');
  });

  it('highlights active agent', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        activeAgent="agent-1"
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('🎯 Addressing: agent-1');
  });

  it('shows session statistics', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('📊 Session Stats');
    expect(lastFrame()).toContain('Turns: 3 (1 user, 2 agent)');
    expect(lastFrame()).toContain('Active: 2/2');
    expect(lastFrame()).toContain('Avg Response:');
  });

  it('shows active agents status', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('2 agents are active');
  });

  it('hides agent panel when showAgentPanel is false', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        showAgentPanel={false}
        showProgress={true}
      />
    );

    expect(lastFrame()).not.toContain('🤖 Active Agents');
    expect(lastFrame()).toContain('💬 Conversation Thread');
  });

  it('hides progress when showProgress is false', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={mockConversation}
        showAgentPanel={true}
        showProgress={false}
      />
    );

    expect(lastFrame()).not.toContain('📊 Session Stats');
    expect(lastFrame()).toContain('🤖 Active Agents');
  });

  it('handles empty conversation correctly', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={[]}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('No conversation turns yet...');
    expect(lastFrame()).toContain('Turns: 0 (0 user, 0 agent)');
  });

  it('handles no agents correctly', () => {
    const { lastFrame } = render(
      <AgentConversation
        agents={[]}
        conversation={mockConversation}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('🤖 Active Agents (0)');
    expect(lastFrame()).toContain('Active: 0/0');
  });

  it('shows different collaboration patterns correctly', () => {
    const patterns = [
      { pattern: CollaborationPattern.DEBATE, expected: '⚔️ Debate' },
      { pattern: CollaborationPattern.CONSULTATION, expected: '💭 Consultation' },
      { pattern: CollaborationPattern.BRAINSTORM, expected: '💡 Brainstorm' },
      { pattern: CollaborationPattern.HIERARCHICAL, expected: '🏗️ Hierarchical' }
    ];

    patterns.forEach(({ pattern, expected }) => {
      const { lastFrame } = render(
        <AgentConversation
          agents={mockAgents}
          conversation={mockConversation}
          pattern={pattern}
          showAgentPanel={true}
          showProgress={true}
        />
      );

      expect(lastFrame()).toContain(expected);
    });
  });

  it('calculates conversation statistics correctly', () => {
    const conversationWithResponseTimes: ConversationTurn[] = [
      {
        id: 'turn-1',
        message: {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date().toISOString(),
          agentId: 'user',
          type: 'default'
        },
        sequenceNumber: 1,
        turnDuration: 0
      },
      {
        id: 'turn-2',
        message: {
          id: 'msg-2',
          role: 'assistant',
          content: 'Agent response 1',
          timestamp: new Date().toISOString(),
          agentId: 'agent-1',
          type: 'default'
        },
        sequenceNumber: 2,
        turnDuration: 1000,
        metadata: {
          responseTime: 1000
        }
      },
      {
        id: 'turn-3',
        message: {
          id: 'msg-3',
          role: 'assistant',
          content: 'Agent response 2',
          timestamp: new Date().toISOString(),
          agentId: 'agent-2',
          type: 'default'
        },
        sequenceNumber: 3,
        turnDuration: 2000,
        metadata: {
          responseTime: 2000
        }
      }
    ];

    const { lastFrame } = render(
      <AgentConversation
        agents={mockAgents}
        conversation={conversationWithResponseTimes}
        showAgentPanel={true}
        showProgress={true}
      />
    );

    expect(lastFrame()).toContain('Turns: 3 (1 user, 2 agent)');
    expect(lastFrame()).toContain('Avg Response: 1500ms');
  });
});