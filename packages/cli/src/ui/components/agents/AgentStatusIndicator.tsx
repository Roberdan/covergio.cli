/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { AgentInstance } from '../../../types/shared.ts';

interface AgentStatusIndicatorProps {
  agent: AgentInstance;
  isActive?: boolean;
  showDetails?: boolean;
}

/**
 * Visual indicator for agent status with color coding and badges
 */
export const AgentStatusIndicator: React.FC<AgentStatusIndicatorProps> = ({
  agent,
  isActive = false,
  showDetails = false
}) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'idle':
        return 'green';
      case 'busy':
        return 'yellow';
      case 'error':
        return 'red';
      case 'offline':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'idle':
        return '●';
      case 'busy':
        return '◐';
      case 'error':
        return '✗';
      case 'offline':
        return '○';
      default:
        return '○';
    }
  };

  const getExpertiseBadges = (): string[] => {
    if (!agent.capabilities) return [];
    return agent.capabilities.map(cap => cap.name).slice(0, 3); // Show max 3 badges
  };

  const getDomainBadge = (): string => {
    return agent.type || 'general';
  };

  return (
    <Box flexDirection="column" marginBottom={showDetails ? 1 : 0}>
      <Box>
        {/* Status Icon */}
        <Text color={getStatusColor(agent.status)}>
          {getStatusIcon(agent.status)}
        </Text>
        
        {/* Agent Name */}
        <Text 
          color={isActive ? 'cyan' : 'white'} 
          bold={isActive}
        >
          {' ' + agent.id}
        </Text>
        
        {/* Domain Badge */}
        <Text color="magenta">
          {' [' + getDomainBadge() + ']'}
        </Text>
        
        {/* Active Indicator */}
        {isActive && (
          <Text color="cyan"> ← speaking</Text>
        )}
      </Box>
      
      {/* Detailed Information */}
      {showDetails && (
        <Box flexDirection="column" marginLeft={2}>
          {/* Status Description */}
          <Box>
            <Text color="gray">
              Status: 
            </Text>
            <Text color={getStatusColor(agent.status)}> {agent.status}</Text>
          </Box>
          
          {/* Expertise Badges */}
          {getExpertiseBadges().length > 0 && (
            <Box>
              <Text color="gray">
                Skills: 
              </Text>
              {getExpertiseBadges().map((capability, index) => (
                <Text 
                  key={capability}
                  color="yellow" 
                >
                  {(index === 0 ? ' ' : ' ') + capability}
                </Text>
              ))}
            </Box>
          )}
          
          {/* Role Information */}
          {agent.type && (
            <Box>
              <Text color="gray">
                Type: 
              </Text>
              <Text color="blue"> {agent.type}</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};