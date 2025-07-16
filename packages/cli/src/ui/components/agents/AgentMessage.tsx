/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { ConversationMessage, AgentInstance } from '../../../types/shared.js';

interface AgentMessageProps {
  message: ConversationMessage;
  agent?: AgentInstance;
  isUser?: boolean;
  showTimestamp?: boolean;
  showTools?: boolean;
  maxWidth?: number;
}

/**
 * Enhanced message component for different agent response types
 */
export const AgentMessage: React.FC<AgentMessageProps> = ({
  message,
  agent,
  isUser = false,
  showTimestamp = true,
  showTools = true,
  maxWidth = 80
}) => {
  const getMessageTypeIcon = (type: string): string => {
    switch (type) {
      case 'thinking':
        return '🤔';
      case 'tool-use':
        return '🔧';
      case 'code':
        return '💻';
      case 'analysis':
        return '📊';
      case 'error':
        return '❌';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '💬';
    }
  };

  const getAgentColor = (agentId: string): string => {
    const colors = ['cyan', 'yellow', 'green', 'magenta', 'blue', 'red'];
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const wrapText = (text: string, width: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  };

  const renderCodeBlock = (content: string): React.ReactNode => {
    const lines = content.split('\n');
    return (
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {lines.map((line, index) => (
          <Text key={index} color="green">
            {line}
          </Text>
        ))}
      </Box>
    );
  };

  const renderThinkingMessage = (): React.ReactNode => {
    const thinkingPhrases = [
      "Let me think about this...",
      "Processing your request...",
      "Analyzing the situation...",
      "Working on a solution...",
      "Gathering information..."
    ];
    
    return (
      <Text color="yellow" italic>
        {thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)]}
      </Text>
    );
  };

  const wrappedContent = wrapText(message.content, maxWidth - 4);
  const agentColor = isUser ? 'white' : getAgentColor(message.agentId);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Message Header */}
      <Box>
        {/* Message Type Icon */}
        <Text>
          {getMessageTypeIcon(message.type || 'default')}
        </Text>
        
        {/* Agent/User Identifier */}
        <Text color={agentColor} bold>
          {' ' + (isUser ? '👤 You' : `🤖 ${message.agentId}`)}
        </Text>
        
        {/* Agent Domain */}
        {!isUser && agent?.type && (
          <Text color="gray"> [{agent.type}]</Text>
        )}
        
        {/* Message Type */}
        {message.type && message.type !== 'default' && (
          <Text color="blue"> ({message.type})</Text>
        )}
        
        {/* Timestamp */}
        {showTimestamp && (
          <Text color="gray">  {formatTimestamp(message.timestamp)}</Text>
        )}
      </Box>

      {/* Message Content */}
      <Box flexDirection="column" marginLeft={2}>
        {message.type === 'thinking' ? (
          renderThinkingMessage()
        ) : message.type === 'code' ? (
          renderCodeBlock(message.content)
        ) : (
          wrappedContent.map((line, index) => (
            <Text key={index} color={isUser ? 'white' : 'gray'}>
              {line}
            </Text>
          ))
        )}
      </Box>

      {/* Tools Used */}
      {showTools && message.metadata?.toolsUsed && message.metadata.toolsUsed.length > 0 && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="blue">🔧 Tools: </Text>
          <Text color="gray">
            {message.metadata.toolsUsed.join(', ')}
          </Text>
        </Box>
      )}

      {/* Response Time */}
      {message.metadata?.responseTime && (
        <Box marginLeft={2}>
          <Text color="yellow">⏱️  </Text>
          <Text color="gray">
            {Math.round(message.metadata.responseTime)}ms
          </Text>
        </Box>
      )}

      {/* Context References */}
      {message.metadata?.contextReferences && message.metadata.contextReferences.length > 0 && (
        <Box marginLeft={2}>
          <Text color="magenta">📎 Context: </Text>
          <Text color="gray">
            {message.metadata.contextReferences.slice(0, 3).join(', ')}
            {message.metadata.contextReferences.length > 3 && 
              ` (+${message.metadata.contextReferences.length - 3} more)`
            }
          </Text>
        </Box>
      )}
    </Box>
  );
};