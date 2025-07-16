/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { ConversationTurn, AgentInstance } from '../../../types/shared.js';

interface ConversationThreadProps {
  turns: ConversationTurn[];
  agents: AgentInstance[];
  activeAgent?: string;
  showTimestamps?: boolean;
  maxTurns?: number;
}

/**
 * Display conversation thread with agent identification and flow
 */
export const ConversationThread: React.FC<ConversationThreadProps> = ({
  turns,
  agents,
  activeAgent,
  showTimestamps = false,
  maxTurns = 10
}) => {
  const getAgentById = (agentId: string): AgentInstance | undefined => {
    return agents.find(agent => agent.id === agentId);
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

  const truncateContent = (content: string, maxLength: number = 120): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const recentTurns = turns.slice(-maxTurns);
  
  if (recentTurns.length === 0) {
    return (
      <Box>
        <Text color="gray" italic>
          No conversation turns yet...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {recentTurns.map((turn, index) => {
        const agent = getAgentById(turn.message.agentId);
        const agentColor = getAgentColor(turn.message.agentId);
        const isActive = turn.message.agentId === activeAgent;
        const isUser = turn.message.role === 'user';
        
        return (
          <Box key={turn.id} flexDirection="column" marginBottom={1}>
            {/* Agent/User Header */}
            <Box>
              {/* Connection Line (except for first turn) */}
              {index > 0 && (
                <Text color="gray">│ </Text>
              )}
              
              {/* Agent Indicator */}
              <Text color={isUser ? 'white' : agentColor} bold={isActive}>
                {isUser ? '👤 You' : `🤖 ${turn.message.agentId}`}
              </Text>
              
              {/* Domain Badge for Agents */}
              {!isUser && agent?.type && (
                <Text color="gray"> [{agent.type}]</Text>
              )}
              
              {/* Timestamp */}
              {showTimestamps && (
                <Text color="gray"> {formatTimestamp(turn.message.timestamp)}</Text>
              )}
              
              {/* Turn Number */}
              <Text color="gray"> #{turn.sequenceNumber}</Text>
            </Box>
            
            {/* Message Content */}
            <Box marginLeft={2}>
              <Text color={isUser ? 'white' : 'gray'}>
                {truncateContent(turn.message.content)}
              </Text>
            </Box>
            
            {/* Metadata (tools used, response time, etc.) */}
            {turn.metadata && (
              <Box marginLeft={2} flexDirection="column">
                {turn.metadata.toolsUsed && turn.metadata.toolsUsed.length > 0 && (
                  <Box>
                    <Text color="blue">🔧 Tools: </Text>
                    <Text color="gray">
                      {turn.metadata.toolsUsed.join(', ')}
                    </Text>
                  </Box>
                )}
                
                {turn.metadata.responseTime && (
                  <Box>
                    <Text color="yellow">⏱️  </Text>
                    <Text color="gray">
                      {Math.round(turn.metadata.responseTime)}ms
                    </Text>
                  </Box>
                )}
                
                {turn.metadata.patternPhase && (
                  <Box>
                    <Text color="magenta">📋 Phase: </Text>
                    <Text color="gray">
                      {turn.metadata.patternPhase}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
            
            {/* Connection Line (except for last turn) */}
            {index < recentTurns.length - 1 && (
              <Box marginLeft={1}>
                <Text color="gray">│</Text>
              </Box>
            )}
          </Box>
        );
      })}
      
      {/* Show indication if there are more turns */}
      {turns.length > maxTurns && (
        <Box marginTop={1}>
          <Text color="gray" italic>
            ... and {turns.length - maxTurns} more turns
          </Text>
        </Box>
      )}
    </Box>
  );
};