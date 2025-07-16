/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { ConversationTurn, AgentInstance, CollaborationPattern } from '../../../types/shared.ts';
import { AgentStatusIndicator } from './AgentStatusIndicator.js';
import { ConversationThread } from './ConversationThread.js';

interface AgentConversationProps {
  agents: AgentInstance[];
  conversation: ConversationTurn[];
  pattern?: CollaborationPattern;
  activeAgent?: string;
  sessionId?: string;
  showAgentPanel?: boolean;
  showProgress?: boolean;
}

/**
 * Main component for displaying multi-agent conversations with real-time updates
 */
export const AgentConversation: React.FC<AgentConversationProps> = ({
  agents,
  conversation,
  pattern,
  activeAgent,
  sessionId,
  showAgentPanel = true,
  showProgress = true
}) => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const getPatternDisplay = (pattern?: CollaborationPattern): { name: string; color: string; icon: string } => {
    switch (pattern) {
      case CollaborationPattern.SEQUENTIAL:
        return { name: 'Sequential', color: 'blue', icon: '→' };
      case CollaborationPattern.PARALLEL:
        return { name: 'Parallel', color: 'green', icon: '⥁' };
      case CollaborationPattern.DEBATE:
        return { name: 'Debate', color: 'red', icon: '⚔️' };
      case CollaborationPattern.CONSULTATION:
        return { name: 'Consultation', color: 'yellow', icon: '💭' };
      case CollaborationPattern.BRAINSTORM:
        return { name: 'Brainstorm', color: 'magenta', icon: '💡' };
      case CollaborationPattern.HIERARCHICAL:
        return { name: 'Hierarchical', color: 'cyan', icon: '🏗️' };
      default:
        return { name: 'General', color: 'white', icon: '💬' };
    }
  };

  const getConversationStats = () => {
    const totalTurns = conversation.length;
    const agentTurns = conversation.filter(turn => turn.message.role !== 'user').length;
    const userTurns = totalTurns - agentTurns;
    const averageResponseTime = agentTurns > 0 
      ? conversation
          .filter(turn => turn.metadata.responseTime)
          .reduce((sum, turn) => sum + (turn.metadata.responseTime || 0), 0) / agentTurns
      : 0;

    return { totalTurns, agentTurns, userTurns, averageResponseTime };
  };

  const getActiveAgents = () => {
    return agents.filter(agent => 
      agent.status === 'busy' || 
      agent.status === 'idle'
    );
  };

  const patternInfo = getPatternDisplay(pattern);
  const stats = getConversationStats();
  const activeAgents = getActiveAgents();

  return (
    <Box flexDirection="row" height="100%">
      {/* Agent Panel */}
      {showAgentPanel && (
        <Box 
          flexDirection="column" 
          width="30%" 
          borderStyle="round" 
          borderColor="gray"
          marginRight={1}
          padding={1}
        >
          {/* Header */}
          <Box flexDirection="column" marginBottom={1}>
            <Text color="cyan" bold>
              🤖 Active Agents ({agents.length})
            </Text>
            
            {/* Pattern Information */}
            {pattern && (
              <Box marginTop={1}>
                <Text color={patternInfo.color}>
                  {patternInfo.icon} {patternInfo.name}
                </Text>
                {sessionId && (
                  <Text color="gray"> ({sessionId})</Text>
                )}
              </Box>
            )}
          </Box>

          {/* Agent List */}
          <Box flexDirection="column" flexGrow={1}>
            {agents.map((agent) => (
              <Box 
                key={agent.id} 
                flexDirection="column"
                marginBottom={1}
              >
                <AgentStatusIndicator
                  agent={agent}
                  isActive={agent.id === activeAgent}
                  showDetails={expandedAgent === agent.id}
                />
              </Box>
            ))}
          </Box>

          {/* Progress/Stats */}
          {showProgress && (
            <Box flexDirection="column" marginTop={1} borderTop borderColor="gray">
              <Text color="gray" bold>
                📊 Session Stats
              </Text>
              
              <Box flexDirection="column">
                <Text color="gray">
                  Turns: {stats.totalTurns} ({stats.userTurns} user, {stats.agentTurns} agent)
                </Text>
                
                {stats.averageResponseTime > 0 && (
                  <Text color="gray">
                    Avg Response: {Math.round(stats.averageResponseTime)}ms
                  </Text>
                )}
                
                <Text color="gray">
                  Active: {activeAgents.length}/{agents.length}
                </Text>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Conversation Panel */}
      <Box 
        flexDirection="column" 
        flexGrow={1} 
        borderStyle="round" 
        borderColor="cyan"
        padding={1}
      >
        {/* Conversation Header */}
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            💬 Conversation Thread
          </Text>
          
          {activeAgent && (
            <Text color="yellow">  🎯 Addressing: {activeAgent}</Text>
          )}
        </Box>

        {/* Conversation Thread */}
        <Box flexGrow={1} flexDirection="column">
          <ConversationThread
            turns={conversation}
            agents={agents}
            activeAgent={activeAgent}
            showTimestamps={true}
            maxTurns={20}
          />
        </Box>

        {/* Status Bar */}
        {activeAgents.length > 0 && (
          <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
            <Text color="yellow">
              {activeAgents.length === 1 
                ? `${activeAgents[0].id} is thinking...`
                : `${activeAgents.length} agents are active`
              }
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};