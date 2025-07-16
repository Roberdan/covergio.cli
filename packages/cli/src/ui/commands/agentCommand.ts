/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';
import { AgentInstance } from '../../types/shared.js';

/**
 * Agent management commands for multi-agent orchestration
 */
export const agentCommand: SlashCommand = {
  name: 'agents',
  altName: 'agent',
  description: 'Multi-agent system management and orchestration',
  subCommands: [
    {
      name: 'list',
      altName: 'ls',
      description: 'List all available agents with their status',
      action: async (context) => {
        // Get orchestrator instance or agent registry
        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized. Please start the agent system first.'
          };
        }

        const agents = await orchestrator.getAgents();
        
        if (agents.length === 0) {
          return {
            type: 'message',
            messageType: 'info',
            content: 'No agents currently available. Use /agents create to add agents.'
          };
        }

        // Format agent list for display
        const agentList = agents.map((agent: any) => {
          const statusIcon = getStatusIcon(agent.status);
          const capabilities = agent.capabilities.map((cap: any) => cap.name).join(', ');
          return `${statusIcon} ${agent.id} [${agent.type}] - ${capabilities}`;
        }).join('\n');

        return {
          type: 'message',
          messageType: 'info',
          content: `Active Agents (${agents.length}):\n${agentList}\n\nUse /agents status <agent-id> for detailed information.`
        };
      }
    },
    {
      name: 'status',
      description: 'Show detailed status of a specific agent or all agents',
      action: async (context, args) => {
        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        const agentId = args.trim();
        
        if (!agentId) {
          // Show summary of all agents
          const agents = await orchestrator.getAgents();
          const statusSummary = agents.map((agent: any) => {
            const statusColor = getStatusColor(agent.status);
            const responseTime = agent.performance.averageResponseTime;
            const successRate = (agent.performance.successRate * 100).toFixed(1);
            
            return `${agent.id}:
  Status: ${statusColor}${agent.status}${statusColor}
  Type: ${agent.type}
  Success Rate: ${successRate}%
  Avg Response: ${responseTime}ms
  Tasks Completed: ${agent.performance.tasksCompleted}
  Capabilities: ${agent.capabilities.map((cap: any) => cap.name).join(', ')}`;
          }).join('\n\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Agent Status Summary:\n\n${statusSummary}`
          };
        }

        // Show specific agent status
        const agent = await orchestrator.getAgent(agentId);
        if (!agent) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Agent '${agentId}' not found. Use /agents list to see available agents.`
          };
        }

        const statusColor = getStatusColor(agent.status);
        const capabilities = agent.capabilities.map((cap: any) => 
          `  - ${cap.name} (v${cap.version}): ${cap.description || 'No description'}`
        ).join('\n');

        return {
          type: 'message',
          messageType: 'info',
          content: `Agent: ${agent.id}
Status: ${statusColor}${agent.status}${statusColor}
Type: ${agent.type}
Performance:
  Success Rate: ${(agent.performance.successRate * 100).toFixed(1)}%
  Average Response Time: ${agent.performance.averageResponseTime}ms
  Tasks Completed: ${agent.performance.tasksCompleted}
  
Capabilities:
${capabilities}

Configuration:
${JSON.stringify(agent.configuration, null, 2)}`
        };
      }
    },
    {
      name: 'start',
      description: 'Start or activate a specific agent',
      action: async (context, args) => {
        const agentId = args.trim();
        if (!agentId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agents start <agent-id>'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          await orchestrator.startAgent(agentId);
          return {
            type: 'message',
            messageType: 'success',
            content: `Agent '${agentId}' started successfully.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to start agent '${agentId}': ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'stop',
      description: 'Stop or deactivate a specific agent',
      action: async (context, args) => {
        const agentId = args.trim();
        if (!agentId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agents stop <agent-id>'
          };
        }

        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          await orchestrator.stopAgent(agentId);
          return {
            type: 'message',
            messageType: 'success',
            content: `Agent '${agentId}' stopped successfully.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to stop agent '${agentId}': ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'create',
      description: 'Create a new agent with specified capabilities',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        if (parts.length < 2) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agents create <agent-id> <type> [capabilities...]'
          };
        }

        const [agentId, agentType, ...capabilities] = parts;
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const agentConfig = {
            id: agentId,
            type: agentType,
            capabilities: capabilities.map(cap => ({
              name: cap,
              version: '1.0.0',
              description: `${cap} capability`
            })),
            status: 'idle' as const,
            configuration: {
              model: 'default',
              temperature: 0.7
            },
            performance: {
              successRate: 0,
              averageResponseTime: 0,
              tasksCompleted: 0
            }
          };

          await orchestrator.createAgent(agentConfig);
          return {
            type: 'message',
            messageType: 'success',
            content: `Agent '${agentId}' created successfully with type '${agentType}' and capabilities: ${capabilities.join(', ')}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to create agent '${agentId}': ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'collaborate',
      description: 'Start multi-agent collaboration with specified patterns',
      subCommands: [
        {
          name: 'sequential',
          description: 'Sequential collaboration pattern - agents work one after another',
          action: async (context, args) => {
            const agentIds = args.trim().split(' ').filter(id => id.length > 0);
            if (agentIds.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /agents collaborate sequential <agent1> <agent2> [agent3...]'
              };
            }

            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator not initialized.'
              };
            }

            try {
              await orchestrator.startCollaboration({
                pattern: 'sequential',
                agents: agentIds,
                maxRounds: 10
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Sequential collaboration started with agents: ${agentIds.join(' → ')}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to start sequential collaboration: ${(error as Error).message}`
              };
            }
          }
        },
        {
          name: 'parallel',
          description: 'Parallel collaboration pattern - agents work simultaneously',
          action: async (context, args) => {
            const agentIds = args.trim().split(' ').filter(id => id.length > 0);
            if (agentIds.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /agents collaborate parallel <agent1> <agent2> [agent3...]'
              };
            }

            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator not initialized.'
              };
            }

            try {
              await orchestrator.startCollaboration({
                pattern: 'parallel',
                agents: agentIds,
                maxRounds: 5
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Parallel collaboration started with agents: ${agentIds.join(' ∥ ')}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to start parallel collaboration: ${(error as Error).message}`
              };
            }
          }
        },
        {
          name: 'debate',
          description: 'Debate collaboration pattern - agents discuss and reach consensus',
          action: async (context, args) => {
            const agentIds = args.trim().split(' ').filter(id => id.length > 0);
            if (agentIds.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /agents collaborate debate <agent1> <agent2> [agent3...]'
              };
            }

            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator not initialized.'
              };
            }

            try {
              await orchestrator.startCollaboration({
                pattern: 'debate',
                agents: agentIds,
                maxRounds: 8,
                terminationCondition: 'consensus'
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Debate collaboration started with agents: ${agentIds.join(' ⚔️ ')}`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to start debate collaboration: ${(error as Error).message}`
              };
            }
          }
        },
        {
          name: 'stop',
          description: 'Stop current collaboration session',
          action: async (context) => {
            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator not initialized.'
              };
            }

            try {
              await orchestrator.stopCollaboration();
              return {
                type: 'message',
                messageType: 'success',
                content: 'Collaboration session stopped successfully.'
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to stop collaboration: ${(error as Error).message}`
              };
            }
          }
        }
      ]
    },
    {
      name: 'assign',
      description: 'Assign a task to a specific agent',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        if (parts.length < 2) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /agents assign <agent-id> <task-description>'
          };
        }

        const [agentId, ...taskParts] = parts;
        const taskDescription = taskParts.join(' ');
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          await orchestrator.assignTask(agentId, {
            description: taskDescription,
            priority: 'medium',
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Task assigned to agent '${agentId}': ${taskDescription}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to assign task to agent '${agentId}': ${(error as Error).message}`
          };
        }
      }
    }
  ]
};

/**
 * Get status icon for agent status
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'idle':
      return '🟢';
    case 'busy':
      return '🟡';
    case 'error':
      return '🔴';
    case 'offline':
      return '⚫';
    default:
      return '⚪';
  }
}

/**
 * Get status color for terminal display
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'idle':
      return '\x1b[32m'; // Green
    case 'busy':
      return '\x1b[33m'; // Yellow
    case 'error':
      return '\x1b[31m'; // Red
    case 'offline':
      return '\x1b[90m'; // Gray
    default:
      return '\x1b[0m'; // Reset
  }
}