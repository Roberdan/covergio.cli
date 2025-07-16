/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { AgentInstance } from '../../../types/shared.js';
import { AgentSelector } from './AgentSelector.js';

interface AgentCommandExtensionsProps {
  agents: AgentInstance[];
  onAgentCommand: (agentId: string, command: string) => void;
  onDirectMessage: (agentId: string, message: string) => void;
  isVisible?: boolean;
  onClose: () => void;
}

interface CommandSuggestion {
  command: string;
  description: string;
  example: string;
}

/**
 * Command extensions for agent addressing and control
 */
export const AgentCommandExtensions: React.FC<AgentCommandExtensionsProps> = ({
  agents,
  onAgentCommand,
  onDirectMessage,
  isVisible = false,
  onClose
}) => {
  const [mode, setMode] = useState<'select' | 'command' | 'message'>('select');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [commandInput, setCommandInput] = useState('');
  const [messageInput, setMessageInput] = useState('');

  const commandSuggestions: CommandSuggestion[] = [
    {
      command: 'status',
      description: 'Check agent status and capabilities',
      example: '@agent status'
    },
    {
      command: 'pause',
      description: 'Pause agent execution',
      example: '@agent pause'
    },
    {
      command: 'resume',
      description: 'Resume agent execution',
      example: '@agent resume'
    },
    {
      command: 'reset',
      description: 'Reset agent state',
      example: '@agent reset'
    },
    {
      command: 'config',
      description: 'Show agent configuration',
      example: '@agent config'
    },
    {
      command: 'help',
      description: 'Show agent-specific help',
      example: '@agent help'
    }
  ];

  useInput((input, key) => {
    if (!isVisible) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (mode === 'select') {
      // Agent selection handled by AgentSelector
      return;
    }

    if (mode === 'command') {
      if (key.return) {
        if (commandInput.trim()) {
          onAgentCommand(selectedAgent, commandInput.trim());
          setCommandInput('');
          onClose();
        }
        return;
      }
      
      if (key.backspace) {
        setCommandInput(prev => prev.slice(0, -1));
        return;
      }
      
      if (input) {
        setCommandInput(prev => prev + input);
      }
    }

    if (mode === 'message') {
      if (key.return) {
        if (messageInput.trim()) {
          onDirectMessage(selectedAgent, messageInput.trim());
          setMessageInput('');
          onClose();
        }
        return;
      }
      
      if (key.backspace) {
        setMessageInput(prev => prev.slice(0, -1));
        return;
      }
      
      if (input) {
        setMessageInput(prev => prev + input);
      }
    }
  });

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgent(agentId);
    setMode('command');
  };

  const handleClose = () => {
    setMode('select');
    setSelectedAgent('');
    setCommandInput('');
    setMessageInput('');
    onClose();
  };

  const getSelectedAgentInfo = (): AgentInstance | undefined => {
    return agents.find(agent => agent.id === selectedAgent);
  };

  if (!isVisible) return null;

  return (
    <Box flexDirection="column">
      {mode === 'select' && (
        <AgentSelector
          agents={agents}
          onAgentSelect={handleAgentSelect}
          onClose={handleClose}
        />
      )}

      {mode === 'command' && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>
            Command Mode - {selectedAgent}
          </Text>
          
          {/* Agent Info */}
          {getSelectedAgentInfo() && (
            <Box marginTop={1}>
              <Text color="gray">
                Type: {getSelectedAgentInfo()?.type || 'general'}
              </Text>
              <Text color="gray">  Status: {getSelectedAgentInfo()?.status}</Text>
            </Box>
          )}

          {/* Command Input */}
          <Box marginTop={1}>
            <Text color="white">
              @{selectedAgent} {commandInput}
            </Text>
            <Text color="yellow">█</Text>
          </Box>

          {/* Command Suggestions */}
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray">Available Commands:</Text>
            {commandSuggestions.map((suggestion, index) => (
              <Box key={suggestion.command} marginLeft={2}>
                <Text color="cyan">
                  {suggestion.command}
                </Text>
                <Text color="gray">
                  - {suggestion.description}
                </Text>
              </Box>
            ))}
          </Box>

          {/* Controls */}
          <Box marginTop={1}>
            <Text color="gray">
              Type command • Enter Execute • Tab Message Mode • ESC Cancel
            </Text>
          </Box>
        </Box>
      )}

      {mode === 'message' && (
        <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
          <Text color="green" bold>
            Direct Message - {selectedAgent}
          </Text>
          
          {/* Message Input */}
          <Box marginTop={1}>
            <Text color="white">
              To @{selectedAgent}: {messageInput}
            </Text>
            <Text color="green">█</Text>
          </Box>

          {/* Controls */}
          <Box marginTop={1}>
            <Text color="gray">
              Type message • Enter Send • Tab Command Mode • ESC Cancel
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};