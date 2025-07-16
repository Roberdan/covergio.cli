/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from './types.js';

/**
 * Task Master AI integration commands
 */
export const taskmasterCommand: SlashCommand = {
  name: 'taskmaster',
  altName: 'tm',
  description: 'Task Master AI integration for task analysis and decomposition',
  subCommands: [
    {
      name: 'status',
      description: 'Show Task Master system status and current tasks',
      action: async (context) => {
        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured. Please ensure you are in a valid project directory.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__get_tasks',
          toolArgs: {
            projectRoot,
            withSubtasks: true
          }
        };
      }
    },
    {
      name: 'next',
      description: 'Get the next available task to work on',
      action: async (context) => {
        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__next_task',
          toolArgs: { projectRoot }
        };
      }
    },
    {
      name: 'show',
      description: 'Show detailed information about a specific task',
      action: async (context, args) => {
        const taskId = args.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster show <task-id>\nExample: /taskmaster show 1.2'
          };
        }

        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__get_task',
          toolArgs: {
            id: taskId,
            projectRoot
          }
        };
      }
    },
    {
      name: 'complete',
      description: 'Mark a task as completed',
      action: async (context, args) => {
        const taskId = args.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster complete <task-id>\nExample: /taskmaster complete 1.2'
          };
        }

        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__set_task_status',
          toolArgs: {
            id: taskId,
            status: 'done',
            projectRoot
          }
        };
      }
    },
    {
      name: 'start',
      description: 'Mark a task as in progress',
      action: async (context, args) => {
        const taskId = args.trim();
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster start <task-id>\nExample: /taskmaster start 1.2'
          };
        }

        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__set_task_status',
          toolArgs: {
            id: taskId,
            status: 'in-progress',
            projectRoot
          }
        };
      }
    },
    {
      name: 'analyze',
      description: 'Analyze project complexity and generate task recommendations',
      action: async (context, args) => {
        const options = parseAnalyzeOptions(args);
        const projectRoot = context.services.config?.getProjectRoot();
        
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        const toolArgs: any = {
          projectRoot,
          research: options.research || false,
          threshold: options.threshold || 5
        };

        if (options.from) toolArgs.from = options.from;
        if (options.to) toolArgs.to = options.to;
        if (options.ids) toolArgs.ids = options.ids;

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__analyze_project_complexity',
          toolArgs
        };
      }
    },
    {
      name: 'expand',
      description: 'Expand a task into subtasks',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        const taskId = parts[0];
        
        if (!taskId) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster expand <task-id> [--research] [--num=N] [--force]\nExample: /taskmaster expand 1 --research --num=5'
          };
        }

        const options = parseExpandOptions(args);
        const projectRoot = context.services.config?.getProjectRoot();
        
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        const toolArgs: any = {
          id: taskId,
          projectRoot,
          research: options.research || false,
          force: options.force || false
        };

        if (options.num) toolArgs.num = options.num.toString();
        if (options.prompt) toolArgs.prompt = options.prompt;

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__expand_task',
          toolArgs
        };
      }
    },
    {
      name: 'add',
      description: 'Add a new task to the project',
      action: async (context, args) => {
        const options = parseAddOptions(args);
        
        if (!options.prompt && !options.title) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster add <task-description> [--research] [--priority=high|medium|low]\nExample: /taskmaster add "Implement user authentication" --research --priority=high'
          };
        }

        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        const toolArgs: any = {
          projectRoot,
          research: options.research || false
        };

        if (options.prompt) toolArgs.prompt = options.prompt;
        if (options.title) toolArgs.title = options.title;
        if (options.description) toolArgs.description = options.description;
        if (options.priority) toolArgs.priority = options.priority;
        if (options.dependencies) toolArgs.dependencies = options.dependencies;

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__add_task',
          toolArgs
        };
      }
    },
    {
      name: 'update',
      description: 'Update task information',
      action: async (context, args) => {
        const parts = args.trim().split(' ');
        const taskId = parts[0];
        
        if (!taskId || parts.length < 2) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster update <task-id> <update-description>\nExample: /taskmaster update 1.2 "Added authentication middleware implementation"'
          };
        }

        const prompt = parts.slice(1).join(' ');
        const projectRoot = context.services.config?.getProjectRoot();
        
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        // Check if it's a subtask (contains dot)
        if (taskId.includes('.')) {
          return {
            type: 'tool',
            toolName: 'mcp__task-master-ai__update_subtask',
            toolArgs: {
              id: taskId,
              prompt,
              projectRoot
            }
          };
        } else {
          return {
            type: 'tool',
            toolName: 'mcp__task-master-ai__update_task',
            toolArgs: {
              id: taskId,
              prompt,
              projectRoot
            }
          };
        }
      }
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
            content: 'Usage: /taskmaster assign <task-id> <agent-id>\nExample: /taskmaster assign 1.2 coding-agent'
          };
        }

        const [taskId, agentId] = parts;
        const projectRoot = context.services.config?.getProjectRoot();
        
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        // Get the task first
        const task = await context.services.taskmaster?.getTask(taskId);
        if (!task) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Task '${taskId}' not found.`
          };
        }

        // Get the agent
        const agent = await context.services.orchestrator?.getAgent(agentId);
        if (!agent) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Agent '${agentId}' not found. Use /agents list to see available agents.`
          };
        }

        // Update task with agent assignment
        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__update_task',
          toolArgs: {
            id: taskId,
            prompt: `Assigned to agent: ${agentId} (${agent.type})`,
            projectRoot
          }
        };
      }
    },
    {
      name: 'complexity',
      description: 'Show complexity analysis report',
      action: async (context) => {
        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__complexity_report',
          toolArgs: { projectRoot }
        };
      }
    },
    {
      name: 'dependencies',
      description: 'Manage task dependencies',
      subCommands: [
        {
          name: 'validate',
          description: 'Validate task dependencies for circular references',
          action: async (context) => {
            const projectRoot = context.services.config?.getProjectRoot();
            if (!projectRoot) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Project root not configured.'
              };
            }

            return {
              type: 'tool',
              toolName: 'mcp__task-master-ai__validate_dependencies',
              toolArgs: { projectRoot }
            };
          }
        },
        {
          name: 'fix',
          description: 'Fix invalid dependencies automatically',
          action: async (context) => {
            const projectRoot = context.services.config?.getProjectRoot();
            if (!projectRoot) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Project root not configured.'
              };
            }

            return {
              type: 'tool',
              toolName: 'mcp__task-master-ai__fix_dependencies',
              toolArgs: { projectRoot }
            };
          }
        },
        {
          name: 'add',
          description: 'Add a dependency between tasks',
          action: async (context, args) => {
            const parts = args.trim().split(' ');
            if (parts.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /taskmaster dependencies add <task-id> <depends-on-task-id>\nExample: /taskmaster dependencies add 2 1'
              };
            }

            const [taskId, dependsOnId] = parts;
            const projectRoot = context.services.config?.getProjectRoot();
            
            if (!projectRoot) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Project root not configured.'
              };
            }

            return {
              type: 'tool',
              toolName: 'mcp__task-master-ai__add_dependency',
              toolArgs: {
                id: taskId,
                dependsOn: dependsOnId,
                projectRoot
              }
            };
          }
        },
        {
          name: 'remove',
          description: 'Remove a dependency between tasks',
          action: async (context, args) => {
            const parts = args.trim().split(' ');
            if (parts.length < 2) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Usage: /taskmaster dependencies remove <task-id> <depends-on-task-id>\nExample: /taskmaster dependencies remove 2 1'
              };
            }

            const [taskId, dependsOnId] = parts;
            const projectRoot = context.services.config?.getProjectRoot();
            
            if (!projectRoot) {
              return {
                type: 'message',
                messageType: 'error',
                content: 'Project root not configured.'
              };
            }

            return {
              type: 'tool',
              toolName: 'mcp__task-master-ai__remove_dependency',
              toolArgs: {
                id: taskId,
                dependsOn: dependsOnId,
                projectRoot
              }
            };
          }
        }
      ]
    },
    {
      name: 'research',
      description: 'Perform AI-powered research on tasks or topics',
      action: async (context, args) => {
        const options = parseResearchOptions(args);
        
        if (!options.query) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /taskmaster research <query> [--task=id] [--detail=low|medium|high]\nExample: /taskmaster research "React hooks best practices" --task=1.2 --detail=high'
          };
        }

        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        const toolArgs: any = {
          query: options.query,
          projectRoot,
          detailLevel: options.detail || 'medium'
        };

        if (options.task) toolArgs.saveTo = options.task;
        if (options.files) toolArgs.filePaths = options.files;

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__research',
          toolArgs
        };
      }
    },
    {
      name: 'generate',
      description: 'Generate individual task files from tasks.json',
      action: async (context) => {
        const projectRoot = context.services.config?.getProjectRoot();
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__generate',
          toolArgs: { projectRoot }
        };
      }
    },
    {
      name: 'parse-prd',
      description: 'Parse a Product Requirements Document to generate tasks',
      action: async (context, args) => {
        const options = parsePRDOptions(args);
        const projectRoot = context.services.config?.getProjectRoot();
        
        if (!projectRoot) {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Project root not configured.'
          };
        }

        const toolArgs: any = {
          projectRoot,
          research: options.research || false,
          append: options.append || false
        };

        if (options.input) toolArgs.input = options.input;
        if (options.numTasks) toolArgs.numTasks = options.numTasks.toString();

        return {
          type: 'tool',
          toolName: 'mcp__task-master-ai__parse_prd',
          toolArgs
        };
      }
    }
  ]
};

/**
 * Parse analyze command options
 */
function parseAnalyzeOptions(args: string): {
  research?: boolean;
  threshold?: number;
  from?: number;
  to?: number;
  ids?: string;
} {
  const options: any = {};
  const parts = args.split(' ');

  for (const part of parts) {
    if (part === '--research') {
      options.research = true;
    } else if (part.startsWith('--threshold=')) {
      options.threshold = parseInt(part.substring(12));
    } else if (part.startsWith('--from=')) {
      options.from = parseInt(part.substring(7));
    } else if (part.startsWith('--to=')) {
      options.to = parseInt(part.substring(5));
    } else if (part.startsWith('--ids=')) {
      options.ids = part.substring(6);
    }
  }

  return options;
}

/**
 * Parse expand command options
 */
function parseExpandOptions(args: string): {
  research?: boolean;
  num?: number;
  force?: boolean;
  prompt?: string;
} {
  const options: any = {};
  const parts = args.split(' ');
  const promptParts: string[] = [];

  for (const part of parts) {
    if (part === '--research') {
      options.research = true;
    } else if (part === '--force') {
      options.force = true;
    } else if (part.startsWith('--num=')) {
      options.num = parseInt(part.substring(6));
    } else if (!part.startsWith('--') && !part.match(/^\d+$/)) {
      // Not an option or task ID, add to prompt
      promptParts.push(part);
    }
  }

  if (promptParts.length > 0) {
    options.prompt = promptParts.join(' ');
  }

  return options;
}

/**
 * Parse add command options
 */
function parseAddOptions(args: string): {
  prompt?: string;
  title?: string;
  description?: string;
  research?: boolean;
  priority?: string;
  dependencies?: string;
} {
  const options: any = {};
  const parts = args.split(' ');
  const promptParts: string[] = [];

  for (const part of parts) {
    if (part === '--research') {
      options.research = true;
    } else if (part.startsWith('--priority=')) {
      options.priority = part.substring(11);
    } else if (part.startsWith('--dependencies=')) {
      options.dependencies = part.substring(15);
    } else if (part.startsWith('--title=')) {
      options.title = part.substring(8);
    } else if (part.startsWith('--description=')) {
      options.description = part.substring(14);
    } else if (!part.startsWith('--')) {
      promptParts.push(part);
    }
  }

  if (promptParts.length > 0) {
    options.prompt = promptParts.join(' ');
  }

  return options;
}

/**
 * Parse research command options
 */
function parseResearchOptions(args: string): {
  query?: string;
  task?: string;
  detail?: string;
  files?: string;
} {
  const options: any = {};
  const parts = args.split(' ');
  const queryParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('--task=')) {
      options.task = part.substring(7);
    } else if (part.startsWith('--detail=')) {
      options.detail = part.substring(9);
    } else if (part.startsWith('--files=')) {
      options.files = part.substring(8);
    } else if (!part.startsWith('--')) {
      queryParts.push(part);
    }
  }

  if (queryParts.length > 0) {
    options.query = queryParts.join(' ');
  }

  return options;
}

/**
 * Parse PRD command options
 */
function parsePRDOptions(args: string): {
  input?: string;
  numTasks?: number;
  research?: boolean;
  append?: boolean;
} {
  const options: any = {};
  const parts = args.split(' ');

  for (const part of parts) {
    if (part === '--research') {
      options.research = true;
    } else if (part === '--append') {
      options.append = true;
    } else if (part.startsWith('--input=')) {
      options.input = part.substring(8);
    } else if (part.startsWith('--num-tasks=')) {
      options.numTasks = parseInt(part.substring(12));
    }
  }

  return options;
}