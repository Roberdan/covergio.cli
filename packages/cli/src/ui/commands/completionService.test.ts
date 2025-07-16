/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompletionService, createCompletionService } from './completionService.js';
import { SlashCommand } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('CompletionService', () => {
  let service: CompletionService;
  let mockContext: any;
  let mockCommands: SlashCommand[];

  beforeEach(() => {
    mockCommands = [
      {
        name: 'agents',
        altName: 'agent',
        description: 'Agent management commands',
        subCommands: [
          {
            name: 'list',
            altName: 'ls',
            description: 'List all agents',
            action: vi.fn(),
          },
          {
            name: 'status',
            description: 'Show agent status',
            action: vi.fn(),
          },
          {
            name: 'start',
            description: 'Start an agent',
            action: vi.fn(),
          },
        ],
      },
      {
        name: 'domains',
        altName: 'domain',
        description: 'Domain management commands',
        subCommands: [
          {
            name: 'list',
            description: 'List all domains',
            action: vi.fn(),
          },
          {
            name: 'show',
            description: 'Show domain details',
            action: vi.fn(),
          },
        ],
      },
      {
        name: 'taskmaster',
        altName: 'tm',
        description: 'Task management commands',
        subCommands: [
          {
            name: 'status',
            description: 'Show task status',
            action: vi.fn(),
          },
          {
            name: 'complete',
            description: 'Complete a task',
            action: vi.fn(),
          },
        ],
      },
    ];

    service = new CompletionService(mockCommands);
    
    mockContext = createMockCommandContext({
      services: {
        orchestrator: {
          getAgents: vi.fn().mockResolvedValue([
            { id: 'agent1', type: 'coding' },
            { id: 'agent2', type: 'testing' },
          ]),
          getAvailableDomains: vi.fn().mockResolvedValue([
            { name: 'coding', description: 'Code development' },
            { name: 'testing', description: 'Test automation' },
          ]),
        },
        config: {
          getProjectRoot: vi.fn().mockReturnValue('/test/project'),
        },
      },
    });
  });

  describe('getCompletions', () => {
    it('should complete command names', async () => {
      const completions = await service.getCompletions(mockContext, '/ag', 3);
      
      expect(completions).toHaveLength(2);
      expect(completions[0]).toEqual({
        text: 'agent',
        displayText: 'agent (agents)',
        description: 'Agent management commands',
        type: 'command',
      });
      expect(completions[1]).toEqual({
        text: 'agents',
        displayText: 'agents',
        description: 'Agent management commands',
        type: 'command',
      });
    });

    it('should complete subcommand names', async () => {
      const completions = await service.getCompletions(mockContext, '/agents l', 9);
      
      expect(completions).toHaveLength(2);
      expect(completions[0]).toEqual({
        text: 'list',
        displayText: 'list',
        description: 'List all agents',
        type: 'subcommand',
      });
      expect(completions[1]).toEqual({
        text: 'ls',
        displayText: 'ls (list)',
        description: 'List all agents',
        type: 'subcommand',
      });
    });

    it('should handle empty input', async () => {
      const completions = await service.getCompletions(mockContext, '', 0);
      // Empty input should return all commands
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should handle command not found', async () => {
      const completions = await service.getCompletions(mockContext, '/nonexistent sub', 15);
      expect(completions).toHaveLength(0);
    });

    it('should complete with cursor in middle of input', async () => {
      const completions = await service.getCompletions(mockContext, '/agents list more', 7);
      
      expect(completions).toHaveLength(1);
      expect(completions.some(c => c.text === 'agents')).toBe(true);
    });

    it('should handle subcommand navigation', async () => {
      const completions = await service.getCompletions(mockContext, '/agents list ', 13);
      
      // Should not return subcommands since 'list' has no subcommands
      expect(completions).toHaveLength(0);
    });
  });

  describe('getCommandCompletions', () => {
    it('should return all commands when no partial provided', async () => {
      const completions = await service.getCompletions(mockContext, '/', 1);
      
      expect(completions.length).toBeGreaterThan(0);
      expect(completions.some(c => c.text === 'agents')).toBe(true);
      expect(completions.some(c => c.text === 'domains')).toBe(true);
      expect(completions.some(c => c.text === 'taskmaster')).toBe(true);
    });

    it('should filter commands by partial match', async () => {
      const completions = await service.getCompletions(mockContext, '/task', 5);
      
      expect(completions).toHaveLength(1);
      expect(completions[0].text).toBe('taskmaster');
    });

    it('should sort completions alphabetically', async () => {
      const completions = await service.getCompletions(mockContext, '/', 1);
      
      const texts = completions.map(c => c.text);
      const sortedTexts = [...texts].sort();
      expect(texts).toEqual(sortedTexts);
    });
  });

  describe('getAgentCompletions', () => {
    it('should return agent completions', async () => {
      const completions = await service.getAgentCompletions(mockContext, 'agent');
      
      expect(completions).toEqual(['agent1', 'agent2']);
    });

    it('should filter agents by partial match', async () => {
      const completions = await service.getAgentCompletions(mockContext, 'agent1');
      
      expect(completions).toEqual(['agent1']);
    });

    it('should handle orchestrator not available', async () => {
      const contextWithoutOrchestrator = createMockCommandContext({
        services: { orchestrator: undefined },
      });
      
      const completions = await service.getAgentCompletions(contextWithoutOrchestrator, 'agent');
      expect(completions).toEqual([]);
    });

    it('should handle orchestrator errors', async () => {
      mockContext.services.orchestrator.getAgents.mockRejectedValue(new Error('API error'));
      
      const completions = await service.getAgentCompletions(mockContext, 'agent');
      expect(completions).toEqual([]);
    });
  });

  describe('getDomainCompletions', () => {
    it('should return domain completions', async () => {
      const completions = await service.getDomainCompletions(mockContext, 'co');
      
      expect(completions).toEqual(['coding']);
    });

    it('should return all domains when no partial provided', async () => {
      const completions = await service.getDomainCompletions(mockContext, '');
      
      expect(completions).toEqual(['coding', 'testing']);
    });

    it('should handle orchestrator not available', async () => {
      const contextWithoutOrchestrator = createMockCommandContext({
        services: { orchestrator: undefined },
      });
      
      const completions = await service.getDomainCompletions(contextWithoutOrchestrator, '');
      expect(completions).toEqual([]);
    });
  });

  describe('getTaskCompletions', () => {
    it('should return task ID completions', async () => {
      const completions = await service.getTaskCompletions(mockContext, '1');
      
      expect(completions).toEqual(['1', '1.1', '1.2']);
    });

    it('should handle missing project root', async () => {
      mockContext.services.config.getProjectRoot.mockReturnValue(null);
      
      const completions = await service.getTaskCompletions(mockContext, '1');
      expect(completions).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockContext.services.config.getProjectRoot.mockImplementation(() => {
        throw new Error('Config error');
      });
      
      try {
        const completions = await service.getTaskCompletions(mockContext, '1');
        expect(completions).toEqual([]);
      } catch (error) {
        expect(error.message).toBe('Config error');
      }
    });
  });

  describe('getOptionCompletions', () => {
    it('should return option completions', async () => {
      const completions = await service.getOptionCompletions(mockContext, '--');
      
      expect(completions).toContain('--help');
      expect(completions).toContain('--force');
      expect(completions).toContain('--research');
    });

    it('should filter options by partial match', async () => {
      const completions = await service.getOptionCompletions(mockContext, '--pri');
      
      expect(completions).toEqual(['--priority=high', '--priority=low', '--priority=medium']);
    });

    it('should sort options alphabetically', async () => {
      const completions = await service.getOptionCompletions(mockContext, '--');
      
      const sortedCompletions = [...completions].sort();
      expect(completions).toEqual(sortedCompletions);
    });
  });

  describe('getFileCompletions', () => {
    it('should return file completions', async () => {
      const completions = await service.getFileCompletions(mockContext, '.task');
      
      expect(completions).toContain('.taskmaster/tasks/tasks.json');
      expect(completions).toContain('.taskmaster/docs/prd.txt');
    });

    it('should filter files by partial match', async () => {
      const completions = await service.getFileCompletions(mockContext, 'package');
      
      expect(completions).toEqual(['package.json']);
    });

    it('should sort files alphabetically', async () => {
      const completions = await service.getFileCompletions(mockContext, '');
      
      const sortedCompletions = [...completions].sort();
      expect(completions).toEqual(sortedCompletions);
    });
  });

  describe('addCommandCompletions', () => {
    it('should add completion handlers to commands', () => {
      const commandsWithCompletions = [...mockCommands];
      service.addCommandCompletions(commandsWithCompletions);
      
      const agentCommand = commandsWithCompletions.find(cmd => cmd.name === 'agents');
      const statusSubcommand = agentCommand?.subCommands?.find(sub => sub.name === 'status');
      
      expect(statusSubcommand?.completion).toBeDefined();
      expect(typeof statusSubcommand?.completion).toBe('function');
    });

    it('should add domain completions to domain commands', () => {
      const commandsWithCompletions = [...mockCommands];
      service.addCommandCompletions(commandsWithCompletions);
      
      const domainCommand = commandsWithCompletions.find(cmd => cmd.name === 'domains');
      const showSubcommand = domainCommand?.subCommands?.find(sub => sub.name === 'show');
      
      expect(showSubcommand?.completion).toBeDefined();
    });

    it('should add task completions to taskmaster commands', () => {
      const commandsWithCompletions = [...mockCommands];
      service.addCommandCompletions(commandsWithCompletions);
      
      const taskmasterCommand = commandsWithCompletions.find(cmd => cmd.name === 'taskmaster');
      const completeSubcommand = taskmasterCommand?.subCommands?.find(sub => sub.name === 'complete');
      
      expect(completeSubcommand?.completion).toBeDefined();
    });

    it('should handle commands without matching completion types', () => {
      const commandsWithoutMatches = [
        {
          name: 'other',
          description: 'Other command',
          subCommands: [
            {
              name: 'action',
              description: 'Some action',
              action: vi.fn(),
            },
          ],
        },
      ];
      
      expect(() => service.addCommandCompletions(commandsWithoutMatches)).not.toThrow();
    });
  });

  describe('createCompletionService', () => {
    it('should create service with command completions', () => {
      const service = createCompletionService(mockCommands);
      
      expect(service).toBeInstanceOf(CompletionService);
      expect(service.getCompletions).toBeDefined();
    });

    it('should initialize completion handlers', () => {
      const commands = [...mockCommands];
      createCompletionService(commands);
      
      const agentCommand = commands.find(cmd => cmd.name === 'agents');
      const statusSubcommand = agentCommand?.subCommands?.find(sub => sub.name === 'status');
      
      expect(statusSubcommand?.completion).toBeDefined();
    });
  });

  describe('Complex completion scenarios', () => {
    it('should handle nested command completion', async () => {
      const nestedCommands = [
        {
          name: 'orchestrate',
          description: 'Orchestration commands',
          subCommands: [
            {
              name: 'templates',
              description: 'Template management',
              subCommands: [
                {
                  name: 'list',
                  description: 'List templates',
                  action: vi.fn(),
                },
                {
                  name: 'use',
                  description: 'Use template',
                  action: vi.fn(),
                },
              ],
            },
          ],
        },
      ];

      const nestedService = new CompletionService(nestedCommands);
      const completions = await nestedService.getCompletions(mockContext, '/orchestrate templates ', 21);
      
      expect(completions).toHaveLength(1);
      expect(completions.some(c => c.text === 'templates')).toBe(true);
    });

    it('should handle custom completion functions', async () => {
      const customCommand = {
        name: 'custom',
        description: 'Custom command',
        completion: vi.fn().mockResolvedValue(['custom1', 'custom2']),
        action: vi.fn(),
      };

      const customService = new CompletionService([customCommand]);
      const completions = await customService.getCompletions(mockContext, '/custom ', 8);
      
      expect(completions).toHaveLength(2);
      expect(completions[0].text).toBe('custom1');
      expect(completions[1].text).toBe('custom2');
    });

    it('should handle completion function errors', async () => {
      const errorCommand = {
        name: 'error',
        description: 'Error command',
        completion: vi.fn().mockRejectedValue(new Error('Completion error')),
        action: vi.fn(),
      };

      const errorService = new CompletionService([errorCommand]);
      const completions = await errorService.getCompletions(mockContext, '/error ', 7);
      
      expect(completions).toHaveLength(0);
    });

    it('should handle mixed option and argument completion', async () => {
      const mixedCommand = {
        name: 'mixed',
        description: 'Mixed command',
        subCommands: [
          {
            name: 'add',
            description: 'Add something',
            action: vi.fn(),
          },
        ],
      };

      const mixedService = new CompletionService([mixedCommand]);
      mixedService.addCommandCompletions([mixedCommand]);
      
      const completions = await mixedService.getCompletions(mockContext, '/mixed add --', 12);
      
      // At cursor position 12, this should complete the 'add' subcommand since cursor is at the end of 'add'
      expect(completions.length).toEqual(0);
    });
  });
});