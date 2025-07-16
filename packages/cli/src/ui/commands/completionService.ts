/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandContext, SlashCommand } from './types.js';

/**
 * Service for command auto-completion
 */
export class CompletionService {
  private commands: SlashCommand[] = [];

  constructor(commands: SlashCommand[]) {
    this.commands = commands;
  }

  /**
   * Get completions for a partial command input
   */
  async getCompletions(
    context: CommandContext,
    input: string,
    cursorPosition: number
  ): Promise<CompletionResult[]> {
    const inputBeforeCursor = input.substring(0, cursorPosition);
    const parts = inputBeforeCursor.split(' ');
    
    if (parts.length === 0) {
      return [];
    }

    // Remove the '/' prefix if present
    const firstPart = parts[0].startsWith('/') ? parts[0].substring(1) : parts[0];
    
    if (parts.length === 1) {
      // Complete command names
      return this.getCommandCompletions(firstPart);
    }

    // Find the command
    const command = this.findCommand(firstPart);
    if (!command) {
      return [];
    }

    // Navigate to the appropriate subcommand
    let currentCommand = command;
    let partIndex = 1;
    
    while (partIndex < parts.length - 1 && currentCommand.subCommands) {
      const subCommand = currentCommand.subCommands.find(
        sub => sub.name === parts[partIndex] || sub.altName === parts[partIndex]
      );
      
      if (!subCommand) {
        break;
      }
      
      currentCommand = subCommand;
      partIndex++;
    }

    const lastPart = parts[parts.length - 1];
    const isLastPartComplete = inputBeforeCursor.endsWith(' ');

    if (isLastPartComplete || partIndex === parts.length - 1) {
      // Complete subcommands or arguments
      if (currentCommand.subCommands && currentCommand.subCommands.length > 0) {
        return this.getSubCommandCompletions(currentCommand.subCommands, isLastPartComplete ? '' : lastPart);
      } else if (currentCommand.completion) {
        // Use custom completion function
        return this.getCustomCompletions(currentCommand, context, lastPart);
      }
    }

    return [];
  }

  /**
   * Get command name completions
   */
  private getCommandCompletions(partial: string): CompletionResult[] {
    const completions: CompletionResult[] = [];
    
    for (const command of this.commands) {
      if (command.name.startsWith(partial)) {
        completions.push({
          text: command.name,
          displayText: command.name,
          description: command.description || 'No description',
          type: 'command'
        });
      }
      
      if (command.altName && command.altName.startsWith(partial)) {
        completions.push({
          text: command.altName,
          displayText: `${command.altName} (${command.name})`,
          description: command.description || 'No description',
          type: 'command'
        });
      }
    }
    
    return completions.sort((a, b) => a.text.localeCompare(b.text));
  }

  /**
   * Get subcommand completions
   */
  private getSubCommandCompletions(subCommands: SlashCommand[], partial: string): CompletionResult[] {
    const completions: CompletionResult[] = [];
    
    for (const subCommand of subCommands) {
      if (subCommand.name.startsWith(partial)) {
        completions.push({
          text: subCommand.name,
          displayText: subCommand.name,
          description: subCommand.description || 'No description',
          type: 'subcommand'
        });
      }
      
      if (subCommand.altName && subCommand.altName.startsWith(partial)) {
        completions.push({
          text: subCommand.altName,
          displayText: `${subCommand.altName} (${subCommand.name})`,
          description: subCommand.description || 'No description',
          type: 'subcommand'
        });
      }
    }
    
    return completions.sort((a, b) => a.text.localeCompare(b.text));
  }

  /**
   * Get custom completions using command-specific completion function
   */
  private async getCustomCompletions(
    command: SlashCommand,
    context: CommandContext,
    partial: string
  ): Promise<CompletionResult[]> {
    if (!command.completion) {
      return [];
    }

    try {
      const completions = await command.completion(context, partial);
      return completions.map(text => ({
        text,
        displayText: text,
        description: '',
        type: 'argument'
      }));
    } catch (error) {
      console.error('Error getting custom completions:', error);
      return [];
    }
  }

  /**
   * Find command by name or alt name
   */
  private findCommand(name: string): SlashCommand | undefined {
    return this.commands.find(cmd => cmd.name === name || cmd.altName === name);
  }

  /**
   * Get completion suggestions for specific command types
   */
  async getAgentCompletions(context: CommandContext, partial: string): Promise<string[]> {
    const orchestrator = context.services.orchestrator;
    if (!orchestrator) {
      return [];
    }

    try {
      const agents = await orchestrator.getAgents();
      return agents
        .filter((agent: any) => agent.id.startsWith(partial))
        .map((agent: any) => agent.id)
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get completion suggestions for domains
   */
  async getDomainCompletions(context: CommandContext, partial: string): Promise<string[]> {
    const orchestrator = context.services.orchestrator;
    if (!orchestrator) {
      return [];
    }

    try {
      const domains = await orchestrator.getAvailableDomains();
      return domains
        .filter((domain: any) => domain.name.startsWith(partial))
        .map((domain: any) => domain.name)
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get completion suggestions for task IDs
   */
  async getTaskCompletions(context: CommandContext, partial: string): Promise<string[]> {
    const projectRoot = context.services.config?.getProjectRoot();
    if (!projectRoot) {
      return [];
    }

    try {
      // This would need to be implemented based on your task management system
      // For now, return some common task ID patterns
      const taskIds = ['1', '1.1', '1.2', '2', '2.1', '2.2', '3', '3.1'];
      return taskIds
        .filter(id => id.startsWith(partial))
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get completion suggestions for command options
   */
  async getOptionCompletions(context: CommandContext, partial: string): Promise<string[]> {
    const commonOptions = [
      '--help',
      '--force',
      '--research',
      '--priority=high',
      '--priority=medium',
      '--priority=low',
      '--pattern=sequential',
      '--pattern=parallel',
      '--pattern=debate',
      '--timeout=30000',
      '--num=5',
      '--detail=high',
      '--detail=medium',
      '--detail=low'
    ];

    return commonOptions
      .filter(option => option.startsWith(partial))
      .sort();
  }

  /**
   * Get file path completions
   */
  async getFileCompletions(context: CommandContext, partial: string): Promise<string[]> {
    // This would integrate with the file system to provide file path completions
    // For now, return some common file patterns
    const commonFiles = [
      '.taskmaster/tasks/tasks.json',
      '.taskmaster/docs/prd.txt',
      'package.json',
      'README.md',
      'src/',
      'test/',
      'docs/'
    ];

    return commonFiles
      .filter(file => file.startsWith(partial))
      .sort();
  }

  /**
   * Add command completion handlers
   */
  addCommandCompletions(commands: SlashCommand[]): void {
    // Add agent completion to agent commands
    const agentCommand = commands.find(cmd => cmd.name === 'agents');
    if (agentCommand && agentCommand.subCommands) {
      for (const subCommand of agentCommand.subCommands) {
        if (['status', 'start', 'stop', 'assign'].includes(subCommand.name)) {
          subCommand.completion = this.getAgentCompletions.bind(this);
        }
      }
    }

    // Add domain completion to domain commands
    const domainCommand = commands.find(cmd => cmd.name === 'domains');
    if (domainCommand && domainCommand.subCommands) {
      for (const subCommand of domainCommand.subCommands) {
        if (['show', 'stats'].includes(subCommand.name)) {
          subCommand.completion = this.getDomainCompletions.bind(this);
        }
      }
    }

    // Add task completion to task commands
    const taskCommand = commands.find(cmd => cmd.name === 'taskmaster');
    if (taskCommand && taskCommand.subCommands) {
      for (const subCommand of taskCommand.subCommands) {
        if (['show', 'complete', 'start', 'update', 'assign'].includes(subCommand.name)) {
          subCommand.completion = this.getTaskCompletions.bind(this);
        }
      }
    }

    // Add option completion for commands that support options
    for (const command of commands) {
      if (command.subCommands) {
        for (const subCommand of command.subCommands) {
          if (['add', 'create', 'execute', 'optimize'].includes(subCommand.name)) {
            const originalCompletion = subCommand.completion;
            subCommand.completion = async (context: any, partial: any) => {
              if (partial.startsWith('--')) {
                return this.getOptionCompletions(context, partial);
              }
              return originalCompletion ? originalCompletion(context, partial) : [];
            };
          }
        }
      }
    }
  }
}

/**
 * Completion result interface
 */
export interface CompletionResult {
  text: string;
  displayText: string;
  description: string;
  type: 'command' | 'subcommand' | 'argument' | 'option' | 'file';
}

/**
 * Create completion service with built-in commands
 */
export function createCompletionService(commands: SlashCommand[]): CompletionService {
  const service = new CompletionService(commands);
  service.addCommandCompletions(commands);
  return service;
}