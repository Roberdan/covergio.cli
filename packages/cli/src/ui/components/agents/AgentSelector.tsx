/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import { AgentInstance } from '../../../types/shared.js';
import { AgentStatusIndicator } from './AgentStatusIndicator.js';

interface AgentSelectorProps {
  agents: AgentInstance[];
  selectedAgent?: string;
  onAgentSelect: (agentId: string) => void;
  onClose: () => void;
  showAll?: boolean;
}

/**
 * Interactive agent selector for addressing specific agents
 */
export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  selectedAgent,
  onAgentSelect,
  onClose,
  showAll = false
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  // Filter agents based on showAll prop
  const visibleAgents = showAll 
    ? agents 
    : agents.filter(agent => agent.status !== 'offline');

  useEffect(() => {
    if (selectedAgent) {
      const index = visibleAgents.findIndex(agent => agent.id === selectedAgent);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    }
  }, [selectedAgent, visibleAgents]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(visibleAgents.length - 1, selectedIndex + 1));
      return;
    }

    if (key.return && visibleAgents[selectedIndex]) {
      onAgentSelect(visibleAgents[selectedIndex].id);
      onClose();
      return;
    }

    // Quick select by number
    const num = parseInt(input);
    if (!isNaN(num) && num >= 1 && num <= visibleAgents.length) {
      onAgentSelect(visibleAgents[num - 1].id);
      onClose();
      return;
    }

    // Quick select by first letter
    if (input && input.length === 1) {
      const agent = visibleAgents.find(a => 
        a.id.toLowerCase().startsWith(input.toLowerCase())
      );
      if (agent) {
        onAgentSelect(agent.id);
        onClose();
        return;
      }
    }
  });

  if (visibleAgents.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
        <Text color="yellow">No active agents available</Text>
        <Text color="gray">Press ESC to close</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text color="cyan" bold>
        Select Agent to Address:
      </Text>
      
      <Box flexDirection="column" marginTop={1}>
        {visibleAgents.map((agent, index) => (
          <Box key={agent.id} marginBottom={0}>
            <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
              {index + 1}.{' '}
            </Text>
            <Box>
              <AgentStatusIndicator 
                agent={agent} 
                isActive={agent.id === selectedAgent}
              />
            </Box>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">
          ↑/↓ Navigate • Enter Select • 1-{visibleAgents.length} Quick select
        </Text>
        <Text color="gray">
          Type first letter • ESC Cancel
        </Text>
      </Box>
    </Box>
  );
};