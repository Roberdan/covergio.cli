/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { AgentMessage } from '../AgentMessage.js';
import { ConversationMessage, AgentInstance } from '../../../types/shared.js';

// Mock data
const mockMessage: ConversationMessage = {
  id: 'msg-1',
  role: 'assistant',
  content: 'This is a test message from an agent.',
  timestamp: new Date().toISOString(),
  agentId: 'test-agent',
  type: 'default',
  metadata: {
    toolsUsed: ['file-reader', 'text-processor'],
    responseTime: 1250,
    contextReferences: ['context-1', 'context-2']
  }
};

const mockAgent: AgentInstance = {
  id: 'test-agent',
  type: 'testing',
  capabilities: [
    { name: 'testing', version: '1.0', description: 'Testing capabilities' },
    { name: 'debugging', version: '1.0', description: 'Debugging capabilities' }
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
};

describe('AgentMessage Component', () => {
  it('renders basic agent message correctly', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('🤖 test-agent');
    expect(lastFrame()).toContain('[testing]');
    expect(lastFrame()).toContain('This is a test message from an agent.');
  });

  it('renders user message correctly', () => {
    const userMessage = {
      ...mockMessage,
      role: 'user' as const,
      agentId: 'user'
    };

    const { lastFrame } = render(
      <AgentMessage
        message={userMessage}
        isUser={true}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('👤 You');
    expect(lastFrame()).not.toContain('[testing]');
  });

  it('shows timestamp when enabled', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        agent={mockAgent}
        showTimestamp={true}
        showTools={false}
      />
    );

    // Should contain a timestamp pattern (HH:MM:SS)
    expect(lastFrame()).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('shows tools when enabled', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={true}
      />
    );

    expect(lastFrame()).toContain('🔧 Tools:');
    expect(lastFrame()).toContain('file-reader, text-processor');
  });

  it('shows response time when available', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('⏱️');
    expect(lastFrame()).toContain('1250ms');
  });

  it('shows context references when available', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('📎 Context:');
    expect(lastFrame()).toContain('context-1, context-2');
  });

  it('handles different message types correctly', () => {
    const codeMessage = {
      ...mockMessage,
      type: 'code',
      content: 'const x = 1;\nconsole.log(x);'
    };

    const { lastFrame } = render(
      <AgentMessage
        message={codeMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('💻');
    expect(lastFrame()).toContain('const x = 1;');
    expect(lastFrame()).toContain('console.log(x);');
  });

  it('handles thinking message type', () => {
    const thinkingMessage = {
      ...mockMessage,
      type: 'thinking',
      content: 'Thinking...'
    };

    const { lastFrame } = render(
      <AgentMessage
        message={thinkingMessage}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('🤔');
    expect(lastFrame()).toMatch(/Let me think|Processing|Analyzing|Working|Gathering/);
  });

  it('wraps long text correctly', () => {
    const longMessage = {
      ...mockMessage,
      content: 'This is a very long message that should be wrapped across multiple lines when the content exceeds the maximum width specified for the message component.'
    };

    const { lastFrame } = render(
      <AgentMessage
        message={longMessage}
        agent={mockAgent}
        maxWidth={50}
        showTimestamp={false}
        showTools={false}
      />
    );

    // Should contain the message content split across lines
    expect(lastFrame()).toContain('This is a very long message that should be');
    expect(lastFrame()).toContain('wrapped across multiple lines');
  });

  it('handles message without agent correctly', () => {
    const { lastFrame } = render(
      <AgentMessage
        message={mockMessage}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('🤖 test-agent');
    expect(lastFrame()).not.toContain('[testing]'); // No type badge without agent
  });

  it('truncates long context references', () => {
    const messageWithManyContexts = {
      ...mockMessage,
      metadata: {
        ...mockMessage.metadata,
        contextReferences: ['ctx-1', 'ctx-2', 'ctx-3', 'ctx-4', 'ctx-5']
      }
    };

    const { lastFrame } = render(
      <AgentMessage
        message={messageWithManyContexts}
        agent={mockAgent}
        showTimestamp={false}
        showTools={false}
      />
    );

    expect(lastFrame()).toContain('📎 Context:');
    expect(lastFrame()).toContain('ctx-1, ctx-2, ctx-3');
    expect(lastFrame()).toContain('(+2 more)');
  });
});