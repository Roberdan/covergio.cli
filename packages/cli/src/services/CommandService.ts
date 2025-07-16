/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand } from '../ui/commands/types.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';
import { agentCommand } from '../ui/commands/agentCommand.js';
import { domainsCommand } from '../ui/commands/domainsCommand.js';
import { orchestrateCommand } from '../ui/commands/orchestrateCommand.js';
import { taskmasterCommand } from '../ui/commands/taskmasterCommand.js';
import { historyCommand } from '../ui/commands/historyCommand.js';
import { createCompletionService } from '../ui/commands/completionService.js';

const loadBuiltInCommands = async (): Promise<SlashCommand[]> => {
  const commands = [
    authCommand,
    clearCommand,
    helpCommand,
    memoryCommand,
    themeCommand,
    agentCommand,
    domainsCommand,
    orchestrateCommand,
    taskmasterCommand,
    historyCommand,
  ];

  // Initialize auto-completion for enhanced commands
  const completionService = createCompletionService(commands);
  
  return commands;
};

export class CommandService {
  private commands: SlashCommand[] = [];
  private completionService: ReturnType<typeof createCompletionService> | null = null;

  constructor(
    private commandLoader: () => Promise<SlashCommand[]> = loadBuiltInCommands,
  ) {
    // The constructor can be used for dependency injection in the future.
  }

  async loadCommands(): Promise<void> {
    // For now, we only load the built-in commands.
    // File-based and remote commands will be added later.
    this.commands = await this.commandLoader();
    
    // Initialize completion service with loaded commands
    this.completionService = createCompletionService(this.commands);
  }

  getCommands(): SlashCommand[] {
    return this.commands;
  }

  getCompletionService() {
    return this.completionService;
  }
}
