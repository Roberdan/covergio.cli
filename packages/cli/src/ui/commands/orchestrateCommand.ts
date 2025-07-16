/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';

/**
 * Orchestration command for manual agent selection and workflow management
 */
export const orchestrateCommand: SlashCommand = {
  name: 'orchestrate',
  altName: 'orch',
  description: 'Manual agent selection and workflow orchestration',
  subCommands: [
    {
      name: 'team',
      description: 'Create a custom team of agents with specific domains and roles',
      action: async (context, args) => {
        const parsedArgs = parseOrchestrateArgs(args);
        
        if (!parsedArgs.domains && !parsedArgs.roles && !parsedArgs.agents) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Usage: /orchestrate team [domain:name] [role:name] [agent:id]
            
Examples:
  /orchestrate team domain:coding domain:testing role:senior-dev
  /orchestrate team agent:gpt-4 agent:claude-3 role:reviewer
  /orchestrate team domain:analysis role:data-scientist agent:specialist-1`
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
          const team = await orchestrator.createCustomTeam({
            domains: parsedArgs.domains,
            roles: parsedArgs.roles,
            agents: parsedArgs.agents,
            maxSize: parsedArgs.maxSize || 5,
            collaborationPattern: parsedArgs.pattern || 'sequential'
          });

          const teamMembers = team.members.map((member: any) => 
            `🤖 ${member.id} [${member.type}] - ${member.capabilities.map((c: any) => c.name).join(', ')}`
          ).join('\n');

          return {
            type: 'message',
            messageType: 'success',
            content: `Custom team created successfully:

Team ID: ${team.id}
Pattern: ${team.collaborationPattern}
Members (${team.members.length}):
${teamMembers}

Team is ready for tasks. Use /orchestrate execute to start workflow.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to create team: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'execute',
      description: 'Execute a workflow with the current team',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        if (parts.length < 1 || !parts[0]) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /orchestrate execute <task-description> [options]\n\nOptions:\n  --pattern sequential|parallel|debate\n  --timeout 30000\n  --priority high|medium|low'
          };
        }

        const taskDescription = parts.join(' ');
        const options = parseExecutionOptions(taskDescription);
        
        const orchestrator = context.services.orchestrator;
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const execution = await orchestrator.executeWorkflow({
            description: options.description,
            pattern: options.pattern || 'sequential',
            timeout: options.timeout || 30000,
            priority: options.priority || 'medium',
            maxRetries: 3
          });

          return {
            type: 'message',
            messageType: 'success',
            content: `Workflow execution started:

Execution ID: ${execution.id}
Pattern: ${execution.pattern}
Status: ${execution.status}
Estimated Duration: ${execution.estimatedDuration}ms

Use /orchestrate status ${execution.id} to monitor progress.`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to execute workflow: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'status',
      description: 'Check the status of current orchestration or specific execution',
      action: async (context, args) => {
        const executionId = args.trim();
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          if (executionId) {
            // Show specific execution status
            const execution = await orchestrator.getExecution(executionId);
            if (!execution) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Execution '${executionId}' not found.`
              };
            }

            const progress = Math.round((execution.completedSteps / execution.totalSteps) * 100);
            const duration = execution.endTime ? 
              execution.endTime.getTime() - execution.startTime.getTime() :
              Date.now() - execution.startTime.getTime();

            const stepsList = execution.steps.map((step: any) => {
              const statusIcon = getStepStatusIcon(step.status);
              const duration = step.duration ? ` (${step.duration}ms)` : '';
              return `  ${statusIcon} ${step.name}${duration}`;
            }).join('\n');

            return {
              type: 'message',
              messageType: 'info',
              content: `Execution Status: ${execution.id}

Status: ${execution.status}
Progress: ${progress}% (${execution.completedSteps}/${execution.totalSteps} steps)
Duration: ${Math.round(duration / 1000)}s
Pattern: ${execution.pattern}
Priority: ${execution.priority}

Steps:
${stepsList}

${execution.error ? `Error: ${execution.error}` : ''}
${execution.result ? `Result: ${execution.result}` : ''}`
            };
          } else {
            // Show general orchestration status
            const status = await orchestrator.getStatus();
            
            const activeExecutions = status.activeExecutions.map((exec: any) => 
              `  🔄 ${exec.id} - ${exec.status} (${Math.round((exec.completedSteps / exec.totalSteps) * 100)}%)`
            ).join('\n') || '  No active executions';

            const recentExecutions = status.recentExecutions.map((exec: any) => 
              `  ${exec.status === 'completed' ? '✅' : '❌'} ${exec.id} - ${exec.status} (${Math.round((exec.endTime.getTime() - exec.startTime.getTime()) / 1000)}s)`
            ).join('\n') || '  No recent executions';

            return {
              type: 'message',
              messageType: 'info',
              content: `Orchestration Status:

Active Team: ${status.activeTeam ? status.activeTeam.id : 'None'}
Active Agents: ${status.activeAgents}/${status.totalAgents}
Queue Length: ${status.queueLength}

Active Executions:
${activeExecutions}

Recent Executions:
${recentExecutions}

Performance:
  Success Rate: ${(status.successRate * 100).toFixed(1)}%
  Average Execution Time: ${status.averageExecutionTime}ms
  Total Executions: ${status.totalExecutions}`
            };
          }
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get orchestration status: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'stop',
      description: 'Stop current orchestration or specific execution',
      action: async (context, args) => {
        const executionId = args.trim();
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          if (executionId) {
            await orchestrator.stopExecution(executionId);
            return {
              type: 'message',
              messageType: 'success',
              content: `Execution '${executionId}' stopped successfully.`
            };
          } else {
            await orchestrator.stopAllExecutions();
            return {
              type: 'message',
              messageType: 'success',
              content: 'All orchestration activities stopped successfully.'
            };
          }
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to stop orchestration: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'history',
      description: 'Show orchestration execution history',
      action: async (context, args) => {
        const limit = parseInt(args.trim()) || 10;
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const history = await orchestrator.getExecutionHistory(limit);
          
          if (history.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No execution history available.'
            };
          }

          const historyList = history.map((exec: any) => {
            const statusIcon = exec.status === 'completed' ? '✅' : 
                              exec.status === 'failed' ? '❌' : 
                              exec.status === 'cancelled' ? '🚫' : '⏸️';
            
            const duration = exec.endTime ? 
              Math.round((exec.endTime.getTime() - exec.startTime.getTime()) / 1000) :
              'N/A';

            return `${statusIcon} ${exec.id} - ${exec.status}
  Started: ${exec.startTime.toLocaleString()}
  Duration: ${duration}s
  Pattern: ${exec.pattern}
  Steps: ${exec.completedSteps}/${exec.totalSteps}
  Description: ${exec.description.substring(0, 100)}${exec.description.length > 100 ? '...' : ''}`;
          }).join('\n\n');

          return {
            type: 'message',
            messageType: 'info',
            content: `Execution History (${history.length} most recent):\n\n${historyList}`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to get execution history: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'optimize',
      description: 'Optimize agent selection and workflow patterns',
      action: async (context, args) => {
        const options = parseOptimizeOptions(args);
        const orchestrator = context.services.orchestrator;
        
        if (!orchestrator) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Orchestrator not initialized.'
          };
        }

        try {
          const optimization = await orchestrator.optimizeWorkflow({
            objective: options.objective || 'speed',
            constraints: options.constraints || {},
            historical: options.historical !== false,
            maxIterations: options.maxIterations || 10
          });

          const recommendations = optimization.recommendations.map((rec: any) => 
            `  💡 ${rec.type}: ${rec.description}
     Impact: ${rec.impact}
     Confidence: ${(rec.confidence * 100).toFixed(1)}%`
          ).join('\n');

          return {
            type: 'message',
            messageType: 'success',
            content: `Workflow Optimization Results:

Objective: ${optimization.objective}
Current Score: ${optimization.currentScore.toFixed(2)}
Optimized Score: ${optimization.optimizedScore.toFixed(2)}
Improvement: ${((optimization.optimizedScore - optimization.currentScore) / optimization.currentScore * 100).toFixed(1)}%

Recommendations:
${recommendations}

Apply recommendations with /orchestrate apply-optimization`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to optimize workflow: ${(error as Error).message}`
          };
        }
      }
    },
    {
      name: 'templates',
      description: 'Manage orchestration templates for common patterns',
      subCommands: [
        {
          name: 'list',
          description: 'List available orchestration templates',
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
              const templates = await orchestrator.getTemplates();
              
              if (templates.length === 0) {
                return {
                  type: 'message',
                  messageType: 'info',
                  content: 'No orchestration templates available.'
                };
              }

              const templateList = templates.map((template: any) => 
                `📋 ${template.name} (${template.category})
  Description: ${template.description}
  Pattern: ${template.pattern}
  Required Domains: ${template.requiredDomains.join(', ')}
  Estimated Duration: ${template.estimatedDuration}ms
  Success Rate: ${(template.successRate * 100).toFixed(1)}%`
              ).join('\n\n');

              return {
                type: 'message',
                messageType: 'info',
                content: `Available Orchestration Templates:\n\n${templateList}\n\nUse /orchestrate templates use <template-name> to apply a template.`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to list templates: ${(error as Error).message}`
              };
            }
          }
        },
        {
          name: 'use',
          description: 'Use a specific orchestration template',
          action: async (context, args) => {
            const templateName = args.trim();
            if (!templateName) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /orchestrate templates use <template-name>'
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
              const result = await orchestrator.useTemplate(templateName);
              
              const teamMembers = result.team.members.map((member: any) => 
                `🤖 ${member.id} [${member.type}]`
              ).join('\n');

              return {
                type: 'message',
                messageType: 'success',
                content: `Template '${templateName}' applied successfully:

Team Created: ${result.team.id}
Pattern: ${result.team.collaborationPattern}
Members:
${teamMembers}

Next Steps:
1. Use /orchestrate execute to start workflow
2. Monitor progress with /orchestrate status`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to use template '${templateName}': ${(error as Error).message}`
              };
            }
          }
        },
        {
          name: 'save',
          description: 'Save current orchestration as a template',
          action: async (context, args) => {
            const parts = args.trim().split(' ');
            if (parts.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /orchestrate templates save <template-name> <description>'
              };
            }

            const [templateName, ...descriptionParts] = parts;
            const description = descriptionParts.join(' ');
            
            const orchestrator = context.services.orchestrator;
            if (!orchestrator) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Orchestrator not initialized.'
              };
            }

            try {
              await orchestrator.saveTemplate({
                name: templateName,
                description,
                category: 'custom',
                pattern: 'sequential' // This would be detected from current setup
              });

              return {
                type: 'message',
                messageType: 'success',
                content: `Template '${templateName}' saved successfully.\n\nUse /orchestrate templates list to see all available templates.`
              };
            } catch (error) {
              return {
                type: 'message',
                messageType: 'error',
                content: `Failed to save template: ${(error as Error).message}`
              };
            }
          }
        }
      ]
    }
  ]
};

/**
 * Parse orchestrate command arguments
 */
function parseOrchestrateArgs(args: string): {
  domains?: string[];
  roles?: string[];
  agents?: string[];
  maxSize?: number;
  pattern?: string;
} {
  const domains: string[] = [];
  const roles: string[] = [];
  const agents: string[] = [];
  let maxSize: number | undefined;
  let pattern: string | undefined;

  const parts = args.split(' ');
  
  for (const part of parts) {
    if (part.startsWith('domain:')) {
      domains.push(part.substring(7));
    } else if (part.startsWith('role:')) {
      roles.push(part.substring(5));
    } else if (part.startsWith('agent:')) {
      agents.push(part.substring(6));
    } else if (part.startsWith('max:')) {
      maxSize = parseInt(part.substring(4));
    } else if (part.startsWith('pattern:')) {
      pattern = part.substring(8);
    }
  }

  return {
    domains: domains.length > 0 ? domains : undefined,
    roles: roles.length > 0 ? roles : undefined,
    agents: agents.length > 0 ? agents : undefined,
    maxSize,
    pattern
  };
}

/**
 * Parse execution options from command string
 */
function parseExecutionOptions(input: string): {
  description: string;
  pattern?: string;
  timeout?: number;
  priority?: string;
} {
  const parts = input.split(' ');
  const options: any = {};
  const descriptionParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('--pattern=')) {
      options.pattern = part.substring(10);
    } else if (part.startsWith('--timeout=')) {
      options.timeout = parseInt(part.substring(10));
    } else if (part.startsWith('--priority=')) {
      options.priority = part.substring(11);
    } else {
      descriptionParts.push(part);
    }
  }

  return {
    description: descriptionParts.join(' '),
    ...options
  };
}

/**
 * Parse optimize options
 */
function parseOptimizeOptions(args: string): {
  objective?: string;
  constraints?: Record<string, any>;
  historical?: boolean;
  maxIterations?: number;
} {
  const options: any = {};
  const parts = args.split(' ');

  for (const part of parts) {
    if (part.startsWith('--objective=')) {
      options.objective = part.substring(12);
    } else if (part.startsWith('--max-iterations=')) {
      options.maxIterations = parseInt(part.substring(17));
    } else if (part === '--no-historical') {
      options.historical = false;
    }
  }

  return options;
}

/**
 * Get step status icon
 */
function getStepStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    case 'running':
      return '🔄';
    case 'pending':
      return '⏳';
    case 'skipped':
      return '⏭️';
    default:
      return '❓';
  }
}