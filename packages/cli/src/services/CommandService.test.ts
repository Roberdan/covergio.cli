/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CommandService } from './CommandService.js';
import { type SlashCommand } from '../ui/commands/types.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';

// Mock the command modules to isolate the service from the command implementations.
vi.mock('../ui/commands/memoryCommand.js', () => ({
  memoryCommand: { name: 'memory', description: 'Mock Memory' },
}));
vi.mock('../ui/commands/helpCommand.js', () => ({
  helpCommand: { name: 'help', description: 'Mock Help' },
}));
vi.mock('../ui/commands/clearCommand.js', () => ({
  clearCommand: { name: 'clear', description: 'Mock Clear' },
}));
vi.mock('../ui/commands/authCommand.js', () => ({
  authCommand: { name: 'auth', description: 'Mock Auth' },
}));
vi.mock('../ui/commands/themeCommand.js', () => ({
  themeCommand: { name: 'theme', description: 'Mock Theme' },
}));

// Mock the enhanced command modules
vi.mock('../ui/commands/agentCommand.js', () => ({
  agentCommand: { name: 'agents', description: 'Mock Agent Commands' },
}));
vi.mock('../ui/commands/domainsCommand.js', () => ({
  domainsCommand: { name: 'domains', description: 'Mock Domain Commands' },
}));
vi.mock('../ui/commands/orchestrateCommand.js', () => ({
  orchestrateCommand: { name: 'orchestrate', description: 'Mock Orchestration Commands' },
}));
vi.mock('../ui/commands/taskmasterCommand.js', () => ({
  taskmasterCommand: { name: 'taskmaster', description: 'Mock TaskMaster Commands' },
}));
vi.mock('../ui/commands/historyCommand.js', () => ({
  historyCommand: { name: 'history', description: 'Mock History Commands' },
}));
vi.mock('../ui/commands/completionService.js', () => ({
  createCompletionService: vi.fn().mockReturnValue({
    getCompletions: vi.fn(),
    getAgentCompletions: vi.fn(),
    getDomainCompletions: vi.fn(),
    getTaskCompletions: vi.fn(),
  }),
}));

describe('CommandService', () => {
  describe('when using default production loader', () => {
    let commandService: CommandService;

    beforeEach(() => {
      commandService = new CommandService();
    });

    it('should initialize with an empty command tree', () => {
      const tree = commandService.getCommands();
      expect(tree).toBeInstanceOf(Array);
      expect(tree.length).toBe(0);
    });

    describe('loadCommands', () => {
      it('should load the built-in commands into the command tree', async () => {
        // Pre-condition check
        expect(commandService.getCommands().length).toBe(0);

        // Action
        await commandService.loadCommands();
        const tree = commandService.getCommands();

        // Post-condition assertions
        expect(tree.length).toBe(10);

        const commandNames = tree.map((cmd) => cmd.name);
        expect(commandNames).toContain('auth');
        expect(commandNames).toContain('memory');
        expect(commandNames).toContain('help');
        expect(commandNames).toContain('clear');
        expect(commandNames).toContain('theme');
        expect(commandNames).toContain('agents');
        expect(commandNames).toContain('domains');
        expect(commandNames).toContain('orchestrate');
        expect(commandNames).toContain('taskmaster');
        expect(commandNames).toContain('history');
      });

      it('should overwrite any existing commands when called again', async () => {
        // Load once
        await commandService.loadCommands();
        expect(commandService.getCommands().length).toBe(10);

        // Load again
        await commandService.loadCommands();
        const tree = commandService.getCommands();

        // Should not append, but overwrite
        expect(tree.length).toBe(10);
      });
    });

    describe('getCommandTree', () => {
      it('should return the current command tree', async () => {
        const initialTree = commandService.getCommands();
        expect(initialTree).toEqual([]);

        await commandService.loadCommands();

        const loadedTree = commandService.getCommands();
        expect(loadedTree.length).toBe(10);
        expect(loadedTree).toEqual([
          authCommand,
          clearCommand,
          helpCommand,
          memoryCommand,
          themeCommand,
          expect.objectContaining({ name: 'agents' }),
          expect.objectContaining({ name: 'domains' }),
          expect.objectContaining({ name: 'orchestrate' }),
          expect.objectContaining({ name: 'taskmaster' }),
          expect.objectContaining({ name: 'history' }),
        ]);
      });

      it('should initialize completion service after loading commands', async () => {
        // Pre-condition: completion service should be null
        expect(commandService.getCompletionService()).toBeNull();

        // Action
        await commandService.loadCommands();

        // Post-condition: completion service should be initialized
        const completionService = commandService.getCompletionService();
        expect(completionService).toBeDefined();
        expect(completionService).not.toBeNull();
        expect(completionService?.getCompletions).toBeDefined();
      });
    });

    describe('getCompletionService', () => {
      it('should return null before loading commands', () => {
        expect(commandService.getCompletionService()).toBeNull();
      });

      it('should return completion service after loading commands', async () => {
        await commandService.loadCommands();

        const completionService = commandService.getCompletionService();
        expect(completionService).toBeDefined();
        expect(completionService).not.toBeNull();
        expect(typeof completionService?.getCompletions).toBe('function');
        expect(typeof completionService?.getAgentCompletions).toBe('function');
        expect(typeof completionService?.getDomainCompletions).toBe('function');
        expect(typeof completionService?.getTaskCompletions).toBe('function');
      });
    });
  });

  describe('when initialized with an injected loader function', () => {
    it('should use the provided loader instead of the built-in one', async () => {
      // Arrange: Create a set of mock commands.
      const mockCommands: SlashCommand[] = [
        { name: 'injected-test-1', description: 'injected 1' },
        { name: 'injected-test-2', description: 'injected 2' },
      ];

      // Arrange: Create a mock loader FUNCTION that resolves with our mock commands.
      const mockLoader = vi.fn().mockResolvedValue(mockCommands);

      // Act: Instantiate the service WITH the injected loader function.
      const commandService = new CommandService(mockLoader);
      await commandService.loadCommands();
      const tree = commandService.getCommands();

      // Assert: The tree should contain ONLY our injected commands.
      expect(mockLoader).toHaveBeenCalled(); // Verify our mock loader was actually called.
      expect(tree.length).toBe(2);
      expect(tree).toEqual(mockCommands);

      const commandNames = tree.map((cmd) => cmd.name);
      expect(commandNames).not.toContain('memory'); // Verify it didn't load production commands.
    });
  });
});
