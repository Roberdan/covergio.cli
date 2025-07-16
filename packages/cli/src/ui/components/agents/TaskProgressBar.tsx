/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';

import { TaskDependency } from '../../../types/shared.js';

interface TaskProgressBarProps {
  taskId: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  progress: number; // 0-100
  dependencies?: TaskDependency[];
  assignedAgent?: string;
  estimatedTime?: string;
  showDependencies?: boolean;
}

/**
 * Task progress bar with dependency visualization
 */
export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({
  taskId,
  title,
  status,
  progress,
  dependencies = [],
  assignedAgent,
  estimatedTime,
  showDependencies = true
}) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'in-progress':
        return 'yellow';
      case 'blocked':
        return 'red';
      case 'pending':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in-progress':
        return '⚡';
      case 'blocked':
        return '🚫';
      case 'pending':
        return '○';
      default:
        return '○';
    }
  };

  const renderProgressBar = (progress: number): string => {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    return `[${bar}]`;
  };

  const getDependencyChain = (): string => {
    if (!dependencies.length) return '';
    
    return dependencies
      .map(dep => `${getStatusIcon(dep.status)} ${dep.id}`)
      .join(' → ');
  };

  const getBlockedDependencies = (): TaskDependency[] => {
    return dependencies.filter(dep => dep.status === 'pending' || dep.status === 'blocked');
  };

  const blockedDeps = getBlockedDependencies();

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Main Task Row */}
      <Box>
        {/* Status Icon */}
        <Text color={getStatusColor(status)}>
          {getStatusIcon(status)}
        </Text>
        
        {/* Task ID */}
        <Text color="cyan"> {taskId}</Text>
        
        {/* Task Title */}
        <Text color="white"> {title}</Text>
        
        {/* Assigned Agent */}
        {assignedAgent && (
          <Text color="magenta"> [@{assignedAgent}]</Text>
        )}
      </Box>

      {/* Progress Bar Row */}
      <Box marginLeft={4}>
        <Text color={getStatusColor(status)}>
          {renderProgressBar(progress)}
        </Text>
        
        <Text color="gray"> {progress}%</Text>
        
        {/* Estimated Time */}
        {estimatedTime && (
          <Text color="gray">  ~{estimatedTime}</Text>
        )}
        
        {/* Status Text */}
        <Text color={getStatusColor(status)}>  {status.toUpperCase()}</Text>
      </Box>

      {/* Dependencies */}
      {showDependencies && dependencies.length > 0 && (
        <Box flexDirection="column" marginLeft={4}>
          <Text color="gray">
            Dependencies: {getDependencyChain()}
          </Text>
          
          {/* Blocked Dependencies Warning */}
          {blockedDeps.length > 0 && (
            <Box marginTop={1}>
              <Text color="red">
                ⚠️  Blocked by: {blockedDeps.map(dep => dep.id).join(', ')}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};