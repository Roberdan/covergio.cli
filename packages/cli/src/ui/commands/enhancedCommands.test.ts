/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { agentCommand } from './agentCommand.js';
import { domainsCommand } from './domainsCommand.js';
import { orchestrateCommand } from './orchestrateCommand.js';
import { taskmasterCommand } from './taskmasterCommand.js';
import { historyCommand } from './historyCommand.js';
import { CommandContext } from './types.js';

describe('Enhanced Commands', () => {
  let mockContext: CommandContext;
  let mockOrchestrator: any;
  let mockTaskmaster: any;
  let mockHistory: any;

  beforeEach(() => {
    mockOrchestrator = {
      getAgents: vi.fn(),
      getAgent: vi.fn(),
      startAgent: vi.fn(),
      stopAgent: vi.fn(),
      createAgent: vi.fn(),
      deleteAgent: vi.fn(),
      getAvailableDomains: vi.fn(),
      getDomain: vi.fn(),
      getAllCapabilities: vi.fn(),
      findMatchingDomains: vi.fn(),
      createDomain: vi.fn(),
      getDomainStats: vi.fn(),
      getAllDomainStats: vi.fn(),
      createCustomTeam: vi.fn(),
      executeWorkflow: vi.fn(),
      getExecution: vi.fn(),
      getStatus: vi.fn(),
      stopExecution: vi.fn(),
      stopAllExecutions: vi.fn(),
      getExecutionHistory: vi.fn(),
      optimizeWorkflow: vi.fn(),
      getTemplates: vi.fn(),
      useTemplate: vi.fn(),
      saveTemplate: vi.fn(),
    };

    mockTaskmaster = {
      getTask: vi.fn(),
    };

    mockHistory = {
      getHistory: vi.fn(),
      searchHistory: vi.fn(),
      getFavorites: vi.fn(),
      markAsFavorite: vi.fn(),
      removeFromFavorites: vi.fn(),
      clearHistory: vi.fn(),
      getStats: vi.fn(),
      exportHistory: vi.fn(),
    };

    mockContext = createMockCommandContext({
      services: {
        orchestrator: mockOrchestrator,
        taskmaster: mockTaskmaster,
        history: mockHistory,
        config: {
          getProjectRoot: vi.fn().mockReturnValue('/test/project'),
        },
      },
    });
  });

  describe('Agent Commands', () => {
    describe('list subcommand', () => {
      it('should list available agents', async () => {
        const mockAgents = [
          { id: 'agent1', type: 'coding', status: 'idle', capabilities: [{ name: 'code-review' }] },
          { id: 'agent2', type: 'testing', status: 'busy', capabilities: [{ name: 'test-generation' }] },
        ];
        mockOrchestrator.getAgents.mockResolvedValue(mockAgents);

        const listCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'list');
        expect(listCommand).toBeDefined();

        const result = await listCommand!.action(mockContext, '');
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('agent1');
        expect(result.content).toContain('agent2');
        expect(result.content).toContain('coding');
        expect(result.content).toContain('testing');
      });

      it('should handle empty agent list', async () => {
        mockOrchestrator.getAgents.mockResolvedValue([]);

        const listCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'list');
        const result = await listCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('No agents currently available');
      });

      it('should handle orchestrator errors', async () => {
        mockOrchestrator.getAgents.mockRejectedValue(new Error('Connection failed'));

        const listCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'list');
        
        await expect(async () => {
          await listCommand!.action(mockContext, '');
        }).rejects.toThrow('Connection failed');
      });
    });

    describe('status subcommand', () => {
      it('should show agent status', async () => {
        const mockAgent = {
          id: 'agent1',
          type: 'coding',
          status: 'idle',
          capabilities: [{ name: 'code-review' }],
          currentTask: null,
          performance: { successRate: 0.95, averageResponseTime: 1500 },
        };
        mockOrchestrator.getAgent.mockResolvedValue(mockAgent);

        const statusCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, 'agent1');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('agent1');
        expect(result.content).toContain('idle');
        expect(result.content).toContain('95.0%');
      });

      it('should handle agent not found', async () => {
        mockOrchestrator.getAgent.mockResolvedValue(null);

        const statusCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, 'nonexistent');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('not found');
      });
    });

    describe('start subcommand', () => {
      it('should start an agent', async () => {
        mockOrchestrator.startAgent.mockResolvedValue(true);

        const startCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'start');
        const result = await startCommand!.action(mockContext, 'agent1');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('success');
        expect(result.content).toContain('started successfully');
        expect(mockOrchestrator.startAgent).toHaveBeenCalledWith('agent1');
      });

      it('should handle missing agent ID', async () => {
        const startCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'start');
        const result = await startCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });

    describe('create subcommand', () => {
      it('should create a new agent', async () => {
        const mockAgent = { id: 'new-agent', type: 'analysis', status: 'idle' };
        mockOrchestrator.createAgent.mockResolvedValue(mockAgent);

        const createCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'create');
        const result = await createCommand!.action(mockContext, 'new-agent analysis --capabilities=data-analysis');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('success');
        expect(result.content).toContain('created successfully');
        expect(mockOrchestrator.createAgent).toHaveBeenCalled();
      });

      it('should handle missing parameters', async () => {
        const createCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'create');
        const result = await createCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });
  });

  describe('Domain Commands', () => {
    describe('list subcommand', () => {
      it('should list available domains', async () => {
        const mockDomains = [
          {
            name: 'coding',
            description: 'Code development and analysis',
            agents: [{ id: 'agent1' }],
            capabilities: [{ name: 'code-review' }],
            status: 'active',
          },
          {
            name: 'testing',
            description: 'Test generation and execution',
            agents: [{ id: 'agent2' }],
            capabilities: [{ name: 'test-generation' }],
            status: 'active',
          },
        ];
        mockOrchestrator.getAvailableDomains.mockResolvedValue(mockDomains);

        const listCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'list');
        const result = await listCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('coding');
        expect(result.content).toContain('testing');
        expect(result.content).toContain('Code development');
      });

      it('should handle empty domain list', async () => {
        mockOrchestrator.getAvailableDomains.mockResolvedValue([]);

        const listCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'list');
        const result = await listCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('No domains currently available');
      });
    });

    describe('show subcommand', () => {
      it('should show domain details', async () => {
        const mockDomain = {
          name: 'coding',
          description: 'Code development and analysis',
          status: 'active',
          version: '1.0.0',
          capabilities: [
            {
              name: 'code-review',
              description: 'Review code for quality',
              supportedOperations: ['analyze', 'suggest'],
              performance: { latency: 1000, accuracy: 0.95 },
            },
          ],
          agents: [{ id: 'agent1', type: 'coding', status: 'idle' }],
          performance: { successRate: 0.98, averageResponseTime: 1200, tasksCompleted: 150 },
        };
        mockOrchestrator.getDomain.mockResolvedValue(mockDomain);

        const showCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, 'coding');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('coding');
        expect(result.content).toContain('code-review');
        expect(result.content).toContain('98.0%');
        expect(result.content).toContain('agent1');
      });

      it('should handle domain not found', async () => {
        mockOrchestrator.getDomain.mockResolvedValue(null);

        const showCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, 'nonexistent');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('not found');
      });
    });

    describe('match subcommand', () => {
      it('should find matching domains', async () => {
        const mockMatches = [
          {
            domain: { name: 'coding', description: 'Code development' },
            confidence: 0.85,
            matchingCapabilities: ['code-review', 'refactoring'],
            reason: 'Strong match for code-related tasks',
          },
        ];
        mockOrchestrator.findMatchingDomains.mockResolvedValue(mockMatches);

        const matchCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'match');
        const result = await matchCommand!.action(mockContext, 'code analysis');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('coding');
        expect(result.content).toContain('85.0%');
        expect(result.content).toContain('code-review');
      });

      it('should handle no matches', async () => {
        mockOrchestrator.findMatchingDomains.mockResolvedValue([]);

        const matchCommand = domainsCommand.subCommands?.find(cmd => cmd.name === 'match');
        const result = await matchCommand!.action(mockContext, 'nonexistent capability');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('No domains found');
      });
    });
  });

  describe('Orchestration Commands', () => {
    describe('team subcommand', () => {
      it('should create a custom team', async () => {
        const mockTeam = {
          id: 'team-123',
          members: [
            { id: 'agent1', type: 'coding', capabilities: [{ name: 'code-review' }] },
            { id: 'agent2', type: 'testing', capabilities: [{ name: 'test-generation' }] },
          ],
          collaborationPattern: 'sequential',
        };
        mockOrchestrator.createCustomTeam.mockResolvedValue(mockTeam);

        const teamCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'team');
        const result = await teamCommand!.action(mockContext, 'domain:coding domain:testing');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('success');
        expect(result.content).toContain('team-123');
        expect(result.content).toContain('agent1');
        expect(result.content).toContain('agent2');
        expect(result.content).toContain('sequential');
      });

      it('should handle missing team parameters', async () => {
        const teamCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'team');
        const result = await teamCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });

    describe('execute subcommand', () => {
      it('should execute a workflow', async () => {
        const mockExecution = {
          id: 'exec-123',
          pattern: 'sequential',
          status: 'running',
          estimatedDuration: 30000,
        };
        mockOrchestrator.executeWorkflow.mockResolvedValue(mockExecution);

        const executeCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'execute');
        const result = await executeCommand!.action(mockContext, 'analyze codebase --pattern=sequential');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('success');
        expect(result.content).toContain('exec-123');
        expect(result.content).toContain('sequential');
        expect(result.content).toContain('running');
      });

      it('should handle missing task description', async () => {
        const executeCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'execute');
        const result = await executeCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });

    describe('status subcommand', () => {
      it('should show orchestration status', async () => {
        const mockStatus = {
          activeTeam: { id: 'team-123' },
          activeAgents: 2,
          totalAgents: 5,
          queueLength: 3,
          activeExecutions: [],
          recentExecutions: [],
          successRate: 0.92,
          averageExecutionTime: 15000,
          totalExecutions: 50,
        };
        mockOrchestrator.getStatus.mockResolvedValue(mockStatus);

        const statusCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('team-123');
        expect(result.content).toContain('2/5');
        expect(result.content).toContain('92.0%');
      });

      it('should show specific execution status', async () => {
        const mockExecution = {
          id: 'exec-123',
          status: 'running',
          completedSteps: 3,
          totalSteps: 5,
          startTime: new Date('2025-01-01T10:00:00Z'),
          pattern: 'sequential',
          priority: 'medium',
          steps: [
            { name: 'Step 1', status: 'completed', duration: 1000 },
            { name: 'Step 2', status: 'running' },
          ],
        };
        mockOrchestrator.getExecution.mockResolvedValue(mockExecution);

        const statusCommand = orchestrateCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, 'exec-123');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('exec-123');
        expect(result.content).toContain('running');
        expect(result.content).toContain('60%');
        expect(result.content).toContain('Step 1');
      });
    });
  });

  describe('TaskMaster Commands', () => {
    describe('status subcommand', () => {
      it('should show task status', async () => {
        const statusCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, '');
        
        expect(result.type).toBe('tool');
        expect(result.toolName).toBe('mcp__task-master-ai__get_tasks');
        expect(result.toolArgs).toEqual({
          projectRoot: '/test/project',
          withSubtasks: true,
        });
      });

      it('should handle missing project root', async () => {
        mockContext.services.config!.getProjectRoot = vi.fn().mockReturnValue(null);

        const statusCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'status');
        const result = await statusCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Project root not configured');
      });
    });

    describe('show subcommand', () => {
      it('should show task details', async () => {
        const showCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, '1.2');
        
        expect(result.type).toBe('tool');
        expect(result.toolName).toBe('mcp__task-master-ai__get_task');
        expect(result.toolArgs).toEqual({
          id: '1.2',
          projectRoot: '/test/project',
        });
      });

      it('should handle missing task ID', async () => {
        const showCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });

    describe('complete subcommand', () => {
      it('should mark task as complete', async () => {
        const completeCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'complete');
        const result = await completeCommand!.action(mockContext, '1.2');
        
        expect(result.type).toBe('tool');
        expect(result.toolName).toBe('mcp__task-master-ai__set_task_status');
        expect(result.toolArgs).toEqual({
          id: '1.2',
          status: 'done',
          projectRoot: '/test/project',
        });
      });
    });

    describe('assign subcommand', () => {
      it('should assign task to agent', async () => {
        const mockTask = { id: '1.2', title: 'Test task' };
        const mockAgent = { id: 'agent1', type: 'coding' };
        mockTaskmaster.getTask.mockResolvedValue(mockTask);
        mockOrchestrator.getAgent.mockResolvedValue(mockAgent);

        const assignCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'assign');
        const result = await assignCommand!.action(mockContext, '1.2 agent1');
        
        expect(result.type).toBe('tool');
        expect(result.toolName).toBe('mcp__task-master-ai__update_task');
        expect(result.toolArgs.id).toBe('1.2');
        expect(result.toolArgs.prompt).toContain('agent1');
      });

      it('should handle missing parameters', async () => {
        const assignCommand = taskmasterCommand.subCommands?.find(cmd => cmd.name === 'assign');
        const result = await assignCommand!.action(mockContext, '1.2');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('error');
        expect(result.content).toContain('Usage:');
      });
    });
  });

  describe('History Commands', () => {
    describe('show subcommand', () => {
      it('should show command history', async () => {
        const mockHistoryData = [
          {
            id: '1',
            command: '/agents list',
            timestamp: Date.now() - 3600000,
            success: true,
            duration: 1500,
            favorite: false,
          },
          {
            id: '2',
            command: '/taskmaster status',
            timestamp: Date.now() - 1800000,
            success: true,
            duration: 800,
            favorite: true,
          },
        ];
        mockHistory.getHistory.mockResolvedValue(mockHistoryData);

        const showCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('/agents list');
        expect(result.content).toContain('/taskmaster status');
        expect(result.content).toContain('✅');
        expect(result.content).toContain('⭐');
      });

      it('should handle empty history', async () => {
        mockHistory.getHistory.mockResolvedValue([]);

        const showCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'show');
        const result = await showCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('No command history available');
      });
    });

    describe('search subcommand', () => {
      it('should search command history', async () => {
        const mockResults = [
          {
            id: '1',
            command: '/agents list',
            timestamp: Date.now() - 3600000,
            success: true,
            duration: 1500,
            favorite: false,
          },
        ];
        mockHistory.searchHistory.mockResolvedValue(mockResults);

        const searchCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'search');
        const result = await searchCommand!.action(mockContext, 'agents');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('/agents list');
        expect(result.content).toContain('agents');
      });

      it('should handle no search results', async () => {
        mockHistory.searchHistory.mockResolvedValue([]);

        const searchCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'search');
        const result = await searchCommand!.action(mockContext, 'nonexistent');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('No commands found');
      });
    });

    describe('favorite subcommand', () => {
      it('should mark command as favorite', async () => {
        const mockCommand = {
          id: '1',
          command: '/agents list',
          timestamp: Date.now(),
          success: true,
        };
        mockHistory.getHistory.mockResolvedValue([mockCommand]);
        mockHistory.markAsFavorite.mockResolvedValue(true);

        const favoriteCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'favorite');
        const result = await favoriteCommand!.action(mockContext, '1');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('success');
        expect(result.content).toContain('marked as favorite');
        expect(mockHistory.markAsFavorite).toHaveBeenCalledWith('1');
      });

      it('should show favorites when no argument provided', async () => {
        const mockFavorites = [
          {
            id: '1',
            command: '/agents list',
            timestamp: Date.now(),
            success: true,
            useCount: 5,
          },
        ];
        mockHistory.getFavorites.mockResolvedValue(mockFavorites);

        const favoriteCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'favorite');
        const result = await favoriteCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('/agents list');
        expect(result.content).toContain('Used 5 times');
      });
    });

    describe('stats subcommand', () => {
      it('should show command statistics', async () => {
        const mockStats = {
          totalCommands: 100,
          uniqueCommands: 25,
          successRate: 0.95,
          averageDuration: 1200,
          favoritesCount: 10,
          topCommands: [
            { command: '/agents list', count: 15 },
            { command: '/taskmaster status', count: 12 },
          ],
          recentActivity: [
            { date: '2025-01-01', count: 5 },
            { date: '2025-01-02', count: 8 },
          ],
          totalSessionTime: 3600000,
          mostActiveHour: 14,
        };
        mockHistory.getStats.mockResolvedValue(mockStats);

        const statsCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'stats');
        const result = await statsCommand!.action(mockContext, '');
        
        expect(result.type).toBe('message');
        expect(result.messageType).toBe('info');
        expect(result.content).toContain('100');
        expect(result.content).toContain('95.0%');
        expect(result.content).toContain('/agents list');
        expect(result.content).toContain('60m');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing orchestrator service', async () => {
      const contextWithoutOrchestrator = createMockCommandContext({
        services: {
          orchestrator: undefined,
          config: {
            getProjectRoot: vi.fn().mockReturnValue('/test/project'),
          },
        },
      });

      const listCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'list');
      const result = await listCommand!.action(contextWithoutOrchestrator, '');
      
      expect(result.type).toBe('message');
      expect(result.messageType).toBe('error');
      expect(result.content).toContain('not initialized');
    });

    it('should handle missing history service', async () => {
      const contextWithoutHistory = createMockCommandContext({
        services: {
          history: undefined,
          config: {
            getProjectRoot: vi.fn().mockReturnValue('/test/project'),
          },
        },
      });

      const showCommand = historyCommand.subCommands?.find(cmd => cmd.name === 'show');
      const result = await showCommand!.action(contextWithoutHistory, '');
      
      expect(result.type).toBe('message');
      expect(result.messageType).toBe('error');
      expect(result.content).toContain('not available');
    });

    it('should handle API errors gracefully', async () => {
      mockOrchestrator.getAgents.mockRejectedValue(new Error('API timeout'));

      const listCommand = agentCommand.subCommands?.find(cmd => cmd.name === 'list');
      
      await expect(async () => {
        await listCommand!.action(mockContext, '');
      }).rejects.toThrow('API timeout');
    });
  });
});