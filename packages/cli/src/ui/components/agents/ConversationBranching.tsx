/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { ConversationTurn, AgentInstance, CollaborationPattern, ConversationBranch } from '../../../types/shared.ts';

interface ConversationBranchingProps {
  branches: ConversationBranch[];
  agents: AgentInstance[];
  activeBranch?: string;
  pattern?: CollaborationPattern;
  onBranchSelect?: (branchId: string) => void;
  showMergePoints?: boolean;
}

/**
 * Conversation branching visualization for parallel agent work
 */
export const ConversationBranching: React.FC<ConversationBranchingProps> = ({
  branches,
  agents,
  activeBranch,
  pattern,
  onBranchSelect,
  showMergePoints = true
}) => {
  const getAgentColor = (agentId: string): string => {
    const colors = ['cyan', 'yellow', 'green', 'magenta', 'blue', 'red'];
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getBranchStatusIcon = (status: string): string => {
    switch (status) {
      case 'active':
        return '●';
      case 'completed':
        return '✓';
      case 'merged':
        return '⚡';
      case 'abandoned':
        return '✗';
      default:
        return '○';
    }
  };

  const getBranchStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'green';
      case 'completed':
        return 'blue';
      case 'merged':
        return 'yellow';
      case 'abandoned':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getPatternVisualization = (pattern?: CollaborationPattern): string => {
    switch (pattern) {
      case CollaborationPattern.PARALLEL:
        return '⟷';
      case CollaborationPattern.SEQUENTIAL:
        return '→';
      case CollaborationPattern.DEBATE:
        return '⚔️';
      case CollaborationPattern.BRAINSTORM:
        return '💭';
      default:
        return '◊';
    }
  };

  const renderBranchConnection = (branch: ConversationBranch, index: number): React.ReactNode => {
    const isActive = branch.id === activeBranch;
    const agentColor = getAgentColor(branch.agentId);
    
    return (
      <Box key={`connection-${branch.id}`} marginLeft={2}>
        <Text color="gray">
          {index === 0 ? '┌─' : '├─'}
        </Text>
        <Text color={agentColor}>
          {getPatternVisualization(pattern)}
        </Text>
        <Text color="gray">
          ─ 
        </Text>
        <Text color={isActive ? 'cyan' : agentColor} bold={isActive}>
          {branch.agentId}
        </Text>
        <Text color={getBranchStatusColor(branch.status)}> {getBranchStatusIcon(branch.status)}</Text>
        {branch.turns.length > 0 && (
          <Text color="gray"> ({branch.turns.length} turns)</Text>
        )}
      </Box>
    );
  };

  const renderBranchDetails = (branch: ConversationBranch): React.ReactNode => {
    const isActive = branch.id === activeBranch;
    if (!isActive) return null;

    const recentTurns = branch.turns.slice(-3);
    
    return (
      <Box key={`details-${branch.id}`} flexDirection="column" marginLeft={4} marginTop={1}>
        {recentTurns.map((turn, index) => (
          <Box key={turn.id} marginBottom={1}>
            <Text color="gray">
              {index === 0 ? '┌─' : '├─'}
            </Text>
            <Text color="gray">
              #{turn.sequenceNumber}
            </Text>
            <Text color="white"> {turn.message.content.substring(0, 60)}
              {turn.message.content.length > 60 ? '...' : ''}
            </Text>
            {turn.metadata?.responseTime && (
              <Text color="yellow"> ({Math.round(turn.metadata.responseTime)}ms)</Text>
            )}
          </Box>
        ))}
        {branch.turns.length > 3 && (
          <Box>
            <Text color="gray">
              └─ ... and {branch.turns.length - 3} more turns
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  const renderMergePoint = (branch: ConversationBranch): React.ReactNode => {
    if (!showMergePoints || branch.status !== 'merged') return null;

    return (
      <Box key={`merge-${branch.id}`} marginLeft={2} marginTop={1}>
        <Text color="yellow">
          ⚡ Merged into main conversation
        </Text>
        <Text color="gray"> (contributed {branch.turns.length} turns)</Text>
      </Box>
    );
  };

  const activeBranches = branches.filter(b => b.status === 'active');
  const completedBranches = branches.filter(b => b.status === 'completed');
  const mergedBranches = branches.filter(b => b.status === 'merged');

  if (branches.length === 0) {
    return (
      <Box>
        <Text color="gray" italic>
          No conversation branches yet...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🌳 Conversation Branches
        </Text>
        {pattern && (
          <Text color="gray">  ({pattern} pattern)</Text>
        )}
      </Box>

      {/* Active Branches */}
      {activeBranches.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green">
            Active ({activeBranches.length}):
          </Text>
          {activeBranches.map((branch, index) => (
            <Box key={branch.id} flexDirection="column">
              {renderBranchConnection(branch, index)}
              {renderBranchDetails(branch)}
            </Box>
          ))}
        </Box>
      )}

      {/* Completed Branches */}
      {completedBranches.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="blue">
            Completed ({completedBranches.length}):
          </Text>
          {completedBranches.map((branch, index) => (
            <Box key={branch.id} flexDirection="column">
              {renderBranchConnection(branch, index)}
            </Box>
          ))}
        </Box>
      )}

      {/* Merged Branches */}
      {mergedBranches.length > 0 && (
        <Box flexDirection="column">
          <Text color="yellow">
            Merged ({mergedBranches.length}):
          </Text>
          {mergedBranches.map((branch) => (
            <Box key={branch.id} flexDirection="column">
              {renderBranchConnection(branch, 0)}
              {renderMergePoint(branch)}
            </Box>
          ))}
        </Box>
      )}

      {/* Controls */}
      <Box marginTop={1}>
        <Text color="gray">
          Use Tab to switch between branches • Enter to select
        </Text>
      </Box>
    </Box>
  );
};