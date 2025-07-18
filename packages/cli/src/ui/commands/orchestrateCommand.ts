/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';
import { WorkflowCoordinator, WorkflowDefinition, WorkflowExecution } from '@google/gemini-cli-core/universal/workflow/WorkflowCoordinator';
import { AgentFactory } from '@google/gemini-cli-core/universal/agent/AgentFactory';
import { DomainRegistry } from '@google/gemini-cli-core/universal/domain/DomainRegistry';
import { ContextEngine } from '@google/gemini-cli-core/universal/context/ContextEngine';
import { AnalysisEngine } from '@google/gemini-cli-core/universal/analysis/AnalysisEngine';
import { TaskMaster } from '@google/gemini-cli-core/universal/agents/TaskMaster';
import { v4 as uuidv4 } from 'uuid';

// Cache for workflow coordinator instance
let workflowCoordinator: WorkflowCoordinator | null = null;

/**
 * Get or create a WorkflowCoordinator instance
 */
async function getWorkflowCoordinator(): Promise<WorkflowCoordinator> {
  if (!workflowCoordinator) {
    const contextEngine = ContextEngine.getInstance();
    const agentFactory = AgentFactory.getInstance();
    const domainRegistry = DomainRegistry.getInstance();
    const analysisEngine = AnalysisEngine.getInstance();
    const taskMaster = new TaskMaster({});
    
    workflowCoordinator = new WorkflowCoordinator({
      contextEngine,
      taskMaster,
      analysisEngine,
      maxParallelSteps: 5,
      autoStart: true
    });
  }
  return workflowCoordinator;
}

/**
 * Parse workflow definition from arguments or file
 */
async function parseWorkflowDefinition(args: string): Promise<WorkflowDefinition | null> {
  // Check if args is a file path
  const isFile = args.trim().endsWith('.json') || args.trim().endsWith('.yaml') || args.trim().endsWith('.yml');
  
  if (isFile) {
    try {
      // In a real implementation, we would read the file and parse it
      // For now, we'll just return a simple workflow for testing
      return {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'A simple test workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            description: 'First step of the workflow',
            task: 'echo "Hello, World!"',
          },
          {
            id: 'step2',
            name: 'Second Step',
            description: 'Second step that depends on the first',
            task: 'process-data',
            dependsOn: ['step1'],
          },
        ],
      };
    } catch (error) {
      console.error('Error loading workflow file:', error);
      return null;
    }
  }
  
  // Parse workflow from command line arguments
  // This is a simplified example - in a real implementation, you would parse the arguments
  // to create a workflow definition
  return {
    id: `workflow-${uuidv4()}`,
    name: 'Dynamic Workflow',
    description: 'Dynamically created workflow',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        name: 'Dynamic Step',
        description: 'Dynamically created step',
        task: args.trim() || 'echo "No task specified"',
      },
    ],
  };
}

/**
 * Format execution status for display
 */
function formatExecutionStatus(execution: WorkflowExecution): string {
  const statusIcons = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '⏹️',
    paused: '⏸️',
  };
  
  const icon = statusIcons[execution.status] || '❓';
  const duration = execution.endTime 
    ? `(${Math.floor((execution.endTime.getTime() - execution.startTime.getTime()) / 1000)}s)`
    : '';
    
  return `${icon} Workflow ${execution.workflowId} - ${execution.status} ${duration}`;
}

/**
 * Orchestration command for Universal AI Agent Orchestration
 */
export const orchestrateCommand: SlashCommand = {
  name: 'orchestrate',
  altName: 'orch',
  description: 'Universal AI Agent Orchestration - Create and manage workflows with specialized agents',
  subCommands: [
    {
      name: 'start',
      description: 'Start a new workflow execution',
      action: async (context, args) => {
        if (!args.trim()) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Usage: /orchestrate start <workflow-file.json|task-description>
            
Examples:
  /orchestrate start ./path/to/workflow.json
  /orchestrate start "Analyze the codebase and generate documentation"
  /orchestrate start --domains=coding,documentation --task="Refactor the API service"`
          };
        }

        try {
          const workflowCoordinator = await getWorkflowCoordinator();
          const workflow = await parseWorkflowDefinition(args);
          
          if (!workflow) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Failed to parse workflow definition.'
            };
          }
          
          const execution = await workflowCoordinator.createExecution(workflow);
          
          return {
            type: 'message',
            messageType: 'success',
            content: `🚀 Started workflow execution: ${execution.id}\n` +
                     `Workflow: ${workflow.name} (${workflow.steps.length} steps)\n` +
                     `Status: ${execution.status}\n` +
                     `Progress: ${execution.progress}%`
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to start workflow: ${error instanceof Error ? error.message : String(error)}`
          };
        }

      }
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
      name: 'stop',
      description: 'Stop a running workflow execution',
      action: async (context, args) => {
        const executionId = args.trim();
        
        if (!executionId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /orchestrate stop <execution-id>'
          };
        }
        
        try {
          const workflowCoordinator = await getWorkflowCoordinator();
          const success = workflowCoordinator.cancelExecution(executionId);
          
          if (success) {
            return {
              type: 'message',
              messageType: 'warning',
              content: 'The templates subcommand has been deprecated.\n' +
                      'Please use `/orchestrate start --template=<id>` instead.'
            };
          } else {
            return {
              type: 'message',
              messageType: 'warning',
              content: `Execution ${executionId} could not be cancelled (it may have already completed or failed)`
            };
          }
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to cancel execution: ${error instanceof Error ? error.message : String(error)}`
          };
        }
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
      name: 'list',
      description: 'List available workflow templates',
      action: async () => {
        // In a real implementation, this would list available workflow templates
        // For now, we'll return a static list of example templates
        const templates = [
          { id: 'code-review', name: 'Code Review', description: 'Review code changes with domain experts' },
          { id: 'documentation', name: 'Generate Documentation', description: 'Create documentation from code' },
          { id: 'testing', name: 'Test Generation', description: 'Generate and run tests for code' },
          { id: 'refactoring', name: 'Code Refactoring', description: 'Refactor code with architecture guidance' },
        ];
        
        return {
          type: 'message',
          messageType: 'info',
          content: 'The templates subcommand has been deprecated.\n' +
                  'Please use `/orchestrate start --template=<id>` instead.'
        };
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
      name: 'domains',
      description: 'List available agent domains and capabilities',
      action: async () => {
        try {
          const domainRegistry = DomainRegistry.getInstance();
          const domains = domainRegistry.listDomains();
          
          if (domains.length === 0) {
            return {
              type: 'message',
              messageType: 'info',
              content: 'No domains registered. Use the DomainRegistry to register domains.'
            };
          }
          
          const domainList = domains.map(domain => {
            const agentTemplates = domainRegistry.listAgentTemplates(domain.id);
            const templateList = agentTemplates.length > 0 
              ? `  Agents: ${agentTemplates.map(t => t.id).join(', ')}`
              : '  No agent templates defined';
              
            return `• ${domain.id} (${domain.name})\n  ${domain.description || 'No description'}\n${templateList}`;
          }).join('\n\n');
          
          return {
            type: 'message',
            messageType: 'info',
            content: '🌐 Available Agent Domains:\n\n' + domainList
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list domains: ${error instanceof Error ? error.message : String(error)}`
          };
        }
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
      name: 'agents',
      description: 'List available agent instances',
      action: async () => {
        try {
          const agentFactory = AgentFactory.getInstance();
          // In a real implementation, we would get the list of agents from the factory
          // For now, we'll return a placeholder message
          
          return {
            type: 'message',
            messageType: 'info',
            content: '🤖 Agent Management\n\n' +
                    'Available agent instances will be listed here.\n' +
                    'Use `/orchestrate agents create <type> [options]` to create a new agent.'
          };
        } catch (error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
          };
        }
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
      name: 'help',
      description: 'Show help for orchestration commands',
      action: () => ({
        type: 'message',
        messageType: 'info',
        content: `🤖 Universal AI Agent Orchestration Commands:

• /orchestrate start <workflow-file|task> - Start a new workflow execution
• /orchestrate status [execution-id]     - Check execution status
• /orchestrate stop <execution-id>       - Stop a running execution
• /orchestrate list                      - List available workflow templates
• /orchestrate domains                   - List available agent domains
• /orchestrate agents                    - Manage agent instances
• /orchestrate help                      - Show this help message

Examples:
  /orchestrate start ./path/to/workflow.json
  /orchestrate start "Analyze the codebase and generate documentation"
  /orchestrate status workflow-123
  /orchestrate stop workflow-123
  /orchestrate domains`
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
    },
    // Keep the original 'team' command for backward compatibility
    {
      name: 'team',
      description: 'Legacy: Create a custom team of agents (use /orchestrate start instead)',
      action: async (context, args) => ({
        type: 'message',
        messageType: 'warning',
        content: 'The /orchestrate team command is deprecated.\n' +
                'Please use `/orchestrate start` with workflow definitions instead.\n' +
                'Example: /orchestrate start --domains=coding,documentation --task="Your task here"'
      })
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
        }
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
                messageType: 'warning',
                content: 'The templates subcommand has been deprecated.\n' +
                        'Please define your workflows as JSON or YAML files instead.'
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
        }
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